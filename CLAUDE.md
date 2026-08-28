# CLAUDE.md — Plataforma Unooria

Você está trabalhando no monorepo da **Plataforma Unooria**, uma plataforma
educacional B2G (governo). Leia este arquivo inteiro antes de qualquer tarefa.
Em conflito entre este arquivo e uma suposição sua, este arquivo vence.

## Contexto de negócio (não violar)

- Cliente: redes públicas (estado/município). **1 contrato = 1 stack de infra GCP**
  (provisionada por Terraform em repo separado). Dentro de um contrato, 100+
  escolas compartilham a stack com **isolamento lógico por `escola_id`**.
- Escala alvo por contrato: ~10k alunos, picos de 2-4k simultâneos (8h da manhã).
- Produto: hub (Next.js) que embeda 48 experiências imersivas (Vite, estáticas)
  do 1º ano EF ao 3º EM.
- Prazo: produção em novembro/2026. Uma pessoa desenvolve. Simplicidade > sofisticação.

## Arquitetura (resumo operacional)

| Peça | Stack | Deploy |
|---|---|---|
| `apps/hub` | Next.js (App Router) | Cloud Run |
| `apps/api` | NestJS + Postgres (Cloud SQL) | Cloud Run |
| `apps/experiencias/*` | Vite + React + `@edu/sdk` | Cloud Storage + CDN (estático) |
| `packages/sdk` | TS puro, zero deps pesadas | consumido via workspace |
| `packages/ui` | ponte para `@unooria/design-system` (npm) | consumido via workspace |
| Auth | WSO2 Identity Server via **OIDC genérico** | externo, único p/ vários contratos |
| IA | Vertex Gemini via `apps/api/src/ai` (provider plugável) | dentro da api |
| Telemetria | SDK → `POST /telemetry/batch` → Pub/Sub → worker | |

Experiências NUNCA viram serviços no Cloud Run. São bundles estáticos:
`gs://{contrato}-exp/{expId}/{versao}/`. Rollback = hub apontar p/ versão anterior.

## Regras invioláveis (segurança/tenancy)

1. **Toda query SQL é escopada por `escola_id`** (e `aluno_id` quando aplicável).
   Tabelas de dados de aluno têm `escola_id NOT NULL` + Row-Level Security.
   Nunca escreva uma query que atravesse escolas, exceto em rotas `admin-contrato`.
2. **Nenhum segredo em bundle client** (experiências e hub client-side): sem
   API keys, sem prompts de sistema, sem URLs internas. IA só via `api /ai/*`.
3. **Respostas corretas / correção / pontuação que vale nota: server-side.**
   O client envia a resposta do aluno; a api corrige.
4. **Token**: hub obtém via OIDC (WSO2), repassa à experiência por `postMessage`
   com `targetOrigin` explícito (nunca `*`). Experiência mantém token só em memória.
5. **IA tem quota**: por usuário/dia e POR PERFIL (`AI_DAILY_TOKEN_QUOTA_PER_ALUNO`,
   `AI_DAILY_TOKEN_QUOTA_PER_PROFESSOR` — um plano anual gasta ~220k tokens só de
   prompt) e rate limit por usuário. Nunca exponha chamada de IA sem passar pelo
   `QuotaService` (`temSaldo(escola, usuario, perfil)` ANTES, `consumir` depois).
6. Dados de menores (LGPD): não logar PII em texto claro; telemetria carrega
   `aluno_id` opaco, nunca nome/email.

## Contratos de integração (mudanças aqui exigem cuidado extremo)

### postMessage hub ⇄ experiência (`packages/sdk/src/bridge.ts`)
```
exp → hub : { type: "exp:ready", protocolVersion: 1 }
hub → exp : { type: "hub:init", token, aluno:{id,nome,serie,turmaId,escolaId}, config, apiUrl }
exp → hub : { type: "exp:concluir", payload:{ score?, dados? } }
exp → hub : { type: "exp:token-expirando" }   → hub responde { type:"hub:token", token }
exp → hub : { type: "exp:estado", estado:{...} }   → p/ "chrome" opcional do hub (aditivo v1)
hub → exp : { type: "hub:pause" | "hub:resume" }   → emitidos por visibilidade/foco da página
```
O `blur` da janela do hub NÃO é sempre o aluno saindo: clicar dentro do iframe
move o foco para a experiência e dispara `blur` no documento de cima — e o
`focus` correspondente não volta enquanto ele continuar ali, então um
`hub:pause` ali é DEFINITIVO (o vídeo da exp-02 parava no 1º toque em "Salvar").
Quando o foco foi para a nossa experiência, `document.activeElement` é o próprio
`<iframe>`; o `ExpFrame` não emite nada nesse caso.
Versione com `protocolVersion` (major verificado nos DOIS lados — incompatível
falha alto). Toda mensagem pós-init é validada com Zod nos dois lados; inválida
é descartada com aviso. Nunca quebre compatibilidade sem bump + suporte à anterior.

### Token e emissor (decisão da migração, 2026-08)
O HUB assina os tokens de experiência (RS256, TTL 15min, claims
`{sub, escola_id, turma_id?, perfil}`, aud `plataforma-api`) e serve o JWKS em
`/.well-known/jwks.json`. A api valida via `OIDC_ISSUER`/`OIDC_JWKS_URI` —
trocar para WSO2 = trocar essas envs, o guard não muda. Papéis:
`aluno | professor | gestor | admin-contrato` (admin-contrato é a única exceção
cross-escola). O claim `turma_id` é a matrícula PRINCIPAL do aluno (ver
"Identidade e enturmamento").

### A rede: escola, lotação e CPF (2026-08-28)

**Uma rede estadual não é uma escola grande.** São milhares de unidades,
professores em mais de uma, e crianças que se transferem. A decisão que torna
isso barato é o que NÃO muda: **o token continua carregando UMA escola**. As 31
tabelas com `escola_id` e a política de RLS ficam intocadas, e a regra 1 continua
literalmente verdadeira (ADR-30).

- **`lotacoes`** — pessoa × escola, datado (o termo da rede pública para alocação
  de servidor a uma unidade). **Professor e gestor ACUMULAM**: lotação nova não
  encerra a anterior. **Aluno tem UMA ativa**, garantida por índice único parcial
  no banco — "aluno em duas escolas" é indistinguível de transferência pela
  metade. FORA da RLS pelo mesmo motivo de `users`: é lida no login, antes de se
  saber a escola, e é ela que responde "quais escolas são suas".
- **Escola ativa é estado de SESSÃO.** Quem tem mais de uma escolhe no cabeçalho
  (`components/seletor-de-escola.tsx`); a troca passa por `POST /api/escola-ativa`,
  que valida contra `GET /escolas/minhas` **da api** — nunca contra a lista que o
  cookie carrega. `users.escola_id` é o cache da lotação principal.
- **Criar escola é `admin-contrato` e ninguém mais**, inclusive no `orgs.csv`:
  escola é tenant, e abrir inquilino com RLS e dados de menores por trás não é
  operação de quem administra uma unidade. `/admin/escolas` é a tela.
- **A REGIONAL agrupa; quem autoriza é a lotação** (ADR-34). `escolas.tipo` tem
  vocabulário fechado — `escola` (a unidade, onde há turma, aluno e dado),
  `regional` (Diretoria de Ensino, polo, secretaria municipal) e `rede` (a raiz)
  —, e `pai_id` liga unidade a regional, com trigger no banco recusando pai que
  seja `escola` ou a própria linha. **Estar numa diretoria não dá acesso a nada**:
  a hierarquia serve para MONTAR a lista de escolas que o admin confirma antes de
  conceder (`POST /escolas/lotacoes-em-lote`, que recebe a **lista** de
  `escolaIds`, nunca o critério). Autorizar por hierarquia seria uma segunda fonte
  de verdade sobre acesso, divergente da lotação no dia em que alguém corrigisse
  um pai. Regional e rede **não recebem lotação** — não têm turma nem dado, e
  virariam escola fantasma no seletor do cabeçalho.
  Estas colunas existiram por um tempo sem NENHUMA query que as lesse: era a
  mesma armadilha do `expires_at` sem rotina. Coluna nasce com o consumidor.
- **O supervisor de diretoria não é papel novo**: é um `gestor` lotado nas
  unidades dela. O panorama (`/admin/minhas-escolas`, `GET /escolas/minhas/resumo`)
  **lista, não soma** — uma linha por unidade, com turmas, alunos e quantos ainda
  não fizeram o primeiro acesso. Somar escolas numa métrica só seria exatamente a
  tela que a decisão acima recusa. O item de menu só aparece com mais de uma
  lotação.
