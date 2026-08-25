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
5. **IA tem quota**: por usuário/dia e POR PERFIL (`AI_DAILY_TOKEN_QUOTA_PER_ALUNO`,
   `AI_DAILY_TOKEN_QUOTA_PER_PROFESSOR` — um plano anual gasta ~220k tokens só de
   prompt) e rate limit por usuário. Nunca exponha chamada de IA sem passar pelo
   `QuotaService` (`temSaldo(escola, usuario, perfil)` ANTES, `consumir` depois).
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
  `/telemetry/ingest` não tem OidcGuard (quem chama é o Pub/Sub) e por isso tem
  o `PubSubPushGuard`: ID token do Google, `aud` == `TELEMETRIA_PUSH_AUDIENCE`,
  `email` == `TELEMETRIA_PUSH_SA`. Envs ausentes = rota 401, nunca aberta.

### Manifesto de experiências (tabela `experiencias` na api)
O CI, ao publicar `gs://{contrato}-exp/{expId}/{versao}/`, faz upsert
(`PUT /experiencias/:expId`, admin-contrato) lendo o `public/experiencia.json`
da experiência (`id, nome, versao, series, capabilities, viewport?, publico?`).
O hub monta a URL do iframe com `versaoAtiva`; rollback = trocar `versaoAtiva`
(`node apps/hub/scripts/publicar-manifesto.mjs <exp> --versao x.y.z`).
`viewport` presente ⇒ o hub embeda dentro do `DispositivoFrame` (casca de
aparelho com escala; exp-01 é 375×812, exp-02 não tem viewport porque foi
desenhada para desktop). SEM linha na tabela, o `viewport` é lido do
`experiencia.json` servido ao lado do index do bundle — não só em dev: uma
stack com a tabela vazia (compose local, ambiente novo antes do 1º publish do
CI) servia o Instanooria esticado na janela em vez do aparelho. Essa leitura é
server-side (o público `NEXT_PUBLIC_CDN_EXP_URL` é o endereço do BROWSER), então
em container use `EXP_INTERNAL_HOST` — que troca só o HOST e PRESERVA a porta,
porque em dev cada exp tem um dev server numa porta diferente e um
`EXP_INTERNAL_URL` fixo faria as três lerem o manifesto de uma só (o UnooTube,
sem `viewport`, apareceria dentro do aparelho da Instanooria). `EXP_INTERNAL_URL`
continua valendo para quando há UMA origem de bundles (o CDN, em produção).
Os dev servers das exps declaram `allowedHosts: ["host.docker.internal"]`: o
Vite 5.4+ recusa `Host` que não conheça, e sem isso o hub em container não lê o
manifesto e a experiência aparece esticada na janela.
`publico: "professor"` ⇒ ferramenta do professor
(exp-90-plano-de-aula): embedada em `/professor/plano-de-aula`, e `/exp/*`
responde 404 para ela. Sem manifesto (dev) o hub cai na raiz do Vite **da
experiência mapeada em `apps/hub/lib/experiencias-dev.ts`** (uma porta por exp:
5173 exp-01, 5174 exp-02, 5175 exp-90…); teste local: rota `/dev-embed?src=http://localhost:5174`.
A montagem do embed (token, manifesto, dev server, origin) é uma só:
`apps/hub/lib/embed-experiencia.ts`, usada por `/exp/[expId]`, `/dev-embed` e
`/professor/plano-de-aula`.
O aluno tem hub próprio (`/aluno`): ele ESCOLHE a missão, sem filtro por série
por enquanto (`apps/hub/lib/missoes-do-aluno.ts`, derivado do catálogo do Entre
Redes; a série volta a filtrar quando o manifesto virar a fonte). Missão só
aparece lá se tiver copy de aluno (`missao.aluno` no catálogo) — a copy do
professor entrega a virada. `/aluno` e `/exp/*` são a MESMA área no middleware
(`lib/papeis.ts`). A trilha do professor cobre a Educação Básica inteira
(1º–9º ano + 3 séries do EM), 4 unidades por ano.

