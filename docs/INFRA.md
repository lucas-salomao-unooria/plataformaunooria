# Contrato com o repo de Terraform

Este repo NÃO cria recursos GCP. O repo de infra provisiona, por contrato:

| Recurso | Nome esperado | Consumido por |
|---|---|---|
| Cloud Run service | `{contrato}-hub`, `{contrato}-api`, `{contrato}-telemetry-worker` | deploy.yml |
| Artifact Registry | `{contrato}-docker` (southamerica-east1) | deploy.yml |
| Bucket experiências | `{contrato}-exp` (+ Cloud CDN) | deploy.yml |
| Cloud SQL | `{contrato}-pg` (HA, PITR, pooler ativo) | api DATABASE_URL |
| Pub/Sub | topic `{contrato}-telemetria` + sub `{contrato}-telemetria-worker` | api/worker |
| Secret Manager | `oidc-*`, `database-url`, `vertex-*` | Cloud Run env |
| Service Accounts | `{contrato}-api-sa` (Vertex, Pub/Sub pub), `{contrato}-worker-sa` | |
| WIF p/ GitHub Actions | pool `github` | deploy.yml (sem chave JSON) |

Variáveis que a app espera: ver `.env.example`. Terraform injeta via Cloud Run env/secrets.

Deploy (CI deste repo):
1. `turbo build --filter='...[HEAD^]'`
2. hub/api mudou → docker build+push → `gcloud run deploy` (revisions = rollback)
3. exp mudou → `gsutil -m rsync -r dist/ gs://{contrato}-exp/{expId}/{versao}/`
   e atualização do manifesto de versões que o hub lê.
