#!/usr/bin/env bash
# Preenche as `vars` e o secret que o .github/workflows/deploy.yml consome,
# lendo os valores de `terraform output` do repo de infra.
#
# Existe porque o Terraform NAO cria variavel de GitHub (e outra API, outro
# provider, outro token) — e digitar doze valores a mao erra em silencio: um
# nome de servico trocado so aparece como falha no meio do deploy.
#
# Uso:
#   INFRA_DIR=~/Documents/Unooria/"Fundacao Plataforma Unooria" \
#     ./scripts/configurar-github-ci.sh              # aplica via gh
#     ./scripts/configurar-github-ci.sh --imprimir   # so mostra (colar na UI)
#
# Requer: terraform, jq e (fora do --imprimir) gh autenticado.
set -euo pipefail

INFRA_DIR="${INFRA_DIR:-$HOME/Documents/Unooria/Fundacao Plataforma Unooria}"
IMPRIMIR=false
[ "${1:-}" = "--imprimir" ] && IMPRIMIR=true

[ -d "$INFRA_DIR" ] || { echo "erro: INFRA_DIR nao existe: $INFRA_DIR" >&2; exit 1; }
command -v jq >/dev/null || { echo "erro: instale o jq (brew install jq)" >&2; exit 1; }

if [ "$IMPRIMIR" = false ]; then
  command -v gh >/dev/null || { echo "erro: instale o gh (brew install gh)" >&2; exit 1; }
  gh auth status >/dev/null 2>&1 || {
    echo "erro: gh nao esta autenticado. Rode 'gh auth login' — ou use --imprimir" >&2
    exit 1
  }
fi

tf() { terraform -chdir="$INFRA_DIR" "$@"; }

echo ">> lendo outputs de $INFRA_DIR"
OUT="$(tf output -json)" || {
  echo "erro: 'terraform output' falhou. Rode o apply antes, e confira o workspace." >&2
  exit 1
}
val() { echo "$OUT" | jq -r --arg k "$1" '.[$k].value // empty'; }

API_SERVICE="$(val api_service_name)"
HUB_SERVICE="$(val frontend_service_name)"
MIGRATE_JOB="$(val migrate_job_name)"
EXP_BUCKET="$(val bucket_exp)"
API_URL="$(val api_public_url)"
ASSETS_BASE_URL="$(val url_assets)"
WIF_PROVIDER="$(val github_workload_identity_provider)"
DEPLOY_SA="$(val github_deployer_service_account)"
# `artifact_registry_repo` e a URL completa; o deploy quer so o nome do repo.
AR_REPO="$(val artifact_registry_repo_id)"
GCP_PROJECT="$(val gcp_project)"
REGION="$(val gcp_region)"
# O hub e o ISSUER dos tokens: HUB_ORIGIN tem que ser IDENTICO ao OIDC_ISSUER
# que a api valida — os dois saem do mesmo `hub_domain` no Terraform, entao nao
# ha como divergirem. Nao derive por manipulacao de string.
HUB_ORIGIN="$(val hub_public_url)"

faltando=""
for n in API_SERVICE HUB_SERVICE MIGRATE_JOB EXP_BUCKET API_URL ASSETS_BASE_URL \
         WIF_PROVIDER DEPLOY_SA AR_REPO GCP_PROJECT REGION HUB_ORIGIN; do
  [ -n "${!n}" ] || faltando="$faltando $n"
done
[ -z "$faltando" ] || { echo "erro: output vazio para:$faltando" >&2; exit 1; }

VARS="GCP_PROJECT=$GCP_PROJECT
REGION=$REGION
AR_REPO=$AR_REPO
API_SERVICE=$API_SERVICE
HUB_SERVICE=$HUB_SERVICE
MIGRATE_JOB=$MIGRATE_JOB
EXP_BUCKET=$EXP_BUCKET
API_URL=$API_URL
HUB_ORIGIN=$HUB_ORIGIN
ASSETS_BASE_URL=$ASSETS_BASE_URL
WIF_PROVIDER=$WIF_PROVIDER
DEPLOY_SA=$DEPLOY_SA"

if [ "$IMPRIMIR" = true ]; then
  echo
  echo "=== vars (Settings > Secrets and variables > Actions > Variables) ==="
  echo "$VARS"
  echo
  echo "=== secret ==="
  echo "TOKEN_SIGNING_KEY_PEM = (terraform -chdir=\"\$INFRA_DIR\" output -raw token_signing_key_pem)"
  exit 0
fi

echo "$VARS" | while IFS='=' read -r nome valor; do
  printf '   %-16s = %s\n' "$nome" "$valor"
  gh variable set "$nome" --body "$valor" >/dev/null
done

# A MESMA chave que o hub usa para assinar: e assim que o `publicar-manifesto`
# do CI consegue um token admin-contrato que a api valida pelo JWKS do hub.
echo "   TOKEN_SIGNING_KEY_PEM = (secret)"
tf output -raw token_signing_key_pem | gh secret set TOKEN_SIGNING_KEY_PEM

echo
echo ">> pronto. Confira com: gh variable list && gh secret list"
