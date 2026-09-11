# Contrato com o repo de Terraform

Este repo NÃO cria recursos GCP. O repo de infra provisiona, por contrato:

> **`{contrato}` = `{app_name}-{env}`** do Terraform (`local.name_prefix`).
> No piloto: `plataforma-unooria-dev`, projeto `entre-redes`, região
> **`us-east1`** (a mesma do Cloud SQL que já existe — o Vertex é o único que
> foge, e foge para o endpoint **`global`**, não para uma região: ver "IA" mais
> abaixo. **O processamento de IA não fica no Brasil**, e isso precisa constar
> do contrato/DPA da rede).
> O passo a passo de subida está em `RUNBOOK-API.md`, no repo de infra.

> O **gerenciador central de identidade** (WSO2 Identity Server) foge deste padrão: é
> único para vários contratos, então não é `{contrato}-*` e vive em projeto próprio.
> Contrato separado em [`INFRA-IDENTITY.md`](INFRA-IDENTITY.md).

| Recurso | Nome esperado | Consumido por |
|---|---|---|
| Cloud Run service | `{contrato}-frontend` (hub), `{contrato}-api` | deploy.yml |
| Cloud Run **job** | `{contrato}-migrate` (VPC, roda `prisma migrate deploy`) | deploy.yml |
| Artifact Registry | `{contrato}` (mesma região do Cloud Run) | deploy.yml |
| Bucket experiências | `{contrato}-exp` (+ Cloud CDN) | deploy.yml, api (`CDN_EXP_URL`, só leitura por HTTP) |
| Bucket **assets** | `{contrato}-assets` (+ Cloud CDN, leitura pública) | api (`ASSETS_BUCKET`) |
| Bucket **planos** | `{contrato}-planos` (**privado**, sem CDN, versionamento de objetos ligado) | api (`PLANOS_BUCKET`) |
| Cloud SQL | `{contrato}-pg` (HA, PITR, pooler ativo) | api DATABASE_URL |
| Pub/Sub | topic `{contrato}-telemetria` + **push** sub `{contrato}-telemetria-ingest` → `POST {api}/telemetry/ingest` | api |
| Secret Manager | `{contrato}-database-url`, `{contrato}-db-password`, `{contrato}-token-signing-key`, `{contrato}-auth-secret`, `{contrato}-perfil-import-token`, `{contrato}-planos-import-token`, `{contrato}-swagger-senha` | Cloud Run env |
| Service Accounts | `{contrato}-api` (Vertex, Pub/Sub publisher, `objectAdmin` nos buckets de assets e de planos), `{contrato}-run` (hub/storybook), `{contrato}-push` (assina o push da telemetria) | |
| Load Balancer | um só, global: hub em `{hub_domain}`, api em `{api_domain}`, bundles em `{exp_domain}`, assets em `{assets_domain}` — mesmo IP, host rules | DNS |
| WIF p/ GitHub Actions | pool `github` | deploy.yml (sem chave JSON) |

Variáveis que a app espera: ver `.env.example`. Terraform injeta via Cloud Run env/secrets.
`OIDC_ISSUER`/`OIDC_JWKS_URI` NÃO são segredo (são URLs públicas do hub) e vão
como env em texto plano, derivadas de `hub_domain` — é isso que garante que o
`iss` do token e o esperado pela api não podem divergir.

**Fuso da plataforma (`FUSO_DA_PLATAFORMA`, ADR-99)**: env em texto plano, **na
api E no hub, com o MESMO valor**. Não é segredo, não é por escola, não tem
coluna no banco: 1 contrato = 1 stack, então a granularidade da configuração é a
do deploy. Ausente = `America/Sao_Paulo`, e nada quebra por falta dela.

- Valor: nome **IANA** (`America/Sao_Paulo`, `America/Manaus`,
  `America/Rio_Branco`, `America/Belem`, `America/Noronha`). Offset fixo
  (`-04:00`) é aceito pelo `Intl` e **não deveria ser usado**: ele congela o
  deslocamento, e uma rede que volte a ter horário de verão fica uma hora
  atrasada sem nada acusar.
