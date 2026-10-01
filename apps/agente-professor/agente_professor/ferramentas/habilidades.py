"""`buscar_habilidades`: a ÚNICA fonte de habilidade da BNCC que o agente tem.

Dois modos, sobre o data store ESTRUTURADO `agente-professor-habilidades` (um
documento por habilidade, `id` = código):

- **navegação** (sem `texto`): query VAZIA + filtro exato, paginando com `pageToken`
  até acabar. É o modo de "todas as habilidades de Matemática do 6º ano": a resposta
  certa existe e é um conjunto, não um top-k.
- **semântico** (com `texto`): a mesma query sob o mesmo filtro, 20 resultados por
  relevância. É o modo de "habilidades sobre frações".
"""

from __future__ import annotations

import json
import logging
from typing import Any

from .. import curriculo
from ..busca import ErroDeBusca, cliente_busca
from ..config import configuracao

logger = logging.getLogger(__name__)

#: A API aceita no máximo 100 por página em data store estruturado.
TAMANHO_DA_PAGINA = 100
#: Teto por chamada. O maior recorte real (Língua Portuguesa do 8º ano) tem 109.
TETO_DE_ITENS = 150
#: Resultados do modo semântico.
RESULTADOS_SEMANTICOS = 20
#: Acima disto, `explicacao`/`exemplos` da Computação saem da resposta (ficam na busca
#: por código): 150 habilidades com texto pedagógico não cabem num turno.
TETO_PARA_DETALHES = 20

_AREA_NO_EM = {
    "ciencias-da-natureza": "Ciências da Natureza e suas Tecnologias (Biologia, Física e Química)",
    "ciencias-humanas": "Ciências Humanas e Sociais Aplicadas (Filosofia, Geografia, História e "
    "Sociologia)",
    "linguagens": "Linguagens e suas Tecnologias (Arte, Educação Física e Língua Inglesa)",
}


def _lista(valores: list[str]) -> str:
    return ", ".join(json.dumps(v, ensure_ascii=False) for v in valores)


def montar_filtro(
    *,
    codigos: list[str] | None = None,
    anos: list[str] | None = None,
    componentes: list[str] | None = None,
    etapas: list[str] | None = None,
) -> str:
    """Filtro exato do Discovery Engine: `campo: ANY("a", "b") AND …`."""
    partes: list[str] = []
    for campo, valores in (
        ("codigo", codigos),
        ("anos", anos),
        ("componente_slug", componentes),
        ("etapa", etapas),
    ):
        if valores:
            partes.append(f"{campo}: ANY({_lista(valores)})")
    return " AND ".join(partes)


def _documento_para_habilidade(resultado: dict[str, Any], detalhes: bool) -> dict[str, Any] | None:
    documento = resultado.get("document") or {}
    dados = documento.get("structData") or documento.get("derivedStructData") or {}
    codigo = dados.get("codigo") or documento.get("id")
    if not codigo:
        return None
    habilidade: dict[str, Any] = {
        "codigo": codigo,
        "descricao": dados.get("descricao", ""),
        "anos": dados.get("anos", []),
        "componente": dados.get("componente", ""),
        "organizador": dados.get("organizador"),
        "organizador_tipo": dados.get("organizador_tipo"),
        "objeto_conhecimento": dados.get("objeto_conhecimento"),
    }
    if detalhes:
        for campo in ("explicacao", "exemplos"):
            if dados.get(campo):
                habilidade[campo] = dados[campo]
    return habilidade


class _ErroDeEntrada(ValueError):
    pass


