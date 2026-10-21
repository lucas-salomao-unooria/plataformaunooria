"""Fakes sem rede: um LLM roteirizado e um Discovery Engine em memória."""

from __future__ import annotations

import json
import re
from collections.abc import AsyncGenerator, Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from google.adk.models import BaseLlm, LlmCapabilities
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from google.adk.utils.streaming_utils import StreamingResponseAggregator
from google.genai import types
from pydantic import Field

# --------------------------------------------------------------------- LLM


@dataclass
class Texto:
    texto: str
    pedacos: int = 3
    tokens: int = 50


@dataclass
class ChamadaDeFerramenta:
    nome: str
    args: dict[str, Any]
    tokens: int = 30


Passo = Texto | ChamadaDeFerramenta | Exception | Callable[[LlmRequest], "Passo"]


def _uso(tokens: int) -> types.GenerateContentResponseUsageMetadata:
    return types.GenerateContentResponseUsageMetadata(
        prompt_token_count=tokens // 2,
        candidates_token_count=tokens - tokens // 2,
        total_token_count=tokens,
    )


def _resposta(
    parts: list[types.Part], tokens: int | None, fim: bool
) -> types.GenerateContentResponse:
    return types.GenerateContentResponse(
        candidates=[
            types.Candidate(
                content=types.Content(role="model", parts=parts),
                finish_reason=types.FinishReason.STOP if fim else None,
            )
        ],
        usage_metadata=_uso(tokens) if tokens else None,
    )


