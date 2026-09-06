# Como se trabalha neste repositório

Uma pessoa desenvolve; do outro lado há escola pública, criança e dado de menor.
O fluxo abaixo existe para que nada chegue lá sem passar por um portão — e para
que, quando algo chegar errado, dê para dizer **o que** subiu, **quando** e como
voltar atrás.

Este documento é o fluxo completo. O resumo operacional está em
[`AGENTS.md`](AGENTS.md), seção "Git e branches"; a decisão de desenho, na
**ADR-53** (um ambiente por branch) e na **ADR-56** (este fluxo, e como ele é
imposto sem *branch protection*).

## O mapa: três branches, três stacks

| Branch | Environment | Stack GCP | O que dispara o deploy | Hoje |
|---|---|---|---|---|
| `dev` | `dev` | projeto/workspace de dev | merge de PR de branch de trabalho | ativo — é a `default_branch` do repo |
| `hml` | `hml` | projeto/workspace de hml | merge do PR de promoção `dev → hml` | ativo |
| `main` | `prd` | produção | merge do PR de promoção `hml → main` | **ainda não dispara**: `main` não está em `on.push.branches` do `deploy.yml`, e o environment `prd` não existe |

O `deploy.yml` já sabe traduzir a branch em environment
(`main → prd`, `dev → dev`, `hml → hml`). Ligar produção, quando for a hora, são
dois atos: criar o environment `prd` com as `vars` do `terraform output`
(`scripts/configurar-github-ci.sh`) e acrescentar `main` ao gatilho de `push`.

**Nada de push direto em branch de ambiente.** O merge do PR é o que sobe código
para a escola; um push direto pula o portão e não deixa registro. O hook
`pre-push` recusa (ver "Os hooks").

## O ciclo normal

```bash
git switch dev && git pull                    # sempre parta de dev atualizado
git switch -c fix/quota-por-perfil            # ou exp-12-fracoes, se for experiência nova
# ... trabalho, com commits Conventional (o hook commit-msg valida) ...
git push -u origin fix/quota-por-perfil
gh pr create --base dev --fill                # o template do PR já traz a checklist
```

**Nome da branch:** `exp-NN-slug` para experiência nova (o slug dela, e só ela na
branch); `tipo/slug` para o resto — `feat`, `fix`, `chore`, `docs`, `ci`,
`refactor`, `test`, `perf`, `build`, `style`, `hotfix`.

**Mensagem de commit:** `tipo(escopo): o que mudou`, o escopo sendo o slug da
experiência ou o app/pacote (`feat(exp-12):`, `fix(api):`, `chore(sdk):`).
Quebra de contrato leva `!` antes dos dois-pontos.

**O PR fecha quando o CI passa** — `typecheck`, `lint`, `test` e `build`, com um
Postgres de verdade (9 das 23 suítes da api são de integração). Tela alterada
pede também a suíte de ponta a ponta do papel afetado, na sua máquina: o CI não
abre navegador.

## Worktree: mais de uma frente ao mesmo tempo

O ciclo acima pressupõe uma cópia do repositório e uma tarefa por vez. Quando há
duas frentes em paralelo — duas pessoas, ou mais de um agente — `git switch` não
serve: existe **uma** árvore de trabalho, e ela carrega as alterações não
commitadas de quem estava antes. O `git status` misturado é de onde sai o commit.

Cada frente paralela ganha um worktree, e um comando faz o caminho inteiro:

```bash
pnpm worktree criar feat/clarity-analytics --fatia api/telemetry,hub/analise
pnpm worktree listar                          # as frentes, e a porta de Vite de cada uma
pnpm worktree remover clarity-analytics       # depois do merge
```

Ele faz o que a mão faria — e os dois passos que a mão esquece:

```bash
git fetch origin
git worktree add -b feat/clarity-analytics .claude/worktrees/clarity-analytics origin/dev
cd .claude/worktrees/clarity-analytics
pnpm install                                  # node_modules NÃO é compartilhado
pnpm --filter @edu/api exec prisma generate   # o client do Prisma também é por worktree
cp ../../../apps/api/.env apps/api/.env       # os .env são ignorados: não viajam
```

