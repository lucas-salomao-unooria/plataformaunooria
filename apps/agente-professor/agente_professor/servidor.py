"""O contrato de runtime do Agent Engine para container customizado — e o shim local.

É um servidor só, com duas portas de uso:

- **imagem do Agent Engine** (`Dockerfile`): escuta em `0.0.0.0:$PORT` (8080), com o
  `VertexAiSessionService` do engine;
- **shim local** (`agente_professor.shim`): o MESMO app em `:8090`, com sessões em
  memória. É o que a api usa em `AGENTE_PROFESSOR_MODO=local` — um cliente só na api.

O contrato (documentação "Runtime contract" do Agent Platform):

    POST /api/reasoning_engine          {"class_method": "...", "input": {...}}
      → 200 {"output": <retorno do método>}
    POST /api/stream_reasoning_engine   {"class_method": "...", "input": {...}}
      → 200 application/json, uma linha JSON por item (NDJSON)

Cada linha do stream de `async_stream_query` é um `Event` do ADK como o AdkApp o
serializa (`model_dump_json(exclude_none=True)`, snake_case). O `:streamQuery?alt=sse`
do engine de verdade pode embrulhar as linhas em `data: `; o shim devolve NDJSON puro,
e o parser da api aceita os dois (`docs/regras/agente-professor.md`).

Só os métodos que o `AdkApp.register_operations()` declara são chamáveis: `getattr`
livre expunha `set_up`, `clone` e o resto do objeto.
"""

from __future__ import annotations

import inspect
import json
import logging
import os
from collections.abc import AsyncIterator, Iterator
from typing import Any

from fastapi import FastAPI, Request, encoders, responses
from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)

_MODOS_UNARIOS = ("", "async")
_MODOS_DE_STREAM = ("stream", "async_stream")


class Pedido(BaseModel):
    class_method: str
    input: dict[str, Any] | None = None


async def ler_pedido(requisicao: Request) -> Pedido:
    """O corpo `{class_method, input}`, lido sem depender do `Content-Type`.

    O Agent Engine repassa o `:query`/`:streamQuery` ao container sem
    `Content-Type: application/json` — o FastAPI então não decodifica e a validação
    recebe o corpo como TEXTO: 400 "Input should be a valid dictionary" na primeira
    sessão em dev (2026-10-01), com o shim local passando liso. Decodifica aqui, e
    aceita também o JSON codificado duas vezes (uma string JSON contendo o objeto).
    """
    dados: Any = json.loads(await requisicao.body() or b"{}")
    if isinstance(dados, str):
        dados = json.loads(dados)
    return Pedido.model_validate(dados)


def serializar(valor: Any) -> Any:
    """Como o AdkApp serializa sessão: `model_dump(mode="json")`, snake_case.

    O `jsonable_encoder` do FastAPI usaria os ALIASES (camelCase) dos modelos do ADK, e
    a api leria `lastUpdateTime` no shim e `last_update_time` no engine.
    """
    if isinstance(valor, BaseModel):
        return valor.model_dump(mode="json")
    if isinstance(valor, dict):
        return {k: serializar(v) for k, v in valor.items()}
    if isinstance(valor, list | tuple):
        return [serializar(v) for v in valor]
    return encoders.jsonable_encoder(valor)


def _linha(item: Any) -> str:
    return json.dumps(serializar(item)) + "\n"


def _status_do_erro(erro: Exception) -> int:
    texto = str(erro).lower()
    if "not found" in texto:
        return 404
    if "does not belong" in texto:
        return 403
    if isinstance(erro, TypeError | ValueError):
        return 400
    return 500


def _erro(status: int, erro: Exception | str) -> responses.JSONResponse:
    mensagem = erro if isinstance(erro, str) else f"{type(erro).__name__}: {erro}"
    return responses.JSONResponse(
        status_code=status, content={"error": {"code": status, "message": mensagem}}
    )


