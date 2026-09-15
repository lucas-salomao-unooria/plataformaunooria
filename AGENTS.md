# Plataforma Unooria — monorepo

Plataforma educacional B2G. Em conflito entre este arquivo e uma suposição sua,
este arquivo vence.

**Este arquivo é o que vale SEMPRE**, e é curto de propósito. O detalhe mora em
dois lugares, e nenhum repete o outro.

## 1. Por PASTA — carrega sozinho quando você mexe nela

| Pasta | O que está lá |
|---|---|
| `apps/api/AGENTS.md` | o que vale para TODA a api (papéis, lotação, o módulo por domínio) — e um `AGENTS.md` por módulo em `apps/api/src/*/` |
| `apps/hub/AGENTS.md` | o que vale para TODO o hub (casca, papéis, middleware) — e um `AGENTS.md` por área em `apps/hub/app/*/` |
| `apps/experiencias/AGENTS.md` | contrato `postMessage`, manifesto, experiência nova, clones do DS |
| `apps/experiencias/*/AGENTS.md` | por experiência: porta, rota, seção do DS, módulo da api |
| `packages/AGENTS.md`, `packages/*/AGENTS.md` | o contrato que o `sdk` promete, as 5 pontes do `ui`, o conteúdo da exp-01 |
| `scripts/AGENTS.md`, `scripts/e2e/AGENTS.md` | os utilitários, o que é gerado, e o que uma suíte precisa provar |
| `docs/AGENTS.md`, `documentacao-latex/AGENTS.md` | o que ali é contrato vivo, e as regras de edição do LaTeX |

## 2. Por ASSUNTO — regra transversal, em `docs/regras/`

Valem em todo lugar, então não cabem numa pasta. **Abra a do seu assunto antes
de escrever**: cada uma traz o custo já pago que produziu a regra.

| Em `docs/regras/` | Quando é sua |
|---|---|
| [`o-que-nao-fazer.md`](docs/regras/o-que-nao-fazer.md) | **sempre** — a lista completa, com o custo de cada uma |
| [`design-system.md`](docs/regras/design-system.md) | antes de escrever QUALQUER interface |
| [`idioma-da-interface.md`](docs/regras/idioma-da-interface.md) | qualquer texto que uma pessoa lê (ADR-91) |
| [`convencoes-de-codigo.md`](docs/regras/convencoes-de-codigo.md) | nomes, Zod, testes, prefixo de tabela |
| [`git-e-branches.md`](docs/regras/git-e-branches.md) | antes do primeiro commit |
| [`comandos.md`](docs/regras/comandos.md) | ao rodar qualquer coisa |
| [`documentacao-latex.md`](docs/regras/documentacao-latex.md) | toda implementação atualiza o LaTeX no mesmo commit |
| [`arquivos-de-instrucao.md`](docs/regras/arquivos-de-instrucao.md) | ao mexer em `AGENTS.md`/`CLAUDE.md` ou nas skills |
| [`ferramentas-externas.md`](docs/regras/ferramentas-externas.md) | o que o agente NÃO dispara (Snyk é do CI) |
| [`infra.md`](docs/regras/infra.md) | Terraform vive em outro repo |

E na raiz: [`CONTEXT.md`](CONTEXT.md) (o glossário, com a fonte de verdade de
cada termo) e [`CONTRIBUTING.md`](CONTRIBUTING.md) (o fluxo de git inteiro).

**Elas chegam sozinhas em cada ferramenta** (ADR-102): Claude Code por
`.claude/rules/` (com `paths:`, sob demanda), Antigravity por `.agents/rules/`,
Codex e Cursor por este arquivo. As duas pastas são **symlinks para
`docs/regras/`**: uma fonte, vários leitores.

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

**Mexeu numa experiência? Suba a `versao` do `public/experiencia.json` E o
`version` do `package.json`, juntos.** O caminho no bucket carrega a versão e o
`rsync` apaga o que não casa: publicar sem subir sobrescreve um caminho tratado
como imutável, e quem está no meio de uma sessão pede assets recém-apagados. O
porquê inteiro, e a separação entre *subir* e *ativar*, em
`apps/experiencias/AGENTS.md`.

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
7. **A missão só abre na turma em que o professor a liberou** (ADR-69). Toda
   entrada de estudante em experiência chama `exigirMissaoLiberada`
   (`apps/api/src/comum/liberacao.ts`) e responde 403 `missao-nao-liberada` sem
   linha em `liberacoes`. Filtrar o card no hub é UX: o bundle é público e
   `/exp/:expId` é endereço adivinhável. Experiência nova declara o próprio
   `EXP_ID` e chama a guarda no FUNIL das rotas de estudante (o `estudanteDaEscola`
   / `garantirSessao` dela), nunca só na rota de leitura.
8. **Todo produto e toda experiência nascem com interruptor no painel da
   Unooria** (ADR-87). O eixo se chama **disponibilidade** e responde "este
   recurso existe NESTA REDE?" — não confunda com a regra 7, que responde "está
   aberta NESTA TURMA?". Disponibilidade é PRÉ-CONDIÇÃO da liberação, nunca o
   contrário, e confundir as duas é caro: produto desligado tem o sintoma de um
   bug de enturmamento.
   - Tabela `disponibilidades`: uma linha por (recurso, escopo). Recurso é
     `produto:<slug>` ou `experiencia:<expId>`; escopo é escola, regional ou o
     contrato inteiro (`escola_id` NULO). **Ausência de linha = LIGADO** — o
     contrário de `liberacoes`, porque este interruptor é mecanismo de EXCEÇÃO
     (não contratado, ou quebrado no deploy) e não de liberação.
   - **O escopo mais específico ganha** (escola → regional → contrato) e **o
     produto é um TETO**: desligado no escopo que vale, nada dentro dele liga.
   - **Experiência nova entra no painel declarando `produto` no
     `public/experiencia.json`** — a composição produto → experiências é
     DERIVADA do manifesto, e `apps/api/tests/manifestos-declaram-produto.spec.ts`
     cobra o campo. Nunca uma lista mantida à mão: é a que ninguém atualiza.
   - Quem opera é SÓ o `admin`, na área `/unooria` (ADR-88) — a primeira
     capacidade que `admin` tem e `gestor_contrato` não, e a exceção à igualdade
     que a ADR-80 afirma.


