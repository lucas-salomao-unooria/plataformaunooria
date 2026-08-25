# WSO2 Identity Server — ambiente local

Gerenciador central de identidade da plataforma, com **PostgreSQL dedicado** (apartado do
banco da api). É o emissor dos tokens que `apps/api` valida e que `apps/hub` obtém via OIDC.

Para a implantação em produção, ver [`docs/INFRA-IDENTITY.md`](../docs/INFRA-IDENTITY.md).

| Item | Valor |
|---|---|
| Produto | WSO2 Identity Server **7.3.0** (última GA) |
| Imagem | `wso2/wso2is:7.3.0` — multi-arch, roda nativo em Apple Silicon |
| Banco | `postgres:16-alpine` dedicado, **porta 5433** no host |
| Console (super) | https://localhost:9443/console — usuário `admin` |
| Console do tenant | https://localhost:9443/t/dev-local/console — no formulário digite só `admin` (o tenant vem da URL; `admin@dev-local` é só para basic auth nas APIs) |
| Tenancy | **1 contrato = 1 tenant** |

## Subir

Duas formas:

```bash
# 1. Junto com o Postgres da plataforma (recomendado; e2e completo):
docker compose up -d            # na RAIZ do repo — inclui este stack

# 2. Só o IdP:
cd wso2 && docker compose up -d
```

Todas as variáveis têm default de desenvolvimento; o `.env` é opcional
(`cp .env.example .env` para sobrescrever algo, ex.: portas).

O primeiro `up` leva ~3 min: build das imagens, `initdb` do Postgres, aplicação do schema
(três bancos), boot do IS (60-120 s) e bootstrap.

Acompanhe:

```bash
docker compose logs -f identity-server   # até "WSO2 Carbon started"
docker compose logs bootstrap            # imprime client_id/secret e as envs prontas
```

Ao final, `docker compose ps` deve mostrar `wso2-postgres` e `identity-server` de pé, e
`dbinit`/`bootstrap` como `exited (0)` — os dois são jobs que rodam e saem.

## O que cada peça faz

```
docker-compose.yml   wso2-postgres → dbinit → identity-server → bootstrap (em cadeia)
Dockerfile           imagem do IS + driver JDBC do PostgreSQL
conf/                copiado para dentro do server home pelo entrypoint da imagem
  repository/conf/deployment.toml    datasources, keystores, OAuth — segredos via $env{}
dbinit/              aplica o schema nos 3 bancos; scripts vêm da própria imagem do IS
bootstrap/           cria tenant, claims, scope, app OIDC e usuários de teste
certs/               (gerado) certificado público do IS, para o NODE_EXTRA_CA_CERTS
```

Três detalhes que explicam o desenho:

- **O driver JDBC vai na imagem, não no config-volume.** A imagem oficial não traz driver
  algum, e ele precisa estar no classpath *antes* do boot — o config-volume só é copiado
  depois.
- **Os scripts SQL vêm da imagem do produto**, via multi-stage em `dbinit/Dockerfile`. Ficam
  travados na versão certa do IS sem vendorizar milhares de linhas de SQL no git.
- **O Postgres do IS fica na 5433.** O `README.md` da raiz manda subir um `postgres:16` na
  5432 para a api; colidir aqui quebraria o ambiente de quem seguiu aquele README.

### Os três bancos

O IS 7.3.0 exige três (o `AGENTIDENTITY` é novo nesta versão, e sua ausência quebra o boot
com erro de datasource mesmo sem usar a feature de agentes):

| Banco | Scripts aplicados |
|---|---|
| `WSO2IS_SHARED_DB` | `dbscripts/postgresql.sql` |
| `WSO2IS_IDENTITY_DB` | `dbscripts/identity/postgresql.sql` + `dbscripts/consent/postgresql.sql` |
| `WSO2IS_AGENTIDENTITY_DB` | `dbscripts/identity/agent/postgresql.sql` |

## Ligar na api e no hub

O bootstrap imprime os valores prontos. Cole em `apps/api/.env`:

```
OIDC_ISSUER=<copie LITERAL do que o bootstrap imprimiu>
OIDC_JWKS_URI=https://localhost:9443/t/dev-local/oauth2/jwks
OIDC_AUDIENCE=plataforma-api
```

E em `apps/hub/.env.local`:

```
AUTH_WSO2_ISSUER=<o mesmo issuer literal>
AUTH_WSO2_CLIENT_ID=<gerado pelo bootstrap>
AUTH_WSO2_CLIENT_SECRET=<gerado pelo bootstrap>
AUTH_SECRET=<qualquer string longa aleatória>
```

> **Copie o `issuer` literalmente, não monte por concatenação.** O IS 7.x tem configurações
> que fazem o issuer ser ora a URL do token endpoint, ora o entity ID do IdP residente. Uma
> barra final de diferença produz 401 em tudo.

