# apps/api/src/observabilidade — log e contexto de requisição

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

## Log e contexto de requisição (2026-09-02)

**O log é o pino, em JSON, com os nomes do Cloud Logging.** Nada de `console.*`
em `src/` — a saída do processo É o sinal operacional (cap. 17), e `console`
sai sem `severity`, sem `requestId` e sem redaction. Dois jeitos de logar, os
dois passando pelo mesmo `criarOpcoesDoPino` (`observabilidade/logger.ts`):
o `Logger` do Nest (`new Logger(X.name)`, que o `app.useLogger` roteia para o
pino) e o `logger` raiz importado de `observabilidade/logger` — este é o
único que existe fora do container do Nest (`main.ts`, `worker.ts`, funções
puras). Os dois carregam o contexto da requisição via `mixin`.

- **Toda linha leva um `codigo` estável** (`telemetria.descartado`,
  `planos.geracao-com-erro`, `query-lenta`): é por ele que se filtra no Logs
  Explorer e que se deriva métrica de log. A mensagem é para gente; o `codigo`
  é para máquina. Não invente `codigo` com valor variável (id, nome).
- **PII entra por CHAVE e sai redigida.** `redigirObjeto` apaga
  `authorization`, `cookie`, `token`, `senha`, `cpf`, `username`, `email`,
  `nome`, `texto`, `mensagem`, `transcricao`, `observacao` em qualquer
  profundidade; `redigirTexto` apaga e-mail, CPF, `Bearer …` e query string na
  mensagem e na `stack`. Isso é rede, não licença: o `username` do
  `auth.controller.ts` foi REMOVIDO do log, não redigido. Um campo novo com
  dado de pessoa ganha o nome da lista, ou entra na lista — nunca um sinônimo.
  A comparação é por nome INTEIRO em minúsculas, e é por isso que `senha` não
  cobria `senha_hash` nem `senhaHash`: os dois entraram na lista, junto com o
  GABARITO de missão que classifica mensagens (`veracidade`, `tom`,
  `explicacao`) e o `Então` da regra Se/Então da exp05ef1b (`entao`,
  `acaoEntao`, `acao_entao` — texto livre de menor). **Os campos sensíveis de
  cada missão têm de estar contidos aqui, e quem cobra é a suíte de regras DA
  MISSÃO** — missão nova com gabarito escreve esse teste
  (`tests/quem-mandou-isso-regras.spec.ts` é o da exp05ef1b). `explicacao`
  ficou da primeira versão da missão do 5º ano (ADR-114), e segue na lista de
  propósito: chave que sai daqui só afrouxa a rede.
- **Sem log de requisição da aplicação** (`autoLogging: false`). O Cloud Run
  já grava um por requisição, com trace. O que a api loga é o que ele não
  sabe: escola, motivo de um 4xx, a decisão de degradar.
- **O contexto (`tenancy/tenancy-context.ts`) é UM objeto mutável por
  requisição**, aberto pelo `contextoMiddleware` em `main.ts` — o PRIMEIRO
  `app.use`, antes dos parsers e dos guards, para o 401 sair com
  `x-request-id` — e preenchido com `escolaId`/`perfil` pelo
  `TenancyInterceptor`. O `FiltroDeExcecao` roda FORA da cadeia do interceptor
  e lê a escola desse mesmo objeto; é por isso que o interceptor MUTA em vez
  de abrir um store novo. `comEscolaNoContexto` (seed, worker, teste) continua
  abrindo o próprio. `requestId` = `traceId` do `traceparent` ou do
  `X-Cloud-Trace-Context` do LB; sem eles, UUID.
- **`FiltroDeExcecao` (global, `APP_FILTER`)**: `HttpException` mantém o corpo
  (5xx loga `ERROR`, 4xx `debug`); `ZodError` que escapou de um `parse(body)`
  vira **400** `{ codigo: "corpo-invalido", problemas: "path: code" }` — era
  500 mudo; o resto vira 500 `{ codigo: "erro-interno", requestId }` com UMA
  linha `ERROR` + `stack_trace`, que o Error Reporting agrupa. Não faça
  `try/catch` que engole erro para "não dar 500": o filtro é quem transforma
  o erro em sinal.
- **Rota sem guard não loga por requisição recusada.** O `/telemetry/beacon`
  é público por natureza; os 5 descartes dele são `logger.debug` (invisível em
  `info`) — o sinal contável é métrica (PR das métricas). Uma linha `warn` por
  lote recusado seria um vetor de inundação de log, cobrado por GiB.
