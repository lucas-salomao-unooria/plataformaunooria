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

**`/privacidade` e `/termos` são a MESMA superfície pública da landing**
(ADR-70), alcançadas pelo rodapé dela. `components/legal/` importa
`landing.css` e monta o mesmo `FundoAnimado` — não copie a nav, o fundo nem a
escala tipográfica para cá: a cópia diverge na primeira mudança de marca, e as
duas páginas passam a parecer de outro produto justo onde a confiança está sendo
decidida. **O conteúdo entra como DADO** (`SecaoLegal[]` com `id`, `titulo`,
`conteudo`), nunca como marcação livre: sumário, numeração e âncora saem da
mesma lista que renderiza as seções, então o índice não pode prometer um item
que o corpo não tem. Duas proibições que já foram rejeitadas em revisão:
**nenhuma `<table>`** no texto legal (célula altíssima e rolagem lateral no
celular, que é onde a família abre o link — use `.legal-card`) e **nenhum
`[A DEFINIR]` espalhado**; o que depende do contrato mora no bloco
`IDENTIFICACAO` no topo de cada página, e o que falta decidir tem uma seção
final própria. **O texto só afirma o que o código faz** — a ADR-70 lista as
promessas que hoje seriam falsas (retenção, exclusão por titular, log de acesso,
dados no Brasil, consentimento). Suíte: `publico/03-documentos-legais`.

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

**A origem do bundle é do AMBIENTE; o manifesto diz o que a experiência
declara.** Os dois estavam conflatados em `emDev = !manifesto && !emProducao` —
"tabela vazia logo é dev" — e isso quebrou quando o seed passou a popular
`experiencias` (ADR-69): sem `NEXT_PUBLIC_CDN_EXP_URL`, a URL versionada caía no
default `localhost:5173`, o dev server da exp-01, que responde a qualquer caminho
com a SPA dele. TODA missão abria o Instanooria, o handshake completava e o boot
dava 403 — nada dizia "endereço errado".

## A sala de aula no hub (ADR-69)

`/estudante` lê `GET /salas/minhas` (`lib/salas.ts`): a turma e a grade do ano
dela, com o estado de cada missão. `null` (api fora do ar) e `[]` (sem turma) são
telas DIFERENTES — mandar a criança falar com a coordenação por causa de um 503 é
o pior conselho possível.

`/professor/turmas/[id]` é a SALA, com abas em `?aba=` (`missoes` | `estudantes`)
e o `Tabs` do DS em modo controlado — a URL é o estado, como o `?turmaId=` dos
resultados. O botão de liberar é client-side porque o professor aperta na FRENTE
DA SALA, e passa pelo BFF: **`PUT` precisou ser exportado lá** (`app/api/plataforma/[...path]/route.ts`),
e método que falta no BFF não dá 404 e sim **405**, sem linha no log — o sintoma
chega como "o botão não faz nada".

O caminho para conduzir a missão sai da sala, com a turma já na URL
(`lib/rotas-da-missao.ts` traduz `expId` → rota do professor; é o único lugar que
faz essa tradução). A trilha do Entre Redes continua por ano e virou catálogo,
com faixa dizendo que quem abre é a turma.

`/exp/[expId]` confere a liberação ANTES de montar o embed e responde 404 sem
ela. Só para estudante: professor e gestor não chegam nesta rota, e `/dev-embed`
segue sem porta (é bancada de desenvolvimento). A api recusaria de qualquer
jeito, mas aí o aparelho carregaria e quebraria por dentro, com o token já
assinado.

## O guia da aula (ADR-65)

Toda missão publicada tem guia em `/professor/.../guia`, e **missão nova nasce
com o guia dela** — `lib/entre-redes/guias/index.test.ts` recusa missão
publicada sem guia, com uma lista de exceções que exige razão escrita.

**O guia é DADO** (`lib/entre-redes/guias/<exp>.ts`, tipo `GuiaDaAula`)
renderizado por um componente único (`components/guia/`). Não escreva um guia
como página: a versão antiga era 447 linhas de JSX só do Instanooria, e a quinta
cópia dela seria o arquivo em que alguém esquece uma seção sem ninguém notar. A
ordem das seções é do renderizador, não do autor — é isso que faz a segunda
missão que o professor roda ter a informação no mesmo lugar da primeira.

