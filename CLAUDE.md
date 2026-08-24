# CLAUDE.md — Plataforma Unooria

Você está trabalhando no monorepo da **Plataforma Unooria**, uma plataforma
educacional B2G (governo). Leia este arquivo inteiro antes de qualquer tarefa.
Em conflito entre este arquivo e uma suposição sua, este arquivo vence.

## Contexto de negócio (não violar)

- Cliente: redes públicas (estado/município). **1 contrato = 1 stack de infra GCP**
  (provisionada por Terraform em repo separado). Dentro de um contrato, 100+
  escolas compartilham a stack com **isolamento lógico por `escola_id`**.
- Escala alvo por contrato: ~10k alunos, picos de 2-4k simultâneos (8h da manhã).
- Produto: hub (Next.js) que embeda 48 experiências imersivas (Vite, estáticas)
  do 1º ano EF ao 3º EM.
- Prazo: produção em novembro/2026. Uma pessoa desenvolve. Simplicidade > sofisticação.

## Arquitetura (resumo operacional)

| Peça | Stack | Deploy |
|---|---|---|
| `apps/hub` | Next.js (App Router) | Cloud Run |
| `apps/api` | NestJS + Postgres (Cloud SQL) | Cloud Run |
| `apps/experiencias/*` | Vite + React + `@edu/sdk` | Cloud Storage + CDN (estático) |
| `packages/sdk` | TS puro, zero deps pesadas | consumido via workspace |
| Auth | WSO2 Identity Server via **OIDC genérico** | externo, único p/ vários contratos |
| IA | Vertex Gemini via `apps/api/src/ai` (provider plugável) | dentro da api |
| Telemetria | SDK → `POST /telemetry/batch` → Pub/Sub → worker | |

Experiências NUNCA viram serviços no Cloud Run. São bundles estáticos:
`gs://{contrato}-exp/{expId}/{versao}/`. Rollback = hub apontar p/ versão anterior.

## Regras invioláveis (segurança/tenancy)

1. **Toda query SQL é escopada por `escola_id`** (e `aluno_id` quando aplicável).
   Tabelas de dados de aluno têm `escola_id NOT NULL` + Row-Level Security.
   Nunca escreva uma query que atravesse escolas, exceto em rotas `admin-contrato`.
2. **Nenhum segredo em bundle client** (experiências e hub client-side): sem
   API keys, sem prompts de sistema, sem URLs internas. IA só via `api /ai/*`.
3. **Respostas corretas / correção / pontuação que vale nota: server-side.**
   O client envia a resposta do aluno; a api corrige.
4. **Token**: hub obtém via OIDC (WSO2), repassa à experiência por `postMessage`
   com `targetOrigin` explícito (nunca `*`). Experiência mantém token só em memória.
5. **IA tem quota**: por aluno/dia (`AI_DAILY_TOKEN_QUOTA_PER_ALUNO`) e rate limit
   por usuário. Nunca exponha chamada de IA sem passar pelo guard de quota.
6. Dados de menores (LGPD): não logar PII em texto claro; telemetria carrega
   `aluno_id` opaco, nunca nome/email.

## Contratos de integração (mudanças aqui exigem cuidado extremo)

### postMessage hub ⇄ experiência (`packages/sdk/src/bridge.ts`)
```
exp → hub : { type: "exp:ready", protocolVersion: 1 }
hub → exp : { type: "hub:init", token, aluno:{id,nome,serie,turmaId,escolaId}, config, apiUrl }
exp → hub : { type: "exp:concluir", payload:{ score?, dados? } }
exp → hub : { type: "exp:token-expirando" }   → hub responde { type:"hub:token", token }
exp → hub : { type: "exp:estado", estado:{...} }   → p/ "chrome" opcional do hub (aditivo v1)
hub → exp : { type: "hub:pause" | "hub:resume" }   → emitidos por visibilidade/foco da página
```
Versione com `protocolVersion` (major verificado nos DOIS lados — incompatível
falha alto). Toda mensagem pós-init é validada com Zod nos dois lados; inválida
é descartada com aviso. Nunca quebre compatibilidade sem bump + suporte à anterior.

### Token e emissor (decisão da migração, 2026-08)
O HUB assina os tokens de experiência (RS256, TTL 15min, claims
`{sub, escola_id, turma_id?, perfil}`, aud `plataforma-api`) e serve o JWKS em
`/.well-known/jwks.json`. A api valida via `OIDC_ISSUER`/`OIDC_JWKS_URI` —
trocar para WSO2 = trocar essas envs, o guard não muda. Papéis:
`aluno | professor | gestor | admin-contrato` (admin-contrato é a única exceção
cross-escola). Usuários entram por CSV: `POST /usuarios/importar-csv`
(gestor/admin), colunas `nome,usuario,senha,papel,turma,serie`.

### Telemetria: dois canais, não um (decisão da migração)
- **Operacional (motor)**: `POST /runs/:id/eventos` e `GET /runs/:id/feed` —
  síncrono, transacional, lido em tempo quase real para curar o próximo bloco.
  Dwell NUNCA passa por Pub/Sub: latência e falta de ordenação quebrariam a
  adaptação e o lock por run.
