# exp-template — Experiência de exemplo

<!-- Troque por: série e unidade, ambiente clonado, o que a criança faz e
     descobre, duração e etapas. Duas ou três frases — o resto está na spec. -->

## Rodar

```bash
pnpm --filter @edu/exp-template dev     # a porta do package.json
# no hub: /exp/exp-template  (ou /dev-embed?src=http://localhost:<porta>)
```

A porta entra em `apps/hub/lib/experiencias-dev.ts` e no `CORS_ORIGINS` da api
(`apps/api/.env`, `docker-compose.yml`, `docker-compose.dev.yml`). Sem ela o boot
morre com "Failed to fetch", e o erro não diz por quê.

Precisa de: a missão LIBERADA na turma do estudante (`liberacoes`, ADR-69) e o
produto do manifesto ligado no painel da Unooria (`/unooria/recursos/<produto>`,
ADR-87).

## Onde as coisas estão

| O quê | Onde |
|---|---|
| Handshake, primeira leitura, erro de abertura | `src/bootstrap.tsx` |
| A tela | `src/App.tsx` |
| Contrato que a tela vê, `EXP_ID`, `EXP_VERSION` | `src/lib/tipos.ts` |
| Chamadas à api (sempre pelo SDK) | `src/lib/api.ts` |
| Vocabulário de telemetria | `src/lib/telemetria.ts` |
| Copy que a TELA escreve | `src/lib/textos.ts` |
| Regras e rotas do servidor | `apps/api/src/<slug>/` |
| Suíte de ponta a ponta | `scripts/e2e/<papel>/NN-slug.mjs` |

## Telemetria

`verbo:objeto` via `@edu/sdk`, com `resultado` e `contexto` como objetos —
nunca texto de estudante, nome ou e-mail.

| Verbo | Objeto | Quando | `resultado` / `contexto` |
|---|---|---|---|
| `attempted` | `missao:entrada` | depois do handshake | — |
| `interacted` | `passo:registrado` | a cada passo | `resultado: { passos }` |
| `completed` | `missao:concluida` | ao concluir | `contexto: { passos }` |

Onde cada medida é LIDA: <!-- tabela `exp_NN_*` + rota do professor -->.
