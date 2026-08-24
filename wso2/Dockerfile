# WSO2 Identity Server 7.3.0 + driver JDBC do PostgreSQL.
#
# A imagem oficial não traz driver JDBC nenhum (nem em components/lib, nem em
# components/dropins) — só o H2 embutido. O driver precisa estar no classpath
# ANTES do boot, por isso vai na imagem e não no config-volume (que o entrypoint
# só copia depois).
#
# A imagem é multi-arch (amd64 + arm64): roda nativo em Apple Silicon.
FROM wso2/wso2is:7.3.0

# Última versão estável do driver. Mantenha alinhada com a major do Postgres
# em uso (42.7.x cobre Postgres 12–17).
ARG PG_JDBC_VERSION=42.7.7

# WSO2_SERVER_HOME já vem como ENV da imagem base (/home/wso2carbon/wso2is-7.3.0).
ADD --chown=wso2carbon:wso2 \
    https://repo1.maven.org/maven2/org/postgresql/postgresql/${PG_JDBC_VERSION}/postgresql-${PG_JDBC_VERSION}.jar \
    ${WSO2_SERVER_HOME}/repository/components/lib/
