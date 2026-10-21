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
| Secret Manager | `{contrato}-database-url`, `{contrato}-db-password`, `{contrato}-token-signing-key`, `{contrato}-auth-secret`, `{contrato}-perfil-import-token`, `{contrato}-planos-import-token`, `{contrato}-swagger-senha`, `{contrato}-liveavatar-api-key`, `{contrato}-ajuda-llm-segredo`, `{contrato}-ajuda-sessao-chave` | Cloud Run env |
| Service Accounts | `{contrato}-api` (Vertex, Pub/Sub publisher, `objectAdmin` nos buckets de assets e de planos), `{contrato}-run` (hub/storybook), `{contrato}-push` (assina o push da telemetria) | |
| Load Balancer | um só, global: hub em `{hub_domain}`, api em `{api_domain}`, bundles em `{exp_domain}`, assets em `{assets_domain}` — mesmo IP, host rules | DNS |
| WIF p/ GitHub Actions | pool `github` | deploy.yml (sem chave JSON) |
| Bucket **agente** | `{project_id}-agente-professor` (privado, versionado; prefixos `bncc/`, `livros/`, `habilidades/`, `metadados/`, `import-erros/`) | `apps/agente-professor/ingestao` (fora do Terraform) |
| Data stores (Vertex AI Search, `global`) | `agente-professor-habilidades` (estruturado, schema próprio), `agente-professor-acervo` (parser de layout, chunk de 500 tokens com títulos) | o agente (`AGENTE_DATASTORE_*`) |
| Agent Engine | `agente-professor` em `us-east1` (dev/hml; prd a decidir) — **nasce só com `agente_professor_imagem` preenchida** (apply 2) | api (`AGENTE_PROFESSOR_ENGINE`), deploy.yml (`PATCH` da `imageUri`, `vars.AGENTE_PROFESSOR_ENGINE`) |
| SA do agente | `{contrato}-agente` (id de SA tem teto de 30 caracteres) | o Agent Engine |

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
  git nem no bundle): `exp04ef1b/videos/v01.mp4..v21.mp4` (~52 MB, os vídeos do
  UnooTube — hoje ARQUIVADO como `backup-exp04ef1b`, ADR-116: a mídia fica no
  bucket, sem uso, e o deploy não a confere mais porque pula `backup-*`; o que
  segue descreve como ela subiu),
  upload manual **uma vez por contrato** — é conteúdo, não recurso Terraform:

  ```bash
  gcloud storage rsync -r apps/experiencias/exp04ef1b/public/videos \
    gs://{contrato}-assets/exp04ef1b/videos/ --project {projeto}
  ```

  **A troca de código de 2026-09 (ADR-110) mudou este prefixo** — era
  `exp-02-unootube/videos/`. Em contrato que já tinha os vídeos, copie uma vez
  para o prefixo novo antes do primeiro deploy depois da troca (a conferência
  abaixo reprova o deploy até lá, que é o comportamento certo):

  ```bash
  gcloud storage cp -r gs://{contrato}-assets/exp-02-unootube/videos \
    gs://{contrato}-assets/exp04ef1b/ --project {projeto}
  ```

  **A mídia que a api GERA também mora por `expId`**: `experiencias/{expId}/`
  no mesmo bucket. A única que existia eram as fotos e os áudios do Eco no Grupo
  (`experiencias/exp-07-o-eco-no-grupo/`, depois `experiencias/exp07ef1b/`), e o
  Eco saiu da trilha (ADR-113): essa mídia não se copia mais — **apaga-se**,
  porque o `exp07ef1b` passa a ser A Seleção, que grava a dela em
  `experiencias/exp07ef1b/selecao/`. Em dev e hml ela nunca chegou ao bucket
  (conferido em 2026-09-26); o comando é para o contrato em que chegou:

  ```bash
  gcloud storage rm -r "gs://{contrato}-assets/experiencias/exp-07-o-eco-no-grupo/" --project {projeto}
  # e, em experiencias/exp07ef1b/, tudo o que NÃO for selecao/
  ```

  O build da exp recebe a base pública em `VITE_VIDEOS_BASE_URL`
  (`https://<cdn-assets>/exp04ef1b/videos`); vazio = `./videos` (dev,
  `public/videos/` gitignorado).

  **O CI não publica essa mídia** — o runner faz checkout do git, e os mp4 não
  estão lá. O que ele passou a fazer é CONFERIR: toda experiência com um
  `midia-externa.json` (prefixo + lista de arquivos, versionado) tem a presença
  checada no bucket de assets antes do bundle subir, e o deploy **falha** se
  faltar algo. Isso exige a var `ASSETS_BUCKET` no environment do GitHub
  (escrita por `scripts/configurar-github-ci.sh`); sem ela o passo só avisa.

  Por que a conferência e não a publicação: em 2026-09-01 a exp04ef1b subiu no
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
  atividade) — e a geração de planos de aula (app-90) também: uma chamada de
  IA de minutos por plano, claim atômico em `planos_de_aula`.
