"""Gera `metadados/acervo.jsonl` (`dataSchema: document`) pela convenção de pastas.

    uv run python -m ingestao.gerar_metadados_acervo [--seco] (--bucket B | --projeto P) [--local PASTA]

Uma linha por PDF que o data store vai ler (a parte, quando o original foi dividido):

    {"id": "...", "structData": {tipo, titulo, componente_slug, etapa, anos, serie,
     pagina_inicial_original, uri_original},
     "content": {"mimeType": "application/pdf", "uri": "gs://<bucket>/<parte>"}}

A convenção (`livros/originais/<componente_slug>/<serie>/<arquivo>.pdf`) é o
contrato com quem sobe livro: pasta fora dela ABORTA a geração inteira, com a lista
do que está errado. Gerar o resto e pular o livro mal arquivado é o livro que nunca
aparece na busca, sem ninguém saber por quê.

- `<componente_slug>`: um de `agente_professor.curriculo.COMPONENTES_DO_ACERVO`
  (`todos` para livro que serve a qualquer componente).
- `<serie>`: `1`..`9`, `em1`, `em2`, `em3` ou `todas`. No filtro, `em1..em3` viram
  `anos: ["EM"]` (o mesmo valor das habilidades), e a série exata fica em `serie`.
- Título: `titulo` do arquivo irmão `<arquivo>.json`, ou o nome do arquivo.

Rode `dividir_pdfs` antes: original sem manifesto é erro.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path, PurePosixPath
from typing import Any

from agente_professor import curriculo

from .armazenamento import Armazenamento, abrir, uri
from .comum import (
    CAMINHO_ACERVO,
    PREFIXO_BNCC_ORIGINAIS,
    PREFIXO_LIVROS_ORIGINAIS,
    id_de_documento,
    projeto_padrao,
)
from .dividir_pdfs import caminho_do_manifesto, ler_ao_lado, originais

SERIES = {
    **{str(n): (["EF"], [str(n)]) for n in range(1, 10)},
    "em1": (["EM"], ["EM"]),
    "em2": (["EM"], ["EM"]),
    "em3": (["EM"], ["EM"]),
    "todas": (["EF", "EM"], list(curriculo.ANOS_VALIDOS)),
}

#: Os documentos oficiais conhecidos. Outro PDF em `bncc/originais/` usa o arquivo
#: irmão `.json` (`titulo`, `componente_slug`) ou cai no padrão "vale para todos".
DOCUMENTOS_DA_BNCC: dict[str, dict[str, Any]] = {
    "bncc-completa-2018.pdf": {
        "titulo": "Base Nacional Comum Curricular (BNCC)",
        "componente_slug": ["todos"],
    },
    "bncc-computacao-2022.pdf": {
        "titulo": "BNCC Computação — Complemento à BNCC (2022)",
        "componente_slug": ["computacao", "todos"],
    },
    # Os cadernos de Temas Contemporâneos Transversais do MEC: atravessam todos
    # os componentes, por isso "todos".
    "tct-economia-2022.pdf": {
        "titulo": "Temas Contemporâneos Transversais na BNCC — Economia (2022)",
        "componente_slug": ["todos"],
    },
    "tct-meio-ambiente-2022.pdf": {
        "titulo": "Temas Contemporâneos Transversais na BNCC — Meio Ambiente (2022)",
        "componente_slug": ["todos"],
    },
    "tct-saude-2022.pdf": {
        "titulo": "Temas Contemporâneos Transversais na BNCC — Saúde (2022)",
        "componente_slug": ["todos"],
    },
}


class ConvencaoViolada(ValueError):
    pass


def titulo_do_arquivo(nome: str) -> str:
    base = PurePosixPath(nome).stem.replace("_", " ").replace("-", " ")
    base = " ".join(base.split())
    return base[:1].upper() + base[1:] if base else "Documento"


def classificar(original: str, ao_lado: dict[str, Any]) -> dict[str, Any]:
    """O `structData` (sem página nem URI) de um original, pela pasta onde ele está."""
    if original.startswith(PREFIXO_BNCC_ORIGINAIS):
        nome = original[len(PREFIXO_BNCC_ORIGINAIS) :]
        if "/" in nome:
            raise ConvencaoViolada(f"{original}: bncc/originais/ não tem subpastas")
        conhecido = DOCUMENTOS_DA_BNCC.get(nome, {})
        componentes = (
            ao_lado.get("componente_slug") or conhecido.get("componente_slug") or ["todos"]
        )
        return {
            "tipo": "bncc_documento",
            "titulo": ao_lado.get("titulo") or conhecido.get("titulo") or titulo_do_arquivo(nome),
            "componente_slug": list(componentes),
            "etapa": ["EF", "EM"],
            "anos": list(curriculo.ANOS_VALIDOS),
            "serie": "todas",
        }
    if original.startswith(PREFIXO_LIVROS_ORIGINAIS):
        partes = original[len(PREFIXO_LIVROS_ORIGINAIS) :].split("/")
        if len(partes) != 3:
            raise ConvencaoViolada(
                f"{original}: o caminho tem de ser livros/originais/<componente>/<serie>/<arquivo>.pdf"
            )
        componente, serie, nome = partes
        if componente not in curriculo.COMPONENTES_DO_ACERVO:
            raise ConvencaoViolada(
                f"{original}: componente {componente!r} desconhecido; use um de "
                f"{', '.join(curriculo.COMPONENTES_DO_ACERVO)}"
            )
        if serie not in SERIES:
            raise ConvencaoViolada(
                f"{original}: série {serie!r} desconhecida; use 1..9, em1, em2, em3 ou todas"
            )
        etapa, anos = SERIES[serie]
        return {
            "tipo": "livro_didatico",
            "titulo": ao_lado.get("titulo") or titulo_do_arquivo(nome),
            "componente_slug": [componente],
            "etapa": etapa,
            "anos": anos,
            "serie": serie,
        }
    raise ConvencaoViolada(f"{original}: fora de bncc/originais/ e de livros/originais/")


def gerar(armazenamento: Armazenamento) -> list[dict[str, Any]]:
    linhas: list[dict[str, Any]] = []
    erros: list[str] = []
    for original in originais(armazenamento):
        try:
            base = classificar(original, ler_ao_lado(armazenamento, original))
        except ConvencaoViolada as erro:
            erros.append(str(erro))
            continue
        manifesto = caminho_do_manifesto(original)
        if not armazenamento.existe(manifesto):
            erros.append(f"{original}: sem manifesto ({manifesto}); rode ingestao.dividir_pdfs")
            continue
        for parte in json.loads(armazenamento.ler(manifesto))["partes"]:
            caminho = str(parte["caminho"])
            linhas.append(
                {
                    "id": id_de_documento(caminho),
                    "structData": {
                        **base,
                        "pagina_inicial_original": int(parte["pagina_inicial_original"]),
                        "uri_original": uri(armazenamento.bucket, original),
                    },
                    "content": {
                        "mimeType": "application/pdf",
                        "uri": uri(armazenamento.bucket, caminho),
                    },
                }
            )
    if erros:
        raise ConvencaoViolada(
            "acervo fora da convenção — nada foi gerado:\n  " + "\n  ".join(erros)
        )
    repetidos = {linha["id"] for linha in linhas if sum(o["id"] == linha["id"] for o in linhas) > 1}
    if repetidos:
        raise ConvencaoViolada(f"ids repetidos: {sorted(repetidos)}")
    return linhas


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--seco", action="store_true", help="só mostra o que faria")
    parser.add_argument("--bucket")
    parser.add_argument("--projeto")
    parser.add_argument("--local", type=Path, help="pasta que espelha o bucket")
    args = parser.parse_args(argv)
    armazenamento = abrir(args.bucket, args.local, projeto_padrao(args.projeto))
    try:
        linhas = gerar(armazenamento)
    except ConvencaoViolada as erro:
        print(erro, file=sys.stderr)
        return 1
    for linha in linhas:
        dados = linha["structData"]
        print(
            f"{linha['id']}: {dados['tipo']} {dados['componente_slug']} {dados['serie']} "
            f"p.{dados['pagina_inicial_original']}+"
        )
    conteudo = "".join(json.dumps(linha, ensure_ascii=False) + "\n" for linha in linhas)
    if args.seco:
        print(
            f"[seco] gravaria {len(linhas)} documentos em gs://{armazenamento.bucket}/{CAMINHO_ACERVO}"
        )
        return 0
    armazenamento.gravar(CAMINHO_ACERVO, conteudo.encode("utf-8"), "application/x-ndjson")
    print(f"gravado gs://{armazenamento.bucket}/{CAMINHO_ACERVO} ({len(linhas)} documentos)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
