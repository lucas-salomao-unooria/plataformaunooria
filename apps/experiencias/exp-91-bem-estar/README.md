# exp-91-bem-estar — "Como você está?" (check-in de bem-estar do professor)

Ferramenta do **professor** (`publico: "professor"` no manifesto), embedada pelo
hub em `/professor/bem-estar`. Aplica o **DASS-21** (Depression Anxiety Stress
Scales, forma curta — Lovibond & Lovibond, 1995; versão brasileira de Vignola &
Tucci, 2014; domínio público) em **microdoses**: 3 frases por dia, 7 dias fecham
os 21 itens, e um espaço livre para o professor dizer como está.

- **Auth**: nenhuma aqui. O hub autentica e entrega o token por `hub:init`; a
  api impõe `@Roles("professor")`.
- **Instrumento**: os 21 itens ficam VERBATIM em `apps/api/src/bemestar/catalogo.ts`
  e chegam prontos pela api. A IA **nunca** reescreve um item (quebraria a
  validação psicométrica).
- **IA** (Vertex, via api): só o entorno — a frase de abertura do dia, a
  pergunta aberta e o acolhimento ao texto livre. Cada texto passa por
  guardrails (`regras.validarTextoDaIa`: sem vocabulário clínico, ordens,
  promessas, gestão, links); barrado ou sem IA, entra o texto fixo do catálogo.
  A IA nunca recebe nome, escola, pontuação ou faixa.
- **Correção**: server-side (regra 3). Ao 7º check-in a api soma por subescala
  (×2) e classifica pelas faixas publicadas. O bundle só exibe.
- **Segurança**: item 17 ou 21 ≥ 2, ou termo de risco no texto livre → mensagem
  fixa de apoio (CVV 188, SAMU 192, CAPS/UBS) e a IA não é chamada.
- **Persistência**: `bem_estar_ciclos` + `bem_estar_checkins` (RLS por escola,
  posse por professor). Dado sensível: só o professor lê; `DELETE /bemestar/dados`
  apaga tudo (LGPD).

## Telemetria

| verbo | objeto | quando |
|---|---|---|
| `attempted` | `checkin` | abriu o check-in do dia (contexto: `numero`, `status`) |
| `completed` | `checkin` | enviou o check-in (contexto: `numero`, `comTexto`) |
| `completed` | `ciclo` | o envio fechou um ciclo de 7 (contexto: `cicloId`) |
| `interacted` | `historico` · `apagar-dados` | ação correspondente |

Nunca vai à telemetria: respostas, pontuação, faixa, texto livre.

## Dev

```bash
pnpm --filter @edu/exp-91-bem-estar dev     # :5176
# hub: http://localhost:3000/professor/bem-estar  (login prof.demo)
# sem GCP: AI_PROVIDER=mock na api → textos fixos (o fluxo inteiro funciona)
```