- **`users.cpf` é a identidade IMUTÁVEL do estudante** — e o que torna a
  transferência possível: nome, login e matrícula mudam, o CPF não. Guardado como
  **11 dígitos, sem pontuação** (a formatação é da tela; CHECK no banco), **único
  por CONTRATO**, não por escola — é essa unicidade que transforma "esse CPF já
  existe na escola B" em transferência reconhecida.
  **O gestor VÊ o número** (ADR-33): ele confere identidade contra o sistema da
  rede, preenche documento e atende a família no balcão — e a lista de
  `/admin/usuarios` mostra o CPF formatado e busca por ele, com ou sem pontuação.
  CPF é dado pessoal COMUM, não do art. 11 (que é saúde, raça, religião,
  biometria), com base legal clara em contrato de educação pública.
  O que sustenta a decisão não é a coluna, é a **contenção**: `users.cpf` é o
  ÚNICO lugar onde o número existe. Nunca em log (nem em mensagem de erro), nunca
  em telemetria, JSONB, claim de token ou bundle de experiência — e
  `tests/identidade-unica.spec.ts` cobra as duas coisas: que só exista essa
  coluna, e que nenhum JSONB de telemetria/progresso carregue 11 dígitos seguidos.
  Uma versão anterior guardava só o hash; a decisão foi revista porque hash é de
  mão única e o gestor não conseguia ver o número (ADR-31, superada pela ADR-33).
- **Na transferência, o dado FICA e a identidade SEGUE** (ADR-32). Tudo o que a
  criança produziu continua com o `escola_id` de onde foi produzido — verdade
  histórica. O que atravessa é `GET /alunos/:id/historico`: uma porta só, restrita
  a quem tem lotação na escola onde ela está HOJE, devolvendo participações e
  **nunca** o conteúdo dos instrumentos. É também a única operação que troca o
  `app.escola_id` no meio de uma transação — sem isso o update na origem não veria
  linha nenhuma (a RLS o esconderia, sem erro) e a criança ficaria nas duas.
- Na importação, **o CPF é a primeira chave**: achado em outra escola da rede, a
  linha vira transferência (aluno) ou lotação a mais (professor). Reimportar não
  troca a senha de quem já entrou.

### Perfil portátil: sair da REDE (2026-08-28)

**Transferir é dentro do contrato; o perfil portátil é para FORA dele.** A
criança que vai da rede estadual para a municipal sai da instalação — outro
contrato, outro banco, nenhum JOIN — e **não há garantia de que o destino comprou
o produto**. Por isso a saída é um DOCUMENTO ASSINADO, não uma integração
(ADR-35): `{ perfil, assinatura }` em JSON, emitido a pedido do titular (LGPD
art. 18, V) e importado como ato da escola de destino. Numa rede que nunca vai
instalar a plataforma, o mesmo arquivo continua legível.

- **O hub assina; a api verifica.** A chave é a MESMA dos tokens de experiência
  (`lib/chave-token.ts`, JWKS em `/.well-known/jwks.json`) — nenhum material novo
  entrou —, e `aud: "perfil-portatil"` separa os dois usos. Verificar é na api
  porque é o passo que **não pode confiar em quem chama**.
- **A assinatura cobre o HASH CANÔNICO**, não o documento como payload: o arquivo
  vai para a FAMÍLIA e precisa ser legível. `jsonCanonico` (chaves ordenadas
  recursivamente) existe nos DOIS lados — `apps/api/src/portabilidade/regras.ts` e
  `apps/hub/lib/perfil-portatil.ts` —, e a duplicação é deliberada: emissor e
  verificador são instalações diferentes, em versões possivelmente diferentes. Um
  **fixture de hash** afirmado nos dois testes derruba um deles se as
  implementações divergirem.
- **Assinatura inválida é RECUSA; emissor inalcançável é rótulo.** A classificação
  é pelo `code` da jose, NUNCA pelo texto: "signature verification failed" contém
  "failed", e uma versão anterior classificava documento FORJADO como "não deu
  para conferir". `PORTABILIDADE_EMISSORES` (origens https) é allowlist contra
  SSRF — o `emissor.hub` vem de dentro do arquivo. Vazia = tudo entra
  `nao-verificada`, e a tela sai em âmbar.
- **O que vem de fora NUNCA se mistura**: vive só em `perfis_portateis`, não vira
  matrícula, progresso nem perfil da Vila, e não entra em média. É a afirmação de
  outra instalação, possivelmente de outra `VERSAO_MAPEAMENTO`.
- **Importar não cria aluno**: liga pelo CPF a quem já está aqui. Matricular é ato
  da escola (planilha ou OneRoster); o perfil se anexa depois.
- **`perfis_portateis.documento` é a ÚNICA exceção à contenção do CPF** (ADR-33):
  o número é o conteúdo do documento, e alterá-lo destruiria a assinatura. A
  exceção está numa lista explícita em `tests/identidade-unica.spec.ts`, que varre
  todo JSONB do schema procurando os CPFs QUE EXISTEM — não "onze dígitos", que
  casa com qualquer `Date.now()`.
- **Bem-estar (exp-91) nunca entra no documento**: dado de saúde, posse do
  professor, sem rota de gestor em lugar nenhum. Documento que o gestor emite não
  carrega o que nem o gestor lê.
- Envs: `CONTRATO_ID` + `CONTRATO_NOME` no hub (sem o primeiro, a emissão é 503);
  `PORTABILIDADE_EMISSORES` na api. Tela: `/admin/turmas/:id` → "Perfil portátil".

### Identidade e enturmamento (2026-08-28)

**Uma conta por PESSOA, a mesma no hub e em todas as experiências.** As
experiências vieram de projetos onde cada atividade tinha cadastro próprio; a
unificação técnica já existia (todas recebem `aluno.id` pelo `hub:init` e gravam
`aluno_id` com FK para `users`), mas a conta era de ASSENTO — está escrito no
schema: `exp_01_runs.nome_no_app` existe *"porque a conta é do APARELHO: outra
turma reusa o mesmo login"*. `nome_no_app` continua existindo como APELIDO dentro
da ficção do Instanooria, nunca como identidade em tela de professor ou
relatório. O teste `tests/identidade-unica.spec.ts` falha se alguém criar uma
segunda tabela de credencial ou uma coluna de pessoa sem FK para `users`.

**O modelo é isomórfico ao OneRoster 1.2, com nomes em pt-BR** — `periodos_letivos`
(≈ `academicSessions`) e `matriculas` (≈ `enrollments`: usuário × turma × escola,
com papel, `principal`, `inicio`/`fim`). O padrão vive SÓ na fronteira
`apps/api/src/rostering/`, como o vendor de IA vive em `src/ai`: nada do domínio
conhece `sourcedId`, e o `hub:init` não muda (ADR-28).

- **A chave da pessoa é `users.matricula_externa`** (o RA da rede), com índice
  único parcial por escola. Sem ela o upsert cai no `username`, e corrigir um
  login cria um segundo aluno com o histórico preso no primeiro.
- **`users.turma_id` sobrevive como CACHE da matrícula principal.** O login e o
  claim `turma_id` o leem antes de haver escola no contexto, onde `matriculas`
  (que tem RLS) não é alcançável. A verdade é `matriculas`.
- **Turma vive dentro de um período letivo**: `UNIQUE (escola_id,
  periodo_letivo_id, nome)`. O "8A de 2026" e o "8A de 2027" são turmas
  DIFERENTES — é isso que impede a virada do ano de reescrever o histórico de
  2026 em silêncio.
- **`matriculas.papel` só admite `aluno` e `professor`.** Gestor é papel da
  ESCOLA (o `roles.csv` do padrão), não matrícula de turma — e é por isso que ele
  continua vendo a escola inteira. "Coordenação" é `gestor`: `PAPEIS` é contrato
  congelado, e o CSV aceita sinônimos (`coordenacao`, `diretor`, `principal`).
- **As turmas do professor são as em que ele tem matrícula.** `comum/turmas-do-professor.ts`
  (`ondeAsTurmasSaoVisiveis`, `professorLeciona`) é a porta única; os seletores do
  UnooTube, da Vila e do unooGPT passam por ela. Antes, qualquer professor abria
  bem-estar e Vila de qualquer turma da escola, porque a única prova exigida era
  "mesma escola", que é a regra de tenancy e não a de quem dá aula ali.
- **ARMADILHA**: query que leia `matriculas` fora de `comTenancy` volta VAZIA, em
  silêncio. O sintoma é lista de pessoas "sem turma".
- Sair da turma é `fim`, não `DELETE`; sair da rede é `ativo = false`. Há dado de
  aluno pendurado em oito tabelas. Mover de turma (`PATCH /matriculas/:id` com
  `turmaDestinoId`) é UM passo: à mão, o gestor tira da antiga e esquece de pôr
  na nova, e o aluno fica sem turma — invisível para o professor, sem nada na
  tela dizendo o que faltou.

**Entrada de pessoas**: `POST /rostering/importar` (gestor/admin), corpo
`text/csv` cru, até 10MB/50k linhas. Planilha de UMA linha por pessoa, cabeçalho
lido por NOME (ordem livre; coluna desconhecida é erro, não coluna ignorada):
`matricula,nome,usuario,email,papel,turma,serie,turno` — só `nome` e `papel` são
obrigatórios (aluno também exige `turma`+`serie`). `usuario` vazio ⇒ o login é
gerado e devolvido no relatório. O header legado
`nome,usuario,senha,papel,turma,serie` continua aceito, e
`POST /usuarios/importar-csv` delega. O modelo para download
(`GET /rostering/modelos/usuarios.csv`) é gerado da MESMA constante que o parser
lê — modelo escrito à mão divergiria no primeiro campo novo.