- **Analítico (SDK)**: `track()` → batch 50/10s → `POST /telemetry/batch` →
  Pub/Sub → push subscription → `POST /telemetry/ingest` → `telemetria_eventos`
  (`ON CONFLICT DO NOTHING`: o Pub/Sub entrega *at least once*). No `pagehide`,
  `POST /telemetry/beacon` com o token no CORPO — `sendBeacon` não manda header.

### Manifesto de experiências (tabela `experiencias` na api)
O CI, ao publicar `gs://{contrato}-exp/{expId}/{versao}/`, faz upsert
(`PUT /experiencias/:expId`, admin-contrato) lendo o `public/experiencia.json`
da experiência (`id, nome, versao, series, capabilities, viewport?`). O hub
monta a URL do iframe com `versaoAtiva`; rollback = trocar `versaoAtiva`.
`viewport` presente ⇒ o hub embeda dentro do `DispositivoFrame` (casca de
aparelho com escala). Sem manifesto (dev) o hub cai na raiz do Vite; teste
local: rota `/dev-embed?src=http://localhost:5173`.

### Evento de telemetria (inspirado em xAPI, simplificado)
```json
{ "eventId": "uuid", "ts": "ISO", "alunoId": "...", "escolaId": "...",
  "expId": "exp-01", "expVersion": "1.2.0", "sessaoId": "uuid",
  "verbo": "completed|attempted|interacted|scored|...",
  "objeto": "fase-3", "resultado": { }, "contexto": { } }
```
SDK preenche tudo exceto `verbo`, `objeto`, `resultado`. Batch de até 50, flush 10s.

### Provider de IA (`apps/api/src/ai/provider.ts`)
Interface única `AiProvider { generate(req): Promise<AiResult> }`. Implementações:
`vertex.provider.ts` (default), `mock.provider.ts` (testes). Para trocar de
provedor, cria-se novo arquivo — nada fora de `src/ai` conhece o vendor.

## Convenções de código

- TypeScript strict em tudo. Sem `any` (use `unknown` + narrow).
- Nomes de domínio em pt-BR (`aluno`, `escola`, `turma`, `experiencia`);
  termos técnicos em inglês (`provider`, `guard`, `batch`).
- Commits: `feat(exp-12): ...`, `fix(api): ...`, `chore(sdk): ...`.
- Zod para validar TODO input externo (body, query, postMessage recebido, env).
- Testes: mínimo = contratos (bridge, telemetria, guards de tenancy). Vitest
  no sdk/experiências, Jest no NestJS.
- UI: template de experiência é propositalmente cru. Trabalho visual sério
  segue `docs/DESIGN.md` quando existir (não inventar design system agora).

## Comandos

```bash
pnpm dev                                  # tudo em watch
pnpm turbo build --filter=@edu/exp-01     # builda 1 experiência (+ deps)
pnpm turbo build --filter='...[HEAD^]'    # só o que mudou (CI usa isso)
pnpm new:exp exp-07-fracoes               # scaffolda experiência do _template
pnpm --filter @edu/api test
```

## Como criar uma experiência nova

1. `pnpm new:exp exp-NN-slug` (copia `_template`, ajusta nomes).
2. Implementar em `src/App.tsx`+; usar SOMENTE a SDK para auth/api/telemetria.
3. Declarar capabilities no `experiencia.json` (`telemetria`, `progresso`,
   `ia`, `avaliacao`, `tempo-real`) — o hub e a api usam isso.
4. `verbo`/`objeto` de telemetria: documentar no README da experiência.
5. Build gera `dist/` 100% estático. Testar embedado: rota `/dev-embed` do hub.

## O que NÃO fazer

- Não criar novos serviços Cloud Run sem necessidade demonstrada (a api absorve).
- Não adicionar Redis/filas/libs de estado sem gargalo medido (exceção: Pub/Sub
  de telemetria, que já é decisão tomada).
- Não usar localStorage para token. Não usar `targetOrigin: "*"`.
- Não escrever migração que remova `escola_id` ou afrouxe RLS.
- Não chamar provedores de IA fora de `apps/api/src/ai`.
- Não commitar assets binários pesados (>2MB): vão para o bucket, referenciados por URL.

## Infra (repo separado)

Terraform vive em outro repo. O contrato entre os repos está em `docs/INFRA.md`:
nomes de recursos esperados, variáveis de ambiente que a app consome, e o que o
CI deste repo publica (imagens no Artifact Registry, bundles no bucket).
Nunca criar recursos GCP imperativamente por script neste repo.

## Definition of Done (qualquer tarefa)

- [ ] Typecheck + lint + testes passando (`pnpm turbo typecheck lint test`)
- [ ] Se mexeu em tela: smoke VISUAL (`node scripts/walkthrough-aluno.mjs <pasta>`
      e `walkthrough-professor.mjs`) — typecheck verde não pega ícone virando
      texto, link sublinhado nem iframe vazio
- [ ] Input externo validado com Zod
- [ ] Queries novas escopadas por tenancy (revisar mentalmente a regra 1)
- [ ] Sem segredo/URL interna em código client
- [ ] Se tocou contrato (bridge/telemetria/provider): docs atualizados aqui
