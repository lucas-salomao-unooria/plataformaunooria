"""Gera `habilidades.jsonl` (`dataSchema: custom`) a partir da BNCC já extraída na api.

    uv run python -m ingestao.exportar_habilidades [--seco] [--enviar --bucket B | --projeto P]

A fonte é `apps/api/src/curriculo/dados/*.ts` — o texto do PDF HOMOLOGADO do MEC,
extraído por `scripts/extrair-bncc.mjs`. Não reextraímos: dois extratores do mesmo PDF
divergem, e o agente citaria um texto que a app-92 não mostra.

**Totais têm de bater: 1.304 EF + 183 EM + 130 Computação.** O script aborta se não
bater — um JSONL com 1.303 linhas importado em `reconciliationMode: FULL` apaga a
habilidade que faltou do data store, em silêncio.

Decisões do documento (por que cada campo é assim):

- `anos`: "1".."9" e "EM" — o `EM13` vale para as três séries, e o professor diz
  "Ensino Médio", não "1EM, 2EM e 3EM".
- `componente_slug`: o slug da BNCC, que no EM é a ÁREA (Biologia → `ciencias-da-natureza`).
  Quem traduz o componente do professor é `agente_professor.curriculo.componentes_bncc`.
- `organizador`: o nome certo por componente — unidade temática; prática de linguagem
  (Língua Portuguesa do EF); eixo (Língua Inglesa e Computação do EF); competência
  específica (EM). O rótulo vai em `organizador_tipo`.
- No EM, o `unidadeTematica` extraído é lixo do PDF (títulos de seção, texto da
  competência); o organizador sai de `competenciaEspecifica` ("Competência específica 3").
  As 54 `EM13LP` não têm competência no código e ficam sem organizador.
- Três habilidades do EF vieram com um parágrafo de introdução da área no lugar do
  objeto de conhecimento ("Cada área do conhecimento estabelece…"): o objeto fica vazio.
- **Computação**: `descricao` é SÓ o texto oficial da habilidade. `explicacao` e
  `exemplos` (do Parecer CNE/CEB 2/2022) vão em campos próprios, pesquisáveis: são o
  texto pedagógico mais valioso da Base, mas misturá-los à descrição faria o agente
  citá-los como se fossem a habilidade.
- `fonte_pagina`: a extração não guardou a página; o campo não existe (a página do
  documento vem do acervo, pelo `buscar_acervo`).
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from collections import Counter
from pathlib import Path
from typing import Any

from agente_professor import curriculo

from .armazenamento import abrir
from .comum import CAMINHO_HABILIDADES, raiz_do_repo, validar_id

TOTAIS_ESPERADOS = {"ef": 1_304, "em": 183, "computacao": 130}

_OBJETO_LIXO = "Cada área do conhecimento estabelece competências específicas de área"


def ler_dados(raiz: Path | None = None) -> dict[str, list[dict[str, Any]]]:
    raiz = raiz or raiz_do_repo()
    pasta = raiz / "apps/api/src/curriculo/dados"
    leitor = Path(__file__).with_name("ler_habilidades.mjs")
    resultado = subprocess.run(
        ["node", "--no-warnings", str(leitor), str(pasta)],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return json.loads(resultado.stdout)


def conferir_totais(dados: dict[str, list[dict[str, Any]]]) -> None:
    reais = {chave: len(dados.get(chave, [])) for chave in TOTAIS_ESPERADOS}
    if reais != TOTAIS_ESPERADOS:
        raise SystemExit(
            f"totais da BNCC não batem: esperado {TOTAIS_ESPERADOS}, lido {reais}. Nada foi gerado."
        )


def _titulo_de_eixo(eixo: str) -> str:
    return " ".join(p.capitalize() for p in eixo.lower().split())


def organizador(h: dict[str, Any]) -> tuple[str | None, str | None]:
    """(organizador, organizador_tipo)."""
    componente = h["componente"]
    if h["etapa"] == "EM":
        if componente == "computacao":
            return None, None
        n = h.get("competenciaEspecifica")
        return (f"Competência específica {n}", "competência específica") if n else (None, None)
    if componente == "computacao":
        eixo = h.get("eixo")
        return (_titulo_de_eixo(eixo), "eixo") if eixo else (None, None)
    valor = h.get("unidadeTematica") or None
    if componente == "lingua-portuguesa":
        return valor, "prática de linguagem" if valor else None
    if componente == "lingua-inglesa":
        return valor, "eixo" if valor else None
    return valor, "unidade temática" if valor else None


def para_documento(h: dict[str, Any]) -> dict[str, Any]:
    codigo = h["codigo"]
    if not curriculo.CODIGO_RE.match(codigo):
        raise SystemExit(f"código fora do formato: {codigo!r}")
    validar_id(codigo)
    anos = curriculo.anos_do_documento(h["anos"])
    slug_do_componente = h["componente"]
    rotulo = curriculo.ROTULOS[slug_do_componente]
    objeto = h.get("objetoDeConhecimento") or None
    if objeto and objeto.startswith(_OBJETO_LIXO):
        objeto = None
    org, tipo = organizador(h)
    documento: dict[str, Any] = {
        "id": codigo,
        "codigo": codigo,
        "titulo": f"{codigo} — {rotulo}, {curriculo.rotulo_dos_anos(anos)}",
        "etapa": h["etapa"],
        "anos": anos,
        "componente": rotulo,
        "componente_slug": slug_do_componente,
        "area": h.get("area"),
        "organizador": org,
        "organizador_tipo": tipo,
        "objeto_conhecimento": objeto,
        "descricao": h["descricao"],
    }
    for campo in ("explicacao", "exemplos"):
        if h.get(campo):
            documento[campo] = h[campo]
    return {k: v for k, v in documento.items() if v is not None}


def gerar(dados: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    conferir_totais(dados)
    documentos = [para_documento(h) for chave in TOTAIS_ESPERADOS for h in dados[chave]]
    repetidos = [c for c, n in Counter(d["id"] for d in documentos).items() if n > 1]
    if repetidos:
        raise SystemExit(f"códigos repetidos: {repetidos}")
    return documentos


def para_jsonl(documentos: list[dict[str, Any]]) -> bytes:
    return "".join(json.dumps(d, ensure_ascii=False) + "\n" for d in documentos).encode("utf-8")


def resumo(documentos: list[dict[str, Any]]) -> str:
    por_componente = Counter((d["etapa"], d["componente_slug"]) for d in documentos)
    linhas = [f"{len(documentos)} habilidades"]
    linhas += [f"  {etapa} {slug}: {n}" for (etapa, slug), n in sorted(por_componente.items())]
    return "\n".join(linhas)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--seco", action="store_true", help="só mostra o que faria")
    parser.add_argument("--saida", type=Path, default=Path("ingestao/saida/habilidades.jsonl"))
    parser.add_argument("--enviar", action="store_true", help="grava no bucket (ou no --local)")
    parser.add_argument("--bucket")
    parser.add_argument("--projeto")
    parser.add_argument("--local", type=Path, help="pasta que espelha o bucket")
    args = parser.parse_args(argv)

    documentos = gerar(ler_dados())
    print(resumo(documentos))
    conteudo = para_jsonl(documentos)
    if args.seco:
        print(f"[seco] gravaria {len(conteudo)} bytes em {args.saida}")
        if args.enviar:
            print(f"[seco] enviaria para {CAMINHO_HABILIDADES} no bucket")
        return 0
    args.saida.parent.mkdir(parents=True, exist_ok=True)
    args.saida.write_bytes(conteudo)
    print(f"gravado {args.saida}")
    if args.enviar:
        destino = abrir(args.bucket, args.local, args.projeto)
        destino.gravar(CAMINHO_HABILIDADES, conteudo, "application/x-ndjson")
        print(f"enviado gs://{destino.bucket}/{CAMINHO_HABILIDADES}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
