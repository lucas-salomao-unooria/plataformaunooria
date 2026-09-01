# Plataforma Unooria — monorepo

Plataforma educacional B2G. Em conflito entre este arquivo e uma suposição sua,
este arquivo vence.

**Este arquivo é o que vale SEMPRE.** O detalhe de cada domínio está no
`AGENTS.md` da pasta correspondente, que carrega sozinho quando você mexe nela:

| Pasta | O que está lá |
|---|---|
| `apps/api/AGENTS.md` | rede/escola/CPF, identidade e enturmamento, perfil portátil, telemetria, OpenAPI derivado do Zod, provider de IA, e os módulos de experiência (vila, planos, bem-estar, unoogpt, unootube) |
| `apps/hub/AGENTS.md` | landing, header, casca, embed de experiência, papéis e middleware, fontes do DS |
| `apps/experiencias/AGENTS.md` | contrato `postMessage`, manifesto, como criar experiência nova, seções de clone do DS, a zona congelada da exp-70 |
| `packages/AGENTS.md` | SDK (bridge, evento de telemetria) e a ponte do design system |
| `documentacao-latex/README.md` | convenções de edição do LaTeX |
| `docs/INFRA.md` | contrato com o repo de Terraform |

## Contexto de negócio (não violar)

- Cliente: redes públicas (estado/município). **1 contrato = 1 stack de infra GCP**
  (provisionada por Terraform em repo separado). Dentro de um contrato, 100+
  escolas compartilham a stack com **isolamento lógico por `escola_id`**.
- Escala alvo por contrato: ~10k estudantes, picos de 2-4k simultâneos (8h da manhã).
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
`gs://{contrato}-exp/{expId}/{versao}/`. Rollback = hub apontar p/ versão anterior
(`publicar-manifesto.mjs <pasta> --versao x.y.z`).

**Mexeu numa experiência? Suba a `versao` do `public/experiencia.json`** — e o
`version` do `package.json` junto, que o CI lê do manifesto e a divergência já
causou bug. O caminho no bucket carrega a versão e o `rsync` roda com
`--delete-unmatched-destination-objects`: publicar sem subir sobrescreve um
caminho tratado como imutável, e quem está no meio de uma sessão pede assets que
acabaram de ser apagados. O deploy separa **subir** (inerte, em paralelo) de
**ativar** (o PUT do manifesto, depois do hub — a api valida contra o JWKS que o
hub serve).

## Regras invioláveis (segurança/tenancy)

1. **Toda query SQL é escopada por `escola_id`** (e `estudante_id` quando aplicável).
   Tabelas de dados de estudante têm `escola_id NOT NULL` + Row-Level Security.
   Nunca escreva uma query que atravesse escolas, exceto em rotas `admin-contrato`.
2. **Nenhum segredo em bundle client** (experiências e hub client-side): sem
   API keys, sem prompts de sistema, sem URLs internas. IA só via `api /ai/*`.
3. **Respostas corretas / correção / pontuação que vale nota: server-side.**
   O client envia a resposta do estudante; a api corrige.
4. **Token**: hub obtém via OIDC (WSO2), repassa à experiência por `postMessage`
   com `targetOrigin` explícito (nunca `*`). Experiência mantém token só em memória.
5. **IA tem quota**: por usuário/dia e POR PERFIL (`AI_DAILY_TOKEN_QUOTA_PER_ESTUDANTE`,
   `AI_DAILY_TOKEN_QUOTA_PER_PROFESSOR` — um plano anual gasta ~220k tokens só de
   prompt) e rate limit por usuário. Nunca exponha chamada de IA sem passar pelo
   `QuotaService` (`temSaldo(escola, usuario, perfil)` ANTES, `consumir` depois).
6. Dados de menores (LGPD): não logar PII em texto claro; telemetria carrega
   `estudante_id` opaco, nunca nome/email.


### Token e emissor (decisão da migração, 2026-08)
O HUB assina os tokens de experiência (RS256, TTL 15min, claims
`{sub, escola_id, turma_id?, perfil}`, aud `plataforma-api`) e serve o JWKS em
`/.well-known/jwks.json`. A api valida via `OIDC_ISSUER`/`OIDC_JWKS_URI` —
trocar para WSO2 = trocar essas envs, o guard não muda. Papéis:
`estudante | professor | gestor | admin-contrato` (admin-contrato é a única exceção
cross-escola). O claim `turma_id` é a matrícula PRINCIPAL do estudante (ver
"Identidade e enturmamento").


## Design System (`@unooria/design-system`) — a regra de ouro

**Todo elemento de interface do hub e das experiências vem deste pacote, sempre
na última versão publicada.** npm PÚBLICO no escopo `@unooria`; a fonte é o repo
`storybook-unooria` (fora deste monorepo). Componente de UI novo se escreve LÁ e
chega aqui por versão — não em `packages/ui`, não dentro de uma experiência.