### Token e emissor (decisão da migração, 2026-08)
O HUB assina os tokens de experiência (RS256, TTL 15min, claims
`{sub, escola_id, turma_id?, perfil}`, aud `plataforma-api`) e serve o JWKS em
`/.well-known/jwks.json`. A api valida via `OIDC_ISSUER`/`OIDC_JWKS_URI` —
trocar para WSO2 = trocar essas envs, o guard não muda. Papéis:
`estudante | professor | gestor_escola | gestor_regional | gestor_contrato | admin`
(os dois últimos são a exceção cross-escola). **Quem atribui quem sai da CADEIA**
— `admin → gestor_contrato → gestor_regional → gestor_escola → professor/estudante`,
com alcance transitivo e nunca para cima (ADR-80). O `gestor_regional` trabalha
UMA escola por vez: o que a regional dele determina é a lista de escolas que ele
pode ativar, e a RLS não muda. O claim `turma_id` é a matrícula PRINCIPAL do estudante (ver
"Identidade e enturmamento").

**A matriz completa de quem faz o quê** (papel x rota x tela, e as ausências
deliberadas) está em `documentacao-latex/secoes/07-tenancy-seguranca.tex`,
"Nível 3: autorização por papel" — é o lugar de olhar antes de responder "esse
papel pode?". Duas respostas que a matriz já dá: **quem ESCREVE pessoa é o
importador** — `POST /usuarios` existe (o formulário do balcão), mas monta a
mesma linha de planilha e delega a `POST /rostering/importar`, nunca escreve em
`users` (ADR-54 + ADR-59; a única exceção é `POST /usuarios/admin-contrato`, o
papel que não cabe numa planilha da escola) —, e gestor e `admin-contrato`
dividem a MESMA área do middleware, então quem separa os dois é o `RolesGuard`
da api, não o hub. **Gestor não cria `admin-contrato`**: a opção não aparece na
tela e a rota responde 403.

## O que NÃO fazer — a versão curta

A lista completa, com o custo de cada uma, está em
[`docs/regras/o-que-nao-fazer.md`](docs/regras/o-que-nao-fazer.md). Aqui, só as
proibições:

- Não criar serviço Cloud Run novo sem necessidade demonstrada (a api absorve).
- Não adicionar Redis/filas/libs de estado sem gargalo medido.
- Não usar `localStorage` para token. Não usar `targetOrigin: "*"`.
- Não escrever migração que remova `escola_id` ou afrouxe RLS.
- Não chamar provedores de IA fora de `apps/api/src/ai`.
- Não rodar Snyk (CLI ou MCP): a varredura é do CI.
- Não escrever conteúdo em `CLAUDE.md`: é o ponteiro `@AGENTS.md` de uma linha.
- **Não escrever interface sem antes procurar no DS**, nem componente local
  silencioso, nem `overflow` onde há `ScrollBar`, nem `<select>` onde há
  `Selection`. E não misturar seções do DS (plataforma dentro do clone).
- Não travar a versão do DS: `^0.1.x` não sobe minor.
- **Não escrever breadcrumb numa página do hub, nem deixar página sem ele**: a
  trilha é do layout da área (ADR-77).
- **Não escrever texto de interface em inglês, nem traduzir o nome do clone**
  (ADR-91). `fake news`, `cyberbullying` e `print` ficam por decisão.
- **Não formatar data na mão** (ADR-98) nem cravar o fuso (ADR-99).
- Não commitar asset binário >2MB (vai para o bucket) nem build (`dist/`,
  `.next/`, `testes/`). Stage por caminho, nunca `git add -A`.

## Definition of Done (qualquer tarefa)

O porquê de cada item está em
[`docs/regras/definition-of-done.md`](docs/regras/definition-of-done.md).

- [ ] `pnpm turbo typecheck lint test` verde
- [ ] Mexeu em tela? A suíte e2e do papel (`node scripts/e2e/rodar.mjs <papel>`)
      — o typecheck não pega ícone virando texto nem iframe vazio. Tela nova =
      passo novo, com `titulo`/`mostra`/`prova`. Espera de IA **corre contra o
      erro**, nunca cega
- [ ] Input externo validado com Zod
- [ ] Query nova escopada por tenancy (a regra 1)
- [ ] Sem segredo, prompt de sistema ou URL interna em código client
- [ ] Produto ou experiência nova: **aparece no painel da Unooria e DESLIGA**
      (regra 8) — o modo de falhar é MUDO
- [ ] Tocou contrato (bridge/telemetria/provider)? Docs atualizados
- [ ] Regra mudou? O `AGENTS.md` ou o `docs/regras/` afetado, no mesmo commit
- [ ] **`documentacao-latex/` atualizada e `main.pdf` regerado.** Decisão com
      alternativa descartada = **ADR nova** em `secoes/18-adr.tex`
