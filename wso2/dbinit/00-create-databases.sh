#!/bin/sh
# Roda uma única vez, no initdb do container postgres (volume vazio).
# Cria o role da aplicação e os três bancos que o IS 7.3.0 exige.
#
# O IS nunca se conecta como superuser: um SQL injection num endpoint do produto
# não deve virar comprometimento da instância inteira.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<-EOSQL
    CREATE ROLE "${WSO2_DB_USER}" WITH LOGIN PASSWORD '${WSO2_DB_PASSWORD}';

    CREATE DATABASE "WSO2IS_SHARED_DB"        OWNER "${WSO2_DB_USER}";
    CREATE DATABASE "WSO2IS_IDENTITY_DB"      OWNER "${WSO2_DB_USER}";
    CREATE DATABASE "WSO2IS_AGENTIDENTITY_DB" OWNER "${WSO2_DB_USER}";
EOSQL

echo "==> role ${WSO2_DB_USER} e os 3 bancos do WSO2 IS criados"
