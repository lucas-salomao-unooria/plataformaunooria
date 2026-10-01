"""Ponta a ponta local: o turno com ferramenta pelo `async_stream_query` em modo SSE.

O modelo é fake, mas o caminho é o de produção: `AdkApp` → `Runner` → plugins →
`FunctionTool(buscar_habilidades)` → Discovery Engine falso → segunda chamada ao
modelo → evento final agregado → evento do título.
"""

from __future__ import annotations

from typing import Any

from agente_professor.agente import criar_app
from agente_professor.fabrica import criar_adk_app
from fakes import ChamadaDeFerramenta, DiscoveryEngineFalso, LlmAuxiliar, LlmRoteirizado, Texto

RESPOSTA = "Olá, Ana! A **EF06MA01** trata de comparar e ordenar números naturais e racionais."


def _texto(evento: dict[str, Any]) -> str:
    return "".join(p.get("text", "") for p in (evento.get("content") or {}).get("parts", []))


def _tem(evento: dict[str, Any], tipo: str) -> bool:
    return any(tipo in p for p in (evento.get("content") or {}).get("parts", []))


async def _turno(app: Any, sessao: str, mensagem: str) -> list[dict[str, Any]]:
    return [
        e
        async for e in app.async_stream_query(
            user_id="u-1",
            session_id=sessao,
            message=mensagem,
            run_config={"streaming_mode": "sse"},
        )
    ]


async def test_turno_com_ferramenta_termina_com_o_evento_final_e_o_titulo(
    busca: DiscoveryEngineFalso,
) -> None:
    principal = LlmRoteirizado(
        roteiro=[
            ChamadaDeFerramenta("buscar_habilidades", {"codigos": ["EF06MA01"]}, tokens=30),
            Texto(RESPOSTA, pedacos=4, tokens=50),
        ]
    )
    auxiliar = LlmAuxiliar(tokens=7)
    app = criar_adk_app(criar_app(modelo=principal, modelo_escopo=auxiliar))
    sessao = await app.async_create_session(
        user_id="u-1", state={"nome_professor": "Ana"}, expire_time="2036-09-30T00:00:00Z"
    )

    eventos = await _turno(app, sessao["id"], "Me explica a EF06MA01")

    # A ferramenta foi chamada de verdade, com o filtro exato.
    assert busca.chamadas[0][1]["filter"] == 'codigo: ANY("EF06MA01")'
    retorno = next(e for e in eventos if _tem(e, "function_response"))
    resposta_da_ferramenta = retorno["content"]["parts"][0]["function_response"]["response"]
    assert [h["codigo"] for h in resposta_da_ferramenta["habilidades"]] == ["EF06MA01"]

    # Depois da ferramenta o stream NÃO trunca: vêm os parciais e o final agregado.
    depois = eventos[eventos.index(retorno) + 1 :]
    parciais = [e for e in depois if e.get("partial") and _texto(e)]
    finais = [e for e in depois if not e.get("partial") and _texto(e)]
    assert len(parciais) == 4
    assert "".join(_texto(e) for e in parciais) == RESPOSTA
    assert len(finais) == 1 and _texto(finais[0]) == RESPOSTA  # o agregado REPETE o texto

    # O título é o último evento: só `state_delta`, sem conteúdo.
    titulo = eventos[-1]
    assert titulo["actions"]["state_delta"] == {
        "titulo_conversa": "Habilidades de Matemática do 6º ano"
    }
    assert "content" not in titulo
    assert auxiliar.chamadas == ["guarda", "titulo"]

    # Quota: soma de `usage_metadata.total_token_count` dos NÃO parciais = principal + auxiliares.
    total = sum(
        e.get("usage_metadata", {}).get("total_token_count", 0)
        for e in eventos
        if not e.get("partial")
    )
    assert total == 30 + 50 + 7 + 7

    # A instrução recebeu o nome do estado (`{nome_professor?}`).
    assert 'primeiro nome é "Ana"' in str(principal.pedidos[0].config.system_instruction)

    # O título e o histórico estão na sessão (o fallback da api lê daqui).
    lida = await app.async_get_session(user_id="u-1", session_id=sessao["id"])
    assert lida.state["titulo_conversa"] == "Habilidades de Matemática do 6º ano"


async def test_segundo_turno_nao_regera_o_titulo_e_resume_retorno_antigo(
    busca: DiscoveryEngineFalso,
) -> None:
    principal = LlmRoteirizado(
        roteiro=[
            ChamadaDeFerramenta("buscar_habilidades", {"componente": "matemática", "anos": ["6"]}),
            Texto("Aqui estão as habilidades."),
            Texto("Claro, em tabela."),
        ]
    )
    auxiliar = LlmAuxiliar()
    app = criar_adk_app(criar_app(modelo=principal, modelo_escopo=auxiliar))
    sessao = await app.async_create_session(user_id="u-1")

    await _turno(app, sessao["id"], "Todas as habilidades de Matemática do 6º ano")
    eventos = await _turno(app, sessao["id"], "Mostre em tabela")

    assert auxiliar.chamadas == ["guarda", "titulo", "guarda"]
    assert not any(
        "titulo_conversa" in (e.get("actions") or {}).get("state_delta", {}) for e in eventos
    )
    # No pedido do 2º turno, o retorno da ferramenta do 1º virou resumo com os códigos.
    ultimo_pedido = principal.pedidos[-1]
    retornos = [
        p.function_response
        for c in ultimo_pedido.contents
        for p in c.parts or []
        if p.function_response
    ]
    resumo = retornos[0].response or {}
    assert "resumo" in resumo
    assert "EF06MA01" in resumo["codigos"]
    # …mas a sessão guarda o retorno inteiro.
    lida = await app.async_get_session(user_id="u-1", session_id=sessao["id"])
    na_sessao = [
        p.function_response
        for e in lida.events
        if e.content
        for p in (e.content.parts or [])
        if p.function_response
    ]
    assert "habilidades" in na_sessao[0].response


async def test_fora_do_escopo_recusa_sem_chamar_o_modelo_principal(
    busca: DiscoveryEngineFalso,
) -> None:
    principal = LlmRoteirizado(roteiro=[])
    app = criar_adk_app(criar_app(modelo=principal, modelo_escopo=LlmAuxiliar(dentro=False)))
    sessao = await app.async_create_session(user_id="u-1", state={"nome_professor": "Ana"})

    eventos = await _turno(app, sessao["id"], "Quem ganhou o jogo ontem?")

    assert principal.pedidos == []
    assert len(eventos) == 1
    recusa = eventos[0]
    assert recusa.get("partial") is not True
    assert _texto(recusa).startswith("Ana, eu só consigo ajudar com a BNCC")
    assert recusa["custom_metadata"]["fora_do_escopo"] is True
    assert recusa["usage_metadata"]["total_token_count"] == 7
    assert "titulo_conversa" not in recusa["actions"]["state_delta"]