**OneRoster CSV** (para rede COM sistema de gestão):
`POST /rostering/oneroster/:arquivo`, **um arquivo por chamada**, na ordem
`manifest → orgs → academicSessions → classes → users → enrollments → roles`,
com `?modo=bulk|delta`. Fora de ordem não corrompe: a linha que aponta para um
`sourcedId` inexistente volta no relatório dizendo QUAL arquivo falta. Quatro
regras que não são óbvias: `orgs.csv` só APRENDE o código INEP desta escola
(escola é tenant, não nasce de upload); sem a coluna `role` (que saiu de
`users.csv` na 1.2) a pessoa entra como **aluno**, o menor privilégio, e o
`roles.csv` corrige; a coluna `password` do padrão é IGNORADA e a contagem vai ao
relatório; e em `bulk` a ausência de linha **não desativa ninguém** — é contada e
listada, porque lote que chegou pela metade não pode apagar uma rede por omissão.
`status = tobedeleted` desativa (pessoa) ou encerra (matrícula), nunca apaga.

**Contas de assento**: `GET /rostering/contas-de-assento` lista as contas sem
`matricula_externa` com quanto cada uma acumulou de dado, para o gestor desativar
o que era conta de aparelho. **Não existe fundir contas** — juntar duas move o que
uma criança fez para outra pessoa, e depois ninguém audita de quem era. Teto de
200 linhas, dito na resposta (`truncado`).

**Senha (ADR-29)**: a planilha NÃO tem coluna de senha. A senha inicial é
escolhida na tela (uma para o lote, ou uma por pessoa — recomendada para alunos),
marca `senha_provisoria` e o primeiro acesso cai em `/trocar-senha` sem saída. A
trava é TRIPLA: middleware, BFF e `/api/exp-token` — só com o middleware,
bastaria digitar `/exp/...` para pular. Ao trocar, a sessão é REFEITA com a senha
nova (novo `signIn`), não remendada: o cookie antigo ainda diz "precisa trocar", e
sem refazê-lo a pessoa volta à mesma tela com a senha anterior já inválida.
Reimportar NÃO reseta a senha de quem já entrou. Os usuários do seed nascem com
`senha_provisoria: false` — prendê-los na troca pararia os sete walkthroughs.

**Área administrativa** (gestor/admin-contrato): `/admin/usuarios` (busca,
filtros, editar, ativar/desativar, reset), `/admin/turmas` e `/admin/turmas/[id]`
(enturmamento, mover, tornar referência), `/admin/importar` e
`/admin/periodos-letivos` (o calendário do contrato — a tela da virada do ano). O
professor tem `/professor/turmas` e `/professor/turmas/[id]` — as turmas dele, com
os alunos nominais.

**A virada do ano tem duas etapas, e nenhuma é automática:** criar o período novo
em `/admin/periodos-letivos` (a partir da data de início ele passa a ser o
vigente, e toda turma nova nasce nele) e importar o enturmamento do ano seguinte.
As turmas e matrículas do ano anterior ficam onde estão — é isso que preserva o
histórico. `vigente` é DERIVADO das datas, nunca coluna.

### Telemetria: dois canais, não um (decisão da migração)
- **Operacional (motor)**: `POST /runs/:id/eventos` e `GET /runs/:id/feed` —
  síncrono, transacional, lido em tempo quase real para curar o próximo bloco.
  Dwell NUNCA passa por Pub/Sub: latência e falta de ordenação quebrariam a
  adaptação e o lock por run.
- **Analítico (SDK)**: `track()` → batch 50/10s → `POST /telemetry/batch` →
  Pub/Sub → push subscription → `POST /telemetry/ingest` → `telemetria_eventos`
  (`ON CONFLICT DO NOTHING`: o Pub/Sub entrega *at least once*). No `pagehide`,
  `POST /telemetry/beacon` com o token no CORPO — `sendBeacon` não manda header.
  `/telemetry/ingest` não tem OidcGuard (quem chama é o Pub/Sub) e por isso tem
  o `PubSubPushGuard`: ID token do Google, `aud` == `TELEMETRIA_PUSH_AUDIENCE`,
  `email` == `TELEMETRIA_PUSH_SA`. Envs ausentes = rota 401, nunca aberta.
  **Destino: Postgres, não BigQuery** (decisão de 2026-08-27). O canal analítico
  fica no mesmo banco: se um relatório precisar dele um dia, é um JOIN local com
  `turmas`/`users`, e é uma plataforma de dados a menos para operar. O que
  sustenta isso na escala são duas coisas, e nenhuma delas é um serviço novo:
  o `INSERT` do `ingest` é **multi-linha** (um lote de 50 custava 50
  round-trips; no pico de ~4k simultâneos isso era ~800 INSERTs/s numa
  instância pequena) e `telemetria_eventos` é **particionada por mês**
  (`particoes.telemetria_eventos_YYYY_MM`, migration
  `20260827100000_telemetria_particionada`).
  **Nada de Redis como buffer.** Quem amortece o pico já é o Pub/Sub — e ele é
  DURÁVEL: um buffer em memória perde os eventos do processo que morre antes do
  flush. Redis só entra com gargalo medido, e o gargalo medido aqui era o laço
  de INSERT.
  A PK é `(event_id, ts)` porque o Postgres exige a chave de partição em índice
  único; a dedupe segue correta (reentrega da mesma mensagem traz o mesmo `ts`).
  As partições vivem no schema `particoes`, fora do alcance do Prisma — em
  `public` cada uma viraria drift. Há uma partição DEFAULT como rede de
  segurança: sem ela, evento com `ts` fora das faixas seria RECUSADO, e
  telemetria perdida em silêncio é pior que telemetria mal guardada. Ela
  encher é sinal de que faltou criar partição — não há job agendado nesta
  plataforma, de propósito, e as faixas vão até 2028-12.

### Manifesto de experiências (tabela `experiencias` na api)
O CI, ao publicar `gs://{contrato}-exp/{expId}/{versao}/`, faz upsert
(`PUT /experiencias/:expId`, admin-contrato) lendo o `public/experiencia.json`
da experiência (`id, nome, versao, series, capabilities, viewport?, publico?`).
O hub monta a URL do iframe com `versaoAtiva`; rollback = trocar `versaoAtiva`
(`node apps/hub/scripts/publicar-manifesto.mjs <exp> --versao x.y.z`).
`viewport` presente ⇒ o hub embeda dentro do `DispositivoFrame` (casca de
aparelho com escala; exp-01 é 375×812, exp-02 não tem viewport porque foi
desenhada para desktop). SEM linha na tabela, o `viewport` é lido do
`experiencia.json` servido ao lado do index do bundle — não só em dev: uma
stack com a tabela vazia (compose local, ambiente novo antes do 1º publish do
CI) servia o Instanooria esticado na janela em vez do aparelho. Essa leitura é
server-side (o público `NEXT_PUBLIC_CDN_EXP_URL` é o endereço do BROWSER), então
em container use `EXP_INTERNAL_HOST` — que troca só o HOST e PRESERVA a porta,
porque em dev cada exp tem um dev server numa porta diferente e um
`EXP_INTERNAL_URL` fixo faria as três lerem o manifesto de uma só (o UnooTube,
sem `viewport`, apareceria dentro do aparelho da Instanooria). `EXP_INTERNAL_URL`
continua valendo para quando há UMA origem de bundles (o CDN, em produção).
Os dev servers das exps declaram `allowedHosts: ["host.docker.internal"]`: o
Vite 5.4+ recusa `Host` que não conheça, e sem isso o hub em container não lê o
manifesto e a experiência aparece esticada na janela.
`permissoes` (aditivo) lista o que o IFRAME daquela experiência precisa — hoje
`pointer-lock` e `forms`, que o `ExpFrame` traduz nos tokens
`allow-pointer-lock` e `allow-forms`. **`forms` custou um bug inteiro para ser
descoberto**: o `Composer` do DS é um `<form>`, e sem o token o navegador BLOQUEIA
o submit — o aluno da exp-03 digitava a pergunta, apertava Enter e nada
acontecia. O sintoma engana porque a conversa parece viva (a fala de abertura do
agente já está na tela) e o único rastro é um aviso de console sobre "form's
frame is sandboxed". Typecheck, lint e a primeira versão do smoke passaram por
cima disso.
Vazio (o default) = nenhuma, que é o que toda experiência tinha antes. É POR
EXPERIÊNCIA de propósito: prender o ponteiro do aluno é capacidade de quem
declarou, não default do frame. Medido em `scripts/probe-pointerlock.mjs`: num
iframe com sandbox, sem o token o `requestPointerLock()` morre com `SecurityError`
e com ele funciona — e o Chromium do Playwright não concede pointer lock nem no
topo da página, então essa verificação exige o Chrome do sistema.
`series: []` significa **todas as séries**, não nenhuma: é assim que uma
experiência TRANSVERSAL se declara (exp-70). Quando o filtro por série voltar a
valer, vazio tem de continuar querendo dizer "todas" — o contrário faz a
experiência desaparecer da tela sozinha.
`publico: "professor"` ⇒ ferramenta do professor
(exp-90-plano-de-aula em `/professor/plano-de-aula`; exp-91-bem-estar em
`/professor/bem-estar`), e `/exp/*` responde 404 para elas. Sem manifesto (dev) o hub cai na raiz do Vite **da
experiência mapeada em `apps/hub/lib/experiencias-dev.ts`** (uma porta por exp:
5173 exp-01, 5174 exp-02, 5175 exp-90, 5176 exp-91, 5177 exp-70, 5178 exp-03);
teste local: rota `/dev-embed?src=http://localhost:5174`.
A montagem do embed (token, manifesto, dev server, origin) é uma só:
`apps/hub/lib/embed-experiencia.ts`, usada por `/exp/[expId]`, `/dev-embed`,
`/professor/plano-de-aula` e `/professor/bem-estar`.
O aluno tem hub próprio (`/aluno`): ele ESCOLHE a missão, sem filtro por série
por enquanto (`apps/hub/lib/missoes-do-aluno.ts`, derivado do catálogo do Entre
Redes; a série volta a filtrar quando o manifesto virar a fonte). Missão só
aparece lá se tiver copy de aluno (`missao.aluno` no catálogo) — a copy do
professor entrega a virada. `/aluno` e `/exp/*` são a MESMA área no middleware
(`lib/papeis.ts`). A trilha do professor cobre a Educação Básica inteira
(1º–9º ano + 3 séries do EM), 4 unidades por ano.

