from __future__ import annotations

import io
import json
from collections import Counter
from pathlib import Path
from typing import Any

import httpx
import pytest
from pypdf import PdfReader, PdfWriter

from agente_professor import curriculo
from fakes import DiscoveryEngineFalso
from ingestao import avaliar_habilidades, dividir_pdfs, gerar_metadados_acervo, importar
from ingestao.armazenamento import ArmazenamentoLocal
from ingestao.comum import ID_VALIDO, id_de_documento
from ingestao.exportar_habilidades import TOTAIS_ESPERADOS, conferir_totais, gerar, ler_dados

# ------------------------------------------------------------- habilidades


def test_totais_batem_e_ids_sao_validos(documentos: list[dict[str, Any]]) -> None:
    assert len(documentos) == sum(TOTAIS_ESPERADOS.values()) == 1_617
    por_etapa = Counter((d["etapa"], d["componente_slug"] == "computacao") for d in documentos)
    assert por_etapa[("EF", False)] == 1_304
    assert por_etapa[("EM", False)] == 183
    assert por_etapa[("EF", True)] + por_etapa[("EM", True)] == 130
    assert all(ID_VALIDO.match(d["id"]) and d["id"] == d["codigo"] for d in documentos)
    assert len({d["id"] for d in documentos}) == len(documentos)


def test_campos_do_documento(documentos: list[dict[str, Any]]) -> None:
    por_codigo = {d["codigo"]: d for d in documentos}
    ef = por_codigo["EF67LP08"]
    assert ef["anos"] == ["6", "7"]
    assert ef["titulo"] == "EF67LP08 — Língua Portuguesa, 6º e 7º ano"
    assert ef["organizador_tipo"] == "prática de linguagem"
    em = por_codigo["EM13CNT101"]
    assert em["anos"] == ["EM"] and em["componente_slug"] == "ciencias-da-natureza"
    assert em["organizador"] == "Competência específica 1"
    assert por_codigo["EF06LI08"]["organizador_tipo"] == "eixo"
    computacao = por_codigo["EF05CO011"]  # três dígitos, como no documento
    assert computacao["organizador"] == "Cultura Digital"
    assert computacao["explicacao"] and computacao["exemplos"]
    assert "explicacao" not in computacao["descricao"]
    assert all(set(d["anos"]) <= set(curriculo.ANOS_VALIDOS) for d in documentos)
    # O lixo de extração ("Cada área do conhecimento…") não vira objeto de conhecimento.
    assert not any((d.get("objeto_conhecimento") or "").startswith("Cada área") for d in documentos)


def test_aborta_quando_os_totais_nao_batem() -> None:
    dados = ler_dados()
    dados["ef"] = dados["ef"][:-1]
    with pytest.raises(SystemExit, match="não batem"):
        conferir_totais(dados)
    with pytest.raises(SystemExit):
        gerar(dados)


# ------------------------------------------------------------------- PDFs


def _pdf(paginas: int) -> bytes:
    escritor = PdfWriter()
    for _ in range(paginas):
        escritor.add_blank_page(width=200, height=200)
    saida = io.BytesIO()
    escritor.write(saida)
    return saida.getvalue()


@pytest.mark.parametrize(
    ("total", "cortes", "esperado"),
    [
        (300, [], [(1, 300)]),
        (600, [463], [(1, 462), (463, 600)]),  # a BNCC: uma parte por etapa
        (600, [57, 463], [(1, 462), (463, 600)]),  # o maior corte que cabe
        (600, [], [(1, 500), (501, 600)]),
        (1_200, [], [(1, 500), (501, 1_000), (1_001, 1_200)]),
        (1_100, [400, 700], [(1, 399), (400, 699), (700, 1_100)]),
    ],
)
def test_planejar_partes(total: int, cortes: list[int], esperado: list[tuple[int, int]]) -> None:
    partes = dividir_pdfs.planejar(total, cortes)
    assert [(p.inicio, p.fim) for p in partes] == esperado
    assert all(p.paginas <= dividir_pdfs.TETO_DE_PAGINAS for p in partes)


