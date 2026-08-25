# Imagem do WSO2 IS para o Cloud Run (GCP).
#
# Build a partir DA PASTA wso2/ (o contexto precisa enxergar gcp/):
#
#   cd wso2
#   docker build -f gcp/Dockerfile -t <registry>/wso2is:7.3.0-r1 --platform linux/amd64 .
#
# Diferenças da imagem local (wso2/Dockerfile):
#   - o deployment.toml vai EMBUTIDO (imagem imutável; sem config-volume de
#     config — o volume só recebe o keystore, montado do Secret Manager);
#   - sem segredo nenhum aqui: tudo entra por env em runtime.
#
# O registry e as envs vêm do Terraform (repo "Identidade Plataforma Unooria").
FROM wso2/wso2is:7.3.0

ARG PG_JDBC_VERSION=42.7.7

ADD --chown=wso2carbon:wso2 \
    https://repo1.maven.org/maven2/org/postgresql/postgresql/${PG_JDBC_VERSION}/postgresql-${PG_JDBC_VERSION}.jar \
    ${WSO2_SERVER_HOME}/repository/components/lib/

COPY --chown=wso2carbon:wso2 gcp/deployment.toml ${WSO2_SERVER_HOME}/repository/conf/deployment.toml
