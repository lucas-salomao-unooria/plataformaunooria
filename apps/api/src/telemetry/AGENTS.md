# apps/api/src/telemetry — dois canais, não um

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

## Telemetria: dois canais, não um (decisão da migração)
- **Operacional (motor)**: `POST /runs/:id/eventos` e `GET /runs/:id/feed` —
  síncrono, transacional, lido em tempo quase real para curar o próximo bloco.
  Dwell NUNCA passa por Pub/Sub: latência e falta de ordenação quebrariam a
  adaptação e o lock por run.
- **Analítico (SDK)**: `track()` → batch 50/10s → `POST /telemetry/batch` →
  Pub/Sub → push subscription → `POST /telemetry/ingest` → `telemetria_eventos`
  (`ON CONFLICT DO NOTHING`: o Pub/Sub entrega *at least once*). No `pagehide`,
  `POST /telemetry/beacon` com o token no CORPO — `sendBeacon` não manda header.
  `/telemetry/ingest` não tem OidcGuard (quem chama é o Pub/Sub) e por isso tem
  o `PubSubPushGuard`: ID token do Google, `aud` == `TELEMETRIA_PUSH_AUDIENCE`,
  `email` == `TELEMETRIA_PUSH_SA`. Envs ausentes = rota 401, nunca aberta.
  **Destino: Postgres, não BigQuery** (decisão de 2026-08-27). O canal analítico
  fica no mesmo banco: se um relatório precisar dele um dia, é um JOIN local com
  `turmas`/`users`, e é uma plataforma de dados a menos para operar. O que
  sustenta isso na escala são duas coisas, e nenhuma delas é um serviço novo:
  o `INSERT` do `ingest` é **multi-linha** (um lote de 50 custava 50
  round-trips; no pico de ~4k simultâneos isso era ~800 INSERTs/s numa
  instância pequena) e `telemetria_eventos` é **particionada por mês**
  (`particoes.telemetria_eventos_YYYY_MM`, migration
  `20260827100000_telemetria_particionada`).
  **Nada de Redis como buffer.** Quem amortece o pico já é o Pub/Sub — e ele é
  DURÁVEL: um buffer em memória perde os eventos do processo que morre antes do
  flush. Redis só entra com gargalo medido, e o gargalo medido aqui era o laço
  de INSERT.
  A PK é `(event_id, ts)` porque o Postgres exige a chave de partição em índice
  único; a dedupe segue correta (reentrega da mesma mensagem traz o mesmo `ts`).
  As partições vivem no schema `particoes`, fora do alcance do Prisma — em
  `public` cada uma viraria drift. Há uma partição DEFAULT como rede de
  segurança: sem ela, evento com `ts` fora das faixas seria RECUSADO, e
  telemetria perdida em silêncio é pior que telemetria mal guardada. Ela
  encher é sinal de que faltou criar partição — não há job agendado nesta
  plataforma, de propósito, e as faixas vão até 2028-12.