def test_caminhos_de_parte_e_manifesto() -> None:
    parte = dividir_pdfs.Parte(463, 600)
    assert (
        dividir_pdfs.caminho_da_parte("bncc/originais/bncc-completa-2018.pdf", parte)
        == "bncc/partes/bncc-completa-2018__p0463-0600.pdf"
    )
    assert (
        dividir_pdfs.caminho_da_parte("livros/originais/matematica/6/livro.pdf", parte)
        == "livros/partes/matematica/6/livro__p0463-0600.pdf"
    )
    assert (
        dividir_pdfs.caminho_do_manifesto("livros/originais/matematica/6/livro.pdf")
        == "livros/partes/matematica/6/livro.partes.json"
    )


def _espelho(tmp_path: Path) -> ArmazenamentoLocal:
    espelho = ArmazenamentoLocal(tmp_path, "proj-agente-professor")
    espelho.gravar("bncc/originais/bncc-completa-2018.pdf", _pdf(620))
    espelho.gravar("bncc/originais/bncc-completa-2018.json", json.dumps({"cortes": [463]}).encode())
    espelho.gravar("livros/originais/biologia/em2/biologia-volume-2.pdf", _pdf(12))
    espelho.gravar(
        "livros/originais/biologia/em2/biologia-volume-2.json",
        json.dumps({"titulo": "Biologia — Volume 2"}).encode(),
    )
    espelho.gravar("livros/originais/matematica/6/matemática_6º_ano.pdf", _pdf(3))
    return espelho


def test_dividir_e_gerar_metadados_pela_convencao(tmp_path: Path) -> None:
    espelho = _espelho(tmp_path)
    assert all(
        linha.startswith("[seco]")
        for linha in dividir_pdfs.dividir(espelho, seco=True, forcar=False)
    )
    assert not espelho.listar("bncc/partes/")

    dividir_pdfs.dividir(espelho, seco=False, forcar=False)
    partes = espelho.listar("bncc/partes/")
    assert partes == [
        "bncc/partes/bncc-completa-2018.partes.json",
        "bncc/partes/bncc-completa-2018__p0001-0462.pdf",
        "bncc/partes/bncc-completa-2018__p0463-0620.pdf",
    ]
    assert len(PdfReader(io.BytesIO(espelho.ler(partes[2]))).pages) == 158
    # Idempotente: a segunda passada não refaz nada.
    assert all(
        linha.startswith("=") for linha in dividir_pdfs.dividir(espelho, seco=False, forcar=False)
    )

    linhas = gerar_metadados_acervo.gerar(espelho)
    por_id = {linha["id"]: linha for linha in linhas}
    assert all(ID_VALIDO.match(i) for i in por_id)
    segunda = next(linha for linha in linhas if linha["content"]["uri"].endswith("p0463-0620.pdf"))
    assert segunda["structData"]["pagina_inicial_original"] == 463
    assert (
        segunda["structData"]["uri_original"]
        == "gs://proj-agente-professor/bncc/originais/bncc-completa-2018.pdf"
    )
    assert segunda["structData"]["tipo"] == "bncc_documento"
    assert segunda["structData"]["componente_slug"] == ["todos"]
    assert segunda["content"]["mimeType"] == "application/pdf"

    biologia = next(linha for linha in linhas if "biologia" in linha["id"])
    assert biologia["structData"] == {
        "tipo": "livro_didatico",
        "titulo": "Biologia — Volume 2",
        "componente_slug": ["biologia"],
        "etapa": ["EM"],
        "anos": ["EM"],
        "serie": "em2",
        "pagina_inicial_original": 1,
        "uri_original": "gs://proj-agente-professor/livros/originais/biologia/em2/biologia-volume-2.pdf",
    }
    # PDF pequeno não é dividido: o data store lê o próprio original.
    assert biologia["content"]["uri"] == biologia["structData"]["uri_original"]
    matematica = next(linha for linha in linhas if "matematica" in linha["id"])
    assert matematica["structData"]["titulo"] == "Matemática 6º ano"
    assert matematica["structData"]["anos"] == ["6"]


