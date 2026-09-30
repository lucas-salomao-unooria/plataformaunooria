# Git e branches — o resumo operacional

Complementa o `AGENTS.md` da raiz, que vence em conflito. **O fluxo inteiro**
(promoção, hotfix, retro-merge, tag/release, rollback por camada) **está em
`CONTRIBUTING.md`** — aqui fica só o que decide se você precisa abri-lo.

## Git e branches

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
  (ADR-103) e **atualiza o grafo do graphify** em segundo plano (ADR-125) no
  `git pull` de `dev-local`, e nunca derruba o pull. Instalados pelo `prepare` no `pnpm install` (`core.hooksPath`).
  Escapes nomeados: `PERMITIR_PUSH_DIRETO=1`, `PERMITIR_BRANCH_FORA_DO_PADRAO=1`,
  `PERMITIR_FORA_DA_FATIA=1`.
- **TODA tarefa começa num worktree, e a base vai ESCRITA** (ADR-61, ADR-101):
  `pnpm worktree criar <tipo/slug> --fatia api/<mod>,hub/<rota>,exp/<id>` faz o
  caminho inteiro (worktree sobre `origin/dev-local`, `.env` copiados,
  `install` + `prisma generate`, grafo do graphify copiado, porta de Vite
  reservada, briefing impresso).
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
  (colide mais que os outros porque só existe no texto: duas frentes que escrevem
  ADR ao mesmo tempo escolhem o mesmo "próximo". O último gasto está no fim de
  `documentacao-latex/secoes/18-adr.tex`; confira ali, em `origin/dev-local` — a
  base de toda frente, que costuma estar à frente de `origin/dev` — e nas
  branches de trabalho abertas, NA HORA de escrever o número: conferir uma vez no
  começo da frente não basta. Quem reparte o trabalho entre frentes paralelas
  aloca os números antes de qualquer uma escrever),
  `main.pdf` (regera, não escolhe lado),  `AGENTS.md` da raiz, `pnpm-lock.yaml`. Receita em `CONTRIBUTING.md`.
- **Uma branch por experiência nova**, com o CÓDIGO dela (ADR-110):
  `exp06ef3b` para missão da trilha, `app-93-diario-de-bordo` para o que não é
  missão. Trabalho que não é experiência usa o prefixo do tipo do commit:
  `fix/quota-por-perfil`, `chore/deps`, `ci/deploy`.
- Commits: `feat(exp06ef3b): ...`, `fix(api): ...`, `chore(sdk): ...` — o escopo
  é o código da experiência ou o app/pacote tocado.
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
