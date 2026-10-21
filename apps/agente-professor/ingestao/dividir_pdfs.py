"""Divide os PDFs originais em partes de até 500 páginas e grava o manifesto de cada um.

    uv run python -m ingestao.dividir_pdfs [--seco] [--forcar] (--bucket B | --projeto P) [--local PASTA]

Por que dividir: o parser de layout do Vertex AI Search não aceita PDF acima de 500
páginas, e a BNCC completa tem 600. Por que o MANIFESTO: é dele que
`gerar_metadados_acervo` tira o `pagina_inicial_original` de cada parte — sem ele,
a página citada ao professor é a da PARTE, não a do documento (a p. 12 da 2ª parte
da BNCC é a p. 474 do PDF oficial).

Todo original ganha manifesto, inclusive os de até 500 páginas (com uma parte só: o
próprio original). Assim `gerar_metadados_acervo` nunca adivinha: original sem
manifesto é erro, e a mensagem manda rodar este script.

Onde cortar, na ordem de preferência:
1. `cortes` do arquivo irmão `<arquivo>.json` (ex.: `{"cortes": [463]}`) — a primeira
   página de cada parte nova;
2. o início de etapa detectado no texto (na BNCC, a 1ª página do Ensino Médio é a 463
   do PDF: o corte fica 1–462 / 463–600, uma parte por etapa);
3. capítulos do sumário do PDF (os marcadores com cara de título);
4. a cada 500 páginas.

Idempotente: original com manifesto é pulado; `--forcar` refaz (use ao TROCAR um
original no bucket). A página do PDF não é a página impressa: na BNCC completa, a
página impressa é a do PDF menos 2 — o agente cita a do PDF, que é a que o leitor de
PDF mostra e a que um link `#page=` abre.
"""

from __future__ import annotations

import argparse
import contextlib
import io
import json
import logging
import re
import sys
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

from pypdf import PdfReader, PdfWriter

from .armazenamento import Armazenamento, abrir
from .comum import (
    PREFIXO_BNCC_ORIGINAIS,
    PREFIXO_BNCC_PARTES,
    PREFIXO_LIVROS_ORIGINAIS,
    PREFIXO_LIVROS_PARTES,
    projeto_padrao,
)

logging.getLogger("pypdf").setLevel(logging.ERROR)

TETO_DE_PAGINAS = 500
#: Frases que abrem uma etapa no documento oficial (a 1ª página da etapa as contém).
MARCADORES_DE_ETAPA = (
    "O Ensino Médio no contexto da Educação Básica",
    "O Ensino Fundamental no contexto da Educação Básica",
    "A Educação Infantil na Base Nacional Comum Curricular",
)
_MARCADOR_DE_WORD = re.compile(r"^(_|back\d|_GoBack|_Hlk)", re.IGNORECASE)


@dataclass(frozen=True)
class Parte:
    inicio: int  # 1-based, inclusive
    fim: int

    @property
    def paginas(self) -> int:
        return self.fim - self.inicio + 1


def planejar(total: int, cortes: list[int], teto: int = TETO_DE_PAGINAS) -> list[Parte]:
    """Partes de até `teto` páginas, cortando no maior corte preferido que couber."""
    if total <= teto:
        return [Parte(1, total)]
    partes: list[Parte] = []
    inicio = 1
    candidatos = sorted({c for c in cortes if 1 < c <= total})
    while total - inicio + 1 > teto:
        cabem = [c for c in candidatos if inicio < c <= inicio + teto]
        proximo = max(cabem) if cabem else inicio + teto
        partes.append(Parte(inicio, proximo - 1))
        inicio = proximo
    partes.append(Parte(inicio, total))
    return partes


def cortes_do_documento(leitor: PdfReader) -> list[int]:
    cortes: set[int] = set()
    for indice, pagina in enumerate(leitor.pages):
        try:
            texto = " ".join((pagina.extract_text() or "").split())
        except Exception:  # noqa: S112 — página ilegível só não oferece corte
            continue
        if any(m in texto[:400] for m in MARCADORES_DE_ETAPA):
            cortes.add(indice + 1)

    def percorrer(itens: list[object]) -> None:
        for item in itens:
            if isinstance(item, list):
                percorrer(item)
                continue
            titulo = str(getattr(item, "title", "") or "")
            if titulo and not _MARCADOR_DE_WORD.match(titulo):
                try:
                    cortes.add(leitor.get_destination_page_number(item) + 1)  # type: ignore[arg-type]
                except Exception:  # noqa: S112
                    continue

    with contextlib.suppress(Exception):  # sumário corrompido não impede a divisão
        percorrer(list(leitor.outline))
    return sorted(cortes)


