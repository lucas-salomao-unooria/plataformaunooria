# Contrato de infra — gerenciador central de identidade (WSO2 IS 7.3.0)

Este documento é irmão do [`INFRA.md`](INFRA.md) e segue a mesma regra: **este repo
não cria recursos GCP**. O que está aqui é o contrato para o repo de Terraform.

A diferença em relação ao `INFRA.md` é o escopo. Lá, tudo é `{contrato}-*`: uma stack
por contrato. Aqui não — o `CLAUDE.md` declara o WSO2 como *"externo, único p/ vários
contratos"*. Ele não pertence à stack de nenhum cliente e vive em **projeto próprio**.

> **Por que projeto próprio, e não dentro da stack de um contrato:** se o IdP morar no
> projeto do contrato A, todos os outros contratos passam a depender do ciclo de vida
> daquele projeto. Encerrar o contrato A — algo perfeitamente normal em B2G — apagaria
> o login de todo mundo.

Ambiente de desenvolvimento equivalente: [`wso2/`](../wso2/README.md).
Implementação Terraform: repo **Identidade Plataforma Unooria** (irmão do repo de
fundação) — hoje provisiona o ambiente de teste (Cloud Run scale-to-0, banco
ZONAL); o README de lá lista o delta até este documento (§ "O que falta para
produção").

---

## 1. Versão e imagem

| Item | Valor |
|---|---|
| Produto | WSO2 Identity Server **7.3.0** (última GA; imagem publicada em junho/2026) |
| Imagem base | `wso2/wso2is:7.3.0` — Ubuntu 24.04 + Temurin JDK 21, multi-arch amd64/arm64 |
| Imagem derivada | `unooria/wso2is:7.3.0-r<N>` = base + driver JDBC PostgreSQL (`42.7.x`) + `deployment.toml` |
| Portas | 9763 (HTTP), 9443 (HTTPS) |
| Usuário no container | `wso2carbon`, uid 802 |
| Server home | `/home/wso2carbon/wso2is-7.3.0` |

⚠️ **A imagem do Docker Hub é GA sem WSO2 Updates.** Um CVE no produto não tem caminho
de correção sem a subscrição paga (`registry.wso2.com/wso2-is/is:7.3.0.0`). Em contrato
de governo, uma cláusula de edital ou auditoria de segurança pode exigir patching em SLA.
**Isso é decisão de negócio, não técnica, e precisa ser tomada antes do go-live** — ver
§9. Plano B sem subscrição: acompanhar os security advisories da WSO2 e estar pronto
para pular para a próxima GA, o que exige o ambiente de staging da §3.

O `deployment.toml` vai **na imagem**, não num volume de config, e todo segredo entra por
`$env{VAR}`. Isso dispensa o cipher-tool/secure vault do WSO2 (que exigiria um passo
interativo em build-time, incompatível com imagem imutável) e mantém a imagem livre de
segredos, podendo ser pinada por digest.

---

## 2. Runtime: Cloud Run

**Recomendação: Cloud Run com `min-instances = max-instances = 1`.**

O comparativo, honestamente:

| Opção | Custo/mês | Por que não foi escolhida |
|---|---|---|
| **Cloud Run** | **~$440 total** | — (escolhida) |
| Compute Engine MIG | ~$355 | ~$85/mês mais barato, mas o deploy deixa de ser `gcloud run deploy` e vira troca de instance template. O `deploy.yml` e o WIF deste repo não têm caminho limpo para isso, e o Terraform mora em outro repo. |
| GKE Autopilot | ~$560-620 | É o **único caminho oficialmente suportado** pela WSO2 para escala horizontal (Helm charts, `membership_scheme = "kubernetes"`). Mas `CLAUDE.md` e `ARQUITETURA.md` descartam GKE explicitamente, e operar um cluster com um dev até novembro/2026 é um segundo produto. |

A economia do GCE equivale a ~2 horas do seu tempo por mês — não paga manter um caminho
de deploy paralelo e patching de SO.

### `max-instances = 1` é decisão de design, não limitação

O IS 7.x invalida cache entre nós via Hazelcast, cujos `membership_scheme` suportados são
`wka`, `kubernetes`, `aws` e `azure`. **Não existe scheme para Cloud Run** — não há IP
estável nem descoberta. Uma instância elimina de uma vez toda a classe de problemas de
coerência de cache, clustering e sticky session.

E a carga comporta com folga. Três contratos × 4.000 alunos logando nos cinco minutos mais
agudos ≈ 40 logins/s. Cada authorization-code flow são ~4 requests (authorize, POST do
login, callback, token exchange) ≈ 160 req/s, a ~150 ms cada ≈ **24 requests concorrentes**.
Depois do login o aluno não toca mais no WSO2 por uma hora. **A carga do IdP é minúscula
comparada à da api** — ele só vê o instante do login.

Também não custa disponibilidade no deploy: `max-instances` é *por revisão*, então durante
um rollout convivem a instância antiga e a nova, e o tráfego só migra depois que o startup
probe passa.

### Configuração do serviço

```
--cpu=2 --memory=4Gi           # piloto; 4 vCPU / 8 GiB a partir do 2º contrato
--min-instances=1 --max-instances=1
--no-cpu-throttling            # obrigatório: sem isso o eviction do pool JDBC não
                               # roda entre requests e a primeira request depois de
                               # ociosidade falha com conexão morta
--cpu-boost                    # acelera o boot, grátis
--concurrency=800
--execution-environment=gen2
--port=9763
--ingress=internal-and-cloud-load-balancing
--vpc-egress=private-ranges-only
--set-env-vars=SERVER_HOSTNAME=idp.unooria.com.br,PROXY_PORT=443,...
```

`--concurrency=800` e não 80: com uma instância, concurrency é o teto de requests em voo —
a 81ª entraria em fila e tomaria 429. Deixe alto e controle a concorrência real no
`maxThreads` do Tomcat, que é quem sabe se defender.

| Probe | Configuração | Por quê |
|---|---|---|
| Startup | `GET /api/health-check/v1.0/health`, `initialDelay=30`, `period=10`, `failureThreshold=20` (=230 s, dentro do teto de 240 s) | **Nunca use probe TCP.** O Tomcat faz bind da porta *antes* de terminar o deploy dos webapps; um probe TCP passa cedo demais e o Cloud Run manda tráfego para um servidor meio inicializado. Sintoma: 500 aleatórios nos primeiros 30 s de cada deploy. |
| Liveness | mesmo path, `period=30`, `failureThreshold=6` (3 min) | Deliberadamente frouxo: um GC pause de 20 s não pode reiniciar o IS, porque reinício custa ~2 min sem novos logins. |

JVM: `JVM_MEM_OPTS="-Xms1024m -Xmx2560m"` dentro de 4 GiB, deixando ~1,4 GiB para
metaspace, code cache, buffers diretos, Tomcat e o filesystem em memória. Cada tenant
carregado consome memória; a partir de ~8-10 contratos, vá para 8 GiB e `-Xmx5g`. Um OOM
kill no Cloud Run aparece só como "reiniciou sozinho", sem mensagem clara — daí o alerta
de memória em 85% na §8.

### O único risco técnico real, e o plano B

O Cloud Run não fala TLS com o container, então o IS precisa rodar no **conector HTTP
9763** com `proxyPort = 443` e `X-Forwarded-Proto`, para que o discovery document anuncie
`https://` e não entre em loop de redirect. **Dê a isso no máximo 3 dias de spike.**

Se falhar, o fallback **não é GKE — é uma VM COS `e2-standard-2` atrás do mesmo Load
Balancer**. E aqui está o que protege o cronograma: **~90% dos recursos das seções 4 a 8
(VPC, Cloud SQL, secrets, LB, DNS, certificado, Cloud Armor, alertas) são idênticos nos
três runtimes.** Provisione tudo isso primeiro e escolha o runtime por último.

---

## 3. Projetos e fundação

| Recurso | Nome | Observação |
|---|---|---|
| Project | `unooria-identity-prod` | labels `componente=identity`, `ambiente=prod` |
| Project | `unooria-identity-stg` | **não é opcional** — ver abaixo |
| Billing budgets | `identity-prod-budget`, `identity-stg-budget` | $600 / $150, alertas em 50/90/100% |
| APIs | `run`, `sqladmin`, `secretmanager`, `artifactregistry`, `compute`, `servicenetworking`, `certificatemanager`, `dns`, `monitoring`, `logging`, `iamcredentials`, `sts`, `cloudscheduler` | `servicenetworking` é pré-requisito **bloqueante** do Private Service Access. **Não** habilite `vpcaccess` — não usaremos Serverless VPC Connector. |

**Por que staging não é opcional:** upgrade de IS exige rodar scripts de migração contra
os três bancos. Sem um ambiente idêntico para ensaiar, o upgrade nunca acontece e você
fica preso na 7.3.0 com o risco de CVE da §1 acumulando.

Região: **southamerica-east1**, a mesma do resto da plataforma.

---

## 4. Rede e conectividade com o Cloud SQL

**Decisão: Direct VPC egress + Cloud SQL Private IP.**

Descartadas, com motivo:

- ❌ **Cloud SQL connector / socket factory.** O driver JDBC só fala socket unix com
  `com.google.cloud.sql.postgres.SocketFactory`, que arrasta ~15 JARs (guava, gRPC,
  protobuf, google-auth-library) para `repository/components/lib`. Conflito de versão
  com as libs internas do WSO2 é quase certo.
- ❌ **Serverless VPC Access Connector.** Legado, custa ~$50/mês em instâncias sempre
  ligadas e é mais um componente para operar.
- ✅ **Direct VPC egress.** JDBC puro (`jdbc:postgresql://10.61.x.x:5432/...`), **um único
  JAR**, sem sidecar, sem custo de connector.

| Recurso | Nome | Dimensionamento | Justificativa |
|---|---|---|---|
| VPC | `identity-vpc` | custom mode | Auto mode cria subnets em todas as regiões e queima ranges do plano de endereçamento. |
| Subnet | `identity-run-sn` | `10.60.0.0/24` | Dedicada ao Direct VPC egress. O Cloud Run consome IPs desta subnet por instância; o Google recomenda ≥4× o `max-instances`. Um /24 não custa nada e evita `no available IPs` num deploy futuro. |
| Allocated IP range (PSA) | `identity-psa-range` | `10.61.0.0/20` | Reservado para serviços gerenciados. /20 e não /24 porque um dia haverá réplica, staging, outra instância. Errar isto é caro de desfazer. |
| Service Networking peering | `servicenetworking-googleapis-com` | — | **Pré-requisito bloqueante do Private IP.** Tem que existir antes da instância. |
| Firewall | `identity-allow-egress-sql` | egress → `10.61.0.0/20` tcp:5432 | Explicita a única rota interna. **Não** crie um `deny all egress`: quebra silenciosamente o acesso às APIs do Google. |
| Cloud NAT | `identity-nat` | **não provisionar agora** | Desnecessário com `--vpc-egress=private-ranges-only`. Vira necessário se integração Gov.br/SEDUC exigir IP de origem fixo em allowlist, ou para SMTP relay — **provável em B2G brasileiro**. Deixe o desenho pronto. |

Plano de endereçamento global a congelar: **identity = `10.60`–`10.63`**, contratos =
`10.0`–`10.59`. Colisão num peering futuro é dolorosa de corrigir.

---

## 5. Cloud SQL

| Recurso | Nome | Dimensionamento |
|---|---|---|
| Instância | `identity-pg` | `POSTGRES_17` (17.4 está na matriz de suporte da WSO2; fallback `POSTGRES_16`/16.6). Edition **Enterprise** (não Plus). Tier **`db-custom-2-4096`**. SSD 20 GB com auto-increase. **Availability: REGIONAL (HA)**. |
| Bancos | `WSO2IS_SHARED_DB`, `WSO2IS_IDENTITY_DB`, `WSO2IS_AGENTIDENTITY_DB` | Três bancos, **uma instância** — isolar em três instâncias triplicaria o custo sem reduzir o blast radius. |
| User | `wso2is` | Owner dos três bancos. **Nunca `postgres` superuser**: um SQL injection num endpoint do produto não pode virar comprometimento da instância. |
| Read replica | — | **Não.** O WSO2 não faz read/write split; seria custo puro. |

**HA desde o dia 1.** Este é o único lugar da plataforma inteira onde alta disponibilidade
não é otimização prematura, porque o blast radius é *todos os contratos*. Custa ~$115/mês
a mais. Pague.

| Configuração | Valor | Por quê |
|---|---|---|
| Backups | diário 04:00 BRT, retenção **14 dias**, **PITR ligado** (log 7 dias) | 14 e não 7: auditoria B2G/LGPD gosta de duas semanas. PITR cobre "rodei o script errado". |
| Manutenção | janela domingo 05:00 BRT; **deny period 1/fev – 15/mar** | Manutenção às 8h derruba o login de todos os contratos ao mesmo tempo. Volta às aulas é quando você não pode ter surpresa. |
| Rede | `ipv4_enabled = false`, `ssl_mode = ENCRYPTED_ONLY`, JDBC com `?sslmode=require` | Sem IP público a superfície some. **Não** use `TRUSTED_CLIENT_CERTIFICATE_REQUIRED`: obrigaria gerenciar certificados de cliente no truststore do WSO2, sem ganho dentro de uma VPC privada. |
| Flags | `log_min_duration_statement=1000`, `deletion_protection=true` | Query lenta no IS é o primeiro sintoma de falta de cleanup de sessão. |

### Schema

O IS 7.3.0 exige três bancos. O mapeamento (conferido no índice da distribuição — o
`AGENTIDENTITY` é **novo nesta versão** e sua ausência quebra o boot com erro de datasource):

| Banco | Scripts |
|---|---|
| `WSO2IS_SHARED_DB` | `dbscripts/postgresql.sql` |
| `WSO2IS_IDENTITY_DB` | `dbscripts/identity/postgresql.sql` + `dbscripts/consent/postgresql.sql` |
| `WSO2IS_AGENTIDENTITY_DB` | `dbscripts/identity/agent/postgresql.sql` |

Aplicados por um **Cloud Run Job** (`identity-db-init`) rodando a imagem `identity-dbinit`,
que é a mesma do ambiente local: multi-stage `FROM wso2/wso2is:7.3.0` copiando `dbscripts/`
para uma base `postgres:17-alpine`. Os scripts vêm travados na versão certa do produto, sem
vendorizar SQL no git.

⚠️ **Os scripts da WSO2 não são idempotentes** (`CREATE TABLE` sem `IF NOT EXISTS`). O job
precisa da sentinela que já existe em [`wso2/dbinit/init-db.sh`](../wso2/dbinit/init-db.sh).

As stored procedures de cleanup (`dbscripts/identity/stored-procedures/postgresql/postgre-11x/`)
são **fase 2** — ver §8.

---

## 6. Imagens e segredos

### Artifact Registry

| Recurso | Nome | Observação |
|---|---|---|
| Repo Docker | `identity-docker` | Não reusa `{contrato}-docker`: a imagem é compartilhada entre contratos, logo não pertence ao registry de nenhum. |
| Repo **remote** | `dockerhub-remote` | Proxy de `docker.io`. Rate limit ou outage do Docker Hub não pode travar o deploy, e garante uma cópia permanente de `wso2/wso2is:7.3.0`. |
| Cleanup policy | — | Manter últimas 10 versões + tudo taggeado; deletar untagged > 30 dias. A imagem tem ~1,5 GB. |
| Artifact Analysis | on-push scanning | Auditoria B2G vai pedir. E como a imagem GA não recebe patches (§1), é o único radar de CVE que você tem. |

### Secret Manager

Replicação **user-managed em southamerica-east1** em todos — replicação automática espalha
cópias globalmente, atrito desnecessário com residência de dados em contrato de governo.

| Secret | Tipo | Consumido como |
|---|---|---|
| `wso2-db-password` | string | env `DB_PASSWORD` |
| `wso2-admin-password` | string | env `ADMIN_PASSWORD` |
| `wso2-keystore-password` | string | env `KEYSTORE_PASSWORD` |
| `wso2-truststore-password` | string | env `TRUSTSTORE_PASSWORD` |
| **`wso2-internal-crypto-key`** | string (base64, 256 bits) | env → `[encryption] key` |
| **`wso2-primary-keystore-p12`** | **binário** (~3 KB) | volume mount — ver §7 |
| `wso2-truststore-p12` | binário | volume mount |
| `wso2-smtp-password` | string | fase 2 (recuperação de senha de professor/gestor) |

⚠️ **`wso2-internal-crypto-key` é o segredo mais crítico da lista e o menos óbvio.** É a
chave simétrica que cifra client secrets, seeds de TOTP e senhas de userstore secundário
dentro do banco. **Se você perder ou trocar depois de gravar dados, todo o dado cifrado do
IS vira lixo** — não há restore, só reonboarding manual de todos os contratos. Escrow
off-GCP obrigatório (§10).

**No projeto de cada contrato** (já previstos na linha `oidc-*` do `INFRA.md`):
`oidc-client-id` e `oidc-client-secret`. Costura operacional a não esquecer: o segredo é
*gerado* no projeto identity (ao registrar a aplicação no WSO2) e *consumido* no projeto do
contrato. Não há automação — é um passo manual por contrato.

### Service Accounts e IAM

| SA | Roles |
|---|---|
| `identity-run-sa` | `roles/secretmanager.secretAccessor` **por secret, nunca no projeto**; `roles/logging.logWriter`; `roles/monitoring.metricWriter` |
| `identity-deploy-sa` | `roles/run.developer` (não `run.admin`); `roles/iam.serviceAccountUser` **em `identity-run-sa`**; `roles/artifactregistry.writer` **no repo** |
| `identity-dbinit-sa` | `secretAccessor` só em `wso2-db-password` |
| `identity-cleanup-sa` | idem (fase 2) |

Note o que **não** está em `identity-run-sa`: `roles/cloudsql.client`. Com Private IP +
Direct VPC egress a conexão é rede pura; aquele role só serve para o Auth Proxy/connector,
que não usamos.

`roles/iam.serviceAccountUser` é obrigatório para deployar um serviço que roda como outra
SA — é o role que todo mundo esquece e que produz um `PERMISSION_DENIED` críptico.

**WIF (pool `github`, provider `github-oidc`): a condição de atributo é obrigatória.**
Sem `assertion.repository == "unooria/plataforma-unooria"` (e idealmente
`assertion.ref == "refs/heads/main"` para prod), **qualquer repositório do GitHub no mundo**
consegue impersonar a `identity-deploy-sa`. É o erro de WIF mais comum e mais grave.

Acesso humano: grupo `identity-admins@unooria.com` com roles nominais e **MFA obrigatório**.
Nunca Owner pessoal — um comprometimento aqui compromete todos os contratos.

---

## 7. Keystore primário — o ponto crítico de segurança

### O ataque, concretamente

A distribuição traz `repository/resources/security/wso2carbon.p12`, alias `wso2carbon`,
senha `wso2carbon`, `CN=localhost`. **A chave privada está dentro de cada cópia do produto
baixada no mundo inteiro.** Se o serviço subir com ela:

1. O IS publica a chave pública demo em `https://idp.unooria.com.br/oauth2/jwks`.
2. [`token.service.ts`](../apps/api/src/auth/token.service.ts) busca esse JWKS e passa a confiar nela.
3. Qualquer pessoa baixa o WSO2 IS 7.3.0, extrai a chave privada e forja:

   ```json
   { "sub": "qualquer", "escola_id": "", "perfil": "admin-contrato",
     "aud": "plataforma-api", "iss": "<seu issuer>" }
   ```

4. `perfil: "admin-contrato"` é **a única exceção cross-escola da regra inviolável nº 1**,
   e o `escolaAlvo()` de `usuarios.controller.ts` deixa esse perfil escolher qualquer
   `?escolaId=`. Resultado: **leitura e escrita de dados de menores de todas as escolas de
   todos os contratos, com um comando.**

Não é teórico — é um exploit de uma linha.

### Geração

Numa máquina sua ou no Cloud Shell. **Nunca em CI, nunca commitado.**

```bash
keytool -genkeypair \
  -alias unooria-signing \
  -keyalg RSA -keysize 3072 -sigalg SHA256withRSA \
  -validity 3650 -storetype PKCS12 \
  -keystore unooria-primary.p12 \
  -dname "CN=idp.unooria.com.br, O=Unooria, C=BR"
```

3072 bits dá margem para uma década de contrato de governo. **Use a mesma senha para store
e key** — o WSO2 tem histórico de comportamento inconsistente quando divergem, e o ganho de
segurança é nulo. Senha de 32+ caracteres aleatórios.

Recrie também o `client-truststore.p12` (senha `wso2carbon`, pública): não tem chave privada,
mas um atacante com acesso ao container poderia injetar uma CA.

### Injeção

**Descartado: embutir na imagem.** A chave privada ficaria no Artifact Registry e no cache
de Docker de toda máquina que buildar, e rotação viraria rebuild.

**Escolhido: Secret Manager (payload binário) → volume mount do Cloud Run → config-volume.**
O P12 tem ~3 KB; o limite do Secret Manager é 64 KiB.

O detalhe que importa: **não monte direto em `repository/resources/security/`**. Um secret
volume do Cloud Run **esconde tudo que já existe no diretório**, e aquele diretório tem
outros artefatos que o IS precisa. Use o mecanismo da própria imagem — o entrypoint copia
`/home/wso2carbon/wso2-config-volume/*` para o server home (com `cp -RL`, recursivo) antes
de subir:

```
--set-secrets=/home/wso2carbon/wso2-config-volume/repository/resources/security/unooria-primary.p12=wso2-primary-keystore-p12:latest
--set-secrets=/home/wso2carbon/wso2-config-volume/repository/resources/security/client-truststore.p12=wso2-truststore-p12:latest
```

O config-volume está vazio na imagem, então nada é escondido, e o entrypoint sobrepõe os
arquivos preservando o resto do diretório real.

**Verificar no primeiro deploy** — pontos de falha silenciosa: o container roda como uid
802 e secret volumes montam como root, então confirme que o modo permite leitura por outros
(o default é 0444, mas confirme, não presuma).

### Verificação obrigatória, antes da primeira exposição pública

1. `curl https://idp.unooria.com.br/oauth2/jwks` — o `kid` retornado deve ser o thumbprint
   do **seu** certificado, e o `kid` demo do WSO2 **não pode aparecer**.
2. Emitir um token real e conferir o `kid` do header.
3. Confirmar que existe **uma só** chave no JWKS.

Faça isso **antes** de o serviço ficar publicamente acessível pela primeira vez. Um JWKS
demo exposto, mesmo por 10 minutos, pode acabar em cache de cliente.

### Rotação

`jose.createRemoteJWKSet` refaz fetch ao ver um `kid` desconhecido, então rotação é segura
**se a chave pública antiga continuar no JWKS durante a janela de sobreposição** (≥ TTL do
token = 1 h). Procedimento: adicionar a nova entrada → apontar `[keystore.primary] alias`
para ela → esperar 1 h → remover a antiga.

**A validar empiricamente no staging:** confirme que o IS 7.3 publica *todas* as entradas
do keystore no JWKS, e não só a ativa. Se publicar só a ativa, rotação implica ~1 h de
tokens rejeitados e precisa ser feita fora do horário de aula.

### HSM / Cloud KMS

**Rejeitado na fase 1.** O WSO2 suporta PKCS#11, mas o Cloud KMS só vira PKCS#11 com Cloud
HSM + biblioteca da Google, custando ~$2,50/chave/mês + operações e adicionando latência de
rede a **cada assinatura de token** — ou seja, a cada login, no pico das 8h. Registre como
opção de fase 3 caso uma auditoria de SEDUC exija; em B2G isso é plausível e é melhor ter a
resposta pronta.

---

## 8. Exposição, observabilidade e HA

### DNS, TLS e Load Balancer

| Recurso | Nome | Observação |
|---|---|---|
| Cloud DNS zone | `unooria-com-br` | |
| Record A/AAAA | **`idp.unooria.com.br`** | ver abaixo |
| IP global estático | `identity-lb-ip` | Premium tier. Grátis enquanto atachado. |
| Certificado | `identity-cert` (Certificate Manager, **DNS authorization**) | Prefira ao `managedSslCertificate` clássico: a autorização por DNS permite **provisionar o certificado antes de cortar o tráfego**, enquanto o clássico exige que o DNS já aponte para o LB, criando uma janela de erro de certificado. Provisiona em 15-60 min — **comece cedo**. |
| Serverless NEG | `identity-neg` | → Cloud Run `identity-is` |
| Backend service | `identity-backend` | **Cloud CDN OFF** (CDN em endpoint de auth é como se vaza o token de um aluno para outro); logging sample 1.0 no início, 0.1 depois. |
| URL map / proxy / forwarding rules | `identity-urlmap`, `identity-https-proxy`, `identity-fr` (443) + `identity-http-redirect` (80 → 301) | ~$18/mês |

⚠️ **`idp.unooria.com.br` é uma decisão para congelar hoje e nunca mais mudar.** Este
hostname vira o `iss` de todo token emitido e o `OIDC_ISSUER`/`AUTH_WSO2_ISSUER` de todo
contrato. Trocar depois invalida tokens vivos e obriga a reconfigurar N contratos. `idp.`
e não `auth.` porque `auth` colide semanticamente com o Auth.js do hub. Reserve
também `idp-stg.unooria.com.br`.

**Um hostname só para todos os contratos** — os tenants são path-based (`/t/<contrato>/`).

⚠️ **`--ingress=internal-and-cloud-load-balancing` é crítico e frequentemente esquecido.**
Sem isso, a URL `identity-is-xxxxx.run.app` continua acessível e **contorna 100% do Cloud
Armor**, transformando toda a política abaixo em decoração. Efeito colateral aceito: a URL
`run.app` para de funcionar para você também — use o domínio ou `gcloud run services proxy`.

### Cloud Armor (`identity-armor`, ~$25-35/mês)

| Regra | Conteúdo |
|---|---|
| 2000 — superfície administrativa | `/carbon/**`, `/console/**`, `/api/server/**`, `/scim2/**`, `/t/*/api/server/**` restritos a allowlist de IP (escritório/VPN). O `/console` exposto com senha fraca é game over para **todos** os contratos ao mesmo tempo. |
| 1000 — rate limit em `/oauth2/token` e `/commonauth` | **Generoso**: 600/min por IP, ban 60 s. |
| 3000 — WAF pré-configurado | `sqli-v33-stable`, `xss-v33-stable`, sensibilidade 1, **em preview por 2 semanas antes de enforce**. As APIs de gestão do WSO2 mandam JSON que dispara falso-positivo de SQLi com frequência; ligar em enforce direto quebra o console em produção. |
| Por tenant (bônus) | `request.path.matches('/t/sp-piloto/')` permite limitar um contrato sem afetar os outros — só possível porque os tenants são path-based. |

⚠️ **A armadilha do rate limit: uma escola inteira sai por um único IP público (NAT).**
Quinhentos alunos às 8h vindos do mesmo IP. Um `enforce_on_key = IP` com threshold
"razoável" de 30/min **bloqueia a escola inteira no primeiro dia de aula**. O objetivo da
regra é só cortar abuso grosseiro; a defesa contra credential stuffing fica na **política de
lockout de conta do WSO2**, que é por usuário. O `auth.controller.ts` da api já documenta
exatamente essa lição ("sem rate limit por IP de propósito") — mesma doutrina aqui.

### Observabilidade

| Recurso | Observação |
|---|---|
| Log bucket `identity-logs` | Retenção **90 dias** (default é 30; auditoria B2G quer mais). |
| Log-based metric `wso2_auth_failures` | Radar de credential stuffing e de "contrato X com config quebrada". |
| **Uptime check `identity-oidc-discovery`** | `GET .well-known/openid-configuration`, 60 s, ≥3 regiões, espera 200 + corpo com `"issuer"`. **O monitor de maior valor da lista**: um único probe exercita DNS, TLS, LB, Cloud Armor, ingress, boot do IS e conexão ao banco. |
| Uptime check `identity-jwks` | `GET /oauth2/jwks` — é a dependência direta do `token.service.ts`. |
| Notification channel | Email **e um canal que te acorde** (SMS/push). Com um dev, alerta que só vai para email às 3h não é alerta. |
| Dashboard `identity-overview` | RPS e latência p50/p95/p99 do LB; CPU/memória/restarts do Cloud Run; CPU/conexões/disco do Cloud SQL; `wso2_auth_failures`. Uma tela só. |

| Alerta | Severidade |
|---|---|
| Uptime check falhando 2× consecutivas | 🔴 |
| Cloud Run instance count = 0 por > 2 min | 🔴 |
| 5xx no backend > 1% em 5 min | 🔴 |
| Failover do Cloud SQL | 🔴 |
| Container restart > 0 em 5 min | 🟡 |
| Memória do Cloud Run > 85% por 10 min | 🟡 (precede OOM kill) |
| CPU do Cloud Run > 80% por 10 min | 🟡 (**gatilho da fase 2**) |
| Cloud SQL CPU > 70% ou disco > 80% | 🟡 (disco = falta de cleanup) |
| Certificado expirando em < 30 dias | 🟡 (renova sozinho, mas a DNS authorization pode quebrar em silêncio) |
| `wso2_auth_failures` > 500 em 5 min | 🟡 |

### Alta disponibilidade

**Fase 1 — uma instância.** A pergunta certa não é "como evitar que o IS caia", é **o que
exatamente quebra quando ele cai**:

| Situação | Impacto |
|---|---|
| Aluno já logado, sessão do hub viva | **Nenhum** |
| Aluno já logado chamando a api | **Nenhum** — `jose` já cacheia o JWKS e só refaz fetch em `kid` novo |
| Aluno tentando logar agora | Bloqueado por 60-120 s |

O SPOF custa *"quem tentar logar nos próximos dois minutos vê erro"*, não "a plataforma
caiu" — desde que: (1) access token de 1 h, para que a janela de indisponibilidade seja
muito menor que a folga do token; (2) **Cloud SQL REGIONAL desde o dia 1**; (3) uptime check
com alerta que acorda alguém, senão "2 minutos" vira "40 minutos até o cliente ligar".

**Fase 2 — vertical antes de horizontal.** Gatilho medido, não antes: p95 de
`authorize→token` > 1,5 s no pico, **ou** CPU > 70% sustentada por 10 min, **ou** um
incidente real que doeu.

1. **Vertical:** 2→4 vCPU, 4→8 GiB. Uma flag. Cobre 5-8 contratos com folga. Sempre primeiro.
2. **Horizontal**, se ainda necessário. O IS 7.x com múltiplos nós exige:
   - bancos compartilhados (já tem);
   - **keystore primário idêntico** em todos os nós — se divergir, token assinado pelo nó A
     não valida contra o JWKS servido pelo nó B, de forma intermitente e enlouquecedora
     (o mount de Secret Manager dá isso de graça);
   - **mesma `[encryption] key`**, senão segredos gravados por um nó são indecifráveis pelo outro;
   - `[session_data] enable_persist = true` (default), que grava o `AuthenticationContext`
     em `IDN_AUTH_SESSION_STORE` e permite que um login iniciado no nó A termine no nó B —
     é isso que torna sticky session opcional. Contrapartida: essa tabela cresce rápido e
     exige as stored procedures de cleanup;
   - **invalidação de cache entre nós** — o item que decide tudo. Exige Hazelcast com
     `membership_scheme` ∈ {`wka`, `kubernetes`, `aws`, `azure`}, e **não há opção para
     Cloud Run**. Saídas: (a) desligar os caches locais relevantes e pagar em round-trips ao
     Postgres, que tem folga sobrando; ou (b) migrar para GKE Autopilot.

   **Decida nessa bifurcação quando chegar nela.** E projete para que seja barata: mantenha
   100% da configuração em `deployment.toml` + envs + Secret Manager, imagem idêntica, zero
   estado em disco. Aí migrar para GKE é "mesma imagem, mesmas envs, outro escalonador" —
   um dia de trabalho, não um mês.

**Cleanup (fase 2):** Cloud Run Job `identity-cleanup-job` + Scheduler às 03:00 BRT rodando
as stored procedures. Na fase 1, o cleanup embutido do IS dá conta (e funciona porque temos
`--no-cpu-throttling`). **Gatilho para migrar:** `IDN_AUTH_SESSION_STORE` passar de ~10M
linhas. Este é um problema que **aparece no mês 3, não no dia 1** — o alerta de disco/CPU do
Cloud SQL é o radar.

---

## 9. Tenancy: 1 contrato = 1 tenant

**Decisão tomada.** Cada contrato vira um tenant / root organization:

```
https://idp.unooria.com.br/t/<contrato>/oauth2/token
https://idp.unooria.com.br/t/<contrato>/oauth2/jwks
```

Issuer **e JWKS distintos por contrato**. Isso torna o isolamento **estrutural, não
disciplinar**: um token do contrato A é rejeitado pela api do contrato B por construção,
porque a api valida contra o `OIDC_ISSUER` dela. **Zero código novo.**

A alternativa — Organizations B2B, o carro-chefe do IS 7.x — teria issuer e audience únicos,
o que significa que **um token emitido para o contrato A é criptograficamente válido contra
a api do contrato B**, a menos que a api verifique `org_id`. Hoje o `token.service.ts` não
verifica e nem sabe que `org_id` existe. Seria estar a uma linha de código faltando de um
vazamento cross-contrato — o oposto da regra inviolável nº 1.

Em IS 7.x tenant e organization são a mesma coisa na raiz, então **isso não fecha a porta
das Organizations**: sub-orgs podem ser adicionadas *dentro* de cada tenant depois, se um
gestor de escola precisar de admin delegado.

**As ~100 escolas continuam sendo claim `escola_id` + RLS**, não sub-orgs. Modelar 100
sub-orgs seria criar 100 superfícies administrativas para operar com um dev, e o
`escola_id` + RLS já resolve o isolamento.

### Claims — o que configurar por tenant

| Passo | Detalhe |
|---|---|
| Claims locais | dialeto `http://wso2.org/claims`: `escola_id`, `turma_id`, `perfil` |
| Claims externas OIDC | dialeto `http://wso2.org/oidc/claim`, **exatamente** esses nomes — são lidos literalmente em `token.service.ts` |
| Scope | `escola`, agrupando os três — casa com o `scope: "openid profile escola"` já em `apps/hub/lib/auth.ts`, sem mudar o hub |
| Token type | **JWT**, não opaco — token opaco faz `jwtVerify` falhar de imediato |
| Audience | adicionar `plataforma-api` às allowed audiences; `jose` aceita quando o valor está *presente* no array `aud` |
| Redirect URI | `https://<hub-do-contrato>/api/auth/callback/wso2` — path **literal**, vem do `id: "wso2"` do Auth.js |

⚠️ **Armadilha nº 1 da integração: atributos no ACCESS token, não só no ID token.** Por
padrão o WSO2 coloca os atributos requisitados no ID token e no userinfo. O hub lê o ID
token e **vai logar perfeitamente**. A api lê o access token e recebe `escola_id` vazio,
caindo no `throw`. Sintoma: *login funciona, tudo na api dá 401*.

⚠️ **`iss`: não adivinhe.** O IS 7.x tem configurações que fazem o issuer ser ora a URL do
token endpoint, ora o entity ID do IdP residente. **Leia `/.well-known/openid-configuration`
depois do deploy e copie o campo `issuer` literalmente.**

⚠️ **`perfil` precisa ser single-valued.** O `token.service.ts` faz
`PERFIS.includes(String(payload["perfil"]))`; se o WSO2 emitir `["aluno"]` — formato natural
de roles/groups — a verificação falha e **todo mundo toma 401**. Mantenha `perfil` como
atributo de usuário, não role. E trate a escrita desse atributo como privilegiada: um bug
de escrita no userstore promove um aluno a `admin-contrato`.

---

## 10. Sequência de implantação

| Fase | Conteúdo |
|---|---|
| **0 — congelar decisões** (zero GCP) | Hostname `idp.unooria.com.br`; tenancy; nomes de claims; audience `plataforma-api`; plano de endereçamento IP; formato de username pós-migração (§11). |
| **1 — fundação** | Projetos + APIs + budgets → **VPC + subnet + allocated range + PSA peering** (bloqueante e caro de refazer) → Cloud SQL + 3 bancos + user → Artifact Registry → Secret Manager (com placeholders) → SAs + IAM + WIF **com condição de repositório**. |
| **2 — material criptográfico e imagens** | Gerar keystore próprio e subir ao Secret Manager (**pré-requisito absoluto do primeiro boot**) → gerar `internal-crypto-key` + escrow → build/push de `unooria/wso2is` e `identity-dbinit` → rodar `identity-db-init`. |
| **3 — primeiro boot, sem exposição** | Deploy com `--ingress=internal`, acesso via `gcloud run services proxy`. Validar boot < 240 s, health check, os 3 bancos, **JWKS servindo a SUA chave**. **É aqui que acontece o spike do reverse proxy.** Trocar senha do super admin, criar admin nomeado com MFA. |
| **4 — exposição** | IP estático + DNS authorization + **certificado** (comece cedo) → NEG → backend → urlmap → forwarding rules → Cloud Armor **em preview** → trocar ingress → apontar DNS → `curl` no discovery e **copiar o `issuer` literal**. |
| **5 — primeiro contrato (staging)** | Tenant → claims + scope → aplicação OIDC → um usuário de cada perfil → **validar o token com um script `jose` local antes de tocar no hub** (isola "WSO2 emite errado" de "hub configurou errado") → preencher `oidc-client-*` → E2E: login → token → api → `escola_id` correto → RLS bloqueia cross-escola. |
| **6 — provisionamento de usuários** | Ver §11. **É o caminho crítico real.** |
| **7 — carga e go-live** | k6 com 4k logins em 10 min contra staging **no mesmo tier**; Cloud Armor em enforce; **runbook** (reiniciar, rollback de revisão, restaurar banco, onde está o keystore, quem tem o escrow). |

Repetir a fase 5 por contrato — deve virar um checklist de 30 min ou um script contra a
Management API. O [`wso2/bootstrap/`](../wso2/bootstrap/) do ambiente local é o ponto de
partida desse script.

### Backup e DR

| Recurso | Observação |
|---|---|
| Bucket `identity-backups` | Export lógico semanal dos 3 bancos. Versioning; Nearline 30 d → Coldline 90 d → delete 365 d; **retention policy (bucket lock) de 30 dias**. Por que além dos backups do Cloud SQL: **backup do Cloud SQL morre junto com a instância/projeto**; um export com bucket lock sobrevive a uma SA comprometida e a um `terraform destroy` acidental. |
| **Escrow off-GCP do material criptográfico** | O P12 primário e o `wso2-internal-crypto-key` precisam ser recuperáveis **independentemente do projeto GCP** — cofre corporativo ou envelope selado. **É o item de maior consequência do documento**: perder isso não é "restaurar backup", é reonboarding manual de todos os contratos. |
| Versões do Secret Manager | Não destruir versões antigas ao rotacionar — é o rollback. |

### Custo mensal estimado

| Item | Prod | Staging |
|---|---|---|
| Cloud Run (2 vCPU / 4 GiB, always-on) | ~$120-160 | ~$0 (min=0) |
| Cloud SQL `db-custom-2-4096` **REGIONAL** + backups | ~$245 | ~$60 (zonal, menor) |
| Load Balancer | ~$25 | $0 |
| Cloud Armor | ~$30 | $0 |
| Artifact Registry, logs, monitoring, DNS | ~$20 | ~$10 |
| **Total** | **~$440** (piloto) → **~$580** (multi-contrato, 4 vCPU) | **~$70** |

---

## 11. Decisões pendentes (fora da infra, mas no caminho crítico)

A infra deste documento é ~2-3 semanas de trabalho. **O que ameaça o prazo de
novembro/2026 é o que está abaixo**, e as três primeiras precisam de decisão cedo.

1. **Subscrição WSO2 vs. imagem GA** (§1). Decisão de negócio sobre patching de CVE em
   contrato de governo.

2. **Como 10.000 alunos por contrato entram no WSO2.** Duas arquiteturas:
   - **(A) WSO2 como userstore mestre.** Migrar a tabela `users` via SCIM2 Bulk. O hash
     bcrypt **não é portável** para o formato do WSO2 — ou todos resetam senha, ou se
     escreve um userstore customizado apontando para o Postgres da api. Você vira
     custodiante de senhas de menores, com o peso de LGPD que isso carrega.
   - **(B) WSO2 como federador + JIT provisioning.** Alunos logam com o Google Workspace
     for Education da rede (**extremamente comum em redes públicas brasileiras**) ou Gov.br
     para gestores; o WSO2 federa e enriquece `escola_id`/`turma_id`. **Você não guarda
     senha de menor nenhuma** — resposta muito melhor num questionário de LGPD de edital.
     Custo: `escola_id`/`turma_id` precisam vir de algum lugar (a SEDUC popula o atributo,
     ou um claim handler consulta a api, o que reintroduz acoplamento).

   **(B) é dramaticamente melhor de risco e de LGPD, mas depende de o cliente ter diretório.
   Levante isso com o cliente do piloto agora.**

3. **Formato de username.** `@@unique([escolaId, username])` no `schema.prisma` permite
   `joao.silva` em duas escolas do mesmo contrato, e o `auth.controller.ts` desambigua pela
   senha. **Num tenant WSO2 o username é único no tenant inteiro** — não há workaround de
   configuração. É migração de dados com impacto de UX em 10k alunos, e **o usuário é uma
   criança de 6 anos digitando numa Chromebook compartilhada**. Opções: `sp042.joao` (código
   curto da escola) ou, melhor, **não digitar nada** — código de turma + QR code ou seleção
   visual do aluno numa lista da turma.

4. **Tela de login.** O `authenticationendpoint` padrão do WSO2 é um formulário corporativo.
   Do 1º ano EF ao 3º EM exige outra coisa. É trabalho de produto, e é meses.

5. **Um contrato pode degradar os outros.** Não há isolamento de recursos entre tenants no
   IS: um teste de carga de um contrato afeta todos. Mitigação parcial: rate limit por path
   de tenant no Cloud Armor — só possível porque os tenants são path-based.
