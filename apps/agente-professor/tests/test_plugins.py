from __future__ import annotations

from typing import Any

import pytest

from agente_professor.agente import criar_app
from agente_professor.fabrica import criar_adk_app
from agente_professor.plugins import limpar_titulo
from fakes import DiscoveryEngineFalso, LlmAuxiliar, LlmRoteirizado, Texto


async def _um_turno(
    auxiliar: LlmAuxiliar, principal: LlmRoteirizado, **kw: Any
) -> list[dict[str, Any]]:
    app = criar_adk_app(criar_app(modelo=principal, modelo_escopo=auxiliar, **kw))
    sessao = await app.async_create_session(user_id="u")
    return [
        e
        async for e in app.async_stream_query(
            user_id="u",
            session_id=sessao["id"],
            message="Habilidades de frações no 5º ano",
            run_config={"streaming_mode": "sse"},
        )
    ]


@pytest.mark.parametrize(
    "auxiliar",
    [LlmAuxiliar(falhar_guarda=True), LlmAuxiliar(dentro=None)],
    ids=["classificador-fora-do-ar", "json-invalido"],
)
async def test_guarda_falha_aberta(
    auxiliar: LlmAuxiliar, busca: DiscoveryEngineFalso, caplog: pytest.LogCaptureFixture
) -> None:
    principal = LlmRoteirizado(roteiro=[Texto("Resposta normal.")])
    eventos = await _um_turno(auxiliar, principal)
    assert len(principal.pedidos) == 1  # o modelo principal respondeu
    assert any("Resposta normal." in str(e.get("content")) for e in eventos)
    assert "fail-open" in caplog.text


async def test_nenhum_log_carrega_o_texto_do_professor(
    busca: DiscoveryEngineFalso, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level("DEBUG", logger="agente_professor")
    await _um_turno(LlmAuxiliar(falhar_guarda=True), LlmRoteirizado(roteiro=[Texto("ok")]))
    registros = [r.getMessage() for r in caplog.records if r.name.startswith("agente_professor")]
    assert registros
    assert not any("frações" in m for m in registros)


async def test_titulo_que_falha_nao_grava_nada(busca: DiscoveryEngineFalso) -> None:
    class AuxiliarSemTitulo(LlmAuxiliar):
        async def generate_content_async(self, llm_request, stream=False):
            if "classifica" not in str(llm_request.config.system_instruction):
                raise RuntimeError("cota")
            async for r in super().generate_content_async(llm_request, stream):
                yield r

    eventos = await _um_turno(AuxiliarSemTitulo(), LlmRoteirizado(roteiro=[Texto("ok")]))
    assert not any(
        "titulo_conversa" in (e.get("actions") or {}).get("state_delta", {}) for e in eventos
    )


@pytest.mark.parametrize(
    ("bruto", "esperado"),
    [
        ("Habilidades de frações no 5º ano.", "Habilidades de frações no 5º ano"),
        ('"EF67LP08 e leitura crítica"', "EF67LP08 e leitura crítica"),
        ("Título: Algoritmos no 1º ano", "Algoritmos no 1º ano"),
        (
            "Uma conversa muito longa sobre as habilidades de Língua Portuguesa no oitavo ano do EF",
            "Uma conversa muito longa sobre as habilidades de Língua",
        ),
        ("", ""),
    ],
)
def test_limpar_titulo(bruto: str, esperado: str) -> None:
    titulo = limpar_titulo(bruto)
    assert titulo == esperado
    assert len(titulo) <= 60
