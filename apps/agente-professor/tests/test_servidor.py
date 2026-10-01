"""O shim fala o contrato de runtime do Agent Engine, byte a byte o que a api espera."""

from __future__ import annotations

import json
from typing import Any

import httpx

from agente_professor.agente import criar_app
from agente_professor.fabrica import criar_adk_app
from agente_professor.servidor import criar_servidor
from fakes import ChamadaDeFerramenta, DiscoveryEngineFalso, LlmAuxiliar, LlmRoteirizado, Texto


def _cliente(principal: LlmRoteirizado, auxiliar: LlmAuxiliar | None = None) -> httpx.AsyncClient:
    app = criar_adk_app(criar_app(modelo=principal, modelo_escopo=auxiliar or LlmAuxiliar()))
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=criar_servidor(app)), base_url="http://shim"
    )


async def _query(cliente: httpx.AsyncClient, metodo: str, **entrada: Any) -> httpx.Response:
    return await cliente.post(
        "/api/reasoning_engine", json={"class_method": metodo, "input": entrada}
    )


async def test_ciclo_de_sessao_pelo_query(busca: DiscoveryEngineFalso) -> None:
    async with _cliente(LlmRoteirizado(roteiro=[])) as cliente:
        criada = await _query(
            cliente,
            "async_create_session",
            user_id="u-1",
            state={"nome_professor": "Ana"},
            expire_time="2036-09-30T00:00:00Z",
        )
        assert criada.status_code == 200
        sessao = criada.json()["output"]
        assert set(sessao) >= {"id", "app_name", "user_id", "state", "events", "last_update_time"}
        assert sessao["state"] == {"nome_professor": "Ana"}

        lida = (
            await _query(cliente, "async_get_session", user_id="u-1", session_id=sessao["id"])
        ).json()["output"]
        assert lida["id"] == sessao["id"]
        assert "last_update_time" in lida  # snake_case, como no engine (não `lastUpdateTime`)

        lista = (await _query(cliente, "async_list_sessions", user_id="u-1")).json()["output"]
        assert [s["id"] for s in lista["sessions"]] == [sessao["id"]]

        apagada = await _query(
            cliente, "async_delete_session", user_id="u-1", session_id=sessao["id"]
        )
        assert apagada.json() == {"output": None}
        sumida = await _query(cliente, "async_get_session", user_id="u-1", session_id=sessao["id"])
        assert sumida.status_code == 404


async def test_metodo_fora_das_operacoes_registradas_e_recusado(
    busca: DiscoveryEngineFalso,
) -> None:
    async with _cliente(LlmRoteirizado(roteiro=[])) as cliente:
        for metodo in ("set_up", "clone", "_tmpl_attrs"):
            resposta = await _query(cliente, metodo)
            assert resposta.status_code == 400
        resposta = await cliente.post(
            "/api/stream_reasoning_engine",
            json={"class_method": "async_create_session", "input": {}},
        )
        assert resposta.status_code == 400


async def test_stream_query_responde_ndjson_com_eventos_do_adk(busca: DiscoveryEngineFalso) -> None:
    principal = LlmRoteirizado(
        roteiro=[
            ChamadaDeFerramenta("buscar_habilidades", {"codigos": ["EF06MA01"]}),
            Texto("A **EF06MA01** trata de números.", pedacos=2),
        ]
    )
    async with _cliente(principal) as cliente:
        sessao = (await _query(cliente, "async_create_session", user_id="u-1")).json()["output"]
        resposta = await cliente.post(
            "/api/stream_reasoning_engine",
            json={
                "class_method": "async_stream_query",
                "input": {
                    "user_id": "u-1",
                    "session_id": sessao["id"],
                    "message": "Me explica a EF06MA01",
                    "run_config": {"streaming_mode": "sse"},
                },
            },
        )
    assert resposta.status_code == 200
    assert resposta.headers["content-type"].startswith("application/json")
    corpo = resposta.text
    assert corpo.endswith("\n")
    eventos = [json.loads(linha) for linha in corpo.splitlines()]
    assert all("author" in e and "invocation_id" in e for e in eventos)
    partes = [p for e in eventos for p in (e.get("content") or {}).get("parts", [])]
    assert any("function_call" in p for p in partes)
    assert any("function_response" in p for p in partes)
    finais = [
        e
        for e in eventos
        if not e.get("partial") and (e.get("content") or {}).get("parts", [{}])[0].get("text")
    ]
    assert finais[-1]["content"]["parts"][0]["text"] == "A **EF06MA01** trata de números."
    assert eventos[-1]["actions"]["state_delta"]["titulo_conversa"]
    # snake_case e sem nulos, como o AdkApp serializa (`model_dump_json(exclude_none=True)`).
    assert "usage_metadata" in finais[-1] and "usageMetadata" not in finais[-1]
    assert all(v is not None for e in eventos for v in e.values())


