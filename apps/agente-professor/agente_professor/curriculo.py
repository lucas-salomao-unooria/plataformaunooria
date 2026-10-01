"""O vocabulário do currículo, do lado do agente: normalização de componente, ano e etapa.

É o MESMO dicionário para quem escreve o data store (`ingestao/exportar_habilidades.py`)
e para quem o consulta (`ferramentas/habilidades.py`). Dois dicionários divergem, e a
divergência não dá erro: dá "nenhuma habilidade encontrada".

A armadilha central (a mesma de `apps/api/src/curriculo/componentes.ts`): no Ensino
Médio a BNCC só desce até a ÁREA. Biologia, Física e Química compartilham as
`EM13CNT` (Ciências da Natureza); Filosofia, Geografia, História e Sociologia, as
`EM13CHS` (Ciências Humanas); Arte, Educação Física e Inglês, as `EM13LGG`
(Linguagens). Língua Portuguesa (`EM13LP`) e Matemática (`EM13MAT`) são os únicos
componentes que a BNCC do EM nomeia. Por isso o componente do professor vira uma
LISTA de `componente_slug` no filtro: "historia" busca `historia` (EF) E
`ciencias-humanas` (EM) — no EF não existe habilidade com slug de área, então a
expansão não traz nada a mais.
"""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Iterable

#: Formato do código. `EF05CO011` tem TRÊS dígitos no documento oficial — não "conserte".
CODIGO_RE = re.compile(r"^E[FM]\d{2}[A-Z]{2,3}\d{2,3}$")
CODIGO_NO_TEXTO_RE = re.compile(r"\bE[FM]\d{2}[A-Z]{2,3}\d{2,3}\b")

ANOS_EF = tuple(str(n) for n in range(1, 10))
#: Os valores de `anos` no data store: "1".."9" e "EM" (o `EM13` vale para as três séries).
ANOS_VALIDOS = (*ANOS_EF, "EM")


def slug(texto: str) -> str:
    """Minúsculo, sem acento, separado por hífen: "Língua Portuguesa" → "lingua-portuguesa"."""
    sem_acento = "".join(
        c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn"
    )
    return re.sub(r"[^a-z0-9]+", "-", sem_acento.lower()).strip("-")


# ---------------------------------------------------------------- componentes

#: `componente_slug` do data store → rótulo. No EM, o slug de ÁREA ganha o nome da área.
ROTULOS: dict[str, str] = {
    "lingua-portuguesa": "Língua Portuguesa",
    "matematica": "Matemática",
    "ciencias": "Ciências",
    "historia": "História",
    "geografia": "Geografia",
    "arte": "Arte",
    "educacao-fisica": "Educação Física",
    "lingua-inglesa": "Língua Inglesa",
    "ensino-religioso": "Ensino Religioso",
    "computacao": "Computação",
    "ciencias-da-natureza": "Ciências da Natureza e suas Tecnologias",
    "ciencias-humanas": "Ciências Humanas e Sociais Aplicadas",
    "linguagens": "Linguagens e suas Tecnologias",
}

#: O que o professor diz (já em `slug`) → os `componente_slug` que o filtro aceita.
_ALIASES: dict[str, tuple[str, ...]] = {}


def _alias(destinos: tuple[str, ...], *nomes: str) -> None:
    for nome in nomes:
        _ALIASES[slug(nome)] = destinos


_alias(
    ("lingua-portuguesa",),
    "lingua-portuguesa",
    "portugues",
    "lp",
    "lingua-portuguesa-em",
    "lingua-portuguesa-e-suas-literaturas",
    "literatura",
    "redacao",
)
_alias(("matematica",), "matematica", "mat", "matematica-em", "matematica-e-suas-tecnologias")
_alias(("ciencias", "ciencias-da-natureza"), "ciencias", "ciencias-naturais")
_alias(
    ("ciencias-da-natureza",),
    "ciencias-da-natureza",
    "ciencias-da-natureza-e-suas-tecnologias",
    "cnt",
    "biologia",
    "fisica",
    "quimica",
)
_alias(("historia", "ciencias-humanas"), "historia", "historia-em")
_alias(("geografia", "ciencias-humanas"), "geografia", "geografia-em")
_alias(
    ("ciencias-humanas",),
    "ciencias-humanas",
    "ciencias-humanas-e-sociais-aplicadas",
    "chs",
    "filosofia",
    "sociologia",
)
_alias(
    ("arte", "linguagens"), "arte", "artes", "arte-em", "artes-visuais", "musica", "danca", "teatro"
)
_alias(
    ("educacao-fisica", "linguagens"),
    "educacao-fisica",
    "ed-fisica",
    "edfisica",
    "educacao-fisica-em",
)
_alias(("lingua-inglesa", "linguagens"), "lingua-inglesa", "ingles", "lingua-inglesa-em")
_alias(("linguagens",), "linguagens", "linguagens-e-suas-tecnologias", "lgg")
_alias(("ensino-religioso",), "ensino-religioso", "religiao")
_alias(
    ("computacao",),
    "computacao",
    "informatica",
    "pensamento-computacional",
    "cultura-digital",
    "mundo-digital",
    "educacao-digital",
    "bncc-computacao",
)

