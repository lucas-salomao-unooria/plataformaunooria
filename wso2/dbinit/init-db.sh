#!/bin/sh
# Aplica o schema do WSO2 IS 7.3.0 nos três bancos PostgreSQL.
#
# Mapeamento (conferido no índice da distribuição 7.3.0 — o banco AGENTIDENTITY
# é novo nesta versão e sua ausência quebra o boot com erro de datasource):
#
#   WSO2IS_SHARED_DB        <- dbscripts/postgresql.sql
#   WSO2IS_IDENTITY_DB      <- dbscripts/identity/postgresql.sql
#                              dbscripts/consent/postgresql.sql
#   WSO2IS_AGENTIDENTITY_DB <- dbscripts/identity/agent/postgresql.sql
set -eu

: "${PGHOST:?PGHOST não definido}"
: "${PGUSER:?PGUSER não definido}"
: "${PGPASSWORD:?PGPASSWORD não definido}"
export PGPORT="${PGPORT:-5432}"

DB_SHARED="WSO2IS_SHARED_DB"
DB_IDENTITY="WSO2IS_IDENTITY_DB"
DB_AGENT="WSO2IS_AGENTIDENTITY_DB"

echo "==> aguardando ${PGHOST}:${PGPORT}"
i=0
until pg_isready -q -h "$PGHOST" -p "$PGPORT" -U "$PGUSER"; do
  i=$((i + 1))
  [ "$i" -gt 60 ] && { echo "!! postgres não respondeu em 60s"; exit 1; }
  sleep 1
done

# Os scripts da WSO2 NÃO são idempotentes: usam CREATE TABLE sem IF NOT EXISTS,
# então uma segunda execução falha com erro confuso ("relation already exists")
# no meio de um arquivo de 2000 linhas. A sentinela abaixo torna o container
# seguro para reiniciar — que é o que `docker compose up` faz o tempo todo.
if psql -d "$DB_IDENTITY" -tAc \
     "SELECT 1 FROM information_schema.tables WHERE table_name = 'idn_oauth_consumer_apps'" \
     2>/dev/null | grep -q 1; then
  echo "==> schema já aplicado em ${DB_IDENTITY}; nada a fazer"
  exit 0
fi

aplicar() {
  banco="$1"
  arquivo="$2"
  echo "==> ${banco} <- ${arquivo}"
  psql -v ON_ERROR_STOP=1 -q -d "$banco" -f "$arquivo"
}

aplicar "$DB_SHARED"   /dbscripts/postgresql.sql
aplicar "$DB_IDENTITY" /dbscripts/identity/postgresql.sql
aplicar "$DB_IDENTITY" /dbscripts/consent/postgresql.sql
aplicar "$DB_AGENT"    /dbscripts/identity/agent/postgresql.sql

# As stored procedures de cleanup (token, sessão, código de confirmação) vivem em
# /dbscripts/identity/stored-procedures/postgresql/postgre-11x/ e NÃO são
# aplicadas aqui: o IS tem cleanup periódico embutido que dá conta do volume de
# desenvolvimento. Em produção elas passam a importar quando IDN_AUTH_SESSION_STORE
# cresce — ver docs/INFRA-IDENTITY.md.

echo "==> schema aplicado com sucesso nos 3 bancos"