def criar_servidor(adk_app: Any) -> FastAPI:
    """O app FastAPI do contrato de runtime, em volta de um `AdkApp` já construído."""
    operacoes: dict[str, list[str]] = adk_app.register_operations()
    unarios = {m for modo in _MODOS_UNARIOS for m in operacoes.get(modo, [])}
    de_stream = {m for modo in _MODOS_DE_STREAM for m in operacoes.get(modo, [])}

    servidor = FastAPI(title="agente-professor", docs_url=None, redoc_url=None)

    @servidor.get("/healthz")
    async def saude() -> dict[str, str]:
        return {"status": "ok"}

    @servidor.post("/api/reasoning_engine")
    async def consulta(requisicao: Request) -> responses.JSONResponse:
        try:
            pedido = await ler_pedido(requisicao)
        except (ValueError, ValidationError) as erro:
            return _erro(400, erro)
        if pedido.class_method not in unarios:
            return _erro(400, f"Method {pedido.class_method} not found on agent")
        metodo = getattr(adk_app, pedido.class_method)
        try:
            saida = metodo(**(pedido.input or {}))
            if inspect.isawaitable(saida):
                saida = await saida
        except Exception as erro:
            logger.warning("%s falhou (%s)", pedido.class_method, type(erro).__name__)
            return _erro(_status_do_erro(erro), erro)
        return responses.JSONResponse(content={"output": serializar(saida)})

    @servidor.post("/api/stream_reasoning_engine", response_model=None)
    async def consulta_em_stream(
        requisicao: Request,
    ) -> responses.StreamingResponse | responses.JSONResponse:
        try:
            pedido = await ler_pedido(requisicao)
        except (ValueError, ValidationError) as erro:
            return _erro(400, erro)
        if pedido.class_method not in de_stream:
            return _erro(400, f"Method {pedido.class_method} not found on agent")
        metodo = getattr(adk_app, pedido.class_method)
        try:
            saida = metodo(**(pedido.input or {}))
        except Exception as erro:
            return _erro(_status_do_erro(erro), erro)

        if hasattr(saida, "__aiter__"):
            iterador: AsyncIterator[Any] = saida.__aiter__()
        else:
            iterador = _assincrono(iter(saida))

        # O 1º item é lido ANTES de responder: erro de entrada (sessão inexistente,
        # `run_config` inválido) vira HTTP 4xx/5xx, e não um 200 com stream vazio.
        try:
            primeiro = await iterador.__anext__()
        except StopAsyncIteration:
            return responses.StreamingResponse(content=iter(()), media_type="application/json")
        except Exception as erro:
            logger.warning("%s falhou (%s)", pedido.class_method, type(erro).__name__)
            return _erro(_status_do_erro(erro), erro)

        async def linhas() -> AsyncIterator[str]:
            ja_avisou = _tem_erro(primeiro)
            yield _linha(primeiro)
            try:
                async for item in iterador:
                    ja_avisou = ja_avisou or _tem_erro(item)
                    yield _linha(item)
            except Exception as erro:
                # O ADK emite um evento com `error_code` e DEPOIS propaga a exceção. Se o
                # evento já saiu, o stream fecha limpo e a api lê o erro nele; se não,
                # a conexão é cortada (stream sem evento final = AGENTE_INDISPONIVEL).
                logger.error("stream interrompido (%s)", type(erro).__name__)
                if not ja_avisou:
                    raise

        return responses.StreamingResponse(content=linhas(), media_type="application/json")

    return servidor


def _tem_erro(item: Any) -> bool:
    return isinstance(item, dict) and bool(item.get("error_code"))


async def _assincrono(iterador: Iterator[Any]) -> AsyncIterator[Any]:
    for item in iterador:
        yield item


def principal(porta_padrao: int = 8080) -> None:
    """Sobe o servidor: `$PORT` (o Agent Engine define) ou a porta padrão."""
    import uvicorn

    from .app_engine import adk_app

    logging.basicConfig(level=os.environ.get("AGENTE_LOG", "INFO"))
    porta = int(os.environ.get("PORT", porta_padrao))
    uvicorn.run(criar_servidor(adk_app), host="0.0.0.0", port=porta)  # noqa: S104


if __name__ == "__main__":
    principal()
