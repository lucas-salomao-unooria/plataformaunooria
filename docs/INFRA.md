# Contrato com o repo de Terraform

Este repo NÃO cria recursos GCP. O repo de infra provisiona, por contrato:

> **`{contrato}` = `{app_name}-{env}`** do Terraform (`local.name_prefix`).
> No piloto: `plataforma-unooria-dev`, projeto `entre-redes`, região
> **`us-east1`** (a mesma do Cloud SQL que já existe — o Vertex é o único que
> fica em `southamerica-east1`, por `VERTEX_LOCATION`).
> O passo a passo de subida está em `RUNBOOK-API.md`, no repo de infra.

> O **gerenciador central de identidade** (WSO2 Identity Server) foge deste padrão: é
> único para vários contratos, então não é `{contrato}-*` e vive em projeto próprio.
> Contrato separado em [`INFRA-IDENTITY.md`](INFRA-IDENTITY.md).

| Recurso | Nome esperado | Consumido por |
|---|---|---|
| Cloud Run service | `{contrato}-frontend` (hub), `{contrato}-api` | deploy.yml |
| Cloud Run **job** | `{contrato}-migrate` (VPC, roda `prisma migrate deploy`) | deploy.yml |
| Artifact Registry | `{contrato}` (mesma região do Cloud Run) | deploy.yml |
| Bucket experiências | `{contrato}-exp` (+ Cloud CDN) | deploy.yml |
| Bucket **assets** | `{contrato}-assets` (+ Cloud CDN, leitura pública) | api (`ASSETS_BUCKET`) |
| Bucket **planos** | `{contrato}-planos` (**privado**, sem CDN, versionamento de objetos ligado) | api (`PLANOS_BUCKET`) |
| Cloud SQL | `{contrato}-pg` (HA, PITR, pooler ativo) | api DATABASE_URL |
| Pub/Sub | topic `{contrato}-telemetria` + **push** sub `{contrato}-telemetria-ingest` → `POST {api}/telemetry/ingest` | api |
| Secret Manager | `{contrato}-database-url`, `{contrato}-db-password`, `{contrato}-token-signing-key`, `{contrato}-auth-secret`, `{contrato}-perfil-import-token`, `{contrato}-planos-import-token` | Cloud Run env |
| Service Accounts | `{contrato}-api` (Vertex, Pub/Sub publisher, `objectAdmin` nos buckets de assets e de planos), `{contrato}-run` (hub/storybook), `{contrato}-push` (assina o push da telemetria) | |
| Load Balancer | um só, global: hub em `{hub_domain}`, api em `{api_domain}`, bundles em `{exp_domain}`, assets em `{assets_domain}` — mesmo IP, host rules | DNS |
| WIF p/ GitHub Actions | pool `github` | deploy.yml (sem chave JSON) |

Variáveis que a app espera: ver `.env.example`. Terraform injeta via Cloud Run env/secrets.
`OIDC_ISSUER`/`OIDC_JWKS_URI` NÃO são segredo (são URLs públicas do hub) e vão
como env em texto plano, derivadas de `hub_domain` — é isso que garante que o
`iss` do token e o esperado pela api não podem divergir.

**Mudanças em relação ao desenho original (decisões da migração, 2026-08):**

- **Sem `{contrato}-telemetry-worker`.** A telemetria analítica é consumida por
  **push subscription** direto num endpoint da própria api
  (`POST /telemetry/ingest`, que grava em `telemetria_eventos` com
  `ON CONFLICT DO NOTHING` — o Pub/Sub entrega *at least once*). Uma peça a
  menos para operar; o worker separado volta se o volume justificar.
- **Bucket de assets novo** (`{contrato}-assets`): as imagens geradas pela IA
  saíram do filesystem (`public/generated/`, que não sobrevive a Cloud Run
  multi-instância) para `atividades/{escolaId}/{activityId}/{postId}.webp`. O
  banco guarda a URL absoluta da CDN. Em dev, `ASSETS_DRIVER=local` e a api
  serve em `/assets`.
  O mesmo bucket guarda a **mídia pesada das experiências** (>2 MB não entra no
  git nem no bundle): `exp-02-unootube/videos/v01.mp4..v21.mp4` (~52 MB),
  upload manual por `gsutil` uma vez por contrato — é conteúdo, não recurso
  Terraform. O build da exp recebe a base pública em `VITE_VIDEOS_BASE_URL`
  (`https://<cdn-assets>/exp-02-unootube/videos`); vazio = `./videos` (dev,
  `public/videos/` gitignorado). Lacuna conhecida: o CI só publica `dist/`;
  para 48 experiências o passo `gsutil rsync` de mídia precisa entrar no CI.
- **Job de migration**: `prisma migrate deploy` roda como Cloud Run Job na VPC
  (o Cloud SQL só tem IP privado), antes do deploy dos serviços.
- **Roles do Postgres**: o desenho original previa duas roles (owner p/
  migrations, `app_runtime` sem ownership p/ a api). Na prática ficou UMA
  (`app`, criada pelo Terraform), porque as tabelas usam **`FORCE ROW LEVEL
  SECURITY`** — que sujeita o próprio dono às políticas e torna a separação
  desnecessária. O que continua sendo obrigatório é a role **não** ter
  `BYPASSRLS` nem `SUPERUSER`; `RUNBOOK-API.md` traz o SQL de verificação, e
  `tests/tenancy.spec.ts` cobre o mesmo contrato localmente com uma role sem
  ownership.
