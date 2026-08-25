# Contrato com o repo de Terraform

Este repo NÃO cria recursos GCP. O repo de infra provisiona, por contrato:

> O **gerenciador central de identidade** (WSO2 Identity Server) foge deste padrão: é
> único para vários contratos, então não é `{contrato}-*` e vive em projeto próprio.
> Contrato separado em [`INFRA-IDENTITY.md`](INFRA-IDENTITY.md).

| Recurso | Nome esperado | Consumido por |
|---|---|---|
| Cloud Run service | `{contrato}-hub`, `{contrato}-api` | deploy.yml |
| Cloud Run **job** | `{contrato}-migrate` (VPC, roda `prisma migrate deploy`) | deploy.yml |
| Artifact Registry | `{contrato}-docker` (southamerica-east1) | deploy.yml |
| Bucket experiências | `{contrato}-exp` (+ Cloud CDN) | deploy.yml |
| Bucket **assets** | `{contrato}-assets` (+ Cloud CDN, leitura pública) | api (`ASSETS_BUCKET`) |
| Bucket **planos** | `{contrato}-planos` (**privado**, sem CDN, versionamento de objetos ligado) | api (`PLANOS_BUCKET`) |
| Cloud SQL | `{contrato}-pg` (HA, PITR, pooler ativo) | api DATABASE_URL |
| Pub/Sub | topic `{contrato}-telemetria` + **push** sub `{contrato}-telemetria-ingest` → `POST {api}/telemetry/ingest` | api |
| Secret Manager | `oidc-*`, `database-url`, `vertex-*`, `token-signing-key`, `perfil-import-token`, `planos-import-token` | Cloud Run env |
| Service Accounts | `{contrato}-api-sa` (Vertex, Pub/Sub pub, GCS write no bucket de assets, `objectAdmin` no bucket de planos) | |
| WIF p/ GitHub Actions | pool `github` | deploy.yml (sem chave JSON) |

Variáveis que a app espera: ver `.env.example`. Terraform injeta via Cloud Run env/secrets.

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
- **Roles do Postgres**: a api conecta com role SEM ownership (`app_runtime`),
  porque as tabelas têm `FORCE ROW LEVEL SECURITY` — o owner ignoraria as
  políticas. As migrations rodam com a role owner.
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

Deploy (CI deste repo):
1. `turbo build --filter='...[HEAD^]'`
2. schema mudou → executar o job `{contrato}-migrate`
3. hub/api mudou → docker build+push → `gcloud run deploy` (revisions = rollback)
4. exp mudou → `gsutil -m rsync -r dist/ gs://{contrato}-exp/{expId}/{versao}/`
   e `PUT {api}/experiencias/{expId}` (admin-contrato) com o conteúdo do
   `public/experiencia.json` — é esse upsert que o hub lê para montar a URL do
   bundle. Feito por `apps/hub/scripts/publicar-manifesto.mjs`, que assina um
   token de 5 min com `token-signing-key` (vars `API_URL`, `HUB_ORIGIN`).
   Rollback = `node apps/hub/scripts/publicar-manifesto.mjs <exp> --versao <anterior>`. Experiência com
   mídia externa (exp-02) builda com `VITE_VIDEOS_BASE_URL` apontando para a
   CDN de assets do contrato.
   **Pendente**: o `deploy.yml` ainda só faz o `rsync` — o `PUT` do manifesto
   (traduzindo `versao` → `versaoAtiva`) não foi automatizado; sem ele o hub
   cai no fallback dev.
