# Plataforma Unooria — monorepo

Plataforma educacional B2G. Em conflito entre este arquivo e uma suposição sua,
este arquivo vence.

**Este arquivo é o que vale SEMPRE**, e é curto de propósito. O detalhe mora em
dois lugares, e nenhum repete o outro.

## 1. Por PASTA — carrega sozinho quando você mexe nela

| Pasta | O que está lá |
|---|---|
| `apps/api/AGENTS.md` | toda a api (papéis, lotação, índice dos módulos) — e um `AGENTS.md` por módulo em `apps/api/src/*/` |
| `apps/hub/AGENTS.md` | todo o hub (casca, papéis, middleware) — e um `AGENTS.md` por área em `apps/hub/app/*/` |
| `apps/experiencias/AGENTS.md` | contrato `postMessage`, manifesto, experiência nova, clones do DS |
| `apps/experiencias/*/AGENTS.md` | por experiência: porta, rota, seção do DS, módulo da api |
| `apps/agente-professor/AGENTS.md` | o agente de IA do professor (Python/ADK no Agent Engine) e a ingestão dos data stores |
| `packages/AGENTS.md`, `packages/*/AGENTS.md` | o contrato que o `sdk` promete, as 8 pontes do `ui`, o conteúdo da exp08ef1b |
| `scripts/AGENTS.md`, `scripts/e2e/AGENTS.md` | utilitários, o que é gerado, o que uma suíte precisa provar |
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
| [`agente-professor.md`](docs/regras/agente-professor.md) | o agente de IA do professor: o contrato entre agente, api, hub e infra |
| [`bridge-postmessage.md`](docs/regras/bridge-postmessage.md) · [`manifesto-de-experiencias.md`](docs/regras/manifesto-de-experiencias.md) | os dois contratos da experiência |

E na raiz: [`CONTEXT.md`](CONTEXT.md) (o glossário, com a fonte de verdade de
cada termo) e [`CONTRIBUTING.md`](CONTRIBUTING.md) (o fluxo de git inteiro).

`.claude/rules/` e `.agents/rules/` são **symlinks para `docs/regras/`** (ADR-102); o
Claude só carrega as com `paths:` — as outras chegam por esta tabela.

**Quem chama quem? Não abra arquivo: `graphify explain "Nome"` ou `path "A" "B"`**
(275–875 tokens; já vem no worktree; custos em `comandos.md`).

## Contexto de negócio (não violar)

- Cliente: redes públicas (estado/município). **1 contrato = 1 stack de infra GCP**
  (provisionada por Terraform em repo separado). Dentro de um contrato, 100+
  escolas compartilham a stack com **isolamento lógico por `escola_id`**.
- Escala alvo por contrato: ~10k estudantes, picos de 2-4k simultâneos (8h da manhã).
- Produto: hub (Next.js) que embeda experiências imersivas (Vite, estáticas)
  do 1º ano EF ao 3º EM — a trilha completa prevê 48 (12 séries x 4 unidades); as
  que existem estão em `apps/experiencias/`.
- Prazo: produção em novembro/2026. Uma pessoa desenvolve. Simplicidade > sofisticação.

## Arquitetura (resumo operacional)

| Peça | Stack | Deploy |
|---|---|---|
| `apps/hub` | Next.js (App Router) | Cloud Run |
| `apps/api` | NestJS + Postgres (Cloud SQL) | Cloud Run |
| `apps/experiencias/*` | Vite + React + `@edu/sdk` | Cloud Storage + CDN (estático) |
| Auth | WSO2 Identity Server via **OIDC genérico** | externo, único p/ vários contratos |
| IA | Vertex Gemini via `apps/api/src/ai` (provider plugável) | dentro da api |
| `apps/agente-professor` | Python + Google ADK (agente de IA do professor) | Vertex AI Agent Engine — só a api o chama |
| Telemetria | SDK → `POST /telemetry/batch` → Pub/Sub → worker | |

Experiências NUNCA viram serviços no Cloud Run. São bundles estáticos:
`gs://{contrato}-exp/{expId}/{versao}/`. Rollback = hub apontar p/ versão anterior
(`publicar-manifesto.mjs <pasta> --versao x.y.z`).

**Mexeu numa experiência? Suba a `versao` do `public/experiencia.json`, o
`version` do `package.json` E o `EXP_VERSION` do código, juntos.** O caminho no bucket carrega a versão e o
`rsync` apaga o que não casa: publicar sem subir sobrescreve um caminho tratado
como imutável. O porquê inteiro, e a separação entre *subir* e *ativar*, em
`apps/experiencias/AGENTS.md`.

## Regras invioláveis (segurança/tenancy)

1. **Toda query SQL é escopada por `escola_id`** (e `estudante_id` quando aplicável).
   Tabelas de dados de estudante têm `escola_id NOT NULL` + Row-Level Security.
   Nunca escreva uma query que atravesse escolas, exceto em rotas de `gestor_contrato` e `admin`.
   **Uma exceção, e só ela: `prospeccao_leads`** (ADR-107) — o cadastro de
   interesse do site público, escrito por VISITANTE meses antes de existir
   contrato. Sem `escola_id`, sem RLS, e as queries dela rodam fora de
   `comTenancy`. Quem tranca é o papel (`admin`) na leitura; a escrita é pública
   por desenho. Tabela nova NÃO herda essa exceção.
2. **Nenhum segredo em bundle client** (experiências e hub client-side): sem
   API keys, sem prompts de sistema, sem URLs internas. IA só via `api /ai/*`.
3. **Respostas corretas / correção / pontuação que vale nota: server-side.**
   O client envia a resposta do estudante; a api corrige.
