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
| `CLAUDE.md` | Claude Code | **`@AGENTS.md` e nada mais**, salvo o bloco que uma FERRAMENTA escreve e reescreve (hoje o do graphify, ADR-124). Nunca conteúdo do projeto |
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
`app-70-vila-do-lume/docs/CLAUDE.md`: quem editava o jogo em `public/jogo/` nunca
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

**Bloco gerado por ferramenta** (o do Next em `apps/hub/AGENTS.md`; o do graphify no
`CLAUDE.md` da raiz, ADR-124) fica intocado, e o conteúdo do projeto vem depois — a
ferramenta reescreve o bloco, e apagá-lo só recria a alteração não commitada. O
bloco de ferramenta é a ÚNICA exceção à regra de que `CLAUDE.md` é só o ponteiro.

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
de contextos é a tabela de pastas do `AGENTS.md` da raiz, cada contexto é o `AGENTS.md`
da sua pasta, e **não existe `docs/adr/`** — as ADRs estão em
`documentacao-latex/secoes/18-adr.tex`. Ver `docs/agents/domain.md`.

## As quatro ferramentas, e por que o desenho é este (ADR-102)

`AGENTS.md` é um **padrão aberto** ([agents.md](https://agents.md/)), adotado
por ~23 agentes de codificação. O Claude Code é a exceção: ele lê `CLAUDE.md`,
não `AGENTS.md` — e é só por isso que o ponteiro de uma linha existe.

| Ferramenta | O que ela lê | Como chega aqui |
|---|---|---|
| **Claude Code** | `CLAUDE.md` (hierárquico) e `.claude/rules/` | o ponteiro `@AGENTS.md`, mais os symlinks de `.claude/rules/` — com `paths:` no frontmatter da FONTE, então carregam sob demanda |
| **Codex** | `AGENTS.md`, da raiz do repo até o diretório atual | direto. Concatena de cima para baixo; o mais próximo vence por vir por último |
| **Antigravity** | `.agents/rules/` (workspace) e `AGENTS.md` aninhado | os symlinks de `.agents/rules/`. **Cada arquivo de rule é cortado em 12.000 caracteres** — é daí que vem o teto desta pasta |
| **Cursor** | `AGENTS.md` | direto |
| **Gemini CLI** | `GEMINI.md` por padrão | `.gemini/settings.json` aponta `context.fileName` para `AGENTS.md` |

**`docs/regras/` é a fonte; `.claude/rules/` e `.agents/rules/` são symlinks
para ela.** Isso não é preferência: é a única forma de servir três ferramentas
sem criar as cópias que esta página inteira existe para evitar. Editar a regra
em `docs/regras/` muda o que todas leem, no mesmo instante.

**As duas pastas NÃO têm o mesmo conteúdo, e é de propósito.** `.agents/rules/`
tem TODAS as regras: o Antigravity lê tudo o que está lá. `.claude/rules/` tem
SÓ as que declaram `paths:` no frontmatter, porque o Claude Code carrega regra
**sem** `paths:` no início de TODA sessão (a com `paths:`, só quando mexe em
arquivo que combina — documentação oficial do Claude Code). Linkar `comandos`,
`ferramentas-externas`, `git-e-branches`, `infra` ou `o-que-nao-fazer` ali as
poria, inteiras, em toda conversa: cerca de 28 mil caracteres que competem com a
tarefa. Essas cinco chegam ao Claude pela tabela por assunto do `AGENTS.md` da
raiz ("abra a do seu assunto antes de escrever"). **Regra de bolso: regra com
`paths:` ganha symlink nas DUAS pastas; regra sem `paths:` só em
`.agents/rules/`.** `apps/api/tests/regras-de-agentes.spec.ts` confere as duas
pastas, e o teto de 12.000 caracteres por regra, em todo `pnpm turbo test`.

### Os dois tetos, e o que cada um custa

- **12.000 caracteres por arquivo** — o corte do Antigravity. Acima disso, a
  regra é truncada **em silêncio**, e o pedaço que some é o fim do arquivo,
  onde costuma estar a consequência.
- **~200 linhas por arquivo de contexto** — a recomendação do Claude Code:
  *"longer files consume more context and reduce adherence"*. Não é corte, é
  degradação: o arquivo entra inteiro e a regra compete com as outras 700.

**Arquivo novo de regra nasce abaixo dos dois.** Se não couber, ele quer ser
dois arquivos — e a divisão certa é por ASSUNTO, não por tamanho: partir uma
regra ao meio deixa a consequência longe da decisão.

**`AGENTS.md` de pasta que passar de 12k se divide por ASSUNTO** — foi assim com
`professor/` (a ficha do Entre Redes foi para `professor/entre-redes/`) e com
`packages/ui/` (as compensações do DS foram para `packages/ui/styles/`). Meça com
`wc -m` (caracteres; `wc -c` conta o acento em dobro), sobretudo nos que vivem
perto do teto. Só as regras de `docs/regras/` têm teste do teto
(`apps/api/tests/regras-de-agentes.spec.ts`): o resto depende de quem edita.

### Onde uma regra vai morar

| A regra vale para… | Vai em |
|---|---|
| uma pasta onde se trabalha a tarefa inteira | o `AGENTS.md` dela (+ `CLAUDE.md` de uma linha) |
| um assunto que atravessa pastas | `docs/regras/<assunto>.md` + symlink em `.agents/rules/` e, se tiver `paths:`, em `.claude/rules/` |
| um contrato entre dois ou mais consumidores | `docs/regras/`, nunca a pasta de um dos lados |

**Pasta nova com `AGENTS.md` entra na tabela do `AGENTS.md` do nível acima, no
mesmo commit.** A tabela é o que faz a pasta ser encontrada por quem não sabe
que ela existe — e um `AGENTS.md` que ninguém abre custa o mesmo que um que não
existe.
