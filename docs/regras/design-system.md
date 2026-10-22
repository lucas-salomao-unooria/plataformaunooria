---
paths:
  - "apps/hub/**/*.{tsx,ts,css}"
  - "apps/experiencias/**/*.{tsx,ts,css}"
  - "packages/ui/**/*.{ts,tsx,css}"
---

# Design System — a regra de ouro

Regra transversal da plataforma. Complementa o `AGENTS.md` da raiz, que vence
em conflito. A mecânica (CSS, fontes, frames, compensações) está em
`packages/ui/AGENTS.md`.

## Design System (`@unooria/design-system`) — a regra de ouro

**Todo elemento de interface do hub e das experiências vem deste pacote, sempre
na última versão publicada.** npm PÚBLICO no escopo `@unooria`; a fonte é o repo
`storybook-unooria` (fora deste monorepo). Componente de UI novo se escreve LÁ e
chega aqui por versão — não em `packages/ui`, não dentro de uma experiência.

**Duas famílias que nunca se cruzam.** A marca institucional é chrome do HUB;
dentro do iframe a fidelidade é ao clone que a experiência imita. Um `Button` da
plataforma no feed do estudante quebra a ilusão que a experiência está medindo.

| Seção | Ponte | Onde vale |
|---|---|---|
| `unooria` | `@edu/ui/ds` | hub (login, `/professor`, `/admin`, `/analise`), header de todos os papéis, telas pós-revelação do estudante |
| `unoovista` | `@edu/ui/ds-unoovista` | superfície disfarçada da exp08ef1b desde a 1.2.0 (ADR-133) e da exp07ef1b desde a 1.1.0 (ADR-135; as telas da escola vão pela `@edu/ui/ds`), e o `PostCard` da gaveta da exp04ef1b desde a 2.1.0 (ADR-136): a cópia estrutural do `instanooria` com a identidade da Unooria. É **outra seção** — tokens `--unv-*`, nunca `--unooria-*` —, e o roxo dela não autoriza peça da plataforma no feed. O ícone é ligadura do Material Symbols: sem `fonts/unoovista.css`, o nome do glifo aparece como texto |
| `instanooria` | `@edu/ui/ds-insta` | as telas de clone (E2–E4) da exp01ef1b (o `PostCard` da exp04ef1b saiu dela na ADR-136); as sete extensões da 0.2.5 (DM, enquete, diálogo, folha, pílula, compositor de Stories) e as três da 0.2.7 (faixa de dica, gesto e aviso passageiro) entraram para ela |
| `unootube` | `@edu/ui/ds-unootube` | superfície disfarçada do UnooTube, hoje ARQUIVADO (`backup-exp04ef1b`, ADR-116): nenhuma missão viva a usa |
| `chatgpt` | `@edu/ui/ds-chatgpt` | a conversa da exp08ef4b (o briefing, o Meu Percurso e o fechamento dela são `unooria`). A exp02em1b saiu dela na 1.3.0 (ADR-138) |
| `unooriaai` | `@edu/ui/ds-unooriaai` | a exp02em1b-v0 INTEIRA desde a 1.3.0 (ADR-138, a Missão Tempestade; não tem revelação no software) e o chat de O Efeito Amplificador (exp02em1b, ADR-181, com o `unoovista` e a escola na mesma missão): a cópia estrutural do `chatgpt` com a identidade da Unooria. É **outra seção** — tokens `--uai-*`, nunca `--unooria-*` — e é clone, não a plataforma: o agente de IA do professor continua `unooria`. Não publica cor primitiva, e o ícone é ligadura: sem `fonts/unooriaai.css`, o nome do glifo aparece como texto |
| `whatsappmobile` | `@edu/ui/ds-whatsapp` | a exp06ef2b — **só tema escuro**. Onde a fronteira cai é a REVELAÇÃO, não o arquivo: na exp06ef2b o mapa da rede fala pela escola porque o app real não tem visualizador de topologia (ADR-72) |
| `unoochat` | `@edu/ui/ds-unoochat` | a exp05ef1b, menos as telas da escola, em tema CLARO (ADR-134), o `MessageBubble` da gaveta e do desafio final da exp04ef1b desde a 2.1.0, também claro (ADR-136), e o do pedido pelo WhatsApp da exp02em1b (ADR-173). Mesma estrutura do `whatsappmobile`, identidade da Unooria — e por isso o token dele numa tela da escola não destoa: a fronteira só se vê pelo prefixo |
| `tiktooria` | — | ainda sem consumidor |