**Header: um só para todos os papéis.** `components/header-plataforma.tsx`
(marca → home do papel, nome + série/papel, avatar, Sair) é o header de
`/aluno`, `/professor`, `/admin`, `/analise` E de `/exp/*` — antes cada área
copiava o seu e a experiência não tinha nenhum. A casca visual (CSS do DS,
compensações, fontes) saiu do layout do grupo `(plataforma)` para
`components/casca-plataforma.tsx`, porque `/exp/*` e `/dev-embed` estão fora do
grupo e também precisam dela. A regra de ouro passou a valer um nível abaixo: o
header é chrome do HUB, desenhado ACIMA do aparelho — dentro do iframe nada da
marca institucional entra.

### Evento de telemetria (inspirado em xAPI, simplificado)
```json
{ "eventId": "uuid", "ts": "ISO", "alunoId": "...", "escolaId": "...",
  "expId": "exp-01", "expVersion": "1.2.0", "sessaoId": "uuid",
  "verbo": "completed|attempted|interacted|scored|...",
  "objeto": "fase-3", "resultado": { }, "contexto": { } }
```
SDK preenche tudo exceto `verbo`, `objeto`, `resultado`. Batch de até 50, flush 10s.

### Provider de IA (`apps/api/src/ai/provider.ts`)
Interface única `AiProvider { generate(req): Promise<AiResult> }`. Implementações:
`vertex.provider.ts` (default), `mock.provider.ts` (testes). Para trocar de
provedor, cria-se novo arquivo — nada fora de `src/ai` conhece o vendor.
`AiRequest.modelo: "padrao" | "longo"` escolhe a família (o `longo` mapeia para
`VERTEX_MODEL_LONGO`, Gemini 2.5, saída até 65k — planos anuais); quem gera texto
longo checa `AiResult.finishReason` (`MAX_TOKENS` = conteúdo cortado, é erro).

**Credencial: ADC, nunca chave de API.** O provider pega o token com
`google-auth-library`, que resolve na mesma ordem nos três ambientes:
`GOOGLE_APPLICATION_CREDENTIALS` → arquivo do `gcloud auth application-default
login` → metadata server (Cloud Run). Antes daqui só havia o metadata server, e
por isso NENHUMA chamada de IA funcionava fora do Cloud Run — nem no host nem no
container, onde `metadata.google.internal` não resolve; em dev a api ficava presa
no `AI_PROVIDER=mock` e a exp-90 devolvia um plano falso. Os dois compose montam
o ADC do host em `/adc` (só leitura); em Cloud Run a service account do serviço
já é a credencial, e ela precisa de `roles/aiplatform.user`.

**Modelo × região (decisão, 2026-08).** O modelo é `gemini-3.6-flash` e a
localização é `global` — para texto E para o plano de aula. Medido no projeto do
contrato: o 3.6-flash dá 404 em `southamerica-east1`, `us-east1` e `us-central1`;
só o endpoint `global` (sem host regional) o serve. A consequência é explícita e
foi aceita: o tráfego de IA sai de São Paulo, inclusive o do aluno. Voltar para
`VERTEX_LOCATION=southamerica-east1` é possível a qualquer momento, mas exige
trocar TAMBÉM o modelo pelo que a região publica (família 2.5 — a 2.0 saiu do
catálogo e a 3.x nunca esteve lá). A arte da exp-01 usa `gemini-3.1-flash-image`
(o `gemini-2.0-flash-exp` que era o default não existe mais em lugar nenhum, e
por isso toda geração de imagem caía no fallback procedural), e PEDE a proporção
`4:5` no `imageConfig`: sem isso o 3.1 devolve 1408×768 e o `cover` do
`AssetsService` (1080×1350) descarta mais da metade da largura. O modelo aceita
1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9 e 21:9 pelo MESMO custo em tokens —
experiência com outro formato deve pedir o formato, não recortar depois.

**Raciocínio conta como saída.** Nos modelos 2.5 e 3.x os tokens de pensamento saem do
`maxOutputTokens`: com pensamento livre o plano anual voltava VAZIO com
`finishReason: MAX_TOKENS`. `VERTEX_THINKING_BUDGET` (default `0`, desligado)
mantém a paridade com o app origem, que usava Claude sem essa etapa; `-1` volta
ao dinâmico.

### Plano de aula (exp-90, `apps/api/src/planos`)
Ferramenta do professor: `POST /planos` (202) gera em background (claim atômico
em `planos_de_aula`, `marked` roda na api), o cliente faz polling em `GET /planos/:id`.
Conteúdo em object storage PRIVADO (`{contrato}-planos`; `PLANOS_DRIVER=local`
em dev → `storage-privado/`): `gerado.md` imutável + `atual.html` do editor
(sanitizado com allowlist). Referências curriculares = texto no Postgres
(`planos_referencias`, catálogo do contrato, sem RLS), importadas por
`scripts/importar-referencias-plano.mjs` com `PLANOS_IMPORT_TOKEN`.
O teto de saída é 64k tokens, não os 32k do app origem (que eram o limite do
Claude): com o material real (currículo da rede + as 4 unidades do ano, ~190k
tokens só de prompt) o gemini-2.5-flash é cortado em 32k e o professor recebe
"o plano ficou grande demais" sem plano nenhum.

### Vila do Lume (exp-70, `apps/api/src/vila`)
Jogo 3D **transversal** — não pertence a ano nenhum (`series: []`), e é o "Ato 1"
que o catálogo do Entre Redes sempre descreveu: *"fora da plataforma, um jogo
mede o perfil de valores do aluno"*. O perfil dele alimenta `perfis_importados`
(a largada do Instanooria) — M5.

**Duas leituras de uma partida, e elas NÃO SE TOCAM.** O retrato Schwartz
(`mapeamento.ts`, 10 valores + 2 eixos) lê escolhas com custo dentro do jogo; a
missão "A Noite Longa" (`mensagens.ts`) lê julgamento sobre 5 mensagens. A
separação é de MEDIDA: um golpe que custasse fagulha faria a criança que caiu
aparecer como menos generosa no retrato, e nada no relatório mostraria isso.

**O servidor recalcula; nunca aceita o perfil do cliente.** O jogo sabe computar
o retrato e deliberadamente não o envia — `CHAVES_DE_PERFIL` no contrato recusa
payload que traga. É isso que permite reprocessar o histórico quando
`VERSAO_MAPEAMENTO` subir (hoje 3, herdada do piloto para os dados serem
comparáveis).

