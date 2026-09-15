---
paths:
  - "**/AGENTS.md"
  - "**/CLAUDE.md"
  - "docs/agents/**/*.md"
---

# Arquivos de instrução de agente — o padrão

Regra transversal da plataforma. Complementa o `AGENTS.md` da raiz, que vence
em conflito.

## Arquivos de instrução de agente — o padrão

Três arquivos, três papéis que não se misturam:

| Arquivo | Para quem | Regra |
|---|---|---|
| `AGENTS.md` | qualquer agente | **canônico.** O único lugar onde a doutrina daquela pasta é escrita |
| `CLAUDE.md` | Claude Code | **uma linha, `@AGENTS.md`.** Nunca conteúdo próprio |
| `README.md` | pessoa | o que a pasta é e como rodar. NÃO entra sozinho no contexto do agente |

Por que dois e não um: `AGENTS.md` é o nome que a maioria das ferramentas lê;
`CLAUDE.md` é o que o Claude Code procura. O ponteiro `@AGENTS.md` importa o
canônico, e a regra existe **uma vez**. `CLAUDE.md` com texto próprio é uma
segunda fonte de verdade sobre a mesma pasta — e duas fontes divergem, sempre na
direção de quem parou de ler a outra.

**Onde nasce um `AGENTS.md`:** numa pasta onde se trabalha uma tarefa inteira sem
sair dela — um app, um pacote, uma experiência, a suíte e2e. Ele carrega sozinho
quando a sessão toca a pasta, e é isso que paga o custo de existir. **Na raiz da
pasta, nunca numa subpasta.** A doutrina da Vila do Lume viveu meses em
`exp-70-vila-do-lume/docs/CLAUDE.md`: quem editava o jogo em `public/jogo/` nunca
a recebia, porque o carregamento é por caminho — o arquivo estava a um nível de
distância de todo mundo que ele tentava avisar.

**O que entra:** o que, se você não souber, você quebra. Regra já violada e o que
custou; contrato com quem consome; zona congelada; armadilha que passa no
typecheck. **O que não entra:** o que o código já diz (estrutura de pastas, lista
de dependências, assinatura de função), o que o `README.md` ao lado já explica, e
qualquer repetição da raiz. Um `AGENTS.md` que repete outro não é redundância
inofensiva: é a cópia que ninguém vai atualizar junto.

**Quando o `README.md` da pasta JÁ é a doutrina** (`scripts/e2e`,
`documentacao-latex`), o `AGENTS.md` não a copia: ele vira um **carregador** —
as poucas regras invioláveis, em uma linha cada, e a ordem de abrir o README
antes de escrever. Copiar o README para o `AGENTS.md` cria as duas cópias que
esta seção inteira existe para evitar.

**Forma.** Primeira linha `# <caminho da pasta> — <o que é>`; segunda,
`Complementa o AGENTS.md da raiz.` (a raiz vence em conflito). Seções por assunto,
com o porquê junto da regra — regra sem custo declarado é a primeira a ser
"otimizada" por quem chega depois.

**Bloco gerado por ferramenta** (o do Next em `apps/hub/AGENTS.md`) fica entre os
marcadores dela, intocado, e o conteúdo do projeto vem depois — a ferramenta
reescreve o bloco, e apagá-lo só recria a alteração não commitada.

**Manutenção.** Mudou a regra, muda o `AGENTS.md` **no mesmo commit** — mesma
razão do LaTeX: instrução desatualizada é pior que instrução nenhuma, porque o
agente obedece. Pasta nova que ganha `AGENTS.md` ganha o `CLAUDE.md` de uma linha
junto; sozinho, o Claude Code não acha o canônico.

## Agent skills

As skills de engenharia instaladas (o plugin `mattpocock-skills`) precisam saber
três coisas sobre este repo, e cada uma vive num arquivo próprio em
`docs/agents/`. **Não responda nenhuma delas de cabeça** — as três divergem do
padrão que as skills assumem.

### Issue tracker

As issues **não** estão nas Issues do GitHub: estão no Notion, board
**Team Tasks → `Tasks`**, filtradas por `Segmento = "Entre Redes"`. Ver
`docs/agents/issue-tracker.md`.

### Triage labels

Os cinco papéis canônicos moram na propriedade `Triagem` do board — que é outro
eixo, não o `Status`. Ver `docs/agents/triage-labels.md`.

### Domain docs

Layout próprio, não o das skills: o glossário é o `CONTEXT.md` da raiz, o mapa
de contextos é a tabela de pastas deste arquivo, cada contexto é o `AGENTS.md`
da sua pasta, e **não existe `docs/adr/`** — as ADRs estão em
`documentacao-latex/secoes/18-adr.tex`. Ver `docs/agents/domain.md`.