**A exceção, e só ela (ADR-117): conteúdo de uma plataforma DENTRO de uma tela
da Unooria usa a seção da plataforma que ele imita.** O Jornal da Escola
(exp04ef1b) não é clone de nada: a redação inteira (mesa, página, Bento,
leitores, Chave) é `unooria`. Mas uma notícia que veio de rede social aparece na
gaveta como `PostCard` do `unoovista`, e uma mensagem encaminhada como
`MessageBubble` do `unoochat` (até a 2.0.0, `instanooria` e `whatsappmobile`;
ADR-136) — a peça imitada fala na voz de onde veio,
porque um post que não parece post não ensina a reconhecer post. A regra é
por PEÇA, nunca por tela: o cromo em volta continua sendo da Unooria, e a peça
do clone não traz a barra, as abas nem o fundo do app. É o inverso do que
continua proibido — a plataforma dentro do clone — e vale só para conteúdo que
a criança deve reconhecer como vindo daquela plataforma. **Clone dentro de
clone (ADR-173):** vale também para a peça de outra plataforma DENTRO de uma
experiência disfarçada, com os mesmos limites — o pedido pelo WhatsApp da
exp02em1b é o `MessageBubble` do `unoochat`, claro e sem hora, dentro do
UnooriaAI, e só a peça importa a ponte.

**Uma versão só, e todo mundo sobe junto** (decisão de 2026-10-02). O hub, a
ponte `packages/ui` e TODAS as experiências declaram o MESMO intervalo de
`@unooria/design-system`, e o lockfile resolve UMA versão:
`apps/api/tests/design-system-versao-unica.spec.ts` reprova o contrário. O custo
que pagamos: no mesmo dia conviviam 0.2.8, 0.2.11 e 0.2.12, e a divergência é
muda — a ponte `@edu/ui/ds-*` resolve o DS pela versão DELA, e a folha de CSS
pela da experiência; o JS e o CSS do mesmo componente saíam de versões
diferentes, sem erro nenhum.

Subir é UM passo para todos: `pnpm up -r @unooria/design-system@^X.Y.Z` (nunca
`--filter`: deixa importador para trás), lockfile e `package.json` no mesmo
commit. Depois, compile cada experiência ANTES e DEPOIS e compare o hash do
`dist/` **sem os `.map`**: o sourcemap carrega o caminho do pacote no store do
pnpm, que tem a versão no nome, e muda em TODA subida — com ele, todas as
experiências pareceriam mudadas (foi o que a 0.2.15 mostrou: 14 "mudaram", 12
mudaram de verdade). **A que mudou sobe a versão nos três lugares** (o caminho no bucket é
imutável); a que saiu idêntica byte a byte não sobe; e a que mudou mas JÁ está
numa versão à frente da do `dev` (subiu desde a última promoção, nunca foi
publicada) também não sobe de novo — compare com `git show origin/dev:<pasta>/public/experiencia.json`. `^0.2.8` não pega `0.3.0`
— caret em `0.x` só sobe patch, e minor é decisão ativa. Mecânica completa
(CSS, fontes, frames, compensações, armadilhas de migração) em
`packages/ui/AGENTS.md`.

**Precedência sobre a skill `frontend-design`.** Ela serve para arte e peças fora
do DS (a exceção declarada em `packages/ui/AGENTS.md`, o site público, o
conteúdo de um clone). Ela NUNCA substitui esta regra: a interface do hub e das
experiências vem do `@unooria/design-system`.

### O procedimento, antes de escrever QUALQUER interface

A regra não é "prefira o DS": é **procure primeiro, e só depois escreva**. Três
passos, nesta ordem, e nenhum é opcional:

1. **Procure no pacote.** A lista de tudo que existe são as pontes de
   `packages/ui/src/ds*.ts` (um `export {}` por seção) e o catálogo em
   `cd ../storybook-unooria && npm run storybook` (:6007). Procure pelo QUE a
   coisa faz, não pelo nome que você daria a ela.
2. **Achou? Use, mesmo que dê mais trabalho** do que escrever a sua. Um
   componente do DS traz estado, acessibilidade, tema claro/escuro e as duas
   famílias já resolvidos — e é atualizado por versão, sem ninguém aqui tocar.
3. **Não achou? Não escreva um.** Abra pedido no `storybook-unooria`, registre-o
   no `AGENTS.md` do pacote ou da experiência, e faça a **compensação local
   MARCADA** — que existe para morrer quando o pacote publicar.

**O que é compensação legítima:** medida, espaçamento, altura, posicionamento,
grade, comportamento de página. **O que não é:** botão, campo, diálogo, aba,
etiqueta, avatar, ícone, tabela, barra de rolagem — se tem estado ou aparência
de controle, é componente, e componente nasce no `storybook-unooria`.

**Componente que existe e não é usado custa igual a componente que falta.** Em
2026-09-07 descobriu-se que o DS publica `ScrollBar` (vertical, horizontal, com
`autoHide`) desde a 0.1.x e o hub tinha as tabelas rolando em `<div>` com
`overflow` na mão, além de outras áreas roláveis soltas — barra de sistema em
cada tela, sem auto-hide e diferente por sistema operacional. Ninguém "decidiu"
não usar: o passo 1 não foi dado. Por isso ele está escrito aqui.

**Compensação viva é dívida com nome e dono.** Toda compensação em
`packages/ui/styles/plataforma.css` diz, no comentário, QUAL é a lacuna do DS,
o que ela faz **e o que ela deixou de fazer** quando o pacote passou a cobrir a
parte dele. A `.tabela-rolavel` é o exemplo: ela já foi a rolagem inteira, hoje
é só a altura e o cabeçalho preso, porque a rolagem virou `ScrollBar`.