**`grau` é invariante de API, não regra de tela.** Valor com UMA fonte de medida
não recebe número. A api devolve linhas em que só a variante `scored` tem
`numero: number`; as outras têm `null` POR TIPO (`leitura.ts`). O hub fica
estruturalmente incapaz de imprimir "Poder 100" a partir de um sinal só. E a
diferença entre `zero` ("teve a chance e não foi", entra na média) e `none` ("a
oportunidade não chegou", sai da conta) é a coisa mais importante do modelo.

**A bolha é do SERVIDOR.** `POST /vila/sessoes` atribui A/B/C balanceada dentro
da TURMA, persiste em `vila_bolhas` (estável entre partidas: a folha do professor
diz "esse estava na C") e devolve os cartões — **só os desta criança e sem
gabarito**, como o `factual` do UnooTube. Era `alunoSlot % 3` no navegador, o que
punha no bundle a condição do próprio instrumento e deixava as três versões
legíveis antes da aula. Nos anos iniciais (1EF–5EF) a bolha B não é servida
("suporte" exige entender o que é suporte) — regra que só a api pode aplicar,
porque só ela sabe a série. O lock consultivo por turma não é zelo: a sala clica
junto, e sem ele os 25 caem todos na bolha A.

**O relatório abre pelo NÍVEL, antes do que ela fez.** "Caiu em 2 de 3" sem dizer
que era o nível C faz o adulto concluir que a criança é ingênua — o rótulo que
este projeto existe para não produzir.

**`cartoesServidos` ≠ `apareceram`.** O primeiro é quantos a api entregou; o
segundo, quantos chegaram a aparecer. Zero aparecidos ⇒ a tela diz "as mensagens
não chegaram nesta partida", **nunca** "ela ignorou tudo" — é a mesma distinção
entre `zero` e `none`.

**Sem tabela de evento fino.** O bruto vive em `vila_sessoes.payload` (fonte do
reprocessamento) e o canal analítico do SDK já grava em `telemetria_eventos`.
`eventos[].dados` só aceita número, booleano ou string de um **vocabulário
fechado** — o `texto` livre que existia era o único canal de texto arbitrário do
payload, e o caminho por onde o nome de uma criança chegaria a um JSONB de 90
dias. Trava estrutural, não lista de proibidos.

**Telas do professor** (`/professor/entre-redes/vila-do-lume`): ficha (para que
serve, quem consome o perfil, passo a passo), `/guia` (o debate),
`/resultados?turmaId=` (com o botão de **zerar a turma**) e `/alunos/:id`.

**O `/guia` precisa saber a TURMA.** Nos anos iniciais a api não serve a bolha B,
e uma tela que projetasse as três mandaria o professor esperar a reação de um
grupo que a sala dele não tem — `GET /vila/professor/cartoes?turmaId=` filtra
pela mesma regra de `abrir` (`bolhasElegiveis`).

**Zerar a turma apaga as BOLHAS junto.** Rodar de novo com a mesma bolha serviria
à criança o mesmo golpe: ela reconhece, e a segunda rodada não mede nada. O que
NÃO é tocado é `perfis_importados` — aquilo pertence à atividade do Instanooria, e
apagar de lá trocaria os lados de uma aula em andamento. O `/guia` projeta as mensagens das TRÊS bolhas lado a lado — é a
revelação da missão, e a primeira vez que a turma vê as outras versões. Os textos
vêm de `GET /vila/professor/cartoes` (COM gabarito, professor only), nunca de
cópia no hub: os textos SÃO o instrumento, e uma vírgula divergente entre o que o
jogo serviu e o que o professor projeta põe a sala discutindo uma mensagem que
ninguém recebeu. A LISTAGEM da
turma não mostra valor de Schwartz nenhum — listagem é ordenável, e uma coluna
"Poder" viraria ranking de crianças; os valores vivem na tela individual, uma
criança por vez, com o grau ao lado. O agregado (`/vila/agregado/*`) abre para
gestor; a linha de uma criança, não — são controllers separados, e não um
`@Roles` misto com exceção por método.

**Dois avisos do repo de origem sobre o DS estão OBSOLETOS na 0.1.11**, medidos
no pacote: o `MetricCard` **não inventa mais tendência** (o prop é `tagText?` e a
doc diz "sem ela a etiqueta não é renderizada"), e o `PositiveNegativeBarChart`
tem escala **fixa** em ±100 (`h = (val / 100) * 110`) — é exatamente o que os
eixos do circumplexo pedem, então a barra divergente NÃO é mais escrita à mão. O
terceiro segue valendo: `AlertBox` é diálogo de 436px; para faixa de contexto,
`FeedbackAlert` (o prop é `type`, não `variant`).

**Cor da plataforma vem de classe escrita à mão** em
`packages/ui/styles/plataforma.css`, e o tema do Tailwind está VAZIO
(`theme.extend: {}`). Classe de cor que não existe ali não é erro em lugar
nenhum: em texto ela herda a cor e passa desapercebida, em FUNDO o elemento fica
branco no branco. Foi o que aconteceu com `bg-unooria-neutral-900` (letra da
bolha invisível). O smoke da exp-70 checa o `backgroundColor` COMPUTADO do
círculo por isso — `toBeVisible()` não pega. Só existem hoje:
`bg-unooria-{navy-800,neutral-50,neutral-100,neutral-200}`,
`border-unooria-neutral-200`,
`text-unooria-{danger,navy-900,neutral-500,neutral-700,neutral-800,neutral-950}`.

**Ato 1 do Instanooria: deixou de ser externo.** `POST
/atividades/:id/perfis/da-vila` (professor) colapsa o perfil da Vila nos quatro
quadrantes e grava em `perfis_importados` com `origem: "jogo"` — é o que decide
de que lado o feed nasce (`largada.ts`). `PERFIL_IMPORT_TOKEN` e
`POST /perfis/importar` continuam vivos como compatibilidade.
O colapso (`vila/quadrantes.ts`) tem duas travas que CUSTAM alunos, de propósito:
valor não observado (`indicative`/`none`) **fica fora da média**, nunca entra como
zero; e quadrante sem nenhum membro observado **invalida o perfil inteiro** —
sem perfil, o Instanooria cai no sorteio balanceado, que é honesto sobre não
saber. Exige `amostraSuficiente`: o `dominante` vira coluna no CSV do `/analise`
ao lado da identidade da criança, e deixar uma partida curta decidir isso seria
dizer pelas costas o que o relatório se recusa a dizer na frente.
O disparo é do PROFESSOR e `ladoForcado` é PRESERVADO no upsert: importar
sozinho, ou levar o objeto inteiro no `update`, desfaria em silêncio uma
redistribuição que ele fez antes da aula.

**Retenção: NÃO HÁ PRAZO DECLARADO** (decisão de 2026-08-26). Houve um
`expires_at` de 90 dias no schema e nenhuma rotina que o cumprisse — e coluna de
prazo que ninguém lê é pior que prazo nenhum, porque quem lê o schema acredita
nela. É a mesma armadilha do `turmas.consentimento_em` do app de origem: a regra
saiu do código, a coluna ficou, e todo mundo continuou acreditando.

O que se ganha em troca é o REPROCESSAMENTO, que é requisito de verdade deste
instrumento: `payload` é a única fonte para recomputar o perfil quando
`VERSAO_MAPEAMENTO` subir, e o mapeamento é hipótese de design que VAI mudar.
90 dias matavam exatamente a comparação entre duas gerações.

Se um contrato exigir prazo, ele volta **junto com a rotina que o cumpre** —
nunca só a coluna. A mesma pergunta está aberta para `telemetria_eventos`, que
guarda evento por `aluno_id` de todas as experiências e também não tem prazo: se
a resposta importar, ela é da plataforma inteira, não de um módulo.

## Design System (`@unooria/design-system`) — a fonte da interface

**Regra: todo elemento de interface do hub e das experiências vem deste pacote,
sempre na última versão publicada.** É npm PÚBLICO no escopo `@unooria` (sem
registry privado, sem `.npmrc` no repo); a fonte é o repo `storybook-unooria`
(Storybook em `:6007`, publicado por tag `v*` no GitHub Actions). Componente de
UI novo se escreve LÁ e chega aqui por versão — não em `packages/ui`, não dentro
de uma experiência. Antes de criar um botão, um card, um campo: procure na seção
correspondente do pacote, ela provavelmente já tem.

`^0.1.11` **não** pega `0.2.0` — caret em `0.x` só sobe patch. "Última versão"
portanto é ativo: `pnpm up -r @unooria/design-system --latest`, commitando o
lockfile e os `package.json` juntos.

**Duas famílias no mesmo pacote, e elas nunca se cruzam.** A separação é a mesma
da regra de ouro do embed: a marca institucional é chrome do HUB, e dentro do
iframe a fidelidade é ao clone que a experiência imita. Um `Button` da plataforma
no feed do aluno quebra a ilusão que a experiência está medindo.

| Seção | Import | CSS | Tokens / tema | Onde vale |
|---|---|---|---|---|
| `unooria` (39) | raiz do pacote | `/unooria.css` | `--unooria-*`, classe `.unooria-theme-light\|dark` | hub (login, `/professor`, `/admin`, `/analise`), header de todos os papéis, telas pós-revelação do aluno |
| `instanooria` (21) | `/instanooria` ou `InstanooriaUI` | `/instanooria.css` | `--insta-*`, prefixo `insta-` | exp-01 |
| `unitube` (30) | `/unitube` ou `UnitubeUI` | `/unitube.css` | `--uni-*`, `uni-` — **só escuro** (o Figma não publica claro; proibido derivar) | exp-02 |
| `whatsappmobile` (29) | `/whatsappmobile` ou `WhatsAppMobileUI` | `/whatsappmobile.css` | `--wa-*`, `wa-` — só escuro | — |
| `chatgpt` (25) | `/chatgpt` ou `ChatGPTUI` | `/chatgpt.css` | `--gpt-*`, `gpt-`, `data-gpt-theme` | exp-03 |
| `tiktooria` (35) | `/tiktooria` ou `TikTooriaUI` | `/tiktooria.css` | `--tik-*`, `tik-` — dois CONTEXTOS de superfície (cromo claro de lista/perfil, imersivo preto de feed/câmera), não dois temas | — |

**Consumir sempre pela ponte em `packages/ui`**, nunca importando o pacote direto
num componente: `@edu/ui/ds` (plataforma) e `@edu/ui/ds-insta` (clone do exp-01).
A ponte existe por dois motivos registrados nos arquivos: marcar `'use client'`
de uma vez para o App Router, e desfazer a colisão de nomes — `Icon`, `Avatar`,
`Badge`, `Button`, `Logo`, `TextField` existem nas duas famílias, então os clones
só saem pelo namespace (`InstanooriaUI.Icon`), e destruturar na ponte é o que
mantém o tree-shaking e evita o `TS2742` do `@types/react` interno do pacote.
Clone novo em uso = arquivo novo `packages/ui/src/ds-<clone>.ts` + `exports` no
`packages/ui/package.json`, mesmo padrão.

**CSS entra UMA vez, no ponto de entrada**: o hub em
`components/casca-plataforma.tsx` (por isso `/exp/*` e `/dev-embed`, que estão
fora do grupo `(plataforma)`, também têm o DS); a experiência no seu
`src/main.tsx`. Nunca importe o consolidado `/styles.css` numa experiência: ele
traz os tokens da plataforma para dentro do clone.

**No hub, o CSS do DS não basta: as fontes também.** O `unooria.css` declara
`Open Sans` e `Material Symbols Rounded` por `@import` de URL remota, e o **Next
remove `@import` externo** de CSS importado por JS — silenciosamente: a regra
continua lá, o `getComputedStyle` responde "Open Sans" e o navegador desenha com
a fonte do sistema. Como `Material Symbols Rounded` é fonte de ligadura, o
sintoma é o ÍCONE VIRANDO TEXTO ("addInvestigação"). Por isso
`components/casca-plataforma.tsx` também monta `FontesDaPlataforma`
(`@edu/ui/fontes`). Numa experiência Vite o `@import` sobrevive e isso não é
necessário.

**Frames: dois níveis, não empilhar.** `PhoneFrame` (instanooria, whatsappmobile,
tiktooria) e `DesktopFrame` (unitube) são cascas de aparelho DO CLONE, para
Storybook e telas soltas. Dentro da plataforma quem desenha o aparelho é o hub,
em `components/DispositivoFrame.tsx`, dirigido pelo `viewport` do manifesto — a
experiência embedada preenche o iframe e não traz casca própria.

**Quem importa, declara.** Todo app que escreve `@unooria/design-system` no
código tem a dependência no seu `package.json` — hub incluído, porque ele importa
o `unooria.css`. Depender do hoisting do pnpm via `@edu/ui` funcionava por acaso:
bastava a ponte trocar de versão (ou o `node_modules` ser reinstalado com outro
layout) para o CSS do hub sumir sem ninguém ter mexido nele.

**Fora da regra, deliberadamente:** exp-70 (jogo em canvas 3D, sem DOM de UI — a
exceção de ADR das convenções). A pendência da exp-02 (CSS próprio em
`src/estilos`) foi RESOLVIDA: ela consome a seção `unitube` pela ponte
`@edu/ui/ds-unootube`, com a aparência escolhida pelo aluno.

### Check-in de bem-estar (exp-91, `apps/api/src/bemestar`)
Ferramenta do professor: o **DASS-21** (Lovibond & Lovibond 1995; versão
brasileira Vignola & Tucci 2014; domínio público) em **microdoses** — 3 frases
por dia, 7 check-ins fecham os 21 itens, um texto livre opcional. Decisões:
- **Os 21 itens são fixos e verbatim** (`catalogo.ts`). A IA NUNCA reescreve
  um item: reformular quebra a validação psicométrica e as faixas de corte.
  O que a IA gera é o entorno — abertura do dia, pergunta aberta, acolhimento
  ao texto — e cada texto passa por `regras.validarTextoDaIa` (sem vocabulário
  clínico, ordens, promessas, gestão, links, tamanho). Barrado, sem saldo ou
  sem provider ⇒ texto fixo do catálogo; o check-in nunca deixa de abrir.
  A IA nunca recebe nome, escola, pontuação ou faixa (só dia da semana, mês,
  nº do check-in e o texto livre, delimitado como conteúdo).
- **Correção server-side** (regra 3): ao 7º check-in a api soma por subescala
  (×2) e classifica pelas faixas publicadas. `pontuar`/`faixaDe` em `regras.ts`.
- **Sinal de apoio**: item 17 ou 21 ≥ 2, ou termo de risco no texto ⇒ mensagem
  FIXA de apoio (CVV 188, SAMU 192, CAPS/UBS) e a IA não é chamada.
- **Dado sensível (LGPD art. 11)**: `bem_estar_ciclos`/`bem_estar_checkins`
  com RLS + posse por `professor_id` em toda query; **nenhuma rota de gestor
  ou agregado** — só o professor lê, e `DELETE /bemestar/dados` apaga tudo.
  Texto livre nunca vai a log nem à telemetria (só contagens).
- 1 check-in por dia (`dia` em `America/Sao_Paulo`); ciclo expira em 21 dias
  sem fechar. `GET /bemestar/resumo` é leve (sem IA) — é o que o card do hub lê.

## Convenções de código

- TypeScript strict em tudo. Sem `any` (use `unknown` + narrow). **Uma exceção,
  registrada em ADR:** o jogo da exp-70 (`public/jogo/`, ~10k linhas de JS
  clássico com globais compartilhados, `three.min.js` vendorizado) fica como
  está — é um instrumento com distâncias e tempos calibrados, e o compilador não
  tem como saber que uma refatoração mudou a medida. `public/jogo/**` está nos
  `ignores` do ESLint. O shim (`src/`, TS strict) é a única porta: `window.VILA`.
  A rede que substitui o `tsc` ali é o smoke visual.
- Nomes de domínio em pt-BR (`aluno`, `escola`, `turma`, `experiencia`);
  termos técnicos em inglês (`provider`, `guard`, `batch`).
- Commits: `feat(exp-12): ...`, `fix(api): ...`, `chore(sdk): ...`.
- Zod para validar TODO input externo (body, query, postMessage recebido, env).
- Testes: mínimo = contratos (bridge, telemetria, guards de tenancy). Vitest
  no sdk/experiências, Jest no NestJS.
- UI: **não inventar componente**. Hub e experiências montam interface com
  `@unooria/design-system` (seção `unooria` para a plataforma, seção do clone
  para a experiência), sempre na última versão — ver "Design System" acima. O
  `_template` continua cru de propósito: o que ele NÃO traz, o DS traz.
- **Tabela de experiência leva o NÚMERO dela: `exp_NN_`.** `exp_70_sessoes`,
  `exp_02_sessoes`, `exp_91_checkins`. Tabela da PLATAFORMA — que serve a todas
  — fica **sem prefixo**: `escolas`, `lotacoes`, `turmas`, `matriculas`,
  `periodos_letivos`, `users`, `experiencias`, `progresso`, `telemetria_eventos`,
  `ia_uso_diario`. O motor (feed adaptativo,
  geração, dossiê) é da exp-01 e leva `exp_01_`. Tabela que é CONTRATO entre
  duas experiências carrega os DOIS números: `exp_01_exp_70_perfis_importados`
  (a exp-70 escreve, a exp-01 lê) — chamá-la de uma só mentiria sobre quem
  depende dela.
  **Um banco, um schema.** Nem banco por experiência (elas não são isoladas: o
  perfil da Vila alimenta a largada do Instanooria, e o Postgres não faz JOIN
  entre bancos; além disso um pool do Prisma por experiência estouraria o
  `max_connections`), nem schema por experiência (a única coisa que um schema
  daria além do prefixo é fronteira de `GRANT`, e existe UMA role de aplicação).
  Migração de referência: `20260827090000_tabelas_por_experiencia` — `RENAME`,
  nunca DROP/CREATE, e renomeando constraints, índices e políticas de RLS
  junto. Duas armadilhas registradas lá: `FOR ... IN SELECT` sobre o catálogo
  relê o que o próprio laço alterou, e `RENAME CONSTRAINT` renomeia também o
  índice que a sustenta — as duas produzem `exp_01_exp_01_..._pkey`.
- Lógica de domínio de uma experiência (gabarito, estado da missão, visão do
  professor) vive num módulo próprio da api, prefixo minúsculo igual ao slug:
  `apps/api/src/unootube/` ↔ `/unootube/*` (regra 3: o client nunca recebe o
  gabarito). Padrão: `catalogo.ts` (dados) + `regras.ts` (puro) + service com
  `comTenancy` + controllers por papel.

## Design System (`@unooria/design-system`, via `packages/ui`)

O pacote publica SEÇÕES independentes, cada uma com namespace de token e
prefixo de classe próprios. Nunca importar o `styles.css` consolidado: ele
arrasta as seis seções e a tipografia da plataforma para dentro de um clone.

| Ponte | Seção | CSS | Namespace | Onde vale |
|---|---|---|---|---|
| `@edu/ui/ds` | `unooria` | `/unooria.css` + `/fonts/unooria.css` | `--unooria-*`, `.unooria-theme-dark` | hub (login, `/professor`, `/admin`, `/analise`), header de todos os papéis, **telas pós-revelação do aluno** |
| `@edu/ui/ds-insta` | `instanooria` | `/instanooria.css` (sem fonte: SF Pro é do sistema) | `--insta-*` | superfície disfarçada da exp-01 |
| `@edu/ui/ds-unootube` | `unootube` | `/unootube.css` + `/fonts/unootube.css` | `--uni-*`, `[data-uni-theme]` | superfície disfarçada da exp-02 |
| `@edu/ui/ds-chatgpt` | `chatgpt` (25) | `/chatgpt.css` + `/fonts/chatgpt.css` | `--gpt-*`, `data-gpt-theme` | a exp-03 INTEIRA: ela NÃO tem revelação no software, então nunca troca para a seção da plataforma |

**A folha de fonte é uma linha SEPARADA e obrigatória** (0.1.17: as folhas de
componente não declaram mais `@font-face`). Nas marcas de clone, esquecê-la só
cai no fallback — feio. Na PLATAFORMA ela quebra: os ícones são fonte de
LIGADURA (Material Symbols Rounded), o `.unooria-icon` recebe o NOME do ícone
como texto, e sem a família a tela escreve "search" no lugar da lupa. As fontes
são auto-hospedadas (woff2 no pacote): não há mais nenhuma requisição a
`fonts.googleapis.com` em lugar nenhum, e por isso o `FontesDaPlataforma`
(`@edu/ui/fontes`), que existia só para injetar aquele `<link>`, foi removido.
Quem usa `next/font` NÃO escreve a linha — mas aí o Material Symbols precisa
vir por lá.

**Custo medido do Material Symbols (2026-08-27):** 5,36 MB num woff2 só. O
`@font-face` é preguiçoso, então o arquivo só desce se a família for aplicada —
medido com `document.fonts.check()` dentro do iframe: na exp-02 ele fica
`unloaded` do feed até a virada do ranking (as telas da plataforma que ela usa
não têm ícone de ligadura), e o que desce ali são ~150 KB de Open Sans. Ou seja:
os 5,36 MB são peso morto no bucket, não download do aluno — e uma armadilha, já
que um ícone da plataforma acrescentado à exp-02 amanhã puxaria tudo. Resolve de
vez migrando o `Icon` da plataforma para registro SVG (as outras cinco seções já
são assim).

**A linha que separa as seções é a REVELAÇÃO, não o arquivo.** O critério é
"quem está falando?", nunca "é depois no tempo?". Na exp-02: feed, cromo,
playlists, canal, o toast ("Vídeo salvo!") e o diálogo de limite ("sua playlist
tem três lugares") usam `ds-unootube` — todos falam de dentro da ficção. Ranking,
os dois diálogos da missão, o botão "Concluir missão" e a TELA DE ENTRADA usam
`ds`. A entrada é a única que fica ANTES do feed, e não é exceção: no briefing
quem fala é a escola, e não há disfarce a proteger porque a criança ainda não viu
um Short. O disfarce começa no toque em "Começar missão" (ADR-22).

**Tema:** a seção do clone lê `data-uni-theme` na raiz; a da plataforma recebe
`theme` por PROP. Quem troca escreve nos dois (`exp-02/src/lib/tema.ts`), senão
o aluno escolhe escuro no feed e o ranking volta branco. Na exp-02 a escolha é
do aluno (Perfil → APARÊNCIA) e é lembrada em `localStorage` — que a regra 4
proíbe para TOKEN, não para preferência de tela.

**Componente que falta no pacote não nasce na experiência.** Vira compensação
local marcada no CSS (`(b) COMPENSAÇÃO`) e um pedido ao `storybook-unooria` — e
some quando o pacote publica. Os quatro pedidos abertos pela exp-02 na 0.1.14
foram atendidos na 0.1.17 (`Modal`/`Snackbar`/`Table`/`EmptyState` em
`unootube`, `showSubscribe` no `ChannelHeader`, token semântico na capa do
canal, `@import` duplicado da Roboto), e as compensações correspondentes foram
apagadas. Sobraram DUAS na exp-02: o girador de carregamento (o
`ShortsPlayer` distingue "parado" de "tocando" mas não "ainda carregando") e a
etiqueta de estado do diálogo de limite (a seção não publica `Tag` nem `Badge` —
e por isso ela sai NEUTRA, não âmbar como o Figma pede: a seção não tem token de
aviso e derivar um seria inventar valor). Uma terceira ligação, não compensação:
o véu do `ShortsPlayer` tem altura FIXA de 194px, então numa miniatura de 88px
sem legenda ele cobre o quadro inteiro e o sintoma é retângulo preto com o vídeo
carregado por baixo.

**Migração de versão do DS: o que morde.** `VideoPlayer`, `VideoPlayerFull` e
`VideoCardHorizontal` mudaram o sentido de `src` na 0.1.13 — era o quadro
estático, agora é o VÍDEO, e o quadro virou `poster`. Passar imagem em `src`
monta um `<video>` que não carrega. Nenhum dos três é usado neste repo hoje.

Sobrescrever classe do DS exige DOIS seletores (`.app-shell > .x`): o CSS do
pacote é injetado pelo módulo do componente, ou seja, DEPOIS do CSS da
experiência no grafo de importação — com peso igual, quem ganha é sempre o DS.

## Git e branches

- **`main` é o tronco.** A migração para o monorepo foi mergeada nela em
  2026-08-25 por fast-forward: 26 commits, histórico linear, sem merge commit.
  A branch `migracao-monorepo` não existe mais.
- **Uma branch por experiência nova**, com o nome do slug dela:
  `exp-07-fracoes`. Trabalho que não é experiência usa o prefixo do tipo do
  commit: `fix/quota-por-perfil`, `chore/deps`, `ci/deploy`.
- Commits: `feat(exp-12): ...`, `fix(api): ...`, `chore(sdk): ...` — o escopo é
  o slug da experiência ou o app/pacote tocado.
- **Nada de build no git.** `.gitignore` cobre `dist/`, `.next/`, `.next-prod/`,
  `.turbo/`, `*.tsbuildinfo`, `storage/`, `storage-privado/` e os prints dos
  walkthroughs. Exceção deliberada: `documentacao-latex/main.pdf` É
  versionado — é entregável de projeto, não artefato de build, e quem precisa
  dele (cliente, edital, revisão) não tem TeX instalado. Os auxiliares do LaTeX
  e `documentacao-latex/build/` ficam fora. `apps/hub/.next-prod/` (que o `pnpm build:isolado` escreve) já
  entrou uma vez por um `git add -A` distraído: 358 arquivos e 250MB de cache de
  webpack no histórico, que só saíram reconstruindo a branch inteira. Stage por
  caminho, nunca `-A` sem olhar o `git status`.
- `apps/hub/next-env.d.ts` É versionado (o Next espera isso), mas alterna entre
  `./.next` e `./.next-prod` conforme o último build. Modificado depois de um
  `build:isolado` = descartar, não commitar.

## Comandos

```bash
pnpm dev                                  # tudo em watch, no host
pnpm docker:dev                           # a stack INTEIRA em container (pg/api/hub/3 exps) com o
                                          # código do host por bind mount: salvar arquivo recompila
                                          # lá dentro, sem build. Mesmas portas do `pnpm dev`, então
                                          # é um OU outro. `:logs` `:deps` `:down` completam.
pnpm turbo build --filter=@edu/exp-01     # builda 1 experiência (+ deps)
pnpm turbo build --filter='...[HEAD^]'    # só o que mudou (CI usa isso)
pnpm new:exp exp-07-fracoes               # scaffolda experiência do _template
pnpm --filter @edu/api test
pnpm --filter @edu/api exec prisma migrate reset --force --skip-seed  # ZERA o banco (dev)
SEED_MINIMO=1 pnpm --filter @edu/api seed   # só escola + gestor.demo + admin: o "zero absoluto"
pnpm --filter @edu/exp-90-plano-de-aula dev   # :5175 → hub /professor/plano-de-aula (prof.demo; seed:demo importa referências demo)
pnpm --filter @edu/exp-91-bem-estar dev       # :5176 → hub /professor/bem-estar (prof.demo; AI_PROVIDER=mock usa os textos fixos)
pnpm --filter @edu/exp-02-unootube dev    # :5174 (exp-01 usa :5173 — portas em apps/hub/lib/experiencias-dev.ts)
node scripts/walkthrough-admin-usuarios.mjs testes/wt-admin  # smoke do ciclo de pessoas: importar -> enturmar -> 1o acesso -> turma do professor
node scripts/walkthrough-rede.mjs testes/wt-rede            # smoke da REDE: 2 escolas, regional, lotação em lote, panorama do supervisor, aluno transferido pelo CPF
node scripts/walkthrough-perfil-portatil.mjs testes/wt-portatil  # smoke do PERFIL PORTÁTIL: emitir assinado, receber, e o que acontece com um arquivo adulterado
node scripts/walkthrough-aluno-unootube.mjs testes/walkthrough-unootube   # smoke da exp-02 (aluno4a01)
node scripts/walkthrough-vila-do-lume.mjs testes/walkthrough-vila       # smoke da exp-70, aluno (usa o CHROME do sistema: pointer lock)
node scripts/walkthrough-professor-vila.mjs testes/wt-prof-vila 8A      # smoke da exp-70, professor (trilha → ficha → turma → aluno)
node scripts/walkthrough-ato1-vila.mjs testes/wt-ato1                   # smoke do Ato 1 (a tela; a largada tem teste em tests/vila-ato1.spec.ts)
pnpm --filter @edu/exp-70-vila-do-lume dev    # :5177 → hub /exp/exp-70-vila-do-lume (transversal, sem série)
pnpm --filter @edu/exp-03-unoogpt dev         # :5178 → hub /exp/exp-03-unoogpt (2ª série EM, unidade 1)
node scripts/walkthrough-aluno-unoogpt.mjs testes/walkthrough-unoogpt   # smoke da exp-03: DOIS contextos
                                          # (o professor dá a largada, o aluno joga). Zera a turma no
                                          # começo — senão a 2ª execução acha o aluno já na investigação.
pnpm up -r @unooria/design-system --latest     # sobe o DS em ui/hub/exps de uma vez (caret ^0.1.x NÃO sobe minor)
npm view @unooria/design-system version        # qual é a última publicada
cd ../storybook-unooria && npm run storybook   # :6007, o catálogo das 6 seções (repo do DS, fora deste monorepo)
cd documentacao-latex && ./compilar.sh         # documentação técnica -> main.pdf (~245p). Atualizar SEMPRE (ver seção própria)
```

## Como criar uma experiência nova

0. `git switch -c exp-NN-slug` a partir da `main` — uma branch por experiência.
1. `pnpm new:exp exp-NN-slug` (copia `_template`, ajusta nomes).
2. Implementar em `src/App.tsx`+; usar SOMENTE a SDK para auth/api/telemetria e
   SOMENTE o `@unooria/design-system` para interface — a seção do clone que a
   experiência imita (`instanooria`, `unitube`, `chatgpt`, `whatsappmobile`,
   `tiktooria`) pela ponte em `packages/ui`. Falta componente? Ele nasce no repo
   `storybook-unooria` e chega por versão nova, não como arquivo local.
3. Declarar capabilities no `experiencia.json` (`telemetria`, `progresso`,
   `ia`, `avaliacao`, `tempo-real`) — o hub e a api usam isso.
4. `verbo`/`objeto` de telemetria: documentar no README da experiência.
5. Build gera `dist/` 100% estático. Testar embedado: rota `/dev-embed` do hub.

## O que NÃO fazer

- Não criar novos serviços Cloud Run sem necessidade demonstrada (a api absorve).
- Não adicionar Redis/filas/libs de estado sem gargalo medido (exceção: Pub/Sub
  de telemetria, que já é decisão tomada).
- Não usar localStorage para token. Não usar `targetOrigin: "*"`.
- Não escrever migração que remova `escola_id` ou afrouxe RLS.
- Não chamar provedores de IA fora de `apps/api/src/ai`.
- Não escrever componente de UI local (nem em `packages/ui`, nem na experiência)
  quando a seção do DS já tem: o lugar do componente novo é o `storybook-unooria`.
- Não misturar seções do DS: componente/token da plataforma dentro do clone de uma
  experiência (ou o contrário) quebra a fidelidade que a experiência mede.
- Não travar a versão do DS: `^0.1.x` não sobe minor — atualizar de propósito.
- Não commitar assets binários pesados (>2MB): vão para o bucket, referenciados por URL.

## Infra (repo separado)

Terraform vive em outro repo. O contrato entre os repos está em `docs/INFRA.md`:
nomes de recursos esperados, variáveis de ambiente que a app consome, e o que o
CI deste repo publica (imagens no Artifact Registry, bundles no bucket).
Nunca criar recursos GCP imperativamente por script neste repo.

## Documentação técnica (`documentacao-latex/`) — ATUALIZAR SEMPRE

A documentação técnica consolidada do projeto é **LaTeX versionado**, em
`documentacao-latex/`, e compila em `main.pdf` (~245 páginas, `PU-DOC-001`).
Ela é a fonte única de: contexto de negócio, requisitos rastreáveis (RF/RNF),
casos de uso, **arquitetura de software nos 4 níveis do C4**, **arquitetura de
nuvem e implantação em GCP**, multi-tenancy e segurança, modelo de dados,
contratos de integração, telemetria, camada de IA, catálogo de experiências,
especificação da API, design system, entrega, qualidade, **27 ADRs**, riscos e
evolução. Todos os diagramas são TikZ vetorial, com fonte Mermaid equivalente no
Apêndice A.

**REGRA: toda implementação nova atualiza esta documentação NO MESMO COMMIT, e
regera o PDF.** Documento que ninguém atualiza é pior que documento nenhum —
é a mesma armadilha do `expires_at` que saiu do schema e do
`turmas.consentimento_em` do app de origem: a regra sai do código, o registro
fica, e quem lê acredita nele.

```bash
cd documentacao-latex && ./compilar.sh      # tectonic; --rapido p/ iterar, --limpar p/ limpar
```

| Se você mudou… | Atualize |
|---|---|
| Módulo, componente, fronteira | `secoes/05-arquitetura-software.tex` (+ o C4 correspondente) |
| Recurso de nuvem, rede, CI/CD | `secoes/06-arquitetura-nuvem.tex`, `secoes/15-entrega.tex` |
| RLS, papel, guard, sandbox do iframe | `secoes/07-tenancy-seguranca.tex` |
| Migração, tabela, coluna | `secoes/08-modelo-de-dados.tex` + `apendices/e-dicionario-de-dados.tex` |
| Bridge, telemetria, manifesto, provider de IA | `secoes/09-contratos-integracao.tex` + `apendices/d-payloads.tex` |
| Rota nova, ou papel de uma rota | `secoes/13-api.tex` + `apendices/c-endpoints.tex` |
| Variável de ambiente | `apendices/b-variaveis-ambiente.tex` |
| Experiência nova | `secoes/12-experiencias.tex` (e o catálogo do cap. 12) |
| Regra de interface / lacuna do DS | `secoes/14-design-system.tex` |
| **Qualquer decisão com alternativa descartada** | `secoes/17-adr.tex` — **ADR nova, numerada** (contexto, decisão, alternativas, consequências ruins incluídas, gatilho de reavaliação) |
| Risco novo, mitigado ou reclassificado | `secoes/18-riscos-evolucao.tex` |
| Sintoma de diagnóstico novo (o sintoma que não aponta para a causa) | `apendices/f-operacao.tex` |
| Diagrama TikZ novo | **também** a fonte Mermaid equivalente em `apendices/a-mermaid.tex` |

Convenções de edição (as que já custaram tempo) em `documentacao-latex/README.md`.
As três que mais pegam: dentro de `tikzpicture` use `\texttt{}` cru (as macros
`\cd`/`\arq` ficam invisíveis em nó de fundo escuro); setas são `\seta` e
`\implica`, nunca `→`/`⇒` literais (a Roboto não tem esses glifos e o XeTeX
não desenha nada); e ER grande vai em **duas figuras retrato**, não em landscape.

## Definition of Done (qualquer tarefa)

- [ ] Typecheck + lint + testes passando (`pnpm turbo typecheck lint test`)
- [ ] Se mexeu em tela: smoke VISUAL (`node scripts/walkthrough-aluno.mjs <pasta>`
      e `walkthrough-professor.mjs`, que também cobre a exp-90 embedada) —
      typecheck verde não pega ícone virando texto, link sublinhado nem iframe vazio
- [ ] Input externo validado com Zod
- [ ] Queries novas escopadas por tenancy (revisar mentalmente a regra 1)
- [ ] Sem segredo/URL interna em código client
- [ ] Se tocou contrato (bridge/telemetria/provider): docs atualizados aqui
- [ ] **`documentacao-latex/` atualizada e `main.pdf` regerado** (tabela acima).
      Decisão com alternativa descartada = ADR nova em `secoes/17-adr.tex`
