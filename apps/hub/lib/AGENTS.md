# apps/hub/lib — log, telemetria e os sinais do navegador

Complementa o `AGENTS.md` de `apps/hub`, que vence em conflito.

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
