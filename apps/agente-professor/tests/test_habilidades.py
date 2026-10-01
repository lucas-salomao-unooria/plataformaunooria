from typing import Any

from agente_professor.busca import ErroDeBusca, definir_cliente_busca
from agente_professor.ferramentas.habilidades import (
    TETO_DE_ITENS,
    buscar_habilidades,
    montar_filtro,
)
from fakes import DiscoveryEngineFalso, interpretar_filtro


def _codigos(resposta: dict[str, Any]) -> list[str]:
    return [h["codigo"] for h in resposta["habilidades"]]


def test_filtro_exato_tem_o_formato_do_discovery_engine() -> None:
    filtro = montar_filtro(
        codigos=["EF06MA01"],
        anos=["6", "EM"],
        componentes=["historia", "ciencias-humanas"],
        etapas=["EF"],
    )
    assert filtro == (
        'codigo: ANY("EF06MA01") AND anos: ANY("6", "EM") AND '
        'componente_slug: ANY("historia", "ciencias-humanas") AND etapa: ANY("EF")'
    )
    assert interpretar_filtro(filtro)["anos"] == {"6", "EM"}


async def test_navegacao_usa_query_vazia_e_pagina_ate_o_fim(
    busca: DiscoveryEngineFalso, documentos: list[dict[str, Any]]
) -> None:
    # Língua Portuguesa do 8º ano: 109 habilidades, duas páginas de 100.
    esperado = sorted(
        d["codigo"]
        for d in documentos
        if d["componente_slug"] == "lingua-portuguesa" and "8" in d["anos"]
    )
    assert len(esperado) > 100

    resposta = await buscar_habilidades(componente="Língua Portuguesa", anos=["8º ano"])

    assert _codigos(resposta) == esperado
    assert resposta["total"] == len(esperado)
    assert resposta["truncado"] is False
    corpos = [c for _, c in busca.chamadas]
    assert len(corpos) == 2
    assert all(c["query"] == "" and c["pageSize"] == 100 for c in corpos)
    assert "pageToken" not in corpos[0] and corpos[1]["pageToken"] == "100"
    assert corpos[0]["filter"] == ('anos: ANY("8") AND componente_slug: ANY("lingua-portuguesa")')


async def test_pagina_menor_que_a_pedida_ainda_chega_ao_fim(
    documentos: list[dict[str, Any]],
) -> None:
    # A API "coage" o pageSize ao teto do tipo de dado; a ferramenta confia no token.
    falso = DiscoveryEngineFalso(habilidades=documentos, tamanho_real_da_pagina=25)
    definir_cliente_busca(falso)
    resposta = await buscar_habilidades(componente="matemática", anos=["6"])
    esperado = {
        d["codigo"] for d in documentos if d["componente_slug"] == "matematica" and "6" in d["anos"]
    }
    assert set(_codigos(resposta)) == esperado
    assert len(falso.chamadas) == -(-len(esperado) // 25)


async def test_biologia_no_em_traz_ciencias_da_natureza(busca: DiscoveryEngineFalso) -> None:
    resposta = await buscar_habilidades(componente="Biologia", anos=["2ª série"])
    codigos = _codigos(resposta)
    assert codigos and all(c.startswith("EM13CNT") for c in codigos)
    assert len(codigos) == 26
    assert "ÁREA" in resposta["aviso"]


async def test_historia_no_ef_nao_traz_ciencias_humanas_do_em(busca: DiscoveryEngineFalso) -> None:
    resposta = await buscar_habilidades(componente="história", anos=["6"])
    assert all(c.startswith(("EF06HI", "EF69HI", "EF67HI")) for c in _codigos(resposta))
    assert "aviso" not in resposta


async def test_codigos_exatos_e_inexistentes(busca: DiscoveryEngineFalso) -> None:
    resposta = await buscar_habilidades(codigos=["ef67lp08", "EF05CO011", "EF06MA99", "XYZ"])
    assert set(_codigos(resposta)) == {"EF67LP08", "EF05CO011"}
    assert resposta["codigos_nao_encontrados"] == ["EF06MA99"]
    assert resposta["codigos_invalidos"] == ["XYZ"]
    assert "não existem" in resposta["aviso"]


async def test_computacao_com_poucos_resultados_traz_explicacao_e_exemplos(
    busca: DiscoveryEngineFalso,
) -> None:
    resposta = await buscar_habilidades(codigos=["EF05CO011"])
    habilidade = resposta["habilidades"][0]
    assert habilidade["explicacao"] and habilidade["exemplos"]
    assert habilidade["organizador_tipo"] == "eixo"


async def test_lista_grande_de_computacao_omite_o_texto_pedagogico(
    busca: DiscoveryEngineFalso,
) -> None:
    resposta = await buscar_habilidades(componente="computação", anos=["anos iniciais"])
    assert len(resposta["habilidades"]) > 20
    assert all("explicacao" not in h for h in resposta["habilidades"])
    assert "busque por código" in resposta["aviso"]


async def test_modo_semantico_usa_texto_sob_o_filtro(busca: DiscoveryEngineFalso) -> None:
    resposta = await buscar_habilidades(componente="matemática", anos=["5"], texto="frações")
    _, corpo = busca.chamadas[0]
    assert corpo["query"] == "frações" and corpo["pageSize"] == 20
    assert corpo["filter"] == 'anos: ANY("5") AND componente_slug: ANY("matematica")'
    assert len(busca.chamadas) == 1
    assert {"EF05MA03", "EF05MA04"} <= set(_codigos(resposta))


async def test_teto_de_itens_avisa_que_truncou() -> None:
    muitos = [
        {
            "codigo": f"EF06MA{i:03d}",
            "descricao": "x",
            "anos": ["6"],
            "componente_slug": "matematica",
            "etapa": "EF",
            "componente": "Matemática",
        }
        for i in range(1, 400)
    ]
    falso = DiscoveryEngineFalso(habilidades=muitos)
    definir_cliente_busca(falso)
    resposta = await buscar_habilidades(componente="matemática", anos=["6"])
    assert len(resposta["habilidades"]) == TETO_DE_ITENS
    assert resposta["truncado"] is True
    assert "cortada" in resposta["aviso"]
    assert len(falso.chamadas) == 2  # parou de paginar ao passar do teto


async def test_entrada_invalida_vira_erro_legivel_sem_chamar_a_busca(
    busca: DiscoveryEngineFalso,
) -> None:
    assert (
        "Componente não reconhecido" in (await buscar_habilidades(componente="astrologia"))["erro"]
    )
    assert "Ano não reconhecido" in (await buscar_habilidades(anos=["décimo"]))["erro"]
    assert "ao menos um filtro" in (await buscar_habilidades())["erro"]
    assert busca.chamadas == []


async def test_falha_da_busca_vira_erro_para_o_modelo(busca: DiscoveryEngineFalso) -> None:
    busca.falhar_com = ErroDeBusca(503, "UNAVAILABLE")
    resposta = await buscar_habilidades(codigos=["EF06MA01"])
    assert "indisponível" in resposta["erro"]
    assert resposta["habilidades"] == []