- **Prisma**: `PrismaService` liga o evento `query` sempre; acima de
  `LIMIAR_DE_QUERY_LENTA_MS` (500) sai `WARNING` com o SQL (com `$1`, sem os
  parâmetros — é neles que mora o CPF); em `LOG_LEVEL=debug` toda query sai.
- **OpenTelemetry: `src/otel.ts` é a PRIMEIRA linha do `main.ts`**, antes
  de `@nestjs/core`. A instrumentação automática altera `http`, `express`,
  `undici` e o Prisma no `start()`; importado depois do `AppModule`, o trace
  teria só o HTTP de entrada — sem banco e sem IA, em silêncio. Nada em
  `otel.ts` importa código da aplicação (o Zod ainda não rodou). Gate em
  `observabilidade/otel-config.ts`: `OBS_TRACE_RATIO > 0` E (`GCP_PROJECT_ID`
  ou `OBS_DEBUG=1`); desligado, nenhum objeto do SDK existe — é o que mantém
  o Jest e o `nest start --watch` sem GCP intocados. Para ver um trace em dev:
  `OBS_DEBUG=1 OBS_TRACE_RATIO=1 pnpm dev` (spans no console).
  **Prisma não é `pg`**: é `@prisma/instrumentation`, que acompanha a versão
  do `prisma` — subir um é subir o outro. O `sampler.ts` decide por rota
  (IA e feed a 10x, até 1) e **ignora a flag do pai remoto** (o `traceparent`
  vem da internet; honrá-la deixaria qualquer cliente forçar 100%). Exportador
  direto para o Cloud Trace, sem sidecar (ADR-57). O `DesligamentoDoOtel`
  faz o flush no SIGTERM via `enableShutdownHooks`.
- **Métricas (`observabilidade/metricas.ts`)**: um provider global com os
  instrumentos (`unooria.ia.*`, `unooria.telemetria.*`, `unooria.web.*`,
  `unooria.observabilidade.*`); injete `Metricas` onde a medida acontece.
  **No Cloud Monitoring elas aparecem como
  `prometheus.googleapis.com/unooria.ia.latencia/histogram`**, no recurso
  monitorado `prometheus_target` (`job` = `service.name`, `instance` = a
  instância do Cloud Run, `location` = a região) — NÃO em
  `workload.googleapis.com`, que é onde o exportador legado do Google as
  colocava. Procurar no domínio errado faz parecer que nada foi exportado
  (aconteceu em 2026-09-02). Os rótulos ganham `otel_scope_name`.
  **Nenhum rótulo com `escola_id`, `estudante_id`, sessão ou URL crua** —
  cem escolas multiplicam cada série por cem. Rótulos são conjuntos fechados
  (`modelo` da env, `operacao`, `resultado`, `perfil`, `motivo`, `finishReason`
  por allowlist, `rota` normalizada por `normalizar-rota.ts`). **A IA se mede
  no `MedidorDeProvider`** (decorator na factory do `AiModule`), nunca no
  consumidor; a quota conta recusas em `temSaldo`. Exportação a cada 60 s por
  **OTLP/JSON para `telemetry.googleapis.com`** (`otlp-google.ts`) — NÃO
  instale `@google-cloud/opentelemetry-cloud-monitoring-exporter`: ele
  arrasta 202 MB de `googleapis` (medido). **O `resource` precisa de
  `gcp.project_id`** (`observabilidade/recurso.ts`): sem ele a Telemetry API
  recusa todo lote com `HTTP 400 Resource is missing required attribute` a cada
  60 s, com log e trace funcionando — falha silenciosa para quem olha o painel.
  O `gcpDetector` não preenche esse atributo. Nos testes,
  `tests/metricas-em-memoria.ts` dá um `Metricas` com MeterProvider em
  memória para ler o que saiu.
- **`/observabilidade/*`** (erros-cliente, vitals, v1/traces): rotas com
  `OidcGuard`, Zod `.strict()`, cota em memória por (escola, usuário) via
  `comum/rate-limit.ts`, e **sem linha de log por requisição recusada** (o
  sinal é contador). O proxy OTLP (`otlp-proxy.service.ts`) SUBSTITUI o
  `resource` do cliente e filtra atributos por allowlist antes de reexportar —
  nada do que o navegador manda vai ao Google como veio.