**O que tem fonte viva NÃO vira texto no guia.** Entra por bloco vivo: um
`ReactNode` que a página da missão ancora ao fim de uma seção
(`blocos={{ debate: <... /> }}`). Já são três — os momentos e a revelação do
Instanooria, os cartões da Vila por turma, a tabela dos vieses do unooGPT (rota
`GET /unoogpt/professor/fontes`). O custo de copiar qualquer um deles é o
professor projetar para a turma uma mensagem que ninguém recebeu.

**Os links para o guia saem de `lib/rotas-da-missao.ts`**, nunca de
`` `${rota}/guia` `` montado na tela: é ele que sabe se a missão tem guia, e a
sala de aula mostra o link em toda turma × toda missão a partir dele. Uma
concatenação na mão vira link para 404 na primeira missão publicada sem guia.

**A folha de impressão é parte do guia**, em `components/guia/guia.css` — o
professor conduz a aula com o papel na mão enquanto o computador projeta a tela
da turma. Ela mira classes próprias (`.guia-bloco`, `.guia-fora-do-papel`),
nunca as do `@unooria/design-system`: nome interno de componente muda por versão
e ninguém imprime para conferir depois de subir o DS. Bloco novo no guia entra
com `guia-bloco` (e `guia-bloco--longo` se puder quebrar entre folhas).

**BNCC Computação: o texto da habilidade é verbatim do MEC**, e os códigos são
**por ano** (`EF04CO08`, `EF08CO11`) mais `EF15CO*` (1º–5º), `EF69CO*` (6º–9º) e
`EM13CO*`. `EF67CO`/`EF89CO` **não existem** — a analogia com as outras áreas já
produziu códigos inventados uma vez, e um teste guarda a forma.

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

O Microsoft Clarity (ADR-60) entra em **dois** lugares no hub, por razões
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


## Log, saúde e erro (2026-09-02)

**O log do servidor do hub é o pino de `lib/log.ts`**, em JSON com os nomes do
Cloud Logging (`severity`, `message`, `serviceContext`,
`logging.googleapis.com/trace`). Nada de `console.*` em código de servidor. É
uma **cópia deliberada** do logger da api (`apps/api/src/observabilidade/`),
sem o AsyncLocalStorage: o contexto entra por `logDaRequisicao(headers)`, que
lê `traceparent`/`X-Cloud-Trace-Context` e devolve um `child` com `requestId`.
Mudou a forma da linha? Muda nos dois (packages/AGENTS.md diz por que não é um
pacote).

- **`apiDoServidor` continua devolvendo `null`** em falha — as páginas dependem
  disso —, mas cada falha vira UMA linha `warn` (`codigo: api-recusou |
  api-indisponivel | api-timeout`) com rota, status e o `requestIdDaApi` que a
  api devolveu no corpo do 500. Antes, "a api caiu" e "não há dados" eram a
  mesma coisa. **Toda chamada tem teto**: `TIMEOUT_DA_API_MS` (10 s) no
  `apiDoServidor`, `TIMEOUT_DO_BFF_MS` (30 s) no BFF, que repassa CSV e
  planilha. Falha de rede vira `Response` sintética 599 (598 no timeout): quem
  chama trata status, não exceção.
- **O `traceparent` da requisição de origem segue para a api** nos dois
  caminhos (`apiDoServidor` e BFF): é o que põe o render do professor e o span
  da api no mesmo trace. Sem cabeçalho de origem (build, teste), nada é
  inventado.
- **O 404 da allowlist do BFF loga** (`codigo: bff-prefixo-recusado`, só o
  prefixo). É o sintoma de uma tela nova que esqueceu de pedir passagem — e
  parecia "a api não tem a rota".
- **`GET /api/healthz`** responde `{ok:true}` sem tocar em nada: é a sonda de
  vida do serviço e o que separa "hub caiu" de "api caiu" no alerta. Fora do
  `matcher` do middleware; `force-dynamic`.
- **`app/error.tsx` e `app/global-error.tsx`** mostram `components/tela-de-erro.tsx`
  (o `AlertBox` do DS) com o `digest` do erro como código do incidente. O
  registro do erro é do `onRequestError` em `instrumentation.ts`: uma linha
  `ERROR` com o MESMO `digest`, stack, rota e `routeType` — a ponte entre o
  relato e o Logs Explorer sem inventar id. A `TelaDeErro` importa o CSS do DS
  por conta própria porque o `error.tsx` da raiz renderiza fora da
  `CascaPlataforma`. Erro de render no CLIENTE não tem digest e não passa pelo
  servidor: o registro dele entra com a captura de erros de cliente (fase 2).