**Duas famílias que nunca se cruzam.** A marca institucional é chrome do HUB;
dentro do iframe a fidelidade é ao clone que a experiência imita. Um `Button` da
plataforma no feed do estudante quebra a ilusão que a experiência está medindo.

| Seção | Ponte | Onde vale |
|---|---|---|
| `unooria` | `@edu/ui/ds` | hub (login, `/professor`, `/admin`, `/analise`), header de todos os papéis, telas pós-revelação do estudante |
| `instanooria` | `@edu/ui/ds-insta` | superfície disfarçada da exp-01 |
| `unitube` | `@edu/ui/ds-unootube` | superfície disfarçada da exp-02 |
| `chatgpt` | `@edu/ui/ds-chatgpt` | a exp-03 INTEIRA (não tem revelação no software) |
| `whatsappmobile`, `tiktooria` | — | ainda sem consumidor |

`^0.1.x` **não** pega `0.2.0` — caret em `0.x` só sobe patch. Atualizar é ativo:
`pnpm up -r @unooria/design-system --latest`, commitando lockfile e
`package.json` juntos. Mecânica completa (CSS, fontes, frames, compensações,
armadilhas de migração) em `packages/AGENTS.md`.

## Convenções de código

- TypeScript strict em tudo. Sem `any` (use `unknown` + narrow). **Uma exceção,
  registrada em ADR:** o jogo da exp-70 (`public/jogo/`, ~10k linhas de JS
  clássico com globais compartilhados, `three.min.js` vendorizado) fica como
  está — é um instrumento com distâncias e tempos calibrados, e o compilador não
  tem como saber que uma refatoração mudou a medida. `public/jogo/**` está nos
  `ignores` do ESLint. O shim (`src/`, TS strict) é a única porta: `window.VILA`.
  A rede que substitui o `tsc` ali é o smoke visual.
- Nomes de domínio em pt-BR (`estudante`, `escola`, `turma`, `experiencia`);
  termos técnicos em inglês (`provider`, `guard`, `batch`).
- Commits: `feat(exp-12): ...`, `fix(api): ...`, `chore(sdk): ...`.
- Zod para validar TODO input externo (body, query, postMessage recebido, env).
- Testes: mínimo = contratos (bridge, telemetria, guards de tenancy). Vitest
  no sdk/experiências, Jest no NestJS.
- UI: **não inventar componente**. Hub e experiências montam interface com
  `@unooria/design-system` (seção `unooria` para a plataforma, seção do clone
  para a experiência), sempre na última versão — ver "Design System" nesta página
  e a mecânica em `packages/AGENTS.md`. O
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
  `.turbo/`, `*.tsbuildinfo`, `storage/`, `storage-privado/` e a pasta `testes/`
  inteira — os prints, o deck e os vídeos da suíte e2e são reproduzíveis
  rodando-a de novo. Exceção deliberada: `documentacao-latex/main.pdf` É
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
npx ts-node --transpile-only apps/api/scripts/gerar-openapi.ts   # docs/openapi.json (roda da pasta apps/api)
node scripts/gerar-endpoints-tex.mjs                            # apendices/c-endpoints.tex A PARTIR do openapi.json
# /docs já vem LIGADO no docker:dev — http://localhost:3001/docs (docs / unooria-docs-local).
# No host (`pnpm dev`) as envs não existem e a rota some; exporte-as para ligar:
SWAGGER_USUARIO=docs SWAGGER_SENHA=unooria-docs-local pnpm dev
SEED_SENHA=<senha> pnpm --filter @edu/api seed  # a senha das contas de demo vem do AMBIENTE (ADR-47).
                                          # Nos dois compose ela já vem (unooria123); no host, no
                                          # apps/api/.env (o Prisma carrega) ou na linha de comando.
                                          # Ausente, o seed FALHA — não inventa senha.
SEED_MINIMO=1 pnpm --filter @edu/api seed   # só escola + gestor.demo + admin: o "zero absoluto"
pnpm --filter @edu/exp-90-plano-de-aula dev   # :5175 → hub /professor/plano-de-aula (prof.demo; seed:demo importa referências demo)
pnpm --filter @edu/exp-91-bem-estar dev       # :5176 → hub /professor/bem-estar (prof.demo; AI_PROVIDER=mock usa os textos fixos)
pnpm --filter @edu/exp-02-unootube dev    # :5174 (exp-01 usa :5173 — portas em apps/hub/lib/experiencias-dev.ts)
pnpm exec playwright install chromium     # PRE-REQUISITO da suíte e2e, uma vez por maquina.
                                          # `npx playwright install` NAO serve: o npx resolve o
                                          # playwright mais NOVO do npm e baixa a build de navegador
                                          # DELE, enquanto o repo fixa 1.62.1 (build 1234). O erro sai
                                          # como "Executable doesn't exist at .../chromium_headless_
                                          # shell-1234" com o cache CHEIO de navegador, e o banner
                                          # manda rodar justamente o npx que causou o descasamento.
