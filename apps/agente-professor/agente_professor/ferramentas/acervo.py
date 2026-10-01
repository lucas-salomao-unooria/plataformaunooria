"""`buscar_acervo`: trechos dos PDFs (BNCC oficial e livros didáticos da Unooria).

Modo CHUNKS do data store `agente-professor-acervo` (chunking por layout). Cada
trecho volta com a página do PDF ORIGINAL: PDFs acima de 500 páginas são divididos
na ingestão (o parser de layout não aceita mais que isso), e o `pageSpan` do
Discovery Engine conta a partir do início da PARTE. A conversão usa o
`pagina_inicial_original` gravado no `structData` de cada parte:

    página original = pagina_inicial_original + pageSpan.pageStart − 1

Sem ela, a citação "BNCC, p. 12" aponta para a página 512 do documento real.

**As chaves de cada trecho são contrato com a api** (`titulo`, `pagina_inicio`,
`pagina_fim`, `trecho`, `fonte_id`): ela extrai o evento `fontes` do
`function_response` de `buscar_acervo` por esses nomes. Mudou aqui, muda lá.
"""

from __future__ import annotations

import logging
from typing import Any

from .. import curriculo
from ..busca import ErroDeBusca, cliente_busca
from ..config import configuracao
from .habilidades import montar_filtro

logger = logging.getLogger(__name__)

RESULTADOS = 8
TETO_DO_TRECHO = 1_200

TIPOS = {
    "livro": "livro_didatico",
    "livros": "livro_didatico",
    "livro-didatico": "livro_didatico",
    "livro_didatico": "livro_didatico",
    "livros-didaticos": "livro_didatico",
    "bncc": "bncc_documento",
    "bncc-documento": "bncc_documento",
    "bncc_documento": "bncc_documento",
    "documento": "bncc_documento",
}


def pagina_original(inicial_original: Any, pagina_da_parte: Any) -> int | None:
    """A página no PDF original. `None` quando o trecho não tem página."""
    try:
        parte = int(pagina_da_parte)
    except (TypeError, ValueError):
        return None
    try:
        inicial = int(inicial_original)
    except (TypeError, ValueError):
        inicial = 1
    return max(inicial, 1) + parte - 1


def _fonte_id(chunk: dict[str, Any]) -> str:
    nome = str(chunk.get("name") or "")
    if "/documents/" in nome:
        return nome.split("/documents/", 1)[1].split("/", 1)[0]
    return str(chunk.get("id") or "")


def _cortar(texto: str) -> str:
    texto = " ".join(texto.split())
    if len(texto) <= TETO_DO_TRECHO:
        return texto
    return texto[: TETO_DO_TRECHO - 1].rsplit(" ", 1)[0] + "…"


def chunk_para_trecho(resultado: dict[str, Any]) -> dict[str, Any] | None:
    chunk = resultado.get("chunk") or {}
    conteudo = chunk.get("content")
    if not conteudo:
        return None
    metadados = chunk.get("documentMetadata") or {}
    dados = metadados.get("structData") or {}
    span = chunk.get("pageSpan") or {}
    inicial = dados.get("pagina_inicial_original", 1)
    inicio = pagina_original(inicial, span.get("pageStart"))
    fim = pagina_original(inicial, span.get("pageEnd", span.get("pageStart")))
    return {
        "titulo": dados.get("titulo") or metadados.get("title") or "Documento do acervo",
        "pagina_inicio": inicio,
        "pagina_fim": fim if fim is not None else inicio,
        "trecho": _cortar(str(conteudo)),
        "fonte_id": _fonte_id(chunk),
    }


async def buscar_acervo(
    pergunta: str,
    tipo: str | None = None,
    componente: str | None = None,
    anos: list[str] | None = None,
) -> dict[str, Any]:
    """Busca trechos no acervo da Unooria: o documento oficial da BNCC e livros didáticos.

    Use para perguntas sobre o TEXTO da BNCC (competências, fundamentos, orientações)
    ou sobre o conteúdo dos livros. Cite SEMPRE o título e as páginas de cada trecho
    usado. Se não vier trecho, diga que não encontrou no acervo.

    Args:
        pergunta: A pergunta ou o tema, em linguagem livre.
        tipo: "bncc_documento" (texto oficial da BNCC) ou "livro_didatico".
            Sem tipo, busca nos dois.
        componente: Componente curricular, ex.: "matemática", "biologia".
        anos: Anos do Ensino Fundamental ("1" a "9") ou "EM".

    Returns:
        {"trechos": [{titulo, pagina_inicio, pagina_fim, trecho, fonte_id}]} e,
        quando nada vier, "aviso".
    """
    consulta = (pergunta or "").strip()
    if not consulta:
        return {"erro": "Informe a pergunta.", "trechos": []}

    tipos: list[str] = []
    if tipo:
        normalizado = TIPOS.get(curriculo.slug(tipo)) or TIPOS.get(tipo)
        if not normalizado:
            return {
                "erro": "Tipo não reconhecido: use 'bncc_documento' ou 'livro_didatico'.",
                "trechos": [],
            }
        tipos = [normalizado]
    componentes: list[str] = []
    if componente:
        try:
            # "todos" = documento que vale para qualquer componente (a própria BNCC).
            componentes = [curriculo.componente_do_acervo(componente), "todos"]
        except curriculo.ComponenteDesconhecido:
            return {"erro": f"Componente não reconhecido: {componente!r}.", "trechos": []}
    try:
        anos_ok = curriculo.normalizar_anos(anos or [])
    except curriculo.AnoDesconhecido:
        return {"erro": "Ano não reconhecido: use '1' a '9' ou 'EM'.", "trechos": []}

    filtro = " AND ".join(
        p
        for p in (
            f'tipo: ANY("{tipos[0]}")' if tipos else "",
            montar_filtro(componentes=componentes, anos=anos_ok),
        )
        if p
    )
    corpo: dict[str, Any] = {
        "query": consulta,
        "pageSize": RESULTADOS,
        "contentSearchSpec": {
            "searchResultMode": "CHUNKS",
            "chunkSpec": {"numPreviousChunks": 0, "numNextChunks": 0},
        },
    }
    if filtro:
        corpo["filter"] = filtro

    try:
        resposta = await cliente_busca().buscar(configuracao().datastore_acervo, corpo)
    except ErroDeBusca as erro:
        logger.warning("buscar_acervo: busca falhou status=%s", erro.status)
        return {
            "erro": "O acervo está indisponível agora. Diga ao professor que não foi possível "
            "consultar o acervo e peça para tentar de novo em instantes.",
            "trechos": [],
        }

    trechos = [t for r in resposta.get("results") or [] if (t := chunk_para_trecho(r))]
    logger.info(
        "buscar_acervo filtros=%s trechos=%d",
        sorted(
            k for k, v in {"tipo": tipos, "componente": componentes, "anos": anos_ok}.items() if v
        ),
        len(trechos),
    )
    if not trechos:
        return {
            "trechos": [],
            "aviso": "Nada encontrado no acervo para esta pergunta. Diga ao professor que não "
            "encontrou no acervo; não responda de memória.",
        }
    return {"trechos": trechos}
