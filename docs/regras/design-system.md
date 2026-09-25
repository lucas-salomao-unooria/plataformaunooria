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
| `instanooria` | `@edu/ui/ds-insta` | superfície disfarçada da exp08ef1b |
| `unitube` | `@edu/ui/ds-unootube` | superfície disfarçada da exp04ef1b |
| `chatgpt` | `@edu/ui/ds-chatgpt` | a exp02em1b INTEIRA (não tem revelação no software) |
| `whatsappmobile` | `@edu/ui/ds-whatsapp` | a exp05ef1b e a exp06ef2b, menos as telas da escola — **só tema escuro**. Onde a fronteira cai é a REVELAÇÃO, não o arquivo: na exp06ef2b o mapa da rede fala pela escola porque o app real não tem visualizador de topologia (ADR-72) |
| `tiktooria` | — | ainda sem consumidor |

`^0.1.x` **não** pega `0.2.0` — caret em `0.x` só sobe patch. Atualizar é ativo:
`pnpm up -r @unooria/design-system --latest`, commitando lockfile e
`package.json` juntos. Mecânica completa (CSS, fontes, frames, compensações,
armadilhas de migração) em `packages/ui/AGENTS.md`.

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
`autoHide`) desde a 0.1.x e o hub tinha **24 tabelas** rolando em `<div>` com
`overflow` na mão, além de mais 6 áreas roláveis soltas — barra de sistema em
cada tela, sem auto-hide e diferente por sistema operacional. Ninguém "decidiu"
não usar: o passo 1 não foi dado. Por isso ele está escrito aqui.

**Compensação viva é dívida com nome e dono.** Toda compensação em
`packages/ui/styles/plataforma.css` diz, no comentário, QUAL é a lacuna do DS,
o que ela faz **e o que ela deixou de fazer** quando o pacote passou a cobrir a
parte dele. A `.tabela-rolavel` é o exemplo: ela já foi a rolagem inteira, hoje
é só a altura e o cabeçalho preso, porque a rolagem virou `ScrollBar`.