node scripts/e2e/rodar.mjs                # A SUÍTE INTEIRA de ponta a ponta, na ordem canônica
                                          # (publico → estudante → professor → gestor → admin-contrato).
                                          # A ordem não é alfabética: o estudante PRODUZ o estado
                                          # (runs, partidas, sessões) que as telas do professor leem, e a
                                          # administração vem por último porque importa gente e troca senha.
node scripts/e2e/rodar.mjs professor      # só um papel
node scripts/e2e/rodar.mjs estudante/02   # só uma suíte
node scripts/e2e/rodar.mjs --deck         # tudo + deck (.pptx) + vídeos (.webm), gerados dos manifestos
node scripts/e2e/publico/01-landing.mjs   # cada suíte também roda sozinha, direto
# Evidências em testes/<papel>/<suíte>/: os prints, `passos.json` (o manifesto) e `relatorio.md`.
# A pasta é APAGADA no começo de cada execução — print de duas corridas na mesma pasta conta
# uma história que nunca aconteceu. `testes/` inteira está no .gitignore.
# O deck e os vídeos NASCEM do `passos.json`: a descrição de cada tela é escrita no
# `registrar()` da suíte, ao lado do passo que a fotografa. Antes havia um roteiro de 66 KB
# mantido à mão, e ele divergiu — descrevia telas que o script já não tirava.
node scripts/e2e/ferramentas/gerar-deck.mjs             # só o deck
node scripts/e2e/ferramentas/gerar-videos.mjs           # só os vídeos (um por papel; o estudante, um por missão)
node scripts/e2e/ferramentas/gerar-videos.mjs --amostra # um quadro em JPEG, p/ conferir o layout sem codificar
pnpm --filter @edu/exp-70-vila-do-lume dev    # :5177 → hub /exp/exp-70-vila-do-lume (transversal, sem série)
pnpm --filter @edu/exp-03-unoogpt dev         # :5178 → hub /exp/exp-03-unoogpt (2ª série EM, unidade 1)
pnpm up -r @unooria/design-system --latest     # sobe o DS em ui/hub/exps de uma vez (caret ^0.1.x NÃO sobe minor)
npm view @unooria/design-system version        # qual é a última publicada
cd ../storybook-unooria && npm run storybook   # :6007, o catálogo das 6 seções (repo do DS, fora deste monorepo)
cd documentacao-latex && ./compilar.sh         # documentação técnica -> main.pdf (~331p). Atualizar SEMPRE
```


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
`documentacao-latex/`, e compila em `main.pdf` (~331 páginas, `PU-DOC-001`).
Ela é a fonte única de: contexto de negócio, requisitos rastreáveis (RF/RNF),
casos de uso, **arquitetura de software nos 4 níveis do C4**, **arquitetura de
nuvem e implantação em GCP**, multi-tenancy e segurança, modelo de dados,
contratos de integração, telemetria, camada de IA, catálogo de experiências,
especificação da API, design system, entrega, qualidade, **51 ADRs**, riscos e
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
- [ ] Se mexeu em tela: a suíte E2E do papel afetado
      (`node scripts/e2e/rodar.mjs <papel>`) — typecheck verde não pega ícone
      virando texto, link sublinhado nem iframe vazio. Tela nova = passo novo na
      suíte, com `titulo`/`mostra`/`prova` preenchidos: é deles que saem o slide
      e a legenda do vídeo.
      Espera nova de IA **corre contra o erro** (`scripts/e2e/lib/smoke.mjs`:
      `esperarOuFalharCedo` + `ALERTA_DE_ERRO` nas telas da plataforma,
      `vigiarFalhasDaApi` e `esperarOuFalharPorHttp` nas disfarçadas). Espera cega paga o
      timeout inteiro e reporta o seletor que faltou em vez da causa: a api
      falhou em 306ms e o roteiro esperou 180s pela `<table>`
- [ ] Input externo validado com Zod
- [ ] Queries novas escopadas por tenancy (revisar mentalmente a regra 1)
- [ ] Sem segredo/URL interna em código client
- [ ] Se tocou contrato (bridge/telemetria/provider): docs atualizados aqui
- [ ] **`documentacao-latex/` atualizada e `main.pdf` regerado** (tabela acima).
      Decisão com alternativa descartada = ADR nova em `secoes/17-adr.tex`
