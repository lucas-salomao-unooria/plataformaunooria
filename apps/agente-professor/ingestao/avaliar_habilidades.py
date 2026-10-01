"""O relatório que decide se a busca de habilidades por data store SERVE.

    uv run python -m ingestao.avaliar_habilidades --projeto P [--seco] [--jsonl ARQ]

Roda a MESMA `buscar_habilidades` que o agente chama (filtro, normalização, paginação),
contra o data store real, e compara com o JSON exportado:

1. **Navegação exata** — para TODA combinação (componente × ano) que existe no JSON, o
   conjunto de códigos devolvido tem de ser IGUAL ao esperado (precisão e revocação de
   100%). Uma habilidade a menos aqui é um plano que descumpre o currículo.
2. **Perguntas de professor** (`casos_avaliacao.json`, ~30) — o que o agente pediria à
   ferramenta para cada pergunta. `"auto"` = conjunto exato (como na parte 1); lista =
   o MÍNIMO anotado à mão que tem de aparecer entre os resultados (revocação de 100%;
   a precisão é informativa, porque o modo semântico sempre traz 20).

Grava `ingestao/relatorios/avaliacao-habilidades-<data>.md`. Só LÊ do data store.
"""

from __future__ import annotations

import argparse
import asyncio
import datetime as dt
import json
import sys
from collections.abc import Iterable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from agente_professor import curriculo
from agente_professor.busca import ClienteBusca, ClienteDiscoveryEngine, definir_cliente_busca
from agente_professor.ferramentas.habilidades import buscar_habilidades

from .comum import projeto_padrao

CASOS = Path(__file__).with_name("casos_avaliacao.json")
RELATORIOS = Path(__file__).with_name("relatorios")


def esperado_por_filtro(documentos: Iterable[dict[str, Any]], args: dict[str, Any]) -> set[str]:
    """O conjunto exato que o filtro da ferramenta deve devolver, calculado do JSON."""
    codigos = {curriculo.normalizar_codigo(c) for c in args.get("codigos") or []}
    anos = set(curriculo.normalizar_anos(args.get("anos") or []))
    componentes = (
        set(curriculo.componentes_bncc(args["componente"])) if args.get("componente") else set()
    )
    etapa = curriculo.normalizar_etapa(args["etapa"]) if args.get("etapa") else None
    saida = set()
    for d in documentos:
        if codigos and d["codigo"] not in codigos:
            continue
        if anos and not anos & set(d["anos"]):
            continue
        if componentes and d["componente_slug"] not in componentes:
            continue
        if etapa and d["etapa"] != etapa:
            continue
        saida.add(d["codigo"])
    return saida


@dataclass
class Resultado:
    id: str
    descricao: str
    esperado: set[str]
    retornado: list[str]
    exato: bool
    nota: str = ""
    erro: str | None = None
    truncado: bool = False

    @property
    def acertos(self) -> set[str]:
        return self.esperado & set(self.retornado)

    @property
    def revocacao(self) -> float:
        if not self.esperado:
            return 1.0 if not self.retornado else 0.0
        return len(self.acertos) / len(self.esperado)

    @property
    def precisao(self) -> float:
        if not self.retornado:
            return 1.0 if not self.esperado else 0.0
        return len(self.acertos) / len(self.retornado)

    @property
    def passou(self) -> bool:
        if self.erro or self.truncado:
            return False
        if self.exato:
            return set(self.retornado) == self.esperado
        return self.revocacao == 1.0

    @property
    def faltando(self) -> list[str]:
        return sorted(self.esperado - set(self.retornado))

    @property
    def sobrando(self) -> list[str]:
        return sorted(set(self.retornado) - self.esperado)

    def posicoes(self) -> dict[str, int]:
        return {c: i + 1 for i, c in enumerate(self.retornado) if c in self.esperado}


@dataclass
class Relatorio:
    navegacao: list[Resultado] = field(default_factory=list)
    perguntas: list[Resultado] = field(default_factory=list)


async def _rodar(args: dict[str, Any]) -> tuple[list[str], str | None, bool]:
    resposta = await buscar_habilidades(**args)
    codigos = [h["codigo"] for h in resposta.get("habilidades", [])]
    return codigos, resposta.get("erro"), bool(resposta.get("truncado"))


def combinacoes(documentos: list[dict[str, Any]]) -> list[tuple[str, str]]:
    pares = {(d["componente_slug"], ano) for d in documentos for ano in d["anos"]}
    return sorted(pares, key=lambda p: (p[0], curriculo.ANOS_VALIDOS.index(p[1])))


async def avaliar(
    documentos: list[dict[str, Any]], casos: list[dict[str, Any]], cliente: ClienteBusca
) -> Relatorio:
    definir_cliente_busca(cliente)
    relatorio = Relatorio()
    try:
        for componente, ano in combinacoes(documentos):
            args = {"componente": componente, "anos": [ano]}
            codigos, erro, truncado = await _rodar(args)
            relatorio.navegacao.append(
                Resultado(
                    id=f"{componente}|{ano}",
                    descricao=f"{curriculo.ROTULOS[componente]}, {ano}",
                    esperado=esperado_por_filtro(documentos, args),
                    retornado=codigos,
                    exato=True,
                    erro=erro,
                    truncado=truncado,
                )
            )
        for caso in casos:
            codigos, erro, truncado = await _rodar(caso["args"])
            automatico = caso["esperado"] == "auto"
            esperado = (
                esperado_por_filtro(documentos, caso["args"])
                if automatico
                else set(caso["esperado"])
            )
            exato = automatico or ("codigos" in caso["args"] and "texto" not in caso["args"])
            relatorio.perguntas.append(
                Resultado(
                    id=caso["id"],
                    descricao=caso["pergunta"],
                    esperado=esperado,
                    retornado=codigos,
                    exato=exato,
                    nota=caso.get("nota", ""),
                    erro=erro,
                    truncado=truncado,
                )
            )
    finally:
        definir_cliente_busca(None)
    return relatorio