- **`server-only` nos testes**: o pacote real LANÇA fora de um RSC. O
  `vitest.config.ts` aponta o alias para `lib/stub-server-only.ts`; sem isso
  qualquer teste que toque `lib/log.ts` ou `lib/api-servidor.ts` morre na
  importação.
- Envs: `LOG_LEVEL` (o Terraform já manda: `debug`/`info`/`warn` por ambiente),
  `GCP_PROJECT_ID` (já vem), `LOG_FORMATO=json` para ver a linha como o Cloud
  Logging a verá. Em teste (`NODE_ENV=test`) é JSON sem transporte.

## OpenTelemetry no hub (2026-09-02)

O `register()` de `instrumentation.ts` liga o SDK (`lib/otel.node.ts`) só no
runtime Node e só com o gate de `lib/otel-config.ts` (`OBS_TRACE_RATIO > 0` E
`GCP_PROJECT_ID` ou `OBS_DEBUG=1`). **Não há `instrumentation-http` aqui, de
propósito**: o Next já emite os spans de servidor (`GET /api/healthz`,
`resolve page components`, `executing api route`) e já extrai o `traceparent`
de entrada assim que existe um `TracerProvider` global — medido: um
`traceparent` forjado na requisição vira o `traceId` de todos os spans do
render. Instalar o `http` duplicaria o span raiz. Só o `undici` entra, para o
`fetch` de saída levar o cabeçalho.

- `lib/otel-propagacao.ts#traceparentDeSaida`: `propagation.inject` do span
  ativo; sem SDK (dev, teste) a API do OTel é no-op e o fallback é o
  `traceparent` que a requisição de origem trouxe. `apiDoServidor` e o BFF
  usam isso — nunca montam o cabeçalho na mão.
- `next.config.mjs#serverExternalPackages`: o SDK, a instrumentação do
  `undici` e o exportador do Google (`@grpc/grpc-js`) ficam fora do bundle do
  servidor; empacotados, `require-in-the-middle` e o gRPC quebram. `pino` já
  está na lista padrão do Next.
- Em dev: `OBS_DEBUG=1 OBS_TRACE_RATIO=1 pnpm dev` imprime os spans no console.
- **Nunca setar `NEXT_OTEL_VERBOSE=1`** em produção: dobra os spans internos do
  Next e o custo, sem dizer nada que o trace normal não diga.


## Sinais do navegador que passam pelo hub (2026-09-02)

- **`config.obs` do `hub:init`**: `montarEmbed` põe `obs: { traceRatio }` (de
  `OBS_TRACE_RATIO_CLIENTE`, env de runtime) no `Embed`; o `ExpHost` recebe
  `obs` e o mete em `config`; as páginas do professor que renderizam `ExpFrame`
  direto (plano de aula, bem-estar) passam `config={{ expId, obs: embed.obs }}`.
  É assim que a amostragem do OpenTelemetry Web das experiências muda sem
  rebuild do hub nem republicar bundles. Sem `obs`, o `ExpHost` manda
  `{ traceRatio: 0 }` — desligado, nunca "sem valor".
- **`exp:erro`**: o `ExpFrame` repassa a `onErro`; o `ExpHost` cobre o aparelho
  com o `AlertBox` "A missão travou" (`data-testid="erro-da-experiencia"`) e o
  botão **Recarregar** remonta o iframe (`key`). A mensagem do erro não aparece;
  o `hash` aparece, para relatar. O registro já foi SDK → api.
- **`/api/ponte`**: `sendBeacon` do `ExpFrame` com o resultado do handshake
  (`ok` | `protocolo-incompativel`); vira UMA linha `INFO`
  `codigo=ponte.handshake`. A métrica "handshakes por resultado" é de LOG
  (Terraform), não contador em processo. Sem `auth()` de propósito: o dado é
  dois enums e um número, e `sendBeacon` não garante cookie.
