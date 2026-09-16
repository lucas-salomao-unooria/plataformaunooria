# Git e branches — o resumo operacional

Complementa o `AGENTS.md` da raiz, que vence em conflito. **O fluxo inteiro**
(promoção, hotfix, retro-merge, tag/release, rollback por camada) **está em
`CONTRIBUTING.md`** — aqui fica só o que decide se você precisa abri-lo.

## Git e branches

**O fluxo inteiro — promoção, hotfix, retro-merge, tag/release, rollback por
camada — está em `CONTRIBUTING.md`.** Aqui fica só o que decide se você precisa
abri-lo.

- **QUATRO ambientes, e cada um tem um testador diferente** (ADR-53, ADR-101):

  | Branch | Ambiente | Quem testa | O merge dispara |
  |---|---|---|---|
  | `dev-local` | Docker na máquina (`pnpm docker:dev`) | **você** | nada — você sobe a stack e olha |
  | `dev` | stack GCP de dev | **o time** | deploy de dev |
  | `hml` | stack GCP de hml | **o cliente** | deploy de hml |
  | `main` | produção | as escolas | deploy de produção |

  **O caminho é sempre: branch de trabalho → PR para `dev-local` → PR para
  `dev` → PR para `hml` → PR para `main`.** Pular `dev-local` tira o único
  portão onde alguém de fato OLHA a tela: o CI não abre navegador, e ícone
  virado texto, link sublinhado e iframe vazio passam por um CI verde.
  **`dev-local` não tem stack em nuvem e não está no `deploy.yml`** — mas é
  branch de AMBIENTE do mesmo jeito, e o `pre-push` recusa push direto nela.
  `main` ainda NÃO dispara: falta o environment `prd` e acrescentar `main` ao
  gatilho de push do `deploy.yml`. Merge por merge commit ou squash; **rebase
  desabilitado**: o job `mudancas` compara `HEAD^`, e um rebase-merge faria o
  diff enxergar só o último commit do PR.
- **Promoção para `main` leva tag semver** (`v1.4.0`) e release, criadas depois
  do merge. A tag é o nome do que está em produção — sem ela, "volta para a
  anterior" vira caça a SHA no meio de um incidente.
- **Hotfix sai de `main`, e desce a escada INTEIRA por retro-merge** — `hml`,
  `dev` e `dev-local` — no mesmo dia. Parar em `dev` deixa a base local sem a
  correção, e a próxima frente nasce sem ela: o hotfix renasce como bug.
- **Os hooks são a única barreira**: `branch protection` e `rulesets` respondem
  403 (repo privado, plano Free). `.githooks/pre-push` recusa push direto em
  branch de ambiente (`dev-local`, `dev`, `hml`, `main`) e nome de branch fora
  do padrão; `.githooks/commit-msg` valida o formato do commit;
  `.githooks/pre-commit` recusa arquivo fora da fatia da frente — só quando
  existe `<git-dir>/fatia`, então a cópia principal segue livre. O
  `.githooks/post-merge` não recusa nada: ele **poda as frentes já mergeadas**
  no `git pull` de `dev-local` (ADR-103), e nunca derruba o pull. Instalados pelo `prepare` no `pnpm install` (`core.hooksPath`).
  Escapes nomeados: `PERMITIR_PUSH_DIRETO=1`, `PERMITIR_BRANCH_FORA_DO_PADRAO=1`,
  `PERMITIR_FORA_DA_FATIA=1`.
- **TODA tarefa começa num worktree, e a base vai ESCRITA** (ADR-61, ADR-101):
  `pnpm worktree criar <tipo/slug> --fatia api/<mod>,hub/<rota>,exp/<id>` faz o
  caminho inteiro (worktree sobre `origin/dev-local`, `.env` copiados,
  `install` + `prisma generate`, porta de Vite reservada, briefing impresso).
  Não é só para paralelismo: a cópia principal é onde a stack RODA, e editar
  nela mistura o que subiu com o que ainda está sendo escrito. Nenhuma
  ferramenta adivinha a base — a `default_branch` do GitHub é `dev`, clone
  antigo tem `origin/HEAD` em `main`, e a criação automática de worktree do
  Claude Code segue a padrão; por isso o `origin/dev-local` do script está
  ESCRITO. **`dev-local` costuma estar À FRENTE de `dev`** (é ela que recebe o
  trabalho primeiro): sair de `dev` é nascer sem o que você integrou ontem.
  `git log origin/dev-local..HEAD` antes do PR confere, e o PR é
  `gh pr create --base dev-local`. **A base se realinha sozinha** (ADR-104):
  toda promoção deixa `dev-local` 1 commit atrás de `dev` (o *merge commit*
  nasce no destino), o atraso ACUMULA, e o primeiro hotfix que descer por
  retro-merge faria a frente nascer sem a correção. O `criar` conserta por
  fast-forward antes de abrir — e RECUSA se as duas divergiram de verdade. **Terminada a frente, não remova nada à
  mão**: o `git pull` em `dev-local` depois do merge poda o worktree, a branch
  local e a remota (ADR-103) — pulando o que tem alteração não commitada, o que
  está em uso, e a branch sem commit próprio. `pnpm worktree limpar --seco`
  mostra o que sairia. **PR empilhado mergeia de CIMA para baixo**: mergear o de
  baixo antes fecha a porta do de cima, e o trabalho fica parado na branch sem
  PR — aconteceu com o #51/#52 em 2026-09-15. Receita em `CONTRIBUTING.md`.