- **Os dois serviços recebem a mesma variável, e isso não é redundância.** A api
  decide o "dia" que grava (o check-in de bem-estar recusa o segundo do dia); o
  hub decide o texto que a professora lê, **e é ele que repassa o valor às
  experiências** — escreve num `<meta>` do layout raiz, o navegador lê dali e o
  `config` do `hub:init` leva ao bundle. Divergir entre os dois devolve o
  defeito da ADR-98: entre as 21h e a meia-noite api e hub falam de DIAS
  diferentes. Um `variable "fuso_da_plataforma"` único no Terraform, consumido
  pelos dois serviços, é o que impede isso — **não** duas entradas separadas.
- **Falha diferente por serviço, de propósito**: na api um valor inválido
  derruba o boot (Zod, `config/env.ts`) — a revisão nova não pega tráfego e o
  Cloud Run mantém a anterior; no hub ele cai no padrão com um `console.error`.
  Derrubar a subida de um processo é barato; deixar a rede sem tela não é.
- **Nada de `NEXT_PUBLIC_FUSO_DA_PLATAFORMA`**: `NEXT_PUBLIC_*` é assado no
  build da imagem, e a mesma imagem pode servir mais de um contrato.


**Documentação da api (`/docs`)**: `SWAGGER_USUARIO` vai como env em texto plano;
`SWAGGER_SENHA` vem de `{contrato}-swagger-senha` (mínimo 16 caracteres). **As
duas ausentes = as rotas `/docs` e `/docs-json` não são montadas**, e o 404 é do
roteador — a api tem domínio próprio no LB, e o que a porta protege é o mapa das
rotas. Meia credencial derruba a subida do container, de propósito: uma porta que
não abre com alguém achando que configurou a documentação é pior que nenhuma.

**Mudanças em relação ao desenho original (decisões da migração, 2026-08):**

- **Sem `{contrato}-telemetry-worker`.** A telemetria analítica é consumida por
  **push subscription** direto num endpoint da própria api
  (`POST /telemetry/ingest`, que grava em `telemetria_eventos` com
  `ON CONFLICT DO NOTHING` — o Pub/Sub entrega *at least once*). Uma peça a
  menos para operar; o worker separado volta se o volume justificar.
- **Bucket de assets novo** (`{contrato}-assets`): as imagens geradas pela IA
  saíram do filesystem (`public/generated/`, que não sobrevive a Cloud Run
  multi-instância) para `atividades/{escolaId}/{activityId}/{postId}.webp`. O
  banco guarda a URL absoluta da CDN. Em dev, `ASSETS_DRIVER=local` e a api
  serve em `/assets`.
  O mesmo bucket guarda a **mídia pesada das experiências** (>2 MB não entra no
  git nem no bundle): `exp-02-unootube/videos/v01.mp4..v21.mp4` (~52 MB),
  upload manual **uma vez por contrato** — é conteúdo, não recurso Terraform:

  ```bash
  gcloud storage rsync -r apps/experiencias/exp-02-unootube/public/videos \
    gs://{contrato}-assets/exp-02-unootube/videos/ --project {projeto}
  ```

  O build da exp recebe a base pública em `VITE_VIDEOS_BASE_URL`
  (`https://<cdn-assets>/exp-02-unootube/videos`); vazio = `./videos` (dev,
  `public/videos/` gitignorado).

  **O CI não publica essa mídia** — o runner faz checkout do git, e os mp4 não
  estão lá. O que ele passou a fazer é CONFERIR: toda experiência com um
  `midia-externa.json` (prefixo + lista de arquivos, versionado) tem a presença
  checada no bucket de assets antes do bundle subir, e o deploy **falha** se
  faltar algo. Isso exige a var `ASSETS_BUCKET` no environment do GitHub
  (escrita por `scripts/configurar-github-ci.sh`); sem ela o passo só avisa.

  Por que a conferência e não a publicação: em 2026-09-01 a exp-02 subiu no
  contrato `entre-redes-dev` com o bucket de assets vazio. Os 21 mp4 responderam
  404, o feed ficou em "Carregando o vídeo…" para sempre e — porque Salvar e
  Curtir são desabilitados enquanto o vídeo carrega — a missão ficou impossível
  de concluir. Nada falhou: nem o deploy, nem o log da api. Quem descobriu foi
  um estudante, na frente da tela.
