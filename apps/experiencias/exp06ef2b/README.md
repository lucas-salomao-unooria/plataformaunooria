# exp06ef2b — O Rastro do Boato: Por que a Mentira Voa?

Missão do **6º ano do Fundamental**, unidade 2. Clone de mensageiro móvel: um
boato sobre a água da escola corre quatro grupos, o estudante audita os dados de
envio de cada mensagem e decide o que fazer quando a crise chega — e depois vê,
no mapa da rede, o que o clique dele produziu.

Duas aulas de ~35 min, com pausa entre elas conduzida pela professora.

## Rodar

```bash
pnpm --filter @edu/exp06ef2b dev     # :5181
```

O hub embeda em `/exp/exp06ef2b`. Para testar o embed sem passar pela
trilha: `/dev-embed?src=http://localhost:5181`.

A api precisa estar no ar (`/rastro-boato/*`), e a missão precisa estar
**liberada** na turma do estudante (ADR-69) — o seed já libera na `6A`.

## Verificar

```bash
pnpm --filter @edu/exp06ef2b typecheck
pnpm --filter @edu/exp06ef2b test
pnpm --filter @edu/exp06ef2b build
node scripts/e2e/rodar.mjs estudante/07-rastro-boato
```

## Telemetria

`verbo:objeto` emitidos (o payload nunca leva texto de estudante):

| Verbo | Objeto | Quando |
|---|---|---|
| `interacted` | `app:aberto`, `chat:<id>`, `audio:<id>` | navegação no mensageiro |
| `interacted` | `mensagem:metadados` | abriu os dados de uma mensagem |
| `interacted` | `crise:alerta-de-inacao` | 90 s sem decidir no pico |
| `attempted` | `intervencao:decisao` | enviou a resposta no grupo |
| `progressed` | `gate:breakpoint`, `telemetria:curvas`, `telemetria:topologia` | espera e Aha! |
| `interacted` | `construtor:ciclo` | confirmou o modelo do ciclo |
| `completed` | `missao:percurso` | entregou o Meu percurso |

## Onde está o resto

- As regras que valem (gabarito, cota, topologia): `apps/api/src/rastro-boato/`.
- O que quebra se você não souber: `AGENTS.md` desta pasta.