- **Erros de cliente do hub**: `instrumentation-client.ts` instala a captura da
  SDK (`lib/erros-do-hub.ts`) com `expId: "hub"` e `versao =
  NEXT_PUBLIC_HUB_VERSAO` (o SHA do build, ARG do Dockerfile — a segunda e
  última `NEXT_PUBLIC_*` que chega ao bundle, junto com a do Clarity). Posta pelo
  BFF (`observabilidade` entrou na allowlist); sem sessão o BFF dá 401 e fica no
  console. `error.tsx`/`global-error.tsx` reportam pelo mesmo caminho.
- **Web Vitals do hub**: `components/vitals-hub.tsx` no layout raiz
  (`useReportWebVitals`), 10% por aba, `rota = pathname` (a api normaliza).
- **OpenTelemetry Web no hub**: `instrumentation-client.ts` chama o MESMO
  `iniciarTracesWeb` da SDK, com `apiUrl: "/api/plataforma"` (exporta pelo
  BFF, que assina o token) e o ratio lido do `<meta name="unooria-obs-ratio">`
  que o `generateMetadata` do layout raiz escreve a partir de
  `OBS_TRACE_RATIO_CLIENTE` — env de runtime, sem rebuild. Com ratio 0 nada é
  baixado (os pacotes são `import()` dinâmico), então a landing pública não paga
  o peso. Sem sessão o BFF dá 401 e o lote morre no exportador — aceito.

## Rolagem: sempre o `ScrollBar` do DS (2026-09-07)

**Nenhuma tela do hub declara `overflow` para rolar.** Área que rola é um
`<ScrollBar>` do `@edu/ui/ds` — as 24 tabelas (de `/admin`, `/analise` e
`/professor`), o sumário de `/privacidade` e `/termos`, e as 5 tabelas largas do
guia da aula. Dele vêm a barra, o `autoHide` e o fade; a mecânica e as
armadilhas estão em `packages/ui/AGENTS.md`.

Tabela nova nasce assim, e não com um `<div>` em volta:

```tsx
<ScrollBar orientation="both" autoHide className="tabela-rolavel">
  <Table … />        {/* ou a <table> crua */}
</ScrollBar>
```

`orientation="both"` não é enfeite: o default (`vertical`) traz
`overflow-x: hidden` e cortaria a coluna da direita das tabelas largas — que é a
maioria delas aqui. E a `tabela-rolavel` continua obrigatória, com o papel
reduzido: a altura que provoca a rolagem e o cabeçalho preso, que o DS ainda não
publica.

**No papel, o `ScrollBar` sai da frente.** `components/guia/guia.css` devolve
`overflow: visible` e `max-height: none` a ele em `@media print`: o guia é feito
para ser impresso e levado para a sala, e `overflow` recortaria a tabela na
largura da coluna.

## Altura de tela cheia: `.tela-cheia`, nunca subtração do header

A página do professor que embeda experiência e **não** rola
(`/professor/plano-de-aula`, `/plano-de-ensino`, `/bem-estar`) usa a classe
`.tela-cheia`. Ela substituiu `height: calc(100dvh - 64px)`, escrito à mão nas
três: o `HeaderPlataforma` mede **65px** (o `h-16` são 64 e a `border-b` põe 1),
então a página transbordava 1px e ganhava uma barra de rolagem vertical PARADA
na tela — visível o tempo todo, sem ter o que rolar. Agora a casca do professor
é coluna (`flex min-h-dvh flex-col`) com o `main` em `flex-1`, e a classe (em
`@edu/ui/styles/plataforma.css`) distribui o resto por flex.

Isto é o oposto do `ScrollBar`: lá o objetivo é rolar bem, aqui é **não existir
área rolável**. Uma barra que não rola nada não é detalhe estético — é a tela
dizendo que há conteúdo escondido quando não há.

Duas armadilhas medidas:

- **`h-full` no lugar do flex NÃO funciona.** A altura de um item que cresceu por
  `flex-grow` dentro de um contêiner de `min-height` não é *definite*: o
  percentual cai para `auto` e o `<iframe>` volta aos 150px de altura padrão dele.
  `display: grid` com `grid-template-rows: auto 1fr` tem o mesmo problema.
- **O `main` só vira contêiner flex via `:has(> .tela-cheia)`.** Sem isso, as
  outras 16 páginas do professor passariam a ter os filhos como itens de flex
  (margem que não colapsa mais, altura que muda) por causa de três telas.

`app/exp/layout.tsx` já fazia certo (`height: 100dvh` + `flex flex-col`) e não
precisou mudar — é a referência do arranjo.