- **Job de migration**: `prisma migrate deploy` roda como Cloud Run Job na VPC
  (o Cloud SQL só tem IP privado), antes do deploy dos serviços.
- **Roles do Postgres**: o desenho original previa duas roles (owner p/
  migrations, `app_runtime` sem ownership p/ a api). Na prática ficou UMA
  (`app`, criada pelo Terraform), porque as tabelas usam **`FORCE ROW LEVEL
  SECURITY`** — que sujeita o próprio dono às políticas e torna a separação
  desnecessária. O que continua sendo obrigatório é a role **não** ter
  `BYPASSRLS` nem `SUPERUSER`; `RUNBOOK-API.md` traz o SQL de verificação, e
  `tests/tenancy.spec.ts` cobre o mesmo contrato localmente com uma role sem
  ownership.
- **Chave de assinatura de token**: enquanto o IdP central não entra, o HUB
  assina os tokens de experiência (RS256) e publica o JWKS em
  `/.well-known/jwks.json`; a api valida por `OIDC_ISSUER`/`OIDC_JWKS_URI`.
  `TOKEN_SIGNING_KEY_PEM` é obrigatória em produção.
- **api com CPU sempre alocada e `min-instances >= 1`**: o worker de geração de
  conteúdo roda in-process (fila em `generation_jobs` + advisory lock por
  atividade) — e a geração de planos de aula (exp-90) também: uma chamada de
  IA de minutos por plano, claim atômico em `planos_de_aula`.
- **Bucket de planos** (`{contrato}-planos`, 2026-08): o gerador de plano de
  aula deixou de ser um Cloud Run separado e virou a experiência exp-90 + o
  módulo `planos` da api. O conteúdo autoral do professor
  (`planos/{escolaId}/{planoId}/{gerado.md,atual.html}`) fica em bucket
  **privado** — nunca no de assets, que é público — e só sai pela api
  (OIDC + posse). Versionamento de objetos ligado dá histórico de cada
  Salvar sem código. Em dev, `PLANOS_DRIVER=local` grava em `storage-privado/`.
  Envs: `PLANOS_DRIVER`, `PLANOS_BUCKET`, `PLANOS_IMPORT_TOKEN`,
  `VERTEX_MODEL_LONGO` (Gemini 2.5, saída longa),
  `AI_DAILY_TOKEN_QUOTA_PER_PROFESSOR`. As referências curriculares (texto)
  vivem no Postgres e entram por `scripts/importar-referencias-plano.mjs`.
  O Cloud Run `planodeaula` antigo pode ser desligado após o smoke em produção.
- **Vila do Lume** (exp-70, transversal, 2026-08): jogo 3D estático no bucket de
  bundles como qualquer experiência — **sem serviço novo e sem bucket novo**. Não
  produz documento autoral, não chama IA (zero token, zero quota) e não precisa
  de fila: o perfil é função pura, calculada no request de conclusão. Três
  tabelas no Postgres (`vila_sessoes`, `vila_perfis`, `vila_bolhas`), todas com
  `escola_id` + RLS. **Nenhuma env.**
  **Tamanho, MEDIDO (2026-08-26)**: o `payload` de uma partida dá ~1,1 KB de
  JSON (1,5 KB na coluna JSONB). A estimativa anterior — centenas de MB a 2,4 GB
  por contrato — partia do teto do contrato (2000 eventos) e estava errada por
  duas ordens de grandeza: o jogo tem 7 pontos de log, todos atos discretos com
  guarda própria (8 Chamas, 4 aldeões, 1 Borda + 3 Destaques, 4 cartões, 1
  primeira conversa) — teto real ~22 eventos, nada por quadro nem por metro
  andado. **~30 MB por contrato** de 10 mil estudantes jogando uma vez. O cap do
  contrato foi de 2000 para 200, que é o que de fato limita a linha se um cliente
  adulterado mandar lixo.
  **Sem prazo de retenção declarado** (decisão de 2026-08-26). Houve um
  `expires_at` de 90 dias no schema e nenhuma rotina que o cumprisse — coluna de
  prazo que ninguém lê é pior que prazo nenhum, porque quem lê o schema acredita
  nela. A coluna saiu (`20260826170000_vila_sem_prazo`). O que se ganha em troca
  é o REPROCESSAMENTO: `payload` é a única fonte para recomputar o perfil quando
  `VERSAO_MAPEAMENTO` subir, e o mapeamento é hipótese de design que vai mudar.
  Não há job agendado, e a plataforma segue sem nenhum.
  **Em aberto, e é decisão de produto/contrato:** se uma rede exigir prazo para o
  dado comportamental bruto de menores, ele volta junto com a rotina que o
  cumpre. A mesma pergunta vale para `telemetria_eventos`, que guarda evento por
  `estudante_id` de TODAS as experiências, também sem prazo — se a resposta importar,
  ela é da plataforma inteira, não de um módulo.