**`origin/dev` está escrito no comando de propósito.** Um clone antigo deste
repositório carrega `origin/HEAD` apontando para `origin/main` (a
`default_branch` no GitHub já é `dev`, mas o ponteiro local não acompanha
sozinho), e qualquer ferramenta que "parta da branch padrão" — inclusive a
criação automática de worktree do Claude Code — abre a branch **sobre
produção**. O erro é silencioso: compila, os testes passam, e o PR aparece com
um diff cheio de commits que já estavam em `dev`. Conserte a raiz uma vez por
clone e confira antes de cada PR:

```bash
git remote set-head origin --auto            # origin/HEAD passa a seguir o GitHub (dev)
git log --oneline origin/dev..HEAD           # antes do PR: só os seus commits
```

Daí em diante nada muda — commits Conventional, push, `gh pr create --base dev`.
O worktree é onde o trabalho acontece, não um fluxo novo. Decisão em **ADR-61**.

**Três coisas que mordem:**

| Situação | O que acontece |
|---|---|
| `pnpm docker:dev` de dentro do worktree | **Não faça.** O nome do projeto do compose vem do diretório: sobe uma segunda stack que recria os containers da principal e disputa as mesmas portas. Quem precisa da stack inteira usa a cópia principal. |
| Dependência nova, ou schema do Prisma alterado | `node_modules` e o client do Prisma são por worktree. `pnpm install` + `prisma generate` de novo, no worktree. |
| Terminar a frente | `git worktree remove .claude/worktrees/<nome>` depois do merge. Worktree órfão fica em `git worktree list` e segura a branch contra `git branch -d`. |

`.gitignore` já cobre `.claude/*`, então o worktree não aparece no `git status`
da cópia principal — e não precisa de entrada nova.

### Repartir o trabalho: a fatia é vertical, nunca por camada

O worktree resolve a árvore de trabalho. Ele não resolve a pergunta seguinte:
**duas frentes editando `apps/api` e `apps/hub`, que são comuns a tudo.**

O instinto errado é repartir por camada — um agente no backend, outro no
frontend. As duas frentes passam a morar nos mesmos arquivos por motivos
diferentes, e nenhum worktree salva de um merge onde os dois reescreveram o
mesmo service. **Reparta por fatia vertical:** cada frente leva o módulo da api,
a rota do hub e a experiência, juntos.

| Frente | Fatia |
|---|---|
| A | `apps/api/src/unootube/` + a rota do hub + `apps/experiencias/exp-02-unootube/` |
| B | `apps/api/src/bemestar/` + `/professor/bem-estar` + `exp-91-bem-estar/` |
| C | `apps/api/src/salas/` + `/professor/turmas` |

Assim api e hub deixam de ser recurso disputado: dentro deles, a fatia de cada
frente é uma **pasta própria**. Não é sorte — é o desenho de um módulo por
domínio (`catalogo.ts` + `regras.ts` + service + controllers por papel) sendo
usado para o que ele serve. **Duas frentes no mesmo módulo não se paralelizam:
serializam.** Custa menos esperar do que resolver o merge.

O que sobra de verdadeiramente compartilhado é curto, e é **linha de registro,
não lógica**:

| Costura | Como não brigar |
|---|---|
| `apps/api/src/app.module.ts` | 1 import + 1 linha no array. A resolução do conflito é sempre "os dois ficam" |
| `apps/api/prisma/schema.prisma` | `model` novo **no fim do arquivo**, nunca no meio. Duas inserções no fim conflitam limpo; duas no meio, sujo |
| `apps/api/prisma/migrations/` | pastas com timestamps distintos não conflitam em texto — o risco é de **ordem**: duas migrações escritas contra o mesmo estado do banco. Quem mergeia por segundo roda `migrate reset` local antes de acreditar no verde |
| `apps/hub/middleware.ts`, `apps/hub/lib/experiencias-dev.ts` | edite só a sua entrada. A porta de dev se reserva como o número da ADR: conferindo `origin/dev` |

**A costura é o último commit da frente, não o primeiro** — separado, e depois
de `git fetch origin && git merge origin/dev`. Rebase está desabilitado neste
repositório (o job `mudancas` compara `HEAD^`), então merge de `dev` para dentro
da frente é o jeito de se atualizar. Faça cedo e várias vezes: deixar para a
véspera do PR é o que transforma quatro conflitos triviais em um difícil.

**O briefing da frente é escrito, não subentendido.** `pnpm worktree criar
--fatia …` imprime no fim um texto pronto para colar no agente (ou para você
mesmo seguir): a fatia, o que é costura, e o que **não** se roda dali.

