# Documentação técnica — LaTeX

Fonte da **documentação técnica consolidada** da Plataforma Unooria
(`PU-DOC-001`). Compila em `main.pdf` (~730 páginas).

Este documento é **normativo** para o projeto: cobre contexto de negócio,
requisitos rastreáveis, casos de uso, arquitetura de software nos quatro níveis
do modelo C4 e nos catorze diagramas da UML 2.5.1, arquitetura de nuvem e implantação em GCP, multi-tenancy e
segurança, modelo de dados, contratos de integração, telemetria, camada de IA,
catálogo de experiências, especificação da API, design system, engenharia de
entrega, qualidade, observabilidade, as ADRs (até a ADR-122), riscos e evolução.

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
├── referencias.bib          bibliografia (53 entradas, ABNT na saída)
├── compilar.sh              script de build
├── preambulo/
│   ├── estilo.tex           tipografia, cores, tabelas, código, títulos, rodapé
│   ├── diagramas.tex        biblioteca TikZ (C4, UML, ER, infra, estados)
│   └── capa.tex             capa, ficha técnica e histórico de revisões
├── secoes/                  00-siglas … 21-pendencias; 05b-modelagem-uml continua o cap. 5
├── apendices/               a-mermaid … f-operacao
├── estudos/                 estudos técnicos avulsos (PU-EST-001, teste de carga)
├── produto/                 documentos de produto (PU-PRD-001, mapa de produto)
├── figuras/                 imagens externas (nenhuma hoje)
└── build/                   pré-visualizações geradas (não versionado)
```

## Documentos avulsos

Além da PU-DOC-001, a pasta guarda documentos que reaproveitam o mesmo
preâmbulo (`\input{../../preambulo/estilo}`) e compilam sozinhos, a partir da
própria pasta, com `tectonic -k <arquivo>.tex`:

| Documento | Onde | Para quem |
|---|---|---|
| PU-EST-001 — teste de carga | `estudos/teste-de-carga/` | engenharia e decisão |
| PU-PRD-001 — mapa de produto (épicos, features, histórias) | `produto/mapa-de-produto/` | PO e time de desenvolvimento |

**A PU-PRD-001 é escrita em linguagem de produto**: pessoas, telas e regras
de negócio, sem rota, tabela ou nome de módulo. O rastreio técnico fica no
Apêndice B dela, que aponta para os capítulos e ADRs daqui. História que muda
de estado troca o selo; identificador nunca é reaproveitado.

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
  A primeira palavra de uma célula também não hifeniza: `\hspace{0pt}` antes
  dela resolve (foi o caso de "Desenvolvimento" numa coluna de 21 mm).
- **Elementos UML** (pacote, componente com bola e soquete, nó de implantação,
  artefato, objeto, parte e porta, fragmento, tempo, perfil) estão no fim de
  `preambulo/diagramas.tex`, com os macros `\pacote`, `\nodo`, `\bola`,
  `\soquete`, `\msgcom`, `\ctitulo` e `\estereo`. Três armadilhas que
  custaram tempo ao escrevê-los:
  - **`\newcommand` dentro de uma figura em `\fitwidth`/`\fitpage` quebra**
    ("Command already defined"): o `adjustbox` processa o conteúdo duas vezes.
    Use `\def`.
  - **Coordenada com vírgula dentro de uma chave do TikZ vai entre chaves**:
    `fit={(0,0) (4,-2)}`, nunca `fit=(0,0) (4,-2)` — o `pgfkeys` parte na
    vírgula e o erro é "Argument of \pgfkeys@@normal has an extra }".
  - **`\fpeval` não existe** no LaTeX que o Tectonic empacota (é de 2022). Conta
    em coordenada se faz com a aritmética do próprio TikZ, dentro de chaves:
    `({4.3+0.32*(10)},-1)`.

## Manutenção — obrigatória

**Atualizar esta documentação faz parte da Definition of Done** (ver `CLAUDE.md`).
Implementação que mude arquitetura, contrato, modelo de dados, decisão ou risco
atualiza o capítulo correspondente **e regera o `main.pdf` no mesmo commit**.

| Se você mudou… | Atualize |
|---|---|
| Módulo, componente ou fronteira | `secoes/05-arquitetura-software.tex` (e o C4 correspondente) |
| Ponte, quota de IA, disponibilidade, sessão/*token*, papéis, implantação | a figura UML em `secoes/05b-modelagem-uml.tex` (cada uma cita os arquivos de onde saiu) e o par Mermaid |
| Recurso de nuvem, rede, CI/CD | `secoes/06-arquitetura-nuvem.tex`, `secoes/15-entrega.tex` |
| RLS, papel, guard, sandbox | `secoes/07-tenancy-seguranca.tex` |
| Migração, tabela, coluna | `secoes/08-modelo-de-dados.tex` + `apendices/e-dicionario-de-dados.tex` |
| Ponte, telemetria, manifesto, provider de IA | `secoes/09-contratos-integracao.tex` + `apendices/d-payloads.tex` |
| Rota nova ou papel de rota | `secoes/13-api.tex` + `apendices/c-endpoints.tex` |
| Variável de ambiente | `apendices/b-variaveis-ambiente.tex` |
| Experiência nova | `secoes/12-experiencias.tex` |
| Qualquer decisão com alternativa descartada | `secoes/18-adr.tex` (ADR nova, numerada) |
| Risco novo ou mitigado | `secoes/19-riscos-evolucao.tex` |
| Sinal operacional novo (log, métrica, alerta, SLO, sonda) | `secoes/17-observabilidade.tex` |
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
