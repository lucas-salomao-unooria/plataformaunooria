from typing import Any

from agente_professor.busca import definir_cliente_busca
from agente_professor.ferramentas.acervo import (
    TETO_DO_TRECHO,
    buscar_acervo,
    chunk_para_trecho,
    pagina_original,
)
from fakes import DiscoveryEngineFalso


def _trecho(conteudo: str, inicio: int, fim: int, inicial: int, **dados: Any) -> dict[str, Any]:
    return {
        "name": "projects/p/locations/global/collections/default_collection/dataStores/d/branches/0/"
        f"documents/bncc-partes-bncc-completa-2018-p{inicial:04d}/chunks/c1",
        "content": conteudo,
        "pageSpan": {"pageStart": inicio, "pageEnd": fim},
        "documentMetadata": {
            "title": "bncc-completa",
            "structData": {
                "tipo": "bncc_documento",
                "titulo": "Base Nacional Comum Curricular (BNCC)",
                "componente_slug": ["todos"],
                "anos": ["1", "6", "EM"],
                "pagina_inicial_original": inicial,
                **dados,
            },
        },
    }


def test_pagina_da_parte_vira_pagina_do_original() -> None:
    assert pagina_original(1, 12) == 12
    assert pagina_original(463, 1) == 463
    assert pagina_original(463, 12) == 474
    assert pagina_original("463", "2") == 464
    assert pagina_original(None, 5) == 5
    assert pagina_original(463, None) is None


def test_chunk_com_pagespan_da_segunda_parte() -> None:
    trecho = chunk_para_trecho({"chunk": _trecho("A etapa do Ensino Médio...", 12, 13, 463)})
    assert trecho == {
        "titulo": "Base Nacional Comum Curricular (BNCC)",
        "pagina_inicio": 474,
        "pagina_fim": 475,
        "trecho": "A etapa do Ensino Médio...",
        "fonte_id": "bncc-partes-bncc-completa-2018-p0463",
    }
    # As chaves são contrato: a api extrai as fontes do `function_response` com elas.
    assert trecho is not None
    assert set(trecho) == {"titulo", "pagina_inicio", "pagina_fim", "trecho", "fonte_id"}


def test_trecho_longo_e_cortado() -> None:
    trecho = chunk_para_trecho({"chunk": _trecho("palavra " * 1000, 1, 1, 1)})
    assert trecho is not None
    assert len(trecho["trecho"]) <= TETO_DO_TRECHO
    assert trecho["trecho"].endswith("…")


async def test_busca_em_chunks_com_filtros() -> None:
    falso = DiscoveryEngineFalso(
        trechos=[_trecho("competências gerais da educação básica", 9, 9, 1)]
    )
    definir_cliente_busca(falso)
    resposta = await buscar_acervo(
        "competências gerais", tipo="bncc", componente="Matemática", anos=["6º ano"]
    )
    assert resposta["trechos"][0]["pagina_inicio"] == 9
    datastore, corpo = falso.chamadas[0]
    assert datastore == "agente-professor-acervo"
    assert corpo["contentSearchSpec"]["searchResultMode"] == "CHUNKS"
    assert corpo["pageSize"] == 8
    assert corpo["filter"] == (
        'tipo: ANY("bncc_documento") AND anos: ANY("6") AND '
        'componente_slug: ANY("matematica", "todos")'
    )


async def test_sem_trecho_avisa_que_nao_encontrou() -> None:
    definir_cliente_busca(DiscoveryEngineFalso(trechos=[]))
    resposta = await buscar_acervo("receita de bolo")
    assert resposta["trechos"] == []
    assert "não encontrou no acervo" in resposta["aviso"]


async def test_tipo_invalido() -> None:
    definir_cliente_busca(DiscoveryEngineFalso())
    assert "Tipo não reconhecido" in (await buscar_acervo("x", tipo="revista"))["erro"]
