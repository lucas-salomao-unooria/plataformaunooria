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
| Cloud SQL | `{contrato}-pg` (HA, PITR, pooler ativo) | api DATABASE_URL |
| Pub/Sub | topic `{contrato}-telemetria` + **push** sub `{contrato}-telemetria-ingest` → `POST {api}/telemetry/ingest` | api |
| Secret Manager | `oidc-*`, `database-url`, `vertex-*`, `token-signing-key`, `perfil-import-token` | Cloud Run env |
| Service Accounts | `{contrato}-api-sa` (Vertex, Pub/Sub pub, GCS write no bucket de assets) | |
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
  atividade).

Deploy (CI deste repo):
1. `turbo build --filter='...[HEAD^]'`
2. schema mudou → executar o job `{contrato}-migrate`
3. hub/api mudou → docker build+push → `gcloud run deploy` (revisions = rollback)
4. exp mudou → `gsutil -m rsync -r dist/ gs://{contrato}-exp/{expId}/{versao}/`
   e `PUT {api}/experiencias/{expId}` (admin-contrato) com o conteúdo do
   `public/experiencia.json` — é esse upsert que o hub lê para montar a URL do
   bundle. Rollback = repetir o PUT com a versão anterior.