- **Bucket de planos** (`{contrato}-planos`, 2026-08): o gerador de plano de
  aula deixou de ser um Cloud Run separado e virou a experiência app-90 + o
  módulo `planos` da api. O conteúdo autoral do professor
  (`planos/{escolaId}/{planoId}/{gerado.md,atual.html}`) fica em bucket
  **privado** — nunca no de assets, que é público — e só sai pela api
  (OIDC + posse). Versionamento de objetos ligado dá histórico de cada
  Salvar sem código. Em dev, `PLANOS_DRIVER=local` grava em `storage-privado/`.
  Envs: `PLANOS_DRIVER`, `PLANOS_BUCKET`, `PLANOS_IMPORT_TOKEN`,
  `VERTEX_MODEL_LONGO` (Gemini 2.5, saída longa). A quota diária do professor
  deixou de ser env (`AI_DAILY_TOKEN_QUOTA_PER_PROFESSOR` **saiu do Terraform**,
  ADR-105): é a linha `professor` de `ia_quotas`, editada pelo `admin` em
  `/unooria/uso-de-ia`. As referências curriculares (texto)
  vivem no Postgres e entram por `scripts/importar-referencias-plano.mjs`.
  O Cloud Run `planodeaula` antigo pode ser desligado após o smoke em produção.
- **Vila do Lume** (app-70, transversal, 2026-08): jogo 3D estático no bucket de
  bundles como qualquer experiência — **sem serviço novo e sem bucket novo**. Não
  produz documento autoral, não chama IA (zero token, zero quota) e não precisa
  de fila: o perfil é função pura, calculada no request de conclusão. Três
  tabelas no Postgres (`app_70_sessoes`, `app_70_perfis`, `app_70_bolhas`), todas com
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