- **Check-in de bem-estar** (exp-91, 2026-08): sem recurso novo de infra —
  duas tabelas com RLS (`bem_estar_ciclos`, `bem_estar_checkins`; a migration
  dá `GRANT` à `app_runtime`) e IA pelo mesmo Vertex/quota do professor. O
  texto livre do professor vai ao Vertex (endpoint `global`): consta do DPA
  junto com o resto da IA. Nenhum bucket, nenhuma rota pública.

**IA: a service account da api precisa de `roles/aiplatform.user`** (2026-08).
A api autentica no Vertex por ADC (`google-auth-library`), então em Cloud Run a
credencial é a SA do serviço e não há env de credencial nenhuma — só
`VERTEX_PROJECT_ID` (obrigatória com `AI_PROVIDER=vertex`; o boot recusa sem
ela), `VERTEX_LOCATION`, `VERTEX_MODEL`, `VERTEX_MODEL_LONGO` e
`VERTEX_THINKING_BUDGET`. Sem o papel, toda geração falha com 403 do Vertex.
Atenção ao catálogo por região: o modelo escolhido (`gemini-3.6-flash`) só
existe no endpoint `global`, então `VERTEX_LOCATION=global` — o processamento de
IA NÃO fica em São Paulo, e isso precisa constar do contrato/DPA da rede. Voltar
à região é trocar as duas envs juntas (localização + modelo da família 2.5).
Em dev (host ou container) a mesma cadeia lê o ADC do
`gcloud auth application-default login` — os compose montam esse arquivo em
`/adc` como somente leitura.

**Telemetria: fica no Postgres, e sem serviço novo** (decisão de 2026-08-27).
Avaliamos mandar o canal analítico para o BigQuery por subscription nativa do
Pub/Sub. Não foi: os relatórios do professor NÃO leem `telemetria_eventos` (leem
`exp_01_events`, o canal síncrono do motor), então o BigQuery não resolvia
problema nenhum hoje e criava uma segunda plataforma de dados para operar. O que
entrou no lugar, tudo dentro do que já existe: `INSERT` multi-linha no
`/telemetry/ingest` (era um por evento, em laço) e partição mensal de
`telemetria_eventos` no schema `particoes`. **Sem Redis**: o amortecedor de pico
é o Pub/Sub, que é durável — um buffer em memória perderia o que não deu tempo
de descarregar. Retenção continua sem prazo declarado, mas agora vira
`DROP TABLE particoes.<mês>` em vez de um `DELETE` que trava a tabela.

**Telemetria: a rota de ingest é autenticada** (2026-08). `POST /telemetry/ingest`
não passa pelo `OidcGuard` — quem chama é a push subscription. O
`PubSubPushGuard` verifica o ID token que o Pub/Sub assina: emissor Google,
`aud` == `TELEMETRIA_PUSH_AUDIENCE` e `email` == `TELEMETRIA_PUSH_SA`. Sem as
duas envs a rota responde 401 (fechada, não aberta). O Terraform casa os dois
lados: a subscription é criada com `oidc_token` dessa mesma SA e audience.

