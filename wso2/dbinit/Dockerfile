# Aplicador de schema do WSO2 IS no PostgreSQL.
#
# Os scripts SQL vêm da PRÓPRIA imagem do produto via multi-stage: assim ficam
# travados na versão certa do IS e não precisam ser vendorizados no git (são
# milhares de linhas que mudam a cada release). O psql vem da imagem base.
FROM wso2/wso2is:7.3.0 AS dist

FROM postgres:16-alpine

# Caminho literal: ENV da stage anterior não é visível em COPY --from.
COPY --from=dist /home/wso2carbon/wso2is-7.3.0/dbscripts /dbscripts

COPY init-db.sh /usr/local/bin/init-db.sh
RUN chmod +x /usr/local/bin/init-db.sh

ENTRYPOINT ["/usr/local/bin/init-db.sh"]