- **Check-in de bem-estar** (app-91, 2026-08): sem recurso novo de infra —
  duas tabelas com RLS (`app_91_ciclos`, `app_91_checkins`; a migration
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

**Agente de IA do professor** (2026-09-30, ADR-126/127/128; contrato das quatro
pontas em `docs/regras/agente-professor.md`; passo a passo em
`RUNBOOK-AGENTE-PROFESSOR.md` no repo de infra). O que a app espera:

- **Envs da api**: `AGENTE_PROFESSOR_MODO` — `desligado` enquanto o engine não
  existe (ausente também é `desligado`: a api sobe e o chat responde
  `AGENTE_INDISPONIVEL`), `agent-engine` depois do apply 2 — e
  `AGENTE_PROFESSOR_ENGINE` com o resource name completo
  (`projects/<p>/locations/us-east1/reasoningEngines/<id>`). `mock`/`local` são
  recusados em produção.
- **IAM**: a SA da api com um papel custom NO engine — `reasoningEngines.get/query`
  e `sessions.get/update` (a renovação do `expireTime` a cada mensagem sustenta o
  histórico sem limite; sem `sessions.update` sai `agente-professor.renovacao-falhou`).
  O CI com `reasoningEngines.get/update` no engine e `iam.serviceAccountUser` na
  SA do agente. A SA do agente: `aiplatform.user`, `discoveryengine.viewer`,
  log/trace/métrica e leitura do bucket.
- **Timeout do Cloud Run da api ≥ 240 s** (a api limita o stream a 240 s; o hub
  corta em 300 s). O LB com NEG serverless tem 60 min fixos.
- **Cloud Armor**: a 921150 (CR/LF) fora de `/agente-professor/` (host da api) e
  de `/api/plataforma/agente-professor/` (host do hub). As outras assinaturas
  seguem valendo.
- **Fora do Terraform**: os service agents do Discovery Engine e do Agent Engine
  (`gcloud beta services identity create`, uma vez por projeto), a importação dos
  documentos (`ingestao/`) e o **aumento de quota do Agent Engine** (90
  `streamQuery` e 300 eventos de sessão por minuto por projeto e região) antes do
  go-live.
- **Ordem**: apply 1 (tudo menos o engine) → ingestão → CI publica a imagem →
  apply 2 (engine, IAM nele, api com `agent-engine`) → daí em diante o CI faz o
  `PATCH` da `imageUri` (o Terraform tem `ignore_changes` nela).
- **Alerta de p95 da api (10 s)**: os streams o inflam, e
  `run.googleapis.com/request_latencies` não tem rótulo de caminho. A métrica de
  log de distribuição que exclui `/agente-professor/` está proposta no RUNBOOK e
  **não aplicada**.

**Ajuda com avatar** (2026-10-02, ADR-132; doutrina em `apps/api/src/ajuda/AGENTS.md`).
Vendor externo: LiveAvatar (HeyGen), FULL Mode com o LLM NOSSO. O que a app espera:

- **Segredos → env da api**: `{contrato}-liveavatar-api-key` → `LIVEAVATAR_API_KEY`
  (a chave da conta; nunca vai ao hub), `{contrato}-ajuda-llm-segredo` →
  `AJUDA_LLM_SEGREDO` (o Bearer que o vendor manda; o MESMO valor fica guardado
  na conta do vendor) e `{contrato}-ajuda-sessao-chave` → `AJUDA_SESSAO_CHAVE`
  (assina o token da sessão; só a api conhece). Todos com 32+ caracteres.
- **Envs comuns da api**: `LIVEAVATAR_CONTEXT_ID` e `LIVEAVATAR_LLM_CONFIG_ID`,
  impressos por `scripts/liveavatar-configurar.mjs <ambiente> <url>` (um conjunto
  por contrato/ambiente, fora do Terraform). `LIVEAVATAR_SANDBOX=0` fora de dev
  (o Zod recusa `1` em produção). Faltou qualquer uma: a Ajuda responde 503 e a
  api sobe normal — dá para aplicar o Terraform antes do script.
- **A api precisa de URL PÚBLICA** alcançável pelo vendor (servidores na AWS,
  `us-east-2` no spike): `POST <api>/ajuda/llm/chat/completions` e
  `GET <api>/ajuda/llm/models`, sem token de usuário (trancados por segredo +
  token da sessão). O caminho não pode ficar atrás de IAP nem de allowlist por IP
  do LB. **Cloud Armor**: o corpo é JSON OpenAI com o prompt do contexto — conferir
  que nenhuma assinatura recusa `/ajuda/llm/`. Resposta em SSE: o primeiro byte
  tem de sair em menos de 10 s (é o timeout do vendor), então nada de buffering no LB.
- **Firewall das escolas** (o navegador fala direto com o vendor): `*.livekit.cloud`
  TCP 443 (WSS), `*.turn.livekit.cloud` 443 (TURN/TLS), `*.host.livekit.cloud`
  UDP 3478 e `api.liveavatar.com` 443; recomendado UDP 50000–60000. Rede que
  bloqueia WebRTC mostra "não conseguimos conectar o vídeo" no modal.
- **Custo e dado**: o vendor cobra 2 créditos por minuto de sessão (plano pago
  necessário — a conta de testes tem 10 créditos). Voz e texto de PROFISSIONAIS
  (nunca de estudante) passam pelo vendor nos EUA: precisa constar do
  contrato/DPA da rede e da página de privacidade.

**O mascote da Ajuda** (2026-10-12, ADR-158; doutrina em `apps/api/src/ajuda/AGENTS.md`).
O segundo atendente: o Gemini Live da Vertex, por um WebSocket da PRÓPRIA api
(`/ajuda/mascote/ao-vivo`). Sem vendor novo e sem segredo novo. O que a app espera:

- **IAM**: o mesmo `roles/aiplatform.user` da SA da api (o Live usa o ADC).
  Região do Live: `AJUDA_MASCOTE_REGIAO` (padrão `us-central1`; o `global` do
  texto não serve o `gemini-3.8-live`). Assina o bilhete com a
  `AJUDA_SESSAO_CHAVE` que a Ajuda já tem.
- **WebSocket atrás do LB**: o `timeout_sec` do *backend service* da api é o
  tempo MÁXIMO de uma conexão WebSocket no HTTPS LB — tem de cobrir o teto de
  minutos por conversa (semente 10 min → ≥ 900 s; o painel aceita até 60 min →
  3600 s; o padrão de 30 s derruba a conversa no meio). O *request timeout* do
  Cloud Run da api também. Cloud Armor:
  o `Upgrade: websocket` em `/ajuda/mascote/ao-vivo` não pode ser recusado.
- **Origem**: o hub precisa estar em `CORS_ORIGINS` da api — a conexão confere
  o `Origin` contra a mesma lista.
- **O modelo 3D vai ao bucket de assets, uma vez por contrato**:
  `gcloud storage cp mascote-v1.glb gs://{contrato}-assets/ajuda/mascote/mascote-v1.glb`
  (3,4 MB, comprimido com meshopt; o original está no PoC `poc-mascote-visemas`).
  O hub baixa por `fetch` a partir do domínio dele, então o **bucket precisa de
  CORS** liberando `GET` para a origem do hub. Sem o arquivo, a janela abre e a
  conversa funciona, mas o mascote não aparece.
- **Custo**: o Live cobra a janela de contexto a cada turno, e a base inteira da
  Ajuda vai na instrução. O teto continua sendo os minutos de `ajuda_limites`.

**Custos de IA** (2026-10-13, ADR-161; doutrina em `docs/regras/custos-de-ia.md`).
Nada novo no Terraform: sem env, sem segredo, sem bucket. Duas expectativas:

- **A api sai para `olinda.bcb.gov.br:443`** (a PTAX do Banco Central, API
  pública, sem chave), do servidor e sob demanda — no máximo uma vez por hora,
  quando o `admin` abre o painel. É tráfego público como o de
  `api.liveavatar.com`; com egress `private-ranges-only` ele já sai direto. Se
  um contrato fechar a saída da api para a internet, o painel continua no ar e
  converte com as cotações guardadas, avisando que o BCB não respondeu.
- **Trocar o modelo de IA numa env do Terraform** (`VERTEX_MODEL`,
  `VERTEX_TTS_MODEL`, o do agente) pede o PREÇO do modelo novo no painel
  `/unooria/custos-de-ia` no mesmo dia: sem ele, o consumo entra com custo zero
  e a tela avisa.

**Telemetria: fica no Postgres, e sem serviço novo** (decisão de 2026-08-27).
Avaliamos mandar o canal analítico para o BigQuery por subscription nativa do
Pub/Sub. Não foi: os relatórios do professor NÃO leem `telemetria_eventos` (leem
`exp08ef1b_events`, o canal síncrono do motor), então o BigQuery não resolvia
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
| Uptime checks (3 regiões, 60 s, valida conteúdo) | `{contrato}-jwks` (`{hub}/.well-known/jwks.json` contém `"keys"`), `{contrato}-api-readyz`, `{contrato}-hub-healthz` (rota nova do hub), `{contrato}-landing`, `{contrato}-exp-ativa` (index.html da versão ativa da exp08ef1b) | o `/readyz` passa a ser chamado por alguém |
| Alert policies | 13 aplicadas (ver cap. 17). A 13ª, `spans do navegador descartados`, é a primeira sobre métrica DA APLICAÇÃO — `prometheus.googleapis.com/unooria.observabilidade.spans_descartados/counter`, recurso `prometheus_target` | por sintoma; nenhuma de CPU/memória. **Alerta sobre métrica da aplicação só pode ser criado depois que a série existe**: o Cloud Monitoring responde 404 `Cannot find metric(s) that match type`, e o contador só cria a série ao incrementar. Por isso `obs_alerta_erro_de_cliente` nasce `false` — ligar depois do deploy da ADR-84. **Em 2026-09-14 essa política pagou o próprio custo**: o que ela apontou foi defeito de CÓDIGO (o proxy OTLP nunca recebia o cliente, por `import type` num token de injeção do Nest), não de infraestrutura. `GCP_PROJECT_ID` já estava nos dois serviços desde 03/09, então **`motivo=sem-projeto` não é evidência de env faltando** — confira a env do serviço antes de abrir tarefa no repo de Terraform |
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
   e `PUT {api}/experiencias/{expId}` (`gestor_contrato` ou `admin`) com o conteúdo do
   `public/experiencia.json` — é esse upsert que o hub lê para montar a URL do
   bundle. Feito por `apps/hub/scripts/publicar-manifesto.mjs`, que assina um
   token de 5 min com `token-signing-key` (vars `API_URL`, `HUB_ORIGIN`).
   **Rollback: prefira o painel da Unooria** (`/unooria/recursos`, papel
   `admin` — ADR-87). Ele troca a `versao_ativa` E RESTAURA o manifesto daquela
   versão (`viewport`, `permissoes`, `series`), lido de `experiencias_versoes`.
   O `publicar-manifesto.mjs <exp> --versao <anterior>` continua funcionando e
   é o caminho de quem não tem a tela à mão, mas ele manda o número antigo com o
   `experiencia.json` **atual do repositório**: voltar a versão por ele NÃO volta
   as permissões de iframe, e a app-70 reabre sem `allow-pointer-lock` — o jogo
   sobe e a câmera não gira, sem erro em lugar nenhum.

   **A troca de código de 2026-09 (ADR-110) mudou o `{expId}` de todo bundle**
   (`exp-01-instanooria` virou `exp08ef1b`; o de-para está na ADR). O primeiro
   deploy depois dela publica cada experiência no prefixo novo; as versões
   ANTERIORES continuam só no prefixo antigo, e a linha delas em
   `experiencias_versoes` (já com o id novo, pela migration
   `20260923120000_codigo_das_experiencias`) apontaria o rollback para um
   caminho vazio. Uma vez por contrato, copie o histórico — o caminho é
   imutável, então copiar não sobrescreve nada que o deploy já subiu:

   ```bash
   for par in exp-01-instanooria:exp08ef1b \
       exp-03-unoogpt:exp02em1b exp-04-o-que-a-foto-conta:exp01ef1b \
       exp-06-rastro-boato:exp06ef2b exp-08-manifesto-ia:exp08ef4b \
       exp-70-vila-do-lume:app-70-vila-do-lume exp-90-plano-de-aula:app-90-plano-de-aula \
       exp-91-bem-estar:app-91-bem-estar exp-92-plano-de-ensino:app-92-plano-de-ensino; do
     gcloud storage cp -r -n "gs://{contrato}-exp/${par%%:*}/*" "gs://{contrato}-exp/${par##*:}/" --project {projeto}
   done
   ```

   O 5º ano não está na lista, de propósito: a primeira versão da missão dele
   nunca chegou a bucket nenhum e saiu da trilha (ADR-114), e a que entra no
   lugar nasce direto no prefixo novo, a partir da 0.2.0. Copiar o prefixo
   antigo não traria nada — e, se trouxesse, poria bundles da versão retirada
   no caminho da nova.

   O 4º ano também não está, e este é o par que MAIS importa deixar de fora: o
   UnooTube foi ARQUIVADO (ADR-116) e o código `exp04ef1b` passou ao Jornal da
   Escola, que nasce na 2.0.0. Copiar `exp-02-unootube/*` para `exp04ef1b/` poria
   os bundles 1.x do UnooTube no caminho do Jornal. Arquivada não é publicada nem
   ativada (o `deploy.yml` pula `backup-*`), então os bundles antigos do UnooTube
   ficam onde estão, sem uso.

   O 7º ano também não está, pelo mesmo motivo: o Eco no Grupo saiu (ADR-113) e
   o código `exp07ef1b` passou à A Seleção, que nasce na 1.0.0. Copiar
   `exp-07-o-eco-no-grupo/*` para `exp07ef1b/` poria os bundles 0.1.x do Eco no
   caminho dela. Os do Eco não servem a ninguém depois da migration
   `20260925180000_remover_eco_no_grupo`; apague-os DEPOIS de ela rodar no
   contrato (antes, o hub ainda pode apontar para eles):

   ```bash
   gcloud storage rm -r "gs://{contrato}-exp/exp-07-o-eco-no-grupo/" --project {projeto}
   ```

   Do lado do Terraform, nada carrega o código de experiência (conferido no
   repo de infra em 2026-09-26): as métricas de log e os alertas são da
   plataforma (`codigo=erro-interno`, por serviço do Cloud Run), e o uptime
   check `{contrato}-exp-ativa` da tabela acima ainda não foi provisionado —
   quando for, aponta para o prefixo novo (`exp08ef1b/`).

   **A api precisa de `CDN_EXP_URL`** (a mesma base do
   `NEXT_PUBLIC_CDN_EXP_URL` do hub) para conferir, com um HEAD no
   `index.html`, se a versão que o painel está ativando existe no bucket.
   Ausente, a ativação acontece e a tela DIZ que não deu para conferir — o que
   é aceitável em dev e não em produção: apontar a rede para uma versão que não
   subiu é tela branca para todo mundo. Experiência com
   mídia externa (exp04ef1b) builda com `VITE_VIDEOS_BASE_URL` apontando para a
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

**A base do gerador de missões (2026-10-06, ADR-149).** O workflow
`base-do-gerador.yml` (push em `dev-local` que toca uma fonte) grava em
`gs://entre-redes-dev-base-plataforma/plataforma/` — bucket só da base, que o
Cloud Run do gerador monta para leitura em `/app/base-plataforma` (até 07/10/2026
era o prefixo `base-plataforma/` do bucket das sessões do gerador, que o listava
como missão e o apagou duas vezes pelo botão de excluir). Espera: (1) o environment
**`base-do-gerador`** no GitHub, com as vars `WIF_PROVIDER` e `DEPLOY_SA` (o
`dev` não serve: a deployment branch policy dele só aceita `dev`); (2) a SA do
deploy de dev com escrita SÓ no bucket da base (`gerador_missoes.tf`, no repo da
Fundação); (3) o pool WIF aceitando o workflow vindo de
`dev-local`. Sem qualquer um dos três o job falha no `auth` ou no `cp`, e o
gerador continua lendo a base anterior — o `atual.json` só sobe depois da pasta.