### Certificado self-signed

O IS local usa o certificado de demonstração da distribuição, e o `jose` (na api) e o
Auth.js (no hub) rejeitam TLS não confiável. O bootstrap exporta o certificado para
`wso2/certs/wso2-local.pem`; rode api e hub apontando para ele:

```bash
NODE_EXTRA_CA_CERTS=$(git rev-parse --show-toplevel)/wso2/certs/wso2-local.pem pnpm dev
```

Preferimos isso a usar o conector HTTP (9763) porque mantém paridade com produção, onde
tudo é HTTPS.

### Usuários de teste

Um por perfil, todos com a senha de `SEED_PASSWORD` e `escola_id = escola-demo` (a mesma
escola que `apps/api/prisma/seed.ts` cria):

| Usuário | `perfil` | `escola_id` |
|---|---|---|
| `aluno.teste` | `aluno` | `escola-demo` |
| `professor.teste` | `professor` | `escola-demo` |
| `gestor.teste` | `gestor` | `escola-demo` |
| `admin.contrato` | `admin-contrato` | *(vazio)* |

`admin-contrato` vai sem `escola_id` de propósito: exercita a única exceção cross-escola da
regra inviolável nº 1.

## Validar

```bash
# 1. Os três bancos existem e têm tabelas
PGPASSWORD=wso2carbon-local psql -h localhost -p 5433 -U wso2carbon -l

# 2. O discovery responde — copie o campo issuer LITERAL
curl -sk https://localhost:9443/t/dev-local/oauth2/token/.well-known/openid-configuration | jq .issuer

# 3. O JWKS tem exatamente uma chave
curl -sk https://localhost:9443/t/dev-local/oauth2/jwks | jq '.keys | length'

# 4. Idempotência: rodar de novo não duplica nada
docker compose up -d
```

O teste que realmente importa é o ponta a ponta: logar no hub com `aluno.teste`, abrir uma
experiência e confirmar que a chamada à api volta **200 com o `escola_id` certo**. É o que
prova que os atributos estão no *access token*, e não só no ID token.

## Problemas comuns

**O hub loga perfeitamente, mas toda chamada à api dá 401.**
A armadilha nº 1 desta integração. O hub lê o *ID token*; a api lê o *access token*. Por
padrão o WSO2 põe os atributos só no ID token e no userinfo, então `escola_id` chega vazio
na api. O bootstrap já habilita atributos no access token — se você criou a aplicação à mão
no console, verifique essa opção. Confirme decodificando o access token em jwt.io: ele
precisa ter `escola_id` e `perfil`.

**401 sem explicação.**
A api agora loga o motivo real (`ERR_JWT_CLAIM_VALIDATION_FAILED`, `claim=iss`, ...) em vez
de engolir o erro. Olhe o log da api antes de investigar o WSO2.

**Todo mundo toma 401 e o log diz `claim perfil inválido`.**
`perfil` chegou como array (`["aluno"]`). Ele precisa ser um atributo de usuário
single-valued, não uma role.

**`relation already exists` no dbinit.**
Os scripts da WSO2 não são idempotentes. O `init-db.sh` tem uma sentinela que evita isso; se
o banco ficou num estado parcial, recomece do zero (ver abaixo).

**O IS não sobe e o log fala de datasource.**
Provavelmente falta o `WSO2IS_AGENTIDENTITY_DB` — banco novo na 7.3.0. Confirme com o
`psql -l` do passo 1.

**Porta 5433 ocupada.** Mude `DB_HOST_PORT` no `.env`.

## Recomeçar do zero

```bash
docker compose down -v   # -v apaga o volume do Postgres
docker compose up -d --build
```

## GCP

A pasta [gcp/](gcp/) tem a variante da imagem para o Cloud Run: mesmo base +
driver JDBC, mas com o `deployment.toml` **embutido** (imagem imutável) e
configuração de reverse proxy (`proxyPort=443`, TLS termina fora do container).
Quem builda/pusha e provisiona a infra é o repo de Terraform
**Identidade Plataforma Unooria** (irmão do de fundação) — o passo a passo está
no README de lá. O desenho completo: [docs/INFRA-IDENTITY.md](../docs/INFRA-IDENTITY.md).

## Produção

⚠️ **Este ambiente usa o keystore de demonstração da distribuição** (`wso2carbon.p12`, senha
`wso2carbon`). Essa chave privada acompanha toda cópia do produto baixada no mundo. Em
localhost é irrelevante; em qualquer ambiente alcançável pela internet significa que
qualquer pessoa pode forjar um token `admin-contrato` e ler dados de menores de todas as
escolas. O procedimento de geração e injeção do keystore próprio está em
[`docs/INFRA-IDENTITY.md`](../docs/INFRA-IDENTITY.md), seção "Keystore primário".