### O que roda onde: o paralelismo é de edição e teste unitário

O runtime deste repositório é **singleton**: portas fixas com `strictPort`
(3000, 3001, 5173–5178), um `docker-compose` com nome fixo e bind mount da
cópia atual, um Postgres com um schema. Isso não é descuido — é o que faz
`pnpm dev` falhar alto em vez de servir a experiência errada. Mas significa que
**dois worktrees não rodam a stack ao mesmo tempo**.

| No worktree, à vontade | Só na cópia principal, uma frente por vez |
|---|---|
| editar, `pnpm turbo typecheck lint test` (os unitários e os de contrato) | `pnpm dev` / `pnpm docker:dev` (a stack inteira) |
| `pnpm turbo build --filter=<pacote>` | a suíte de ponta a ponta (`node scripts/e2e/rodar.mjs …`) |
| o Vite de **uma** experiência numa porta alternativa (abaixo) | migração de banco (`migrate deploy`, `migrate reset`) |

Para ver uma experiência do worktree sem derrubar nada: suba só o Vite dela
numa porta livre e embede pelo hub que já está no ar.

```bash
pnpm --filter @edu/exp-02-unootube dev -- --port 5274     # strictPort continua valendo
# no navegador, com sessão de estudante:
#   http://localhost:3000/dev-embed?src=http://localhost:5274
```

Funciona porque o `/dev-embed` aceita `?src=` e o hub em container troca só o
host (`host.docker.internal`), preservando a porta. O que **não** viaja com o
worktree: `apps/api/.env`, `public/videos/` da exp-02 (52 MB, gitignorado) e
qualquer credencial — copie o que precisar, sem commitar.

A DoD exige a suíte e2e do papel afetado para toda tela. Numa frente em
worktree isso quer dizer: terminou a edição, **traz para a cópia principal**
(pelo PR, ou `git switch` para a branch lá) e roda a suíte de lá. Um agente por
vez nessa etapa — é a fila natural, e é melhor que dois navegadores lendo dois
servidores na mesma porta.

### Os arquivos-ímã de conflito

Frentes em pastas diferentes quase não conflitam — é o desenho dos `AGENTS.md`
por fronteira. Quatro arquivos toda frente toca, e é neles que o `git merge`
para:

| Arquivo | Como não brigar |
|---|---|
| `documentacao-latex/secoes/18-adr.tex` | **reserve o número no começo da frente**, conferindo `origin/dev` (não a sua cópia). Dois agentes já escreveram a mesma "ADR-N" ao mesmo tempo |
| `documentacao-latex/main.pdf` | binário: sempre conflita. Resolve-se **regerando**, nunca escolhendo um lado — quem mergeia por último recompila |
| `AGENTS.md` da raiz | edite a seção da sua frente, não a vizinha; conflito aqui é textual e resolve na mão |
| `pnpm-lock.yaml` | conflitou? `git checkout --theirs pnpm-lock.yaml && pnpm install` e commite o resultado |

E a fila do outro lado: cada merge em `dev` dispara um deploy da stack dev, que
**não cancela** o anterior (`cancel-in-progress: false`, de propósito — abortar
no meio de uma migração é pior). Três PRs mergeados em rajada são três deploys
em sequência. Não é bug; é o custo de ter um ambiente por branch.

## Promoção `dev → hml`

Promoção é um PR como outro qualquer — o que muda é que o diff é um lote de
trabalho já revisado, e o que se revisa é o **conjunto**.

```bash
gh pr create --base hml --head dev \
  --title "promoção: dev → hml" \
  --body-file .github/PULL_REQUEST_TEMPLATE/promocao.md
git log --oneline origin/hml..origin/dev     # o que exatamente está indo
```

Antes de mergear: rode a suíte e2e inteira (`node scripts/e2e/rodar.mjs`) contra
a stack de dev. É a última tela de verdade antes de hml.

## Promoção `hml → main` (produção), e a tag

```bash
gh pr create --base main --head hml --title "release: v1.4.0"
# depois do merge:
git switch main && git pull
git tag -a v1.4.0 -m "v1.4.0"
git push origin v1.4.0
gh release create v1.4.0 --generate-notes
```

**A tag é o nome do que está em produção.** Sem ela, "volta para a versão
anterior" vira caça a SHA no histórico de merges — e caça a SHA às 8h da manhã,
com 2 a 4 mil estudantes simultâneos, não é plano de rollback.