class LlmRoteirizado(BaseLlm):
    """Cada chamada consome o próximo passo do roteiro.

    Em `stream=True` o texto sai em pedaços pelo MESMO `StreamingResponseAggregator`
    que o `Gemini` usa: parciais e, no fim, o evento agregado — o formato real do SSE.
    """

    model: str = "gemini-fake"
    roteiro: list[Any] = Field(default_factory=list)
    pedidos: list[LlmRequest] = Field(default_factory=list)

    @property
    def capabilities(self) -> LlmCapabilities:
        return LlmCapabilities(output_schema_and_tools=True)

    async def generate_content_async(
        self, llm_request: LlmRequest, stream: bool = False
    ) -> AsyncGenerator[LlmResponse, None]:
        self.pedidos.append(llm_request)
        if not self.roteiro:
            raise AssertionError("roteiro do LLM fake acabou")
        passo = self.roteiro.pop(0)
        if callable(passo) and not isinstance(passo, Exception):
            passo = passo(llm_request)
        if isinstance(passo, Exception):
            raise passo

        if isinstance(passo, ChamadaDeFerramenta):
            parte = types.Part(
                function_call=types.FunctionCall(name=passo.nome, args=passo.args, id="fc-1")
            )
            respostas = [_resposta([parte], passo.tokens, fim=True)]
        else:
            assert isinstance(passo, Texto)
            n = max(1, passo.pedacos)
            tamanho = -(-len(passo.texto) // n)
            fatias = [passo.texto[i : i + tamanho] for i in range(0, len(passo.texto), tamanho)]
            respostas = [
                _resposta(
                    [types.Part(text=f)],
                    passo.tokens if i == len(fatias) - 1 else None,
                    fim=i == len(fatias) - 1,
                )
                for i, f in enumerate(fatias)
            ]

        if not stream:
            partes: list[types.Part] = []
            for r in respostas:
                partes.extend(r.candidates[0].content.parts)  # type: ignore[index,union-attr,arg-type]
            texto = "".join(p.text for p in partes if p.text)
            final = [types.Part(text=texto)] if texto else partes
            yield LlmResponse.create(
                _resposta(
                    final,
                    respostas[-1].usage_metadata and respostas[-1].usage_metadata.total_token_count,
                    fim=True,
                )
            )
            return

        agregador = StreamingResponseAggregator()
        for r in respostas:
            async for resposta in agregador.process_response(r):
                yield resposta
        fechamento = agregador.close()
        if fechamento is not None:
            yield fechamento


def llm_json(valor: dict[str, Any] | str, tokens: int = 12) -> LlmRoteirizado:
    """Um LLM que sempre responde o mesmo texto (guarda de escopo, título)."""
    texto = valor if isinstance(valor, str) else json.dumps(valor)
    return LlmRoteirizado(roteiro=[Texto(texto, pedacos=1, tokens=tokens) for _ in range(50)])


# --------------------------------------------------------- Discovery Engine

_CLAUSULA = re.compile(r'(\w+): ANY\(((?:"(?:[^"\\]|\\.)*"(?:, )?)+)\)')


def interpretar_filtro(filtro: str) -> dict[str, set[str]]:
    clausulas: dict[str, set[str]] = {}
    for campo, valores in _CLAUSULA.findall(filtro or ""):
        clausulas[campo] = set(json.loads(f"[{valores}]"))
    resto = _CLAUSULA.sub("", filtro or "").replace("AND", "").strip()
    assert not resto, f"filtro com sintaxe inesperada: {filtro!r}"
    return clausulas


def _casa(dados: dict[str, Any], clausulas: dict[str, set[str]]) -> bool:
    for campo, aceitos in clausulas.items():
        valor = dados.get(campo)
        valores = set(valor) if isinstance(valor, list) else {valor}
        if not valores & aceitos:
            return False
    return True


class DiscoveryEngineFalso:
    """Implementa o `ClienteBusca` com a semântica que as ferramentas usam.

    Habilidades: `structData` por documento, filtro `ANY`, query vazia = navegação
    paginada. Texto: casa palavras na descrição (uma aproximação de relevância).
    Acervo: trechos com `pageSpan`.
    """

    def __init__(
        self,
        habilidades: list[dict[str, Any]] | None = None,
        trechos: list[dict[str, Any]] | None = None,
        tamanho_real_da_pagina: int = 100,
    ) -> None:
        self.habilidades = habilidades or []
        self.trechos = trechos or []
        self.tamanho_real_da_pagina = tamanho_real_da_pagina
        self.chamadas: list[tuple[str, dict[str, Any]]] = []
        self.falhar_com: Exception | None = None

    async def buscar(self, datastore: str, corpo: dict[str, Any]) -> dict[str, Any]:
        self.chamadas.append((datastore, json.loads(json.dumps(corpo))))
        if self.falhar_com:
            raise self.falhar_com
        clausulas = interpretar_filtro(corpo.get("filter", ""))
        if corpo.get("contentSearchSpec", {}).get("searchResultMode") == "CHUNKS":
            achados = [
                t for t in self.trechos if _casa(t["documentMetadata"]["structData"], clausulas)
            ]
            palavras = _palavras(corpo.get("query", ""))
            achados = [t for t in achados if palavras & _palavras(t["content"])]
            return {"results": [{"chunk": t} for t in achados[: corpo.get("pageSize", 10)]]}

        candidatos = [h for h in self.habilidades if _casa(h, clausulas)]
        consulta = corpo.get("query", "")
        if consulta:
            palavras = _palavras(consulta)
            pontos = [
                (
                    len(
                        palavras
                        & _palavras(h["descricao"] + " " + (h.get("objeto_conhecimento") or ""))
                    ),
                    h,
                )
                for h in candidatos
            ]
            candidatos = [h for p, h in sorted(pontos, key=lambda x: -x[0]) if p > 0]
        pagina = min(int(corpo.get("pageSize", 10)), self.tamanho_real_da_pagina)
        inicio = int(corpo.get("pageToken") or 0)
        fatia = candidatos[inicio : inicio + pagina]
        resposta: dict[str, Any] = {
            "results": [
                {"id": h["codigo"], "document": {"id": h["codigo"], "structData": h}} for h in fatia
            ],
            "totalSize": len(candidatos),
        }
        if inicio + pagina < len(candidatos):
            resposta["nextPageToken"] = str(inicio + pagina)
        return resposta


def _palavras(texto: str) -> set[str]:
    from agente_professor.curriculo import slug

    return {p for p in slug(texto).split("-") if len(p) > 3}


def carregar_jsonl(caminho: Path) -> list[dict[str, Any]]:
    return [
        json.loads(linha) for linha in caminho.read_text(encoding="utf-8").splitlines() if linha
    ]


class LlmAuxiliar(BaseLlm):
    """O modelo barato: responde a guarda de escopo e o título pela instrução recebida."""

    model: str = "gemini-fake-lite"
    dentro: bool | None = True  # None = JSON inválido
    falhar_guarda: bool = False
    titulo: str = "Habilidades de Matemática do 6º ano."
    tokens: int = 7
    chamadas: list[str] = Field(default_factory=list)

    @property
    def capabilities(self) -> LlmCapabilities:
        return LlmCapabilities(output_schema_and_tools=True)

    async def generate_content_async(
        self, llm_request: LlmRequest, stream: bool = False
    ) -> AsyncGenerator[LlmResponse, None]:
        instrucao = str(llm_request.config.system_instruction or "")
        if "classifica" in instrucao:
            self.chamadas.append("guarda")
            if self.falhar_guarda:
                raise RuntimeError("classificador fora do ar")
            texto = (
                "isto não é json"
                if self.dentro is None
                else json.dumps({"dentro_do_escopo": self.dentro})
            )
        else:
            self.chamadas.append("titulo")
            texto = self.titulo
        yield LlmResponse.create(_resposta([types.Part(text=texto)], self.tokens, fim=True))