#: Componentes que o professor escolhe e que dão nome a pasta de livro no bucket.
COMPONENTES_DO_ACERVO = (
    "lingua-portuguesa",
    "matematica",
    "ciencias",
    "historia",
    "geografia",
    "arte",
    "educacao-fisica",
    "lingua-inglesa",
    "ensino-religioso",
    "computacao",
    "biologia",
    "fisica",
    "quimica",
    "filosofia",
    "sociologia",
    "todos",
)


class ComponenteDesconhecido(ValueError):
    """O componente não casa com nenhum nome conhecido."""


def componentes_bncc(componente: str) -> tuple[str, ...]:
    """Os `componente_slug` de habilidade que valem para o componente que o professor disse."""
    chave = slug(componente)
    if chave in _ALIASES:
        return _ALIASES[chave]
    raise ComponenteDesconhecido(componente)


def componente_do_acervo(componente: str) -> str:
    """O slug de pasta de livro (`livros/originais/<slug>/`) para o componente dito."""
    chave = slug(componente)
    for sufixo in ("-em",):
        if chave.endswith(sufixo) and chave[: -len(sufixo)] in COMPONENTES_DO_ACERVO:
            chave = chave[: -len(sufixo)]
    if chave in COMPONENTES_DO_ACERVO:
        return chave
    # Nomes livres ("portugues", "ingles") caem no primeiro destino do alias.
    if chave in _ALIASES:
        destino = _ALIASES[chave][0]
        if destino in COMPONENTES_DO_ACERVO:
            return destino
    raise ComponenteDesconhecido(componente)


def nomes_de_componente_aceitos() -> list[str]:
    return sorted(ROTULOS)


# ---------------------------------------------------------------------- anos

_ORDINAIS = {
    "primeiro": "1",
    "segundo": "2",
    "terceiro": "3",
    "quarto": "4",
    "quinto": "5",
    "sexto": "6",
    "setimo": "7",
    "oitavo": "8",
    "nono": "9",
}


class AnoDesconhecido(ValueError):
    """O ano não casa com nenhum formato conhecido."""


def normalizar_ano(valor: str) -> set[str]:
    """ "6", "6º ano", "sexto ano", "6EF", "EM", "2ª série", "anos iniciais" → {"6"} / {"EM"}…"""
    bruto = slug(str(valor)).replace("-", " ")
    if not bruto:
        raise AnoDesconhecido(valor)
    for palavra, digito in _ORDINAIS.items():
        bruto = re.sub(rf"\b{palavra}\b", digito, bruto)

    if re.search(r"\b(em|medio|serie|series)\b", bruto) or re.search(
        r"\b[1-3]\s*a?\s*em\b|\bem\s*[1-3]\b|\b[1-3]em\b|\bem[1-3]\b", bruto
    ):
        return {"EM"}
    if "anos iniciais" in bruto or bruto in {"iniciais", "fundamental 1", "ef1", "ef 1"}:
        return set(ANOS_EF[:5])
    if "anos finais" in bruto or bruto in {"finais", "fundamental 2", "ef2", "ef 2"}:
        return set(ANOS_EF[5:])
    faixa = re.search(r"\b([1-9])\s*o?\s*(?:ano\s*)?(?:a|ao|ate|e)\s*([1-9])\b", bruto)
    if faixa:
        inicio, fim = int(faixa.group(1)), int(faixa.group(2))
        if inicio <= fim:
            return {str(n) for n in range(inicio, fim + 1)}
    unico = re.fullmatch(
        r"(?:ef\s*)?0?([1-9])\s*(?:o|a)?\s*(?:ano)?\s*(?:ef|do ef|do fundamental)?", bruto
    )
    if unico:
        return {unico.group(1)}
    raise AnoDesconhecido(valor)


def normalizar_anos(valores: Iterable[str]) -> list[str]:
    saida: set[str] = set()
    for valor in valores:
        saida |= normalizar_ano(valor)
    return sorted(saida, key=ANOS_VALIDOS.index)


def anos_do_documento(anos: Iterable[str]) -> list[str]:
    """Os anos como vêm de `tipos.ts` ("6EF", "1EM") → os do data store ("6", "EM")."""
    saida: list[str] = []
    for ano in anos:
        valor = "EM" if ano.endswith("EM") else ano.removesuffix("EF")
        if valor not in ANOS_VALIDOS:
            raise AnoDesconhecido(ano)
        if valor not in saida:
            saida.append(valor)
    return saida


def normalizar_etapa(valor: str) -> str:
    chave = slug(valor)
    if chave in {"ef", "fundamental", "ensino-fundamental", "anos-iniciais", "anos-finais"}:
        return "EF"
    if chave in {"em", "medio", "ensino-medio"}:
        return "EM"
    raise ValueError(f"etapa desconhecida: {valor}")


def rotulo_dos_anos(anos: list[str]) -> str:
    """["6"] → "6º ano"; ["6","7"] → "6º e 7º ano"; ["1".."5"] → "1º ao 5º ano"; ["EM"] → "Ensino Médio"."""
    if anos == ["EM"]:
        return "Ensino Médio"
    numeros = sorted(int(a) for a in anos if a != "EM")
    if not numeros:
        return ""
    if len(numeros) == 1:
        return f"{numeros[0]}º ano"
    if len(numeros) == 2:
        return f"{numeros[0]}º e {numeros[1]}º ano"
    return f"{numeros[0]}º ao {numeros[-1]}º ano"


def normalizar_codigo(codigo: str) -> str:
    return re.sub(r"\s+", "", codigo).upper().strip("()")