def caminho_da_parte(original: str, parte: Parte) -> str:
    """`bncc/originais/x.pdf` → `bncc/partes/x__p0001-0462.pdf` (e o mesmo em `livros/`)."""
    for de, para in (
        (PREFIXO_BNCC_ORIGINAIS, PREFIXO_BNCC_PARTES),
        (PREFIXO_LIVROS_ORIGINAIS, PREFIXO_LIVROS_PARTES),
    ):
        if original.startswith(de):
            relativo = PurePosixPath(original[len(de) :])
            return f"{para}{relativo.with_name(f'{relativo.stem}__p{parte.inicio:04d}-{parte.fim:04d}.pdf')}"
    raise ValueError(f"original fora da convenção de pastas: {original}")


def caminho_do_manifesto(original: str) -> str:
    return caminho_da_parte(original, Parte(0, 0)).replace("__p0000-0000.pdf", ".partes.json")


def ler_ao_lado(armazenamento: Armazenamento, original: str) -> dict[str, object]:
    irmao = original.removesuffix(".pdf") + ".json"
    if armazenamento.existe(irmao):
        return json.loads(armazenamento.ler(irmao))
    return {}


def originais(armazenamento: Armazenamento) -> list[str]:
    return [
        c
        for prefixo in (PREFIXO_BNCC_ORIGINAIS, PREFIXO_LIVROS_ORIGINAIS)
        for c in armazenamento.listar(prefixo)
        if c.lower().endswith(".pdf")
    ]


def dividir(armazenamento: Armazenamento, *, seco: bool, forcar: bool) -> list[str]:
    relatorio: list[str] = []
    for original in originais(armazenamento):
        manifesto = caminho_do_manifesto(original)
        if armazenamento.existe(manifesto) and not forcar:
            relatorio.append(f"= {original}: já dividido ({manifesto})")
            continue
        leitor = PdfReader(io.BytesIO(armazenamento.ler(original)))
        total = len(leitor.pages)
        ao_lado = ler_ao_lado(armazenamento, original)
        cortes_manuais = ao_lado.get("cortes")
        if isinstance(cortes_manuais, list):
            cortes = [int(c) for c in cortes_manuais]
        else:
            cortes = cortes_do_documento(leitor) if total > TETO_DE_PAGINAS else []
        plano = planejar(total, cortes)
        partes = []
        for parte in plano:
            destino = original if len(plano) == 1 else caminho_da_parte(original, parte)
            partes.append(
                {
                    "caminho": destino,
                    "pagina_inicial_original": parte.inicio,
                    "pagina_final_original": parte.fim,
                }
            )
        descricao = ", ".join(f"{p.inicio}–{p.fim}" for p in plano)
        relatorio.append(f"{'[seco] ' if seco else ''}+ {original}: {total} páginas → {descricao}")
        if seco:
            continue
        if len(plano) > 1:
            for parte, registro in zip(plano, partes, strict=True):
                escritor = PdfWriter()
                for indice in range(parte.inicio - 1, parte.fim):
                    escritor.add_page(leitor.pages[indice])
                saida = io.BytesIO()
                escritor.write(saida)
                armazenamento.gravar(str(registro["caminho"]), saida.getvalue(), "application/pdf")
        conteudo = {"original": original, "paginas": total, "partes": partes}
        armazenamento.gravar(
            manifesto,
            json.dumps(conteudo, ensure_ascii=False, indent=2).encode(),
            "application/json",
        )
    return relatorio


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--seco", action="store_true", help="só mostra o que faria")
    parser.add_argument("--forcar", action="store_true", help="refaz mesmo com manifesto")
    parser.add_argument("--bucket")
    parser.add_argument("--projeto")
    parser.add_argument("--local", type=Path, help="pasta que espelha o bucket")
    args = parser.parse_args(argv)
    armazenamento = abrir(args.bucket, args.local, projeto_padrao(args.projeto))
    for linha in dividir(armazenamento, seco=args.seco, forcar=args.forcar):
        print(linha)
    return 0


if __name__ == "__main__":
    sys.exit(main())