**Header: um só para todos os papéis.** `components/header-plataforma.tsx`
(marca → home do papel, nome + série/papel, avatar, Sair) é o header de
`/aluno`, `/professor`, `/admin`, `/analise` E de `/exp/*` — antes cada área
copiava o seu e a experiência não tinha nenhum. A casca visual (CSS do DS,
compensações, fontes) saiu do layout do grupo `(plataforma)` para
`components/casca-plataforma.tsx`, porque `/exp/*` e `/dev-embed` estão fora do
grupo e também precisam dela. A regra de ouro passou a valer um nível abaixo: o
header é chrome do HUB, desenhado ACIMA do aparelho — dentro do iframe nada da
marca institucional entra.

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
`AiRequest.modelo: "padrao" | "longo"` escolhe a família (o `longo` mapeia para
`VERTEX_MODEL_LONGO`, Gemini 2.5, saída até 65k — planos anuais); quem gera texto
longo checa `AiResult.finishReason` (`MAX_TOKENS` = conteúdo cortado, é erro).

**Credencial: ADC, nunca chave de API.** O provider pega o token com
`google-auth-library`, que resolve na mesma ordem nos três ambientes:
`GOOGLE_APPLICATION_CREDENTIALS` → arquivo do `gcloud auth application-default
login` → metadata server (Cloud Run). Antes daqui só havia o metadata server, e
por isso NENHUMA chamada de IA funcionava fora do Cloud Run — nem no host nem no
container, onde `metadata.google.internal` não resolve; em dev a api ficava presa
no `AI_PROVIDER=mock` e a exp-90 devolvia um plano falso. Os dois compose montam
o ADC do host em `/adc` (só leitura); em Cloud Run a service account do serviço
já é a credencial, e ela precisa de `roles/aiplatform.user`.

**Modelo × região (decisão, 2026-08).** O modelo é `gemini-3.6-flash` e a
localização é `global` — para texto E para o plano de aula. Medido no projeto do
contrato: o 3.6-flash dá 404 em `southamerica-east1`, `us-east1` e `us-central1`;
só o endpoint `global` (sem host regional) o serve. A consequência é explícita e
foi aceita: o tráfego de IA sai de São Paulo, inclusive o do aluno. Voltar para
`VERTEX_LOCATION=southamerica-east1` é possível a qualquer momento, mas exige
trocar TAMBÉM o modelo pelo que a região publica (família 2.5 — a 2.0 saiu do
catálogo e a 3.x nunca esteve lá). A arte da exp-01 usa `gemini-2.5-flash-image`:
o `gemini-2.0-flash-exp` que era o default não existe mais em lugar nenhum, e por
isso toda geração de imagem caía no fallback procedural.

**Raciocínio conta como saída.** Nos modelos 2.5 e 3.x os tokens de pensamento saem do
`maxOutputTokens`: com pensamento livre o plano anual voltava VAZIO com
`finishReason: MAX_TOKENS`. `VERTEX_THINKING_BUDGET` (default `0`, desligado)
mantém a paridade com o app origem, que usava Claude sem essa etapa; `-1` volta
ao dinâmico.