**Observabilidade (PENDENTE — fase 0 do cap. 17 da documentação, ADR-57/58 propostas em 2026-09-01).**
Hoje a stack não tem alerta, sonda HTTP nem painel: só o log e a métrica nativa do
Cloud Run. Quando a fase 0 for provisionada, este repo passa a esperar, por contrato:

| Recurso | Nome esperado | Observação |
|---|---|---|
| Notification channels | `{contrato}-alerta-acorda` (e-mail + push do app Cloud Console), `{contrato}-alerta-amanha` (e-mail + Google Chat/Slack) | duas severidades, só |
| Uptime checks (3 regiões, 60 s, valida conteúdo) | `{contrato}-jwks` (`{hub}/.well-known/jwks.json` contém `"keys"`), `{contrato}-api-readyz`, `{contrato}-hub-healthz` (rota nova do hub), `{contrato}-landing`, `{contrato}-exp-ativa` (index.html da versão ativa da exp-01) | o `/readyz` passa a ser chamado por alguém |
| Alert policies | 13 aplicadas (ver cap. 17). A 13ª, `spans do navegador descartados`, é a primeira sobre métrica DA APLICAÇÃO — `prometheus.googleapis.com/unooria.observabilidade.spans_descartados/counter`, recurso `prometheus_target` | por sintoma; nenhuma de CPU/memória. **Alerta sobre métrica da aplicação só pode ser criado depois que a série existe**: o Cloud Monitoring responde 404 `Cannot find metric(s) that match type`, e o contador só cria a série ao incrementar. Por isso `obs_alerta_erro_de_cliente` nasce `false` — ligar depois do deploy da ADR-84 |
| SLOs (service monitoring) | disponibilidade do `-frontend` e do `-api` a 99,5 %/30 dias, com alerta de burn rate | |
| Dashboard | `{contrato}-plataforma` (JSON versionado no Terraform) | igual em todo contrato |
| Log: exclusões no sink `_Default` | request log de `/healthz`, `/readyz` e dos uptime checks; `sample(insertId, 0.2)` dos 2xx com latência < 1 s | é o que mantém o log dentro dos 50 GiB grátis |
| Log: bucket de auditoria | `{contrato}-auditoria`, 400 dias, regional, alimentado por sink de `codigo=auth.*`, `codigo=importacao.*`, `codigo=deploy` + Admin Activity | Data Access audit logs do próprio Logging ligados |
| Pub/Sub dead letter | topic `{contrato}-telemetria-dlq`, `dead_letter_policy` na `-telemetria-ingest` após 5 tentativas | hoje um lote recusado é reentregue para sempre, em silêncio |
| Sondas do Cloud Run | `startup_probe` e `liveness_probe` HTTP em `/healthz` (api) e `/api/healthz` (hub, **existe desde 2026-09-02**) no recurso do serviço | o `gcloud run deploy` do CI não as remove; trocar a sonda para HTTP só DEPOIS do hub com a rota estar no ar naquele ambiente |
| Cloud SQL | Query Insights ligado; `pg_stat_statements` | grátis |
| Env | `FUSO_DA_PLATAFORMA` (api E hub, MESMO valor — ADR-99; ausente = `America/Sao_Paulo`), `GCP_PROJECT_ID` (api e hub), `LOG_LEVEL=info`, `OBS_TRACE_RATIO=0.02` (api e hub), `OBS_TRACE_RATIO_CLIENTE=0.02` (só hub: vai no `config.obs` do `hub:init` e liga o OpenTelemetry Web das experiências) | o hub já recebe `GCP_PROJECT_ID` e `LOG_LEVEL`; a api passou a validá-las (Zod) em 2026-09-02 e ainda NÃO as recebe do Terraform — ver apêndice B |
| Metrics scope | projeto de observação sem recursos, com todos os contratos como monitored projects | métrica atravessa projeto; log não |
| IAM e APIs | `{contrato}-api` e `{contrato}-run` já têm `roles/cloudtrace.agent`, `roles/monitoring.metricWriter` e `roles/logging.logWriter` (confirmado no Terraform em 2026-09-02). O que faltava e entrou: APIs `cloudtrace`, `clouderrorreporting` e `telemetry` em `gcp_services` (o papel não habilita a API — sem ela o exportador recebe `SERVICE_DISABLED`), e `roles/telemetry.writer` + `roles/serviceusage.serviceUsageConsumer` **só na SA da api** (as MÉTRICAS da api e o proxy OTLP dos spans do navegador saem por `telemetry.googleapis.com`; o exportador de métricas do Google foi descartado por arrastar 202 MB de `googleapis`) | ver `RUNBOOK-API.md` > Observabilidade no repo de infra |