@pytest.mark.parametrize(
    "caminho",
    [
        "livros/originais/astrologia/6/x.pdf",
        "livros/originais/matematica/10/x.pdf",
        "livros/originais/matematica/x.pdf",
    ],
)
def test_pasta_fora_da_convencao_aborta_tudo(tmp_path: Path, caminho: str) -> None:
    espelho = _espelho(tmp_path)
    espelho.gravar(caminho, _pdf(1))
    dividir_pdfs.dividir(espelho, seco=False, forcar=False)
    with pytest.raises(gerar_metadados_acervo.ConvencaoViolada, match="nada foi gerado"):
        gerar_metadados_acervo.gerar(espelho)


def test_original_sem_manifesto_e_erro(tmp_path: Path) -> None:
    espelho = _espelho(tmp_path)
    with pytest.raises(
        gerar_metadados_acervo.ConvencaoViolada, match=r"rode ingestao\.dividir_pdfs"
    ):
        gerar_metadados_acervo.gerar(espelho)


def test_id_longo_ganha_hash_e_continua_valido() -> None:
    longo = "livros/originais/matematica/6/" + "um-titulo-muito-comprido-" * 10 + ".pdf"
    a = id_de_documento(longo)
    b = id_de_documento(longo.replace("um-titulo", "outro-titulo"))
    assert len(a) <= 128 and ID_VALIDO.match(a)
    assert a != b


# ---------------------------------------------------------------- importar


def test_corpos_de_importacao() -> None:
    habilidades = importar.corpo_de_importacao("habilidades", "b", "T")
    assert habilidades == {
        "gcsSource": {
            "inputUris": ["gs://b/habilidades/habilidades.jsonl"],
            "dataSchema": "custom",
        },
        "idField": "id",
        "reconciliationMode": "FULL",
        "errorConfig": {"gcsPrefix": "gs://b/import-erros/habilidades/T/"},
    }
    acervo = importar.corpo_de_importacao("acervo", "b", "T")
    assert acervo["gcsSource"]["dataSchema"] == "document"
    assert acervo["reconciliationMode"] == "INCREMENTAL"


def test_importar_espera_a_operacao_e_resume() -> None:
    chamadas: list[tuple[str, str]] = []

    def responder(pedido: httpx.Request) -> httpx.Response:
        chamadas.append((pedido.method, pedido.url.path))
        if pedido.method == "POST":
            return httpx.Response(200, json={"name": "projects/p/operations/op-1", "done": False})
        return httpx.Response(
            200,
            json={
                "name": "projects/p/operations/op-1",
                "done": True,
                "metadata": {"successCount": "1617", "failureCount": "0", "totalCount": "1617"},
                "response": {},
            },
        )

    cliente = httpx.Client(transport=httpx.MockTransport(responder))
    codigo = importar.executar(
        "habilidades",
        projeto="p",
        bucket="b",
        location="global",
        seco=False,
        http=cliente,
        dormir=lambda _s: None,
    )
    assert codigo == 0
    assert chamadas[0] == (
        "POST",
        "/v1/projects/p/locations/global/collections/default_collection/"
        "dataStores/agente-professor-habilidades/branches/default_branch/"
        "documents:import",
    )
    assert chamadas[1] == ("GET", "/v1/projects/p/operations/op-1")


def test_resumo_com_falhas() -> None:
    texto, ok = importar.resumir(
        {
            "done": True,
            "metadata": {"successCount": 3, "failureCount": 1},
            "response": {"errorSamples": [{"message": "id inválido"}]},
        }
    )
    assert not ok and "falhas=1" in texto and "id inválido" in texto