### Plano de aula (exp-90, `apps/api/src/planos`)
Ferramenta do professor: `POST /planos` (202) gera em background (claim atômico
em `planos_de_aula`, `marked` roda na api), o cliente faz polling em `GET /planos/:id`.
Conteúdo em object storage PRIVADO (`{contrato}-planos`; `PLANOS_DRIVER=local`
em dev → `storage-privado/`): `gerado.md` imutável + `atual.html` do editor
(sanitizado com allowlist). Referências curriculares = texto no Postgres
(`planos_referencias`, catálogo do contrato, sem RLS), importadas por
`scripts/importar-referencias-plano.mjs` com `PLANOS_IMPORT_TOKEN`.
O teto de saída é 64k tokens, não os 32k do app origem (que eram o limite do
Claude): com o material real (currículo da rede + as 4 unidades do ano, ~190k
tokens só de prompt) o gemini-2.5-flash é cortado em 32k e o professor recebe
"o plano ficou grande demais" sem plano nenhum.

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
- Lógica de domínio de uma experiência (gabarito, estado da missão, visão do
  professor) vive num módulo próprio da api, prefixo minúsculo igual ao slug:
  `apps/api/src/unootube/` ↔ `/unootube/*` (regra 3: o client nunca recebe o
  gabarito). Padrão: `catalogo.ts` (dados) + `regras.ts` (puro) + service com
  `comTenancy` + controllers por papel.

## Git e branches

- **`main` é o tronco.** A migração para o monorepo foi mergeada nela em
  2026-08-25 por fast-forward: 26 commits, histórico linear, sem merge commit.
  A branch `migracao-monorepo` não existe mais.
- **Uma branch por experiência nova**, com o nome do slug dela:
  `exp-07-fracoes`. Trabalho que não é experiência usa o prefixo do tipo do
  commit: `fix/quota-por-perfil`, `chore/deps`, `ci/deploy`.
- Commits: `feat(exp-12): ...`, `fix(api): ...`, `chore(sdk): ...` — o escopo é
  o slug da experiência ou o app/pacote tocado.
- **Nada de build no git.** `.gitignore` cobre `dist/`, `.next/`, `.next-prod/`,
  `.turbo/`, `*.tsbuildinfo`, `storage/`, `storage-privado/` e os prints dos
  walkthroughs. `apps/hub/.next-prod/` (que o `pnpm build:isolado` escreve) já
  entrou uma vez por um `git add -A` distraído: 358 arquivos e 250MB de cache de
  webpack no histórico, que só saíram reconstruindo a branch inteira. Stage por
  caminho, nunca `-A` sem olhar o `git status`.
- `apps/hub/next-env.d.ts` É versionado (o Next espera isso), mas alterna entre
  `./.next` e `./.next-prod` conforme o último build. Modificado depois de um
  `build:isolado` = descartar, não commitar.

## Comandos

```bash
pnpm dev                                  # tudo em watch, no host
pnpm docker:dev                           # a stack INTEIRA em container (pg/api/hub/3 exps) com o
                                          # código do host por bind mount: salvar arquivo recompila
                                          # lá dentro, sem build. Mesmas portas do `pnpm dev`, então
                                          # é um OU outro. `:logs` `:deps` `:down` completam.
pnpm turbo build --filter=@edu/exp-01     # builda 1 experiência (+ deps)
pnpm turbo build --filter='...[HEAD^]'    # só o que mudou (CI usa isso)
pnpm new:exp exp-07-fracoes               # scaffolda experiência do _template
pnpm --filter @edu/api test
pnpm --filter @edu/exp-90-plano-de-aula dev   # :5175 → hub /professor/plano-de-aula (prof.demo; seed:demo importa referências demo)
pnpm --filter @edu/exp-02-unootube dev    # :5174 (exp-01 usa :5173 — portas em apps/hub/lib/experiencias-dev.ts)
node scripts/walkthrough-aluno-unootube.mjs testes/walkthrough-unootube   # smoke da exp-02 (aluno4a01)
```

## Como criar uma experiência nova

0. `git switch -c exp-NN-slug` a partir da `main` — uma branch por experiência.
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
      e `walkthrough-professor.mjs`, que também cobre a exp-90 embedada) —
      typecheck verde não pega ícone virando texto, link sublinhado nem iframe vazio
- [ ] Input externo validado com Zod
- [ ] Queries novas escopadas por tenancy (revisar mentalmente a regra 1)
- [ ] Sem segredo/URL interna em código client
- [ ] Se tocou contrato (bridge/telemetria/provider): docs atualizados aqui