4. **Token**: hub obtém via OIDC (WSO2), repassa à experiência por `postMessage`
   com `targetOrigin` explícito (nunca `*`). Token só em memória, nunca em `localStorage`.
5. **IA tem quota**: por usuário/dia e POR PERFIL, e **o teto é DADO, não env**
   (ADR-105): a linha do perfil em `ia_quotas` (`estudante` | `professor`),
   editada só pelo `admin` em `/unooria/uso-de-ia`.
   Não recrie `AI_DAILY_TOKEN_QUOTA_PER_*` como fallback. E rate limit por
   usuário. Nunca exponha chamada de IA sem passar pelo `QuotaService`
   (`temSaldo(escola, usuario, perfil)` ANTES, `consumir` depois). **Exceção
   única: a Ajuda com avatar** (ADR-132), limitada por minutos (`ajuda_limites`).
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
   - Tabela `disponibilidades`: uma linha por (recurso `produto:<slug>` ou
     `experiencia:<expId>`, escopo escola, regional ou contrato). **Ausência de
     linha = LIGADO** (salvo produto em teste interno, que nasce desligado) — o
     contrário de `liberacoes`, porque este interruptor é mecanismo de EXCEÇÃO. **O escopo mais específico ganha** e **o produto é um
     TETO**: desligado no escopo que vale, nada dentro dele liga. Detalhe em
     `apps/api/src/recursos/AGENTS.md`.
   - **Experiência nova entra no painel declarando `produto` no
     `public/experiencia.json`** — a composição produto → experiências é
     DERIVADA do manifesto, e `apps/api/tests/manifestos-declaram-produto.spec.ts`
     cobra o campo. Nunca uma lista mantida à mão: é a que ninguém atualiza.
   - Quem opera é SÓ o `admin`, na área `/unooria` (ADR-88): a primeira capacidade
     que ele tem e `gestor_contrato` não.


### Token e emissor
O HUB assina os tokens de experiência (RS256, TTL 15min, claims
`{sub, escola_id, turma_id?, perfil}`, aud `plataforma-api`) e serve o JWKS em
`/.well-known/jwks.json`; a api valida via `OIDC_ISSUER`/`OIDC_JWKS_URI`, então
trocar para WSO2 = trocar essas envs. Papéis:
`estudante | professor | gestor_escola | gestor_regional | gestor_contrato | admin`
(os dois últimos são a exceção cross-escola). **Quem atribui quem sai da CADEIA**
— `admin → gestor_contrato → gestor_regional → gestor_escola → professor/estudante`,
nunca para cima (ADR-80; o detalhe, e o porquê de o `gestor_regional` não tocar a
RLS, estão em `apps/api/AGENTS.md`). O claim `turma_id` é a matrícula PRINCIPAL
do estudante (ver `apps/api/src/rostering/AGENTS.md`).

**Quem faz o quê** (matriz papel x rota x tela, e as ausências deliberadas):
`documentacao-latex/secoes/07-tenancy-seguranca.tex`, "Nível 3". **Quem ESCREVE
pessoa é o importador** (`POST /rostering/importar`); `POST /usuarios` só monta a
linha de planilha e delega a ele — a exceção é `POST /usuarios/sem-escola`, dos
papéis que não cabem numa planilha da escola (ADR-54 + ADR-59). Os quatro papéis
de gestão dividem a MESMA área do middleware: quem os separa é o `RolesGuard` da
api, não o hub, e **ninguém cria o próprio nível nem um acima** (a rota responde
403).

## O que NÃO fazer — a versão curta

A lista completa, com o custo de cada uma, está em
[`docs/regras/o-que-nao-fazer.md`](docs/regras/o-que-nao-fazer.md). Aqui, só as
proibições:

- Não criar serviço Cloud Run novo sem necessidade demonstrada (a api absorve).
- Não adicionar Redis/filas/libs de estado sem gargalo medido.
- Não escrever migração que remova `escola_id` ou afrouxe RLS.
- Não chamar provedores de IA fora de `apps/api/src/ai` (a exceção é o agente de IA do professor, ADR-126).
- Não rodar Snyk (CLI ou MCP): a varredura é do CI.
- Não escrever conteúdo em `CLAUDE.md`: é o ponteiro `@AGENTS.md`, mais o bloco que
  o graphify escreve e reescreve (ADR-124).
- **Não escrever interface sem antes procurar no DS**, nem componente local
  silencioso, nem `overflow` onde há `ScrollBar`, nem `<select>` onde há
  `Selection`. E não misturar seções do DS (plataforma dentro do clone).
- Não deixar o DS parado: em `0.x` o caret só sobe patch; minor é decisão ativa.
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
- [ ] Mexeu em tela? A suíte e2e do papel (`node scripts/e2e/rodar.mjs <papel>`);
      tela nova = passo novo (`titulo`/`mostra`/`prova`), e espera de IA **corre
      contra o erro**, nunca cega
- [ ] Input externo validado com Zod; query nova escopada por tenancy (regra 1);
      sem segredo, prompt de sistema ou URL interna em código client
- [ ] Produto ou experiência nova: **aparece no painel da Unooria e DESLIGA**
      (regra 8) — o modo de falhar é MUDO
- [ ] Tocou contrato (bridge/telemetria/provider)? Docs atualizados
- [ ] Regra mudou? O `AGENTS.md` ou o `docs/regras/` afetado, no mesmo commit
- [ ] **`documentacao-latex/` atualizada e `main.pdf` regerado.** Decisão com
      alternativa descartada = **ADR nova** em `secoes/18-adr.tex`. Mudou tela
      ou regra? O selo no **mapa de produto** (`produto/`) também