def test_esquemas_tornam_filtraveis_os_campos_do_filtro() -> None:
    for nome, campos in (
        ("habilidades", ["codigo", "anos", "componente_slug", "etapa"]),
        ("acervo", ["tipo", "componente_slug", "anos"]),
    ):
        esquema = json.loads((importar.ESQUEMAS / f"{nome}.json").read_text())
        for campo in campos:
            definicao = esquema["properties"][campo]
            alvo = definicao.get("items", definicao)
            assert alvo.get("indexable") is True, (nome, campo)


def test_campo_chave_nao_leva_searchable_nem_indexable() -> None:
    # A Discovery Engine recusa o PATCH do esquema inteiro com 400 ("Key property
    # titulo should not contain searchable or indexable annotation") — medido no
    # primeiro `importar esquema` em dev, 2026-10-01. O campo-chave (title,
    # description) já é buscado por ser chave; a marcação a mais só derruba.
    for nome in ("habilidades", "acervo"):
        esquema = json.loads((importar.ESQUEMAS / f"{nome}.json").read_text())
        for campo, definicao in esquema["properties"].items():
            if "keyPropertyMapping" in definicao:
                proibidas = {"searchable", "indexable"} & definicao.keys()
                assert not proibidas, (nome, campo, proibidas)


def test_esquema_de_habilidades_nao_remove_campo_do_terraform() -> None:
    # O Terraform da fundação criou o esquema com `fonte_pagina`, e a Discovery
    # Engine NÃO deixa remover campo num PATCH ("Fields fonte_pagina cannot be
    # removed", dev, 2026-10-01). Todo campo que já nasceu lá tem de continuar aqui.
    esquema = json.loads((importar.ESQUEMAS / "habilidades.json").read_text())
    criados_no_terraform = {
        "codigo", "etapa", "anos", "componente", "componente_slug", "area",
        "organizador", "objeto_conhecimento", "descricao", "fonte_pagina", "titulo",
    }
    assert criados_no_terraform <= esquema["properties"].keys()


# ---------------------------------------------------------------- avaliar


async def test_avaliacao_com_fake_passa_inteira(documentos: list[dict[str, Any]]) -> None:
    casos = json.loads(avaliar_habilidades.CASOS.read_text("utf-8"))["casos"]
    assert len(casos) >= 30
    relatorio = await avaliar_habilidades.avaliar(
        documentos, casos, DiscoveryEngineFalso(habilidades=documentos)
    )
    assert len(relatorio.navegacao) == len(avaliar_habilidades.combinacoes(documentos))
    falhas_nav = [r.id for r in relatorio.navegacao if not r.passou]
    assert falhas_nav == []
    # Com o fake (busca por palavra), os casos exatos têm de passar todos.
    exatos = [r for r in relatorio.perguntas if r.exato]
    assert exatos and all(r.passou for r in exatos), [r.id for r in exatos if not r.passou]
    texto = avaliar_habilidades.em_markdown(relatorio, data="2026-09-30", alvo="fake")
    assert "# Avaliação da busca de habilidades — 2026-09-30" in texto
    assert "Navegação exata" in texto


async def test_avaliacao_acusa_habilidade_faltando(documentos: list[dict[str, Any]]) -> None:
    incompleto = [d for d in documentos if d["codigo"] != "EF06MA01"]
    relatorio = await avaliar_habilidades.avaliar(
        documentos, [], DiscoveryEngineFalso(habilidades=incompleto)
    )
    falha = next(r for r in relatorio.navegacao if r.id == "matematica|6")
    assert not falha.passou and falha.faltando == ["EF06MA01"]
    assert "faltando: EF06MA01" in avaliar_habilidades.em_markdown(relatorio, data="d", alvo="a")