- **Reparta por fatia VERTICAL, nunca por camada** (ADR-71). `apps/api` e
  `apps/hub` são comuns a todas as frentes: um agente "no backend" e outro "no
  frontend" moram nos mesmos arquivos e brigam no merge. Cada frente leva o
  módulo da api + a rota do hub + a experiência, juntos — aí a fatia de cada uma
  dentro de api/hub é uma pasta própria. Duas frentes no mesmo módulo não se
  paralelizam: serializam. O que resta compartilhado é linha de REGISTRO
  (`app.module.ts`, fim do `schema.prisma`, `middleware.ts`,
  `experiencias-dev.ts`) e vai em UM commit no fim, depois de
  `git merge origin/dev-local` — rebase está desabilitado. **A fatia é
  OBRIGATÓRIA e é barreira, não conselho**: `criar` recusa sem `--fatia`, grava
  os caminhos em `<git-dir>/fatia` e o `.githooks/pre-commit` recusa commit fora
  dela (escape: `PERMITIR_FORA_DA_FATIA=1`). Frente que não toca módulo de
  domínio declara a pasta da ferramenta: `--fatia scripts,.githooks`. Receita em
  `CONTRIBUTING.md`.
- **O paralelismo é de EDIÇÃO e teste unitário; o runtime é singleton.** Portas
  fixas com `strictPort`, compose de nome fixo, um banco: dois worktrees não
  rodam a stack ao mesmo tempo. No worktree: editar, `typecheck lint test`,
  build, e o Vite de UMA experiência em porta alternativa
  (`/dev-embed?src=http://localhost:52NN`). Na cópia principal, uma frente por
  vez: `pnpm dev`/`docker:dev`, a suíte e2e, migração. **Nunca**
  `pnpm docker:dev` de um worktree — ele recria os containers da stack
  principal. Arquivos que toda frente toca e brigam no merge: número da ADR
  (a PRÓXIMA é a **105**: a **104 é o realinhamento automático da
      base depois da promoção**, a **103 a poda automática da frente
      mergeada**, a **102 a doutrina numa fonte só, lida por
      quatro agentes**, a **101 o fluxo de quatro ambientes, com
      `dev-local` como base de toda frente**, e a **100 o caminho único da sala
      para a missão** — que ocupou o número em 2026-09-15 e mergeou SEM
      atualizar esta linha, que ainda anunciava a 100 como livre. É o modo de
      falhar desta lista: ela só vale se quem gasta o número a corrige no
      MESMO commit. Antes delas, a 93 é a sincronização de sala por polling da
      exp-08, a 94 o latch por polling da exp-04, a 95 a sessão de 2h de
      inatividade, a 96 a renovação de sessão dentro da missão, a 97 a recusa
      de login na tela, a **98 o fuso único da plataforma** e a **99 esse fuso
      vindo de uma variável de ambiente** — as quatro foram alocadas por quem repartia o trabalho ANTES de
      qualquer frente escrever, e é assim que a colisão de 2026-09-06 e
      2026-09-07 deixa de acontecer; a 86 foi ocupada pelo guia da aula, a 87 e a 88
      pelo eixo da disponibilidade e pelo painel da Unooria, a 89 pelo
      histórico append-only que a rede também lê, a 90 pela suíte da api em um
      worker, a 91 pelas três zonas do idioma da interface, a 92 pelo
      retorno de etapa que reabre a sessão do Instanooria, a **93 pela
      sincronização de sala por polling HTTP em vez de WebSocket** e a **94
      reservada para a frente paralela que corria no mesmo dia** — as duas
      foram alocadas por quem repartia o trabalho, ANTES de qualquer uma
      escrever, e é assim que a colisão de 2026-09-06 e 2026-09-07 deixa de
      acontecer; a 65 foi ocupada pelo guia da aula, a 72 pela
      fronteira do disfarce da exp-06, a 73 pelo planejamento dirigido pela
      BNCC, a 74 pela contabilidade de tokens do `generateJson`, a 75 pela
      rolagem com o `ScrollBar` do DS, a 76 pelo passo semanal do
      planejamento + `allow-downloads`, a 77 pela trilha que virou do layout
      e a 78 pelo logoff no menu do avatar — três frentes fecharam ADR em
      2026-09-06 e duas colidiram na 65, e **em 2026-09-07 aconteceu de
      novo**: duas frentes simultâneas reservaram a 76, uma cedeu e foi para
      a 77/78, a 79 é o vínculo obrigatório escola/regional e a 80 o modelo
      de seis papéis, a 81 o panorama da diretoria, a 82 o
      relatório dela, a 83 o header que ancora na janela, a 84 o sinal do
      navegador sem sessão e a **85 a remontagem do miolo da área ao trocar de
      escola**. Conferir
      só a branch de integração NÃO basta — em 2026-09-08 `origin/dev` parava
      na 71 enquanto as branches de trabalho já iam até a 83 —, e conferir uma
      vez no começo da frente também
      não: confira as branches de trabalho abertas E `origin/dev-local`, na
      HORA de escrever o número — e é `origin/dev-local`, não `origin/dev`, que
      é a base de toda frente e costuma estar à frente),
  `main.pdf` (regera, não escolhe lado),  `AGENTS.md` da raiz, `pnpm-lock.yaml`. Receita em `CONTRIBUTING.md`.
- **Uma branch por experiência nova**, com o nome do slug dela:
  `exp-12-fracoes`. Trabalho que não é experiência usa o prefixo do tipo do
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
