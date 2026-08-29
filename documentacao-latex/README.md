# Documentação técnica — LaTeX

Fonte da **documentação técnica consolidada** da Plataforma Unooria
(`PU-DOC-001`). Compila em `main.pdf` (~265 páginas).

Este documento é **normativo** para o projeto: cobre contexto de negócio,
requisitos rastreáveis, casos de uso, arquitetura de software nos quatro níveis
do modelo C4, arquitetura de nuvem e implantação em GCP, multi-tenancy e
segurança, modelo de dados, contratos de integração, telemetria, camada de IA,
catálogo de experiências, especificação da API, design system, engenharia de
entrega, qualidade, 40 ADRs, riscos e evolução.

## Compilar

```bash
./compilar.sh              # build completo
./compilar.sh --rapido     # uma passagem, para iterar na escrita
./compilar.sh --limpar     # remove os arquivos auxiliares
```

```bash
# Alternativas, com uma distribuição de TeX completa instalada
latexmk -pdf -bibtex main.tex
pdflatex main && bibtex main && pdflatex main && pdflatex main
```

## Requisitos

| Item | Detalhe |
|---|---|
| Motor | **Tectonic** (recomendado — `brew install tectonic`): baixa os pacotes sob demanda e chama o BibTeX sozinho. Alternativa: MiKTeX ou TeX Live com `pdflatex` + `bibtex` |
| Fontes | `roboto` e `roboto-mono` |
| Diagramas | `tikz` e `pgfplots` — todos vetoriais, sem renderização externa |
| Bibliografia | `abntex2cite` (estilo `alf`, ABNT NBR 6023) processado por **BibTeX** |
| Tabelas | `booktabs`, `tabularx`, `ltablex`, `colortbl` |
| Código | `listings` com dialetos para TypeScript, SQL, YAML, JSON, Bash e Mermaid |

**Por que BibTeX e não biblatex/biber:** o `biber` é um binário separado que o
Tectonic não empacota, e as versões de `biblatex` e `biber` têm de casar
exatamente (a do bundle do Tectonic não casa com a do Homebrew). Com
`abntex2cite` + BibTeX o Tectonic fecha o ciclo de referências sozinho, e a
saída sai formatada em ABNT do mesmo jeito.

## Estrutura

```
documentacao-latex/
├── main.tex                 documento mestre (ordem dos capítulos)
├── referencias.bib          bibliografia (45 entradas, ABNT na saída)
├── compilar.sh              script de build
├── preambulo/
│   ├── estilo.tex           tipografia, cores, tabelas, código, títulos, rodapé
│   ├── diagramas.tex        biblioteca TikZ (C4, UML, ER, infra, estados)
│   └── capa.tex             capa, ficha técnica e histórico de revisões
├── secoes/                  00-siglas … 19-conclusao
├── apendices/               a-mermaid … f-operacao
├── figuras/                 imagens externas (nenhuma hoje)
└── build/                   pré-visualizações geradas (não versionado)
```

## Convenções de edição

- **Cores**: usar apenas os tokens `unoo*` de `preambulo/estilo.tex`. A paleta é
  a do `@unooria/design-system` (os mesmos valores que
  `packages/ui/styles/plataforma.css` usa como fallback).
- **Código em linha**: `\cd{...}` para identificadores, `\arq{...}` para
  arquivos, `\rota{...}` para endpoints, `\env{...}` para variáveis de ambiente.
  Todos usam `\texttt`+`\textcolor` deliberadamente — `{\ttfamily...}` troca a
  fonte antes de o parágrafo começar e desalinha a primeira linha de base nas
  células de tabela.
- **Dentro de `tikzpicture`, use `\texttt{}` cru**, não `\cd`/`\arq`/`\rota`: as
  cores dessas macros são pensadas para texto sobre fundo claro e ficam
  invisíveis num nó de fundo escuro.
- **Setas**: sempre `\seta` e `\implica`, nunca `→` ou `⇒` literais — a Roboto
  não tem esses glifos (o XeTeX avisa "Missing character" e não desenha nada).
  Os demais caracteres especiais (`—`, `§`, `·`, `≥`, `×`, `…`) funcionam.
- **Blocos de destaque**: `nota`, `atencao`, `decisao`, `limitacao`, `regra`,
  `destaque`, `especificacao{título}`.
- **Diagramas**: envolver em `\fitwidth{...}` (encolhe só se exceder a largura)
  ou `\fitpage{...}`. Diagramas largos vão dentro de `\begin{landscape}` — mas
  prefira **dividir em duas figuras retrato**: os ER grandes ficaram ilegíveis em
  paisagem antes de serem divididos.
- **Identificadores rastreáveis**: `\rf{RF-01}`, `\rf{RNF-01}`, `\ucr{UC-01}`,
  `\adrr{ADR-09}`, `\drr{DR-01}`.
- **Mermaid**: ao acrescentar um diagrama TikZ, incluir a fonte Mermaid
  equivalente em `apendices/a-mermaid.tex`, referenciando o mesmo número de
  figura. Diagrama sem par Mermaid é diagrama que só uma pessoa consegue alterar.
- **Quebra em célula estreita**: `\B` insere ponto de quebra sem hífen em
  caminho longo (identificador monoespaçado não hifeniza e transborda a caixa).

## Manutenção — obrigatória

**Atualizar esta documentação faz parte da Definition of Done** (ver `CLAUDE.md`).
Implementação que mude arquitetura, contrato, modelo de dados, decisão ou risco
atualiza o capítulo correspondente **e regera o `main.pdf` no mesmo commit**.

| Se você mudou… | Atualize |
|---|---|
| Módulo, componente ou fronteira | `secoes/05-arquitetura-software.tex` (e o C4 correspondente) |
| Recurso de nuvem, rede, CI/CD | `secoes/06-arquitetura-nuvem.tex`, `secoes/15-entrega.tex` |
| RLS, papel, guard, sandbox | `secoes/07-tenancy-seguranca.tex` |
| Migração, tabela, coluna | `secoes/08-modelo-de-dados.tex` + `apendices/e-dicionario-de-dados.tex` |
| Ponte, telemetria, manifesto, provider de IA | `secoes/09-contratos-integracao.tex` + `apendices/d-payloads.tex` |
| Rota nova ou papel de rota | `secoes/13-api.tex` + `apendices/c-endpoints.tex` |
| Variável de ambiente | `apendices/b-variaveis-ambiente.tex` |
| Experiência nova | `secoes/12-experiencias.tex` |
| Qualquer decisão com alternativa descartada | `secoes/17-adr.tex` (ADR nova, numerada) |
| Risco novo ou mitigado | `secoes/18-riscos-evolucao.tex` |
| Sintoma de diagnóstico novo | `apendices/f-operacao.tex` |

## Notas de compilação

- A primeira passagem deixa referências cruzadas e o sumário pendentes; elas só
  estabilizam depois do BibTeX e do rerun. O `compilar.sh` avisa se sobrar
  alguma.
- `tectonic` sem `-k` guarda os auxiliares **só em memória**: o PDF sai correto,
  mas `main.toc` e `main.lof` no diretório ficam desatualizados e enganam quem
  for depurar. O `compilar.sh` sempre passa `-k`.
- Avisos de `Overfull \hbox` de poucos pontos nas tabelas são benignos: são
  células com identificador monoespaçado, que não hifeniza. Acima de ~20pt, vale
  usar `\B` ou encurtar o conteúdo.