def _pct(valor: float) -> str:
    return f"{valor * 100:.0f}%"


def em_markdown(relatorio: Relatorio, *, data: str, alvo: str) -> str:
    nav, perg = relatorio.navegacao, relatorio.perguntas
    nav_ok = sum(r.passou for r in nav)
    perg_ok = sum(r.passou for r in perg)
    linhas = [
        f"# Avaliação da busca de habilidades — {data}",
        "",
        f"Data store: `{alvo}`. Gerado por `ingestao/avaliar_habilidades.py`.",
        "",
        "## Resumo",
        "",
        "| Parte | Casos | Passaram | Critério |",
        "|---|---|---|---|",
        f"| Navegação exata (componente × ano) | {len(nav)} | {nav_ok} | conjunto idêntico |",
        f"| Perguntas de professor | {len(perg)} | {perg_ok} | exato (auto/código) ou mínimo anotado no top-20 |",
        "",
        f"**Veredito: {'SERVE' if nav_ok == len(nav) and perg_ok == len(perg) else 'NÃO SERVE AINDA — ver falhas'}.**",
        "",
        "## 1. Navegação exata — falhas",
        "",
    ]
    falhas = [r for r in nav if not r.passou]
    if not falhas:
        linhas.append("Nenhuma: todas as combinações devolveram exatamente o conjunto do JSON.")
    for r in falhas:
        linhas.append(
            f"- **{r.descricao}** (esperado {len(r.esperado)}, veio {len(r.retornado)})"
            f"{' — ERRO: ' + r.erro if r.erro else ''}{' — TRUNCADO' if r.truncado else ''}"
        )
        if r.faltando:
            linhas.append(f"  - faltando: {', '.join(r.faltando)}")
        if r.sobrando:
            linhas.append(f"  - sobrando: {', '.join(r.sobrando)}")
    linhas += [
        "",
        "## 2. Perguntas de professor",
        "",
        "| Caso | Pergunta | Esperado | Veio | Revocação | Precisão | Passou |",
        "|---|---|---|---|---|---|---|",
    ]
    for r in perg:
        linhas.append(
            f"| `{r.id}` | {r.descricao} | {len(r.esperado)} | {len(r.retornado)} | "
            f"{_pct(r.revocacao)} | {_pct(r.precisao)} | {'sim' if r.passou else '**não**'} |"
        )
    linhas += ["", "### Casos que falharam", ""]
    falhas = [r for r in perg if not r.passou]
    if not falhas:
        linhas.append("Nenhum.")
    for r in falhas:
        linhas.append(f"- **`{r.id}`** — {r.descricao}{' — ERRO: ' + r.erro if r.erro else ''}")
        if r.nota:
            linhas.append(f"  - nota: {r.nota}")
        if r.faltando:
            linhas.append(f"  - faltando: {', '.join(r.faltando)}")
        if r.exato and r.sobrando:
            linhas.append(f"  - sobrando: {', '.join(r.sobrando)}")
        if r.posicoes():
            linhas.append(f"  - posições dos acertos: {r.posicoes()}")
    return "\n".join(linhas) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--projeto")
    parser.add_argument("--location", default="global")
    parser.add_argument("--jsonl", type=Path, help="habilidades.jsonl (padrão: gera do .ts)")
    parser.add_argument("--seco", action="store_true", help="só mostra o plano, sem chamar a API")
    args = parser.parse_args(argv)

    if args.jsonl:
        documentos = [
            json.loads(linha) for linha in args.jsonl.read_text("utf-8").splitlines() if linha
        ]
    else:
        from .exportar_habilidades import gerar, ler_dados

        documentos = gerar(ler_dados())
    casos = json.loads(CASOS.read_text("utf-8"))["casos"]
    if args.seco:
        print(
            f"[seco] {len(combinacoes(documentos))} combinações componente × ano "
            f"e {len(casos)} perguntas contra o data store"
        )
        return 0
    projeto = projeto_padrao(args.projeto)
    if not projeto:
        raise SystemExit("informe --projeto (ou AGENTE_PROJETO)")
    relatorio = asyncio.run(
        avaliar(documentos, casos, ClienteDiscoveryEngine(projeto, args.location))
    )
    hoje = dt.date.today().isoformat()
    RELATORIOS.mkdir(exist_ok=True)
    destino = RELATORIOS / f"avaliacao-habilidades-{hoje}.md"
    destino.write_text(
        em_markdown(relatorio, data=hoje, alvo=f"{projeto}/agente-professor-habilidades"),
        encoding="utf-8",
    )
    print(f"relatório: {destino}")
    return 0 if all(r.passou for r in relatorio.navegacao + relatorio.perguntas) else 1


if __name__ == "__main__":
    sys.exit(main())