Semver, com o significado que faz sentido para uma rede de escolas:

| Parte | Quando sobe |
|---|---|
| **MAJOR** | quebra de contrato com quem está fora do repo: `PROTOCOL_VERSION` do bridge, formato do manifesto, payload de telemetria, contrato com o Terraform |
| **MINOR** | experiência nova, tela nova, rota nova — o caso comum de uma promoção |
| **PATCH** | correção sem contrato novo |

A tag é criada **depois** do merge, apontando para o commit de merge em `main`.
Não existe tag em `dev` nem em `hml`: ambiente de trabalho não tem versão, tem
ponta.

## Hotfix

Produção quebrada não espera a fila `dev → hml → main`, mas também não vira push
direto:

```bash
git switch main && git pull
git switch -c hotfix/login-500
# correção mínima, só o que apaga o incêndio
gh pr create --base main --title "fix(api): ..." --label hotfix
# merge, tag de PATCH (v1.4.1), release
```

**E imediatamente o retro-merge**, senão a próxima promoção desfaz a correção:

```bash
gh pr create --base hml --head main --title "retro-merge: hotfix v1.4.1 em hml"
# e, depois desse, hml → dev pelo mesmo caminho
```

Hotfix que não volta para `dev` é a correção que renasce como bug na promoção
seguinte. Se o retro-merge não couber no mesmo dia, ele é o primeiro item do dia
seguinte.

## Rollback

Cada camada volta de um jeito, e nenhum deles é `git revert` às pressas:

| O que quebrou | Como volta |
|---|---|
| Uma experiência | `node apps/hub/scripts/publicar-manifesto.mjs <exp> --versao <anterior>` — troca `versaoAtiva`; o bundle antigo continua no bucket. Sem build, sem imagem. **Só entre versões do mesmo major do protocolo** |
| Hub ou api | `gcloud run services update-traffic` devolve o tráfego à revisão anterior |
| Conteúdo de professor (planos) | versionamento de objetos do bucket: cada "Salvar" é uma versão |
| Migração de banco | não volta sozinha — migração é sempre para frente (`RENAME`, nunca `DROP/CREATE`) |

`git revert` no código é o passo **seguinte**, para o histórico contar a verdade
— não o instrumento de emergência.

## As regras de merge

- **Merge commit ou squash.** *Rebase merge está desabilitado nas opções do
  repositório* (confirmado: `allow_rebase_merge: false`), e não é preferência
  estética: o job `mudancas` compara `HEAD^` — o primeiro pai, que num merge
  commit é a ponta antiga da branch de ambiente. Um rebase-merge faria o diff
  enxergar só o último commit do PR, e o deploy pularia o pacote que mudou.
- **Squash** para branch de trabalho com histórico bagunçado; **merge commit**
  nas promoções, para o histórico de `hml` e `main` preservar o que veio junto.

## Os hooks

`branch protection` e `rulesets` respondem **403** neste repositório (privado,
plano Free do GitHub). A regra que o servidor não impõe, o hook local impõe:

```bash
pnpm install          # o `prepare` roda: git config core.hooksPath .githooks
```

| Hook | O que recusa | Escape |
|---|---|---|
| `pre-push` | push direto em `dev`/`hml`/`main` (inclusive deleção) | `PERMITIR_PUSH_DIRETO=1` |
| `pre-push` | nome de branch fora do padrão | `PERMITIR_BRANCH_FORA_DO_PADRAO=1` |
| `commit-msg` | assunto fora de Conventional Commits | `git commit --no-verify` |

Os escapes existem e são nomeados de propósito: emergência acontece, e é melhor
que ela deixe rastro numa variável explícita do que numa flag genérica. **Hook é
conselho, não muralha** — quem clona e não roda `pnpm install` não tem nenhum.
No dia em que o repo virar Pro ou público, o mesmo conjunto de regras vira
*ruleset* no servidor, e aí é muralha.

## Higiene de branches

Branch mergeada é lixo com nome bonito: ela aparece no autocompletar, confunde
`git branch -a` e faz alguém partir de uma base velha.

```bash
git branch --merged origin/dev            # o que já está contido em dev
git branch -d <branch>                    # local
git push origin --delete <branch>         # remota
```

Ligar `delete_branch_on_merge` nas opções do repositório automatiza o lado
remoto — hoje está desligado, e por isso as branches remotas se acumulam.