def _normalizar_entrada(
    codigos: list[str] | None,
    anos: list[str] | None,
    componente: str | None,
    etapa: str | None,
) -> tuple[list[str], list[str], list[str], list[str], list[str]]:
    codigos_ok: list[str] = []
    invalidos: list[str] = []
    for bruto in codigos or []:
        codigo = curriculo.normalizar_codigo(bruto)
        (codigos_ok if curriculo.CODIGO_RE.match(codigo) else invalidos).append(codigo)
    try:
        anos_ok = curriculo.normalizar_anos(anos or [])
    except curriculo.AnoDesconhecido as erro:
        raise _ErroDeEntrada(
            f"Ano não reconhecido: {erro.args[0]!r}. Use '1' a '9' (Ensino Fundamental) ou 'EM'."
        ) from erro
    try:
        componentes_ok = list(curriculo.componentes_bncc(componente)) if componente else []
    except curriculo.ComponenteDesconhecido as erro:
        raise _ErroDeEntrada(
            f"Componente não reconhecido: {componente!r}. Aceitos: "
            f"{', '.join(curriculo.nomes_de_componente_aceitos())}, e os do Ensino Médio "
            "(biologia, física, química, filosofia, sociologia)."
        ) from erro
    try:
        etapas_ok = [curriculo.normalizar_etapa(etapa)] if etapa else []
    except ValueError as erro:
        raise _ErroDeEntrada("Etapa não reconhecida: use 'EF' ou 'EM'.") from erro
    return codigos_ok, invalidos, anos_ok, componentes_ok, etapas_ok