O CI ganha, no mesmo passo: smoke pós-deploy (a suíte `publico`+`estudante` de
`scripts/e2e`), `if: failure()` notificando no canal "amanhã", e a suíte agendada
contra `hml`. Nada disso existe hoje.

Deploy (CI deste repo):
1. `turbo build --filter='...[HEAD^]'`
2. schema mudou → executar o job `{contrato}-migrate` (roda ANTES do deploy do
   serviço: o schema novo tem que estar no banco antes da revisão nova pegar
   tráfego)
3. hub/api mudou → `docker build` + push direto no Artifact Registry (sem Cloud
   Build) → `gcloud run deploy` (revisions = rollback)
4. exp mudou → `gcloud storage rsync -r dist/ gs://{contrato}-exp/{expId}/{versao}/`
   e `PUT {api}/experiencias/{expId}` (admin-contrato) com o conteúdo do
   `public/experiencia.json` — é esse upsert que o hub lê para montar a URL do
   bundle. Feito por `apps/hub/scripts/publicar-manifesto.mjs`, que assina um
   token de 5 min com `token-signing-key` (vars `API_URL`, `HUB_ORIGIN`).
   **Rollback: prefira o painel da Unooria** (`/unooria/recursos`, papel
   `admin` — ADR-87). Ele troca a `versao_ativa` E RESTAURA o manifesto daquela
   versão (`viewport`, `permissoes`, `series`), lido de `experiencias_versoes`.
   O `publicar-manifesto.mjs <exp> --versao <anterior>` continua funcionando e
   é o caminho de quem não tem a tela à mão, mas ele manda o número antigo com o
   `experiencia.json` **atual do repositório**: voltar a versão por ele NÃO volta
   as permissões de iframe, e a exp-70 reabre sem `allow-pointer-lock` — o jogo
   sobe e a câmera não gira, sem erro em lugar nenhum.

   **A api precisa de `CDN_EXP_URL`** (a mesma base do
   `NEXT_PUBLIC_CDN_EXP_URL` do hub) para conferir, com um HEAD no
   `index.html`, se a versão que o painel está ativando existe no bucket.
   Ausente, a ativação acontece e a tela DIZ que não deu para conferir — o que
   é aceitável em dev e não em produção: apontar a rede para uma versão que não
   subiu é tela branca para todo mundo. Experiência com
   mídia externa (exp-02) builda com `VITE_VIDEOS_BASE_URL` apontando para a
   CDN de assets do contrato.
   O `deploy.yml` faz o `rsync` **e** o `PUT` do manifesto, e grava
   `Cache-Control: max-age=60` no `index.html` (o resto do caminho carrega a
   versão e é imutável). A mídia pesada (os mp4 para o bucket de assets) continua
   sendo upload deliberado — o runner não tem os arquivos —, mas desde
   2026-09-01 o CI **confere** a presença dela e recusa publicar sem: ver a seção
   do bucket de assets acima e `RUNBOOK-API.md`, passo 4.

Nomes e valores concretos saem de `terraform output`; as `vars` que o
`deploy.yml` consome estão listadas no passo 2 do `RUNBOOK-API.md`.

**O que o CI passou a consumir (2026-09-02, cap. 17):** a var de environment
`EXP_MAPAS_BUCKET` (= `terraform output bucket_exp_mapas`, o bucket PRIVADO dos
sourcemaps — `scripts/configurar-github-ci.sh` a inclui quando o output
existe). Sem ela o deploy avisa e segue (o `.map` fica só no runner). Nenhum
secret novo: falha de workflow avisa por e-mail quem fez o push (padrão do
GitHub), e o alerta de disponibilidade é dos **uptime checks** do Cloud
Monitoring (Terraform, `observabilidade.tf`), por e-mail.