async def test_falha_do_modelo_vira_evento_com_error_code_e_o_stream_termina(
    busca: DiscoveryEngineFalso,
) -> None:
    from google.genai import errors

    indisponivel = errors.APIError(
        503, {"error": {"code": 503, "message": "x", "status": "UNAVAILABLE"}}
    )
    async with _cliente(LlmRoteirizado(roteiro=[indisponivel])) as cliente:
        sessao = (await _query(cliente, "async_create_session", user_id="u-1")).json()["output"]
        linhas: list[str] = []
        try:
            async with cliente.stream(
                "POST",
                "/api/stream_reasoning_engine",
                json={
                    "class_method": "async_stream_query",
                    "input": {
                        "user_id": "u-1",
                        "session_id": sessao["id"],
                        "message": "oi",
                        "run_config": {"streaming_mode": "sse"},
                    },
                },
            ) as resposta:
                async for linha in resposta.aiter_lines():
                    linhas.append(linha)
        except Exception:  # noqa: S110 — o corte da conexão é o comportamento esperado
            pass
    eventos = [json.loads(linha) for linha in linhas if linha]
    # O ADK emite um evento com `error_code` e depois propaga a exceção: o stream acaba
    # SEM evento final de texto. É o sinal de AGENTE_INDISPONIVEL para a api.
    assert eventos[0]["error_code"] == "UNAVAILABLE"
    assert not any((e.get("content") or {}).get("parts") for e in eventos)


async def test_saude(busca: DiscoveryEngineFalso) -> None:
    async with _cliente(LlmRoteirizado(roteiro=[])) as cliente:
        assert (await cliente.get("/healthz")).json() == {"status": "ok"}


async def test_corpo_sem_content_type_json_como_o_agent_engine_manda(
    busca: DiscoveryEngineFalso,
) -> None:
    # Medido no primeiro deploy em dev (2026-10-01): o engine repassa o corpo ao
    # container sem `Content-Type: application/json`, e o FastAPI, validando direto,
    # respondia 400 "Input should be a valid dictionary". O shim local passava liso
    # porque o httpx manda o cabeçalho.
    corpo = json.dumps(
        {"class_method": "async_create_session", "input": {"user_id": "u-1", "state": {}}}
    )
    async with _cliente(LlmRoteirizado(roteiro=[])) as cliente:
        for conteudo, tipo in (
            (corpo, "text/plain"),
            (corpo, "application/octet-stream"),
            (json.dumps(corpo), "application/json"),  # JSON codificado duas vezes
        ):
            resposta = await cliente.post(
                "/api/reasoning_engine", content=conteudo, headers={"content-type": tipo}
            )
            assert resposta.status_code == 200, (tipo, resposta.text)
            assert resposta.json()["output"]["user_id"] == "u-1"
        lixo = await cliente.post(
            "/api/stream_reasoning_engine",
            content="não é json",
            headers={"content-type": "text/plain"},
        )
        assert lixo.status_code == 400