async def buscar_habilidades(
    codigos: list[str] | None = None,
    anos: list[str] | None = None,
    componente: str | None = None,
    etapa: str | None = None,
    texto: str | None = None,
) -> dict[str, Any]:
    """Busca habilidades da BNCC (inclusive a BNCC Computação) no data store oficial.

    Use SEMPRE que a resposta envolver uma habilidade: código, texto, lista de um ano ou
    de um componente. Nunca cite habilidade que não veio desta ferramenta.

    Args:
        codigos: Códigos exatos, ex.: ["EF06MA01", "EF67LP08"]. Com códigos, os outros
            filtros são opcionais.
        anos: Anos do Ensino Fundamental ("1" a "9") ou "EM" para o Ensino Médio.
            Aceita "6º ano", "anos finais", "2ª série".
        componente: Componente curricular, ex.: "matemática", "língua portuguesa",
            "computação", "biologia". No Ensino Médio, Biologia/Física/Química trazem as
            habilidades da área de Ciências da Natureza (a BNCC do EM é por área).
        etapa: "EF" (Ensino Fundamental) ou "EM" (Ensino Médio).
        texto: Tema em linguagem livre, ex.: "frações", "pensamento computacional".
            Sem `texto`, a busca traz TODAS as habilidades do filtro (até 150).

    Returns:
        {"total", "habilidades": [{codigo, descricao, anos, componente, organizador,
        organizador_tipo, objeto_conhecimento}], "truncado"} e, quando for o caso,
        "codigos_nao_encontrados", "codigos_invalidos", "aviso".
    """
    try:
        codigos_ok, invalidos, anos_ok, componentes_ok, etapas_ok = _normalizar_entrada(
            codigos, anos, componente, etapa
        )
    except _ErroDeEntrada as erro:
        return {"erro": str(erro), "total": 0, "habilidades": [], "truncado": False}

    consulta = (texto or "").strip()
    if not (codigos_ok or anos_ok or componentes_ok or etapas_ok or consulta):
        if invalidos:
            return {
                "total": 0,
                "habilidades": [],
                "truncado": False,
                "codigos_invalidos": invalidos,
                "aviso": "Nenhum destes códigos tem o formato de uma habilidade da BNCC.",
            }
        return {
            "erro": "Informe ao menos um filtro (codigos, anos, componente, etapa) ou um texto.",
            "total": 0,
            "habilidades": [],
            "truncado": False,
        }

    filtro = montar_filtro(
        codigos=codigos_ok, anos=anos_ok, componentes=componentes_ok, etapas=etapas_ok
    )
    datastore = configuracao().datastore_habilidades
    cliente = cliente_busca()

    brutos: list[dict[str, Any]] = []
    total_informado: int | None = None
    truncado = False
    try:
        if consulta:
            corpo: dict[str, Any] = {"query": consulta, "pageSize": RESULTADOS_SEMANTICOS}
            if filtro:
                corpo["filter"] = filtro
            resposta = await cliente.buscar(datastore, corpo)
            brutos = list(resposta.get("results") or [])
            total_informado = len(brutos)
        else:
            token: str | None = None
            while True:
                corpo = {"query": "", "pageSize": TAMANHO_DA_PAGINA, "filter": filtro}
                if token:
                    corpo["pageToken"] = token
                resposta = await cliente.buscar(datastore, corpo)
                brutos.extend(resposta.get("results") or [])
                if isinstance(resposta.get("totalSize"), int):
                    total_informado = resposta["totalSize"]
                token = resposta.get("nextPageToken") or None
                if not token:
                    break
                if len(brutos) >= TETO_DE_ITENS:
                    truncado = True
                    break
    except ErroDeBusca as erro:
        logger.warning("buscar_habilidades: busca falhou status=%s", erro.status)
        return {
            "erro": "A busca de habilidades está indisponível agora. Diga ao professor que "
            "não foi possível consultar a BNCC e peça para tentar de novo em instantes.",
            "total": 0,
            "habilidades": [],
            "truncado": False,
        }

    if len(brutos) > TETO_DE_ITENS:
        truncado = True
    detalhes = min(len(brutos), TETO_DE_ITENS) <= TETO_PARA_DETALHES
    vistos: set[str] = set()
    habilidades: list[dict[str, Any]] = []
    for resultado in brutos:
        habilidade = _documento_para_habilidade(resultado, detalhes)
        if habilidade and habilidade["codigo"] not in vistos:
            vistos.add(habilidade["codigo"])
            habilidades.append(habilidade)
    if not consulta:
        habilidades.sort(key=lambda h: h["codigo"])
    habilidades = habilidades[:TETO_DE_ITENS]

    saida: dict[str, Any] = {
        "total": max(total_informado or 0, len(habilidades)) if not consulta else len(habilidades),
        "habilidades": habilidades,
        "truncado": truncado,
    }
    avisos: list[str] = []
    if truncado:
        avisos.append(
            f"A lista passou de {TETO_DE_ITENS} habilidades e foi cortada. Diga isso ao "
            "professor e sugira refinar por ano ou componente."
        )
    if codigos_ok:
        faltando = [c for c in codigos_ok if c not in vistos]
        if faltando:
            saida["codigos_nao_encontrados"] = faltando
            avisos.append("Estes códigos não existem na BNCC: não os cite como habilidade.")
    if invalidos:
        saida["codigos_invalidos"] = invalidos
    areas = [c for c in componentes_ok if c in _AREA_NO_EM]
    if (
        areas
        and (not anos_ok or "EM" in anos_ok)
        and componente
        and curriculo.slug(componente) not in _AREA_NO_EM
    ):
        avisos.append(
            "No Ensino Médio a BNCC organiza estas habilidades pela ÁREA "
            f"{_AREA_NO_EM[areas[0]]}, não pelo componente: diga isso ao professor."
        )
    if not detalhes and any(h["componente"] == "Computação" for h in habilidades):
        avisos.append(
            "A explicação e os exemplos oficiais da Computação ficaram de fora por serem "
            "muitas habilidades; busque por código para trazê-los."
        )
    if avisos:
        saida["aviso"] = " ".join(avisos)

    logger.info(
        "buscar_habilidades modo=%s filtros=%s total=%d truncado=%s",
        "semantico" if consulta else "navegacao",
        sorted(
            k
            for k, v in {
                "codigos": codigos_ok,
                "anos": anos_ok,
                "componente": componentes_ok,
                "etapa": etapas_ok,
            }.items()
            if v
        ),
        len(habilidades),
        truncado,
    )
    return saida