- **Chave de assinatura de token**: enquanto o IdP central não entra, o HUB
  assina os tokens de experiência (RS256) e publica o JWKS em
  `/.well-known/jwks.json`; a api valida por `OIDC_ISSUER`/`OIDC_JWKS_URI`.
  `TOKEN_SIGNING_KEY_PEM` é obrigatória em produção.
- **api com CPU sempre alocada e `min-instances >= 1`**: o worker de geração de
  conteúdo roda in-process (fila em `generation_jobs` + advisory lock por
  atividade) — e a geração de planos de aula (exp-90) também: uma chamada de
  IA de minutos por plano, claim atômico em `planos_de_aula`.
- **Bucket de planos** (`{contrato}-planos`, 2026-08): o gerador de plano de
  aula deixou de ser um Cloud Run separado e virou a experiência exp-90 + o
  módulo `planos` da api. O conteúdo autoral do professor
  (`planos/{escolaId}/{planoId}/{gerado.md,atual.html}`) fica em bucket
  **privado** — nunca no de assets, que é público — e só sai pela api
  (OIDC + posse). Versionamento de objetos ligado dá histórico de cada
  Salvar sem código. Em dev, `PLANOS_DRIVER=local` grava em `storage-privado/`.
  Envs: `PLANOS_DRIVER`, `PLANOS_BUCKET`, `PLANOS_IMPORT_TOKEN`,
  `VERTEX_MODEL_LONGO` (Gemini 2.5, saída longa),
  `AI_DAILY_TOKEN_QUOTA_PER_PROFESSOR`. As referências curriculares (texto)
  vivem no Postgres e entram por `scripts/importar-referencias-plano.mjs`.
  O Cloud Run `planodeaula` antigo pode ser desligado após o smoke em produção.
- **Check-in de bem-estar** (exp-91, 2026-08): sem recurso novo de infra —
  duas tabelas com RLS (`bem_estar_ciclos`, `bem_estar_checkins`; a migration
  dá `GRANT` à `app_runtime`) e IA pelo mesmo Vertex/quota do professor. O
  texto livre do professor vai ao Vertex (endpoint `global`): consta do DPA
  junto com o resto da IA. Nenhum bucket, nenhuma rota pública.

**IA: a service account da api precisa de `roles/aiplatform.user`** (2026-08).
A api autentica no Vertex por ADC (`google-auth-library`), então em Cloud Run a
credencial é a SA do serviço e não há env de credencial nenhuma — só
`VERTEX_PROJECT_ID` (obrigatória com `AI_PROVIDER=vertex`; o boot recusa sem
ela), `VERTEX_LOCATION`, `VERTEX_MODEL`, `VERTEX_MODEL_LONGO` e
`VERTEX_THINKING_BUDGET`. Sem o papel, toda geração falha com 403 do Vertex.
Atenção ao catálogo por região: o modelo escolhido (`gemini-3.6-flash`) só
existe no endpoint `global`, então `VERTEX_LOCATION=global` — o processamento de
IA NÃO fica em São Paulo, e isso precisa constar do contrato/DPA da rede. Voltar
à região é trocar as duas envs juntas (localização + modelo da família 2.5).
Em dev (host ou container) a mesma cadeia lê o ADC do
`gcloud auth application-default login` — os compose montam esse arquivo em
`/adc` como somente leitura.

**Telemetria: a rota de ingest é autenticada** (2026-08). `POST /telemetry/ingest`
não passa pelo `OidcGuard` — quem chama é a push subscription. O
`PubSubPushGuard` verifica o ID token que o Pub/Sub assina: emissor Google,
`aud` == `TELEMETRIA_PUSH_AUDIENCE` e `email` == `TELEMETRIA_PUSH_SA`. Sem as
duas envs a rota responde 401 (fechada, não aberta). O Terraform casa os dois
lados: a subscription é criada com `oidc_token` dessa mesma SA e audience.

Deploy (CI deste repo):
1. `turbo build --filter='...[HEAD^]'`
2. schema mudou → executar o job `{contrato}-migrate` (roda ANTES do deploy do
   serviço: o schema novo tem que estar no banco antes da revisão nova pegar
   tráfego)
3. hub/api mudou → `docker build` + push direto no Artifact Registry (sem Cloud
   Build) → `gcloud run deploy` (revisions = rollback)
4. exp mudou → `gsutil -m rsync -r dist/ gs://{contrato}-exp/{expId}/{versao}/`
   e `PUT {api}/experiencias/{expId}` (admin-contrato) com o conteúdo do
   `public/experiencia.json` — é esse upsert que o hub lê para montar a URL do
   bundle. Feito por `apps/hub/scripts/publicar-manifesto.mjs`, que assina um
   token de 5 min com `token-signing-key` (vars `API_URL`, `HUB_ORIGIN`).
   Rollback = `node apps/hub/scripts/publicar-manifesto.mjs <exp> --versao <anterior>`. Experiência com
   mídia externa (exp-02) builda com `VITE_VIDEOS_BASE_URL` apontando para a
   CDN de assets do contrato.
   O `deploy.yml` faz o `rsync` **e** o `PUT` do manifesto, e grava
   `Cache-Control: max-age=60` no `index.html` (o resto do caminho carrega a
   versão e é imutável). **Pendente**: o `rsync` da mídia pesada
   (`gsutil rsync` dos mp4 para o bucket de assets) continua manual — ver
   `RUNBOOK-API.md`, passo 4.

Nomes e valores concretos saem de `terraform output`; as `vars` que o
`deploy.yml` consome estão listadas no passo 2 do `RUNBOOK-API.md`.
