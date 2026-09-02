#!/usr/bin/env bash
# Preenche as `vars` e o secret que o .github/workflows/deploy.yml consome,
# lendo os valores de `terraform output` do repo de infra e gravando no
# ENVIRONMENT do GitHub correspondente ao workspace selecionado (dev|hml|prd).
#
# Existe porque o Terraform NAO cria variavel de GitHub (e outra API, outro
# provider, outro token) — e digitar doze valores a mao erra em silencio: um
# nome de servico trocado so aparece como falha no meio do deploy.
#
# O ambiente NAO e argumento de proposito: ele sai de `terraform workspace show`
# do INFRA_DIR, a mesma fonte dos valores. Um argumento separado poderia
# apontar para o environment de um ambiente com os outputs de outro — e esse
# erro so apareceria como deploy de hml escrevendo no bucket de dev.
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

AMB="$(tf workspace show)"
case "$AMB" in
  # branch = environment em dev/hml; producao e a excecao (branch main,
  # environment prd — o deploy.yml faz o mesmo mapeamento).
  dev|hml) BRANCH="$AMB" ;;
  prd)     BRANCH="main" ;;
  *) echo "erro: workspace '$AMB' nao e um ambiente (dev|hml|prd). Rode: terraform -chdir=\"\$INFRA_DIR\" workspace select <amb>" >&2; exit 1 ;;
esac

echo ">> lendo outputs de $INFRA_DIR (workspace: $AMB -> environment: $AMB, branch: $BRANCH)"
OUT="$(tf output -json)" || {
  echo "erro: 'terraform output' falhou. Rode o apply antes, e confira o workspace." >&2
  exit 1
}
val() { echo "$OUT" | jq -r --arg k "$1" '.[$k].value // empty'; }

API_SERVICE="$(val api_service_name)"
HUB_SERVICE="$(val frontend_service_name)"
MIGRATE_JOB="$(val migrate_job_name)"
EXP_BUCKET="$(val bucket_exp)"
# Bucket da MIDIA pesada das experiencias (os mp4 da exp-02). O CI nao a
# publica — o runner nao tem os arquivos —, mas confere que ela esta la
# antes de publicar o bundle que depende dela (ver `midia-externa.json`).
ASSETS_BUCKET="$(val bucket_assets)"
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
         ASSETS_BUCKET WIF_PROVIDER DEPLOY_SA AR_REPO GCP_PROJECT REGION HUB_ORIGIN; do
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
ASSETS_BUCKET=$ASSETS_BUCKET
WIF_PROVIDER=$WIF_PROVIDER
DEPLOY_SA=$DEPLOY_SA"

if [ "$IMPRIMIR" = true ]; then
  echo
  echo "=== vars do ENVIRONMENT '$AMB' (Settings > Environments > $AMB > Variables) ==="
  echo "$VARS"
  echo
  echo "=== secret do ENVIRONMENT '$AMB' ==="
  echo "TOKEN_SIGNING_KEY_PEM = (terraform -chdir=\"\$INFRA_DIR\" output -raw token_signing_key_pem)"
  echo
  echo "=== deployment branch policy ==="
  echo "environment '$AMB' deve aceitar deploy SO da branch '$BRANCH' (selected branches)"
  exit 0
fi

REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"

# Cria (ou atualiza) o environment com deployment branch policy restrita:
# o environment de hml so aceita job vindo da branch hml. Sem isso, um
# workflow_dispatch de qualquer branch poderia assumir a identidade WIF do
# ambiente errado.
echo ">> environment '$AMB' em $REPO (deploy so da branch '$BRANCH')"
gh api -X PUT "repos/$REPO/environments/$AMB" --input - >/dev/null <<'JSON'
{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}
JSON
# Idempotente na pratica: se a policy ja existe, a API recusa a duplicata — e
# recusar o que ja esta la nao e falha.
gh api -X POST "repos/$REPO/environments/$AMB/deployment-branch-policies" \
  -f name="$BRANCH" >/dev/null 2>&1 || true

echo "$VARS" | while IFS='=' read -r nome valor; do
  printf '   %-16s = %s\n' "$nome" "$valor"
  gh variable set "$nome" --env "$AMB" --body "$valor" >/dev/null
done

# A MESMA chave que o hub usa para assinar: e assim que o `publicar-manifesto`
# do CI consegue um token admin-contrato que a api valida pelo JWKS do hub.
# Escopada no environment: a chave de dev nunca assina um manifesto de hml.
echo "   TOKEN_SIGNING_KEY_PEM = (secret)"
tf output -raw token_signing_key_pem | gh secret set TOKEN_SIGNING_KEY_PEM --env "$AMB"

echo
echo ">> pronto. Confira com: gh variable list --env $AMB && gh secret list --env $AMB"
