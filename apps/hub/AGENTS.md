<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- As regras acima são geradas pelo Next e ficam entre os marcadores.
     Tudo abaixo é do projeto e sobrevive a uma regeração. -->

# apps/hub — Next.js (App Router)

Complementa o `AGENTS.md` da raiz.

**A raiz (`/`) é a LANDING pública** (2026-08-29, ADR-40): sem sessão, renderiza
`components/landing/` — porte da tela do Stitch com a estrutura, a copy e o
movimento do modelo, e a cor, a tipografia, os ícones, o logo e os botões do DS
(nunca a paleta/fontes que o Stitch gera). Com sessão, `/` continua roteando
para a home do papel: o `login-form` e o `trocar-senha` fazem
`router.replace("/")` e dependem disso. Duas armadilhas medidas: o cleanup do
shader NÃO pode chamar `loseContext()` (o Strict Mode remonta o efeito no mesmo
canvas e o contexto volta perdido — fundo em branco), e cor de ícone vai pela
prop `color` do `Icon`, não por classe (a folha do DS vence e o ícone sai preto).
Suíte: `node scripts/e2e/rodar.mjs publico` (a landing e o login; só o hub).

**Header: um só para todos os papéis.** `components/header-plataforma.tsx`
(marca → home do papel, nome + série/papel, avatar, Sair) é o header de
`/estudante`, `/professor`, `/admin`, `/analise` E de `/exp/*` — antes cada área
copiava o seu e a experiência não tinha nenhum. A casca visual (CSS do DS,
compensações, fontes) saiu do layout do grupo `(plataforma)` para
`components/casca-plataforma.tsx`, porque `/exp/*` e `/dev-embed` estão fora do
grupo e também precisam dela. A regra de ouro passou a valer um nível abaixo: o
header é chrome do HUB, desenhado ACIMA do aparelho — dentro do iframe nada da
marca institucional entra.


## Papéis e roteamento

`lib/papeis.ts` é contrato congelado com a api (`apps/api/src/auth/claims.ts`):
quatro papéis, replicados em quatro fontes que precisam concordar sem
compartilhar código — o validador do token, este arquivo (que o middleware edge
importa), o `CHECK` no Postgres e o atributo `perfil` do WSO2. `/estudante` e
`/exp/*` são a MESMA área no middleware.

**Escola ativa é estado de SESSÃO.** Quem tem mais de uma escolhe no cabeçalho
(`components/seletor-de-escola.tsx`); a troca passa por `POST /api/escola-ativa`,
que valida contra `GET /escolas/minhas` **da api** — nunca contra a lista que o
cookie carrega.

## Embed de experiência

A montagem (token, manifesto, dev server, origin) é uma só:
`lib/embed-experiencia.ts`, usada por `/exp/[expId]`, `/dev-embed`,
`/professor/plano-de-aula` e `/professor/bem-estar`. O contrato `postMessage` e
o manifesto estão em `apps/experiencias/AGENTS.md`.

## As fontes do DS não vêm de graça

**No hub, o CSS do DS não basta: as fontes também.** O `unooria.css` declara
`Open Sans` e `Material Symbols Rounded` por `@import` de URL remota, e o **Next
remove `@import` externo** de CSS importado por JS — silenciosamente: a regra
continua lá, o `getComputedStyle` responde "Open Sans" e o navegador desenha com
a fonte do sistema. Como `Material Symbols Rounded` é fonte de ligadura, o
sintoma é o ÍCONE VIRANDO TEXTO ("addInvestigação"). Por isso
`components/casca-plataforma.tsx` também monta `FontesDaPlataforma`
(`@edu/ui/fontes`). Numa experiência Vite o `@import` sobrevive e isso não é
necessário.

**Frames: dois níveis, não empilhar.** `PhoneFrame` (instanooria, whatsappmobile,
tiktooria) e `DesktopFrame` (unitube) são cascas de aparelho DO CLONE, para
Storybook e telas soltas. Dentro da plataforma quem desenha o aparelho é o hub,
em `components/DispositivoFrame.tsx`, dirigido pelo `viewport` do manifesto — a

## Clarity: dois pontos de montagem, e nenhum é arbitrário

O Microsoft Clarity (ADR-59) entra em **dois** lugares no hub, por razões
diferentes — mover qualquer um deles quebra cobertura em silêncio.

| Componente | Onde monta | Por que ali |
|---|---|---|
| `components/clarity-hub.tsx` (o `<Script>`) | `app/layout.tsx` **raiz** | É o único layout que cobre a landing pública e o `/login`, que estão fora do grupo `(plataforma)`. Na casca, a landing ficaria sem gravação — e é onde a pessoa chega. |
| `components/clarity-identidade.tsx` (identify + tags) | `components/casca-plataforma.tsx` | É o único componente por onde `(plataforma)/**` e `/exp/**` passam os dois. No layout raiz não daria: lá não há sessão. Num layout por papel dariam quatro cópias. |

A casca virou `async` por causa disso (chama `await auth()`). Ela é usada por
dois layouts de servidor, então isso é transparente — mas é a razão de ela não
ser mais uma função síncrona.

**A identificação re-dispara a cada rota**, via `usePathname()`. Não é
redundância: o App Router navega sem recarregar a página, e a doc do Clarity
pede `identify` por PÁGINA. Sem isso, tudo depois do primeiro render cai numa
página só no painel.

**O snippet não é escrito aqui.** Ele vem de `@edu/sdk` (`snippetClarity`), que
é a mesma fonte que as experiências injetam dentro do iframe. Colar o script no
layout cria a segunda cópia.

**`NEXT_PUBLIC_CLARITY_PROJECT_ID` é a única `NEXT_PUBLIC_*` do hub que chega ao
bundle do CLIENT** — as outras duas são lidas só em código server-only, e por
isso são env de runtime. Esta é inlinada no `next build`, entra por `ARG` no
`Dockerfile`, e trocá-la exige rebuild. Ela é lida num lugar só,
`lib/clarity.ts`: a referência a `process.env` precisa ser estática para o Next
substituir o literal, e `process.env[nome]` calculado chegaria `undefined` sem
erro nenhum.