- **O resource do proxy OTLP também precisa de `gcp.project_id`.**
  `reescreverLote` monta o resource do ZERO — o do navegador é descartado
  inteiro, por ser entrada não confiável —, então ele tem de REPETIR o atributo
  que `recurso.ts` já põe nos sinais do processo. Sem ele a Telemetry API recusa
  todo lote com `400 Resource is missing required attribute`, a rota responde
  204 e o contador soma em `motivo=upstream`. O valor sai de
  `ClienteOtlpGoogle.projeto`, a MESMA fonte do cabeçalho `x-goog-user-project`:
  o projeto que paga a cota e o que recebe os spans não podem divergir.
  **Este defeito ficou escondido atrás do de baixo** por seis semanas — sem
  cliente injetado o lote nunca era enviado, e o 400 não tinha como aparecer.
  Consertar caminho morto revela o próximo erro que mora nele: não dê a correção
  por encerrada no primeiro deploy, olhe a métrica depois.
- **Classe que é TOKEN de injeção NUNCA entra por `import type`.** O
  `emitDecoratorMetadata` monta o `design:paramtypes` a partir do escopo de
  VALOR: com `import type` o identificador some, o metadata vira `Function`, o
  Nest não acha provider para esse token — e com `@Optional()` a dependência
  chega `undefined` em runtime, sem erro nenhum. Custou seis semanas (2026-09-02
  a 09-14) do proxy OTLP descartando TODO span de navegador como `sem-projeto`
  com `GCP_PROJECT_ID` definido em dev E hml, com a rota respondendo 204 e o
  alerta do cap. 17 acusando uma env que estava correta. Passa no typecheck, no
  lint e em qualquer suíte que faça `new Servico(...)` — **injeção manual não
  passa pelo container, e é exatamente onde este defeito não aparece**.
  Dependência opcional leva `@Inject(Classe)` explícito, que tira o token das
  mãos do compilador; a rede é `tests/observabilidade-injecao.spec.ts`, que
  monta o service pelo `NestFactory` (`@nestjs/testing` não é dependência deste
  projeto, e `createApplicationContext` do `core` monta o mesmo grafo).
- **`/observabilidade/publico/*` é a ÚNICA rota sem `OidcGuard`** além do
  `/telemetry/ingest` (que tem o `PubSubPushGuard`) — ADR-84. Existe porque a
  tela de LOGIN não tem sessão, e o 401 do BFF descartava exatamente o sinal de
  que ninguém estava conseguindo entrar. Quem escolhe o destino é o **BFF do
  hub**, não o cliente: com sessão, a rota autenticada (o log leva `usuarioId`);
  sem sessão, a pública (sem identidade, `expId` forçado a `hub`, cota por IP
  mais teto global de instância). O IP é chave de cota e **não vai para log nem
  para rótulo** — a lição do `rate-limit.ts` contra chave por IP vale para rota
  de produto, onde estourar a cota derruba a turma pelo NAT da escola; aqui
  estourar só descarta amostra de telemetria.
- **Todo caminho de recusa CONTA** (`erros_recusados`, `vitais_recusados`, com
  `motivo` e `superficie`), e é por isso que o corpo inválido passa por
  `safeParse` em vez de `parse`: em 2026-09 um `versao` de 40 caracteres (o
  `github.sha`) estourou o `max(32)` do schema e recusou **todo** erro de
  cliente do hub por seis dias — o único vestígio era uma linha
  `corpo-invalido`, e o contador que teria gritado não existia. O mesmo SHA
  derrubava o lote OTLP do hub em `identidadeDoLote`, **com a rota respondendo
  204**. Os dois tetos hoje são 64, e o CI manda o SHA curto.
- **O user-agent vira rótulo por `observabilidade/dispositivo.ts`**, nunca cru:
  `navegador`/`so`/`tipo` de conjunto FECHADO. Só `tipo` entra em métrica (os
  outros dois multiplicariam a série do histograma por 18); `navegador` e `so`
  ficam no log do erro, que não custa série.
- Envs: `LOG_LEVEL` (default `info`), `GCP_PROJECT_ID` (correlação com o
  trace, cliente OTLP; vazio em dev = métricas e spans do navegador contados
  e descartados), `OBS_TRACE_RATIO` (fração exportada; 0 desliga),
  `OBS_DEBUG` (spans e métricas no console). Fora de produção o formato é `pino-pretty`; `LOG_FORMATO=json`
  mostra a linha como o Cloud Logging a verá. Em teste (`NODE_ENV=test`) é
  JSON sem transporte — o pino-pretty abre um worker que o Jest não fecha.
- Testes: `tests/observabilidade-*.spec.ts` e `tests/tenancy-contexto.spec.ts`
  provam redaction, severity, trace, filtro e o store mutável. São puros
  (sem banco): rodam sozinhos com `pnpm exec jest tests/observabilidade`.
