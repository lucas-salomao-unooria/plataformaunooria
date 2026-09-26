# Como se trabalha neste repositório

Uma pessoa desenvolve; do outro lado há escola pública, criança e dado de menor.
O fluxo abaixo existe para que nada chegue lá sem passar por um portão — e para
que, quando algo chegar errado, dê para dizer **o que** subiu, **quando** e como
voltar atrás.

Este documento é o fluxo completo. O resumo operacional está em
[`AGENTS.md`](AGENTS.md), seção "Git e branches"; a decisão de desenho, na
**ADR-53** (um ambiente por branch) e na **ADR-56** (este fluxo, e como ele é
imposto sem *branch protection*).

## O mapa: quatro branches, quatro ambientes, quem testa em cada um

| Branch | Ambiente | Quem testa ali | O que o merge dispara | Hoje |
|---|---|---|---|---|
| `dev-local` | Docker na máquina de quem desenvolve (`pnpm docker:dev`) | **você** | nada automático — você sobe a stack local e olha | ativo; é a base de toda branch de trabalho |
| `dev` | stack GCP de dev | **o time** | deploy da stack dev | ativo — é a `default_branch` do repo |
| `hml` | stack GCP de hml | **o cliente** | deploy da stack hml | ativo |
| `main` | produção | as escolas | deploy de produção | **ainda não dispara**: `main` não está em `on.push.branches` do `deploy.yml`, e o environment `prd` não existe |

**`dev-local` não tem stack em nuvem e não aparece no `deploy.yml`** — de
propósito. Ela é a camada onde o código é integrado e visto rodando *antes* de
custar um deploy e o tempo de outra pessoa. É branch de AMBIENTE mesmo assim: o
ambiente é o seu Docker, e o `pre-push` recusa push direto nela pela mesma razão
que recusa em `dev` — o que entra ali entra por PR, com registro.

O `deploy.yml` já sabe traduzir a branch em environment
(`main → prd`, `dev → dev`, `hml → hml`). Ligar produção, quando for a hora, são
dois atos: criar o environment `prd` com as `vars` do `terraform output`
(`scripts/configurar-github-ci.sh`) e acrescentar `main` ao gatilho de `push`.

**Nada de push direto em branch de ambiente.** O merge do PR é o que sobe código
para a escola; um push direto pula o portão e não deixa registro. O hook
`pre-push` recusa (ver "Os hooks").

## O ciclo normal

**Toda tarefa começa abrindo uma frente** (ADR-101). Não existe "tarefa pequena
demais para um worktree": a cópia principal é onde a stack roda, e trabalho
não commitado dela é o que aparece misturado no `git status` da próxima vez.

```bash
pnpm worktree criar fix/quota-por-perfil --fatia api/ai,hub/professor
# ... trabalho, com commits Conventional (o hook commit-msg valida) ...
pnpm turbo typecheck lint test                # a DoD, antes do PR
git push -u origin fix/quota-por-perfil
gh pr create --base dev-local --fill          # o template do PR já traz a checklist
```

Depois do merge em `dev-local`, você sobe o Docker local (`pnpm docker:dev`) e
**vê a coisa rodando**. É esse olhar que autoriza o PR seguinte, `dev-local →
dev` — o primeiro que custa um deploy e o tempo de outra pessoa.

**Nome da branch:** o código da experiência nova (`exp06ef3b`,
`app-93-diario-de-bordo` — ADR-110), e só ela na branch; `tipo/slug` para o resto — `feat`, `fix`, `chore`, `docs`, `ci`,
`refactor`, `test`, `perf`, `build`, `style`, `hotfix`.

**Mensagem de commit:** `tipo(escopo): o que mudou`, o escopo sendo o código da
experiência ou o app/pacote (`feat(exp06ef3b):`, `fix(api):`, `chore(sdk):`).
Quebra de contrato leva `!` antes dos dois-pontos.

**O PR fecha quando o CI passa** — `typecheck`, `lint`, `test` e `build`, com um
Postgres de verdade (9 das 23 suítes da api são de integração). Tela alterada
pede também a suíte de ponta a ponta do papel afetado, na sua máquina: o CI não
abre navegador.

## Worktree: onde o trabalho acontece

**A cópia principal não é lugar de editar.** Ela é onde a stack roda — `pnpm
docker:dev`, a suíte e2e, as migrações — e é a checagem do que está em
`dev-local`. Editar ali significa que o `git status` que você olha antes de um
deploy mistura o que subiu com o que você ainda está escrevendo.

`git switch -c` também não resolve: existe **uma** árvore de trabalho, e ela
carrega as alterações não commitadas de quem estava antes. O `git status`
misturado é de onde sai o commit errado.

Por isso **toda tarefa ganha um worktree**, paralela ou não, e um comando faz o
caminho inteiro:

```bash
pnpm worktree criar feat/clarity-analytics --fatia api/telemetry,hub/analise
pnpm worktree listar                          # as frentes, e a porta de Vite de cada uma
pnpm worktree remover clarity-analytics       # depois do merge
```

`--fatia` é **obrigatória** — o script recusa sem ela. Frente que não toca
módulo de domínio declara a pasta da ferramenta: `--fatia scripts,.githooks`.

Ele faz o que a mão faria — e os dois passos que a mão esquece:

```bash
git fetch origin
git worktree add -b feat/clarity-analytics .claude/worktrees/clarity-analytics origin/dev-local
cd .claude/worktrees/clarity-analytics
pnpm install                                  # node_modules NÃO é compartilhado
pnpm --filter @edu/api exec prisma generate   # o client do Prisma também é por worktree
cp ../../../apps/api/.env apps/api/.env       # os .env são ignorados: não viajam
```

**`origin/dev-local` está escrito no comando de propósito.** Nenhuma ferramenta
adivinha a base certa: a `default_branch` no GitHub é `dev`, e um clone antigo
ainda carrega `origin/HEAD` apontando para `origin/main`. Qualquer coisa que
"parta da branch padrão" — inclusive a criação automática de worktree do Claude
Code — abre a branch sobre `dev` ou sobre **produção**, nunca sobre a base do
seu ambiente local. O erro é silencioso: compila, os testes passam, e o PR
aparece com um diff cheio de commits que já estavam lá.

E a base importa mais do que parece porque **`dev-local` pode estar à frente de
`dev`**: é ela que recebe o trabalho primeiro. Sair de `dev` é nascer sem o que
você mesmo integrou ontem — foi assim que uma frente reservou a ADR-79 sobre
`dev-local`, que já tinha a 78, enquanto `dev` ainda parava na 71.

```bash
git remote set-head origin --auto              # origin/HEAD passa a seguir o GitHub
git log --oneline origin/dev-local..HEAD       # antes do PR: só os seus commits
```

Daí em diante nada muda — commits Conventional, push, `gh pr create --base
dev-local`. O worktree é onde o trabalho acontece, não um fluxo novo.
Decisões em **ADR-61** (o worktree) e **ADR-101** (`dev-local` como base).

**Três coisas que mordem:**

| Situação | O que acontece |
|---|---|
| `pnpm docker:dev` de dentro do worktree | **Não faça.** O nome do projeto do compose vem do diretório: sobe uma segunda stack que recria os containers da principal e disputa as mesmas portas. Quem precisa da stack inteira usa a cópia principal. |
| Dependência nova, ou schema do Prisma alterado | `node_modules` e o client do Prisma são por worktree. `pnpm install` + `prisma generate` de novo, no worktree. |
| Terminar a frente | **não precisa fazer nada**: o `git pull` em `dev-local` depois do merge poda a frente sozinho (abaixo). À mão, `pnpm worktree remover <slug>`. |

`.gitignore` já cobre `.claude/*`, então o worktree não aparece no `git status`
da cópia principal — e não precisa de entrada nova.

### A frente mergeada se enterra sozinha (ADR-103)

**O merge do PR acontece no GitHub, e nenhum hook local dispara nele.** O
primeiro momento em que a sua máquina fica sabendo é o `git pull` em
`dev-local` — e é aí que o `.githooks/post-merge` roda `pnpm worktree limpar`.

```bash
git switch dev-local && git pull      # a poda acontece aqui, sozinha
pnpm worktree limpar                  # à mão, quando quiser
pnpm worktree limpar --seco           # só mostra o que removeria
```

A poda remove o worktree, a branch local e a remota. Ela **nunca remove
trabalho**, e as três recusas são deliberadas:

| Situação | O que acontece |
|---|---|
| worktree com alteração não commitada | **pulado**, e o `git status` dele é impresso. Você decide |
| a frente de onde você está rodando | pulada, com aviso — mude para a cópia principal |
| branch sem commit próprio | **não conta como mergeada.** Uma frente aberta agora aponta para o mesmo commit da base e seria trivialmente "ancestral" dela: sem esta regra, abrir uma frente apagaria a que o vizinho acabou de abrir |

`pnpm worktree criar` também poda antes de abrir — quem começa uma frente já
fechou a anterior —, e `pnpm worktree listar` marca as mergeadas que sobraram.
Escape do hook: `PULAR_PODA_DE_WORKTREE=1 git pull`.

**O hook nunca derruba o `git pull`**: qualquer erro dele sai como aviso e o
`exit` é 0.

### PR empilhado: mergeie de cima para baixo

Duas frentes que tocam os mesmos arquivos **serializam** (é a ADR-71), e a forma
de serializar sem esperar é empilhar: a segunda nasce da branch da primeira, e o
PR dela tem a primeira como base.

```bash
# A frente 2 sai da branch da frente 1, não de origin/dev-local:
git worktree add -b chore/frente-2 .claude/worktrees/frente-2 chore/frente-1
gh pr create --base chore/frente-1 --head chore/frente-2
```

**A ordem do merge é de CIMA para baixo — a de trás primeiro.** Mergear o PR de
baixo antes fecha a porta do de cima: o de baixo some do fluxo, e o que estava
empilhado nele fica parado na branch, sem PR aberto para lugar nenhum.

Foi o que aconteceu em 2026-09-15 com os PRs #51 e #52. O #51
(`chore/fluxo-dev-local → dev-local`) foi mergeado primeiro; o #52 entrou depois
em `chore/fluxo-dev-local`, que já não tinha PR aberto. Seis commits ficaram
invisíveis em `dev-local` até alguém abrir o #53 — e o sintoma foi enganoso:
`git status` limpo, PRs todos verdes, e a metade do trabalho simplesmente não
estava lá.

Se a ordem inverter, o conserto é um PR novo da branch de baixo para o destino:
o conteúdo não se perde, só não chegou.

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
| A | `apps/api/src/unoogpt/` + a rota do hub + `apps/experiencias/exp02em1b/` |
| B | `apps/api/src/bemestar/` + `/professor/bem-estar` + `app-91-bem-estar/` |
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
| `apps/hub/middleware.ts`, `apps/hub/lib/experiencias-dev.ts` | edite só a sua entrada. A porta de dev se reserva como o número da ADR: conferindo `origin/dev-local` |

**A costura é o último commit da frente, não o primeiro** — separado, e depois
de `git fetch origin && git merge origin/dev-local`. Rebase está desabilitado neste
repositório (o job `mudancas` compara `HEAD^`), então merge de `dev-local` para
dentro da frente é o jeito de se atualizar. Faça cedo e várias vezes: deixar para a
véspera do PR é o que transforma quatro conflitos triviais em um difícil.

**A fatia é barreira, não conselho.** `pnpm worktree criar --fatia …` resolve os
caminhos contra a árvore (`api/unoogpt` → `apps/api/src/unoogpt`,
`hub/professor` → `apps/hub/app/(plataforma)/professor`) e grava a lista em
`<git-dir>/fatia` — que num worktree é `.git/worktrees/<slug>/`, privado daquela
frente e fora do versionamento. O `.githooks/pre-commit` confere o index contra
ela e **recusa** o que estiver fora, com o escape nomeado
`PERMITIR_FORA_DA_FATIA=1`, como os outros hooks. A costura passa (é ela que
liga o módulo novo ao resto), mas passa **avisando** que o lugar dela é um
commit separado no fim. Sem o arquivo, o hook é inerte: a cópia principal e
qualquer frente sem fatia declarada seguem livres.

**O briefing da frente é escrito, não subentendido.** `criar` imprime no fim um
texto pronto para colar no agente (ou para você mesmo seguir): a fatia
resolvida, o que é costura, e o que **não** se roda dali.

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
pnpm --filter @edu/exp02em1b dev -- --port 5274     # strictPort continua valendo
# no navegador, com sessão de estudante:
#   http://localhost:3000/dev-embed?src=http://localhost:5274
```

Funciona porque o `/dev-embed` aceita `?src=` e o hub em container troca só o
host (`host.docker.internal`), preservando a porta. O que **não** viaja com o
worktree: `apps/api/.env` e
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
| `documentacao-latex/secoes/18-adr.tex` | **reserve o número na HORA de escrevê-lo**, conferindo `origin/dev-local` E as branches de trabalho abertas (não a sua cópia, e não uma vez só no começo da frente). Dois agentes já escreveram a mesma "ADR-N" ao mesmo tempo, em 2026-09-06 e de novo em 2026-09-07. E conferir só a branch de integração não basta: em 2026-09-08 `origin/dev` parava na 71 enquanto as branches de trabalho já iam até a 83. **O próximo número é a 105** — e quem gastar o 105 corrige esta célula no mesmo commit, senão a lista mente para a próxima frente, como mentiu sobre a 100 em 2026-09-15 |
| `documentacao-latex/main.pdf` | binário: sempre conflita. Resolve-se **regerando**, nunca escolhendo um lado — quem mergeia por último recompila |
| `AGENTS.md` da raiz | edite a seção da sua frente, não a vizinha; conflito aqui é textual e resolve na mão |
| `pnpm-lock.yaml` | conflitou? `git checkout --theirs pnpm-lock.yaml && pnpm install` e commite o resultado |

E a fila do outro lado: merge em `dev-local` não dispara nada (o ambiente é o
seu Docker), mas cada merge em `dev` dispara um deploy da stack dev, que
**não cancela** o anterior (`cancel-in-progress: false`, de propósito — abortar
no meio de uma migração é pior). Três PRs mergeados em rajada são três deploys
em sequência. Não é bug; é o custo de ter um ambiente por branch.

## Promoção `dev-local → dev`

É a primeira promoção da escada, e a única cujo portão é **você olhando a coisa
rodar**. Antes dela, nada saiu da sua máquina.

```bash
pnpm docker:dev                                   # a stack inteira, com o que acabou de entrar
node scripts/e2e/rodar.mjs <papel>                # o papel que a mudança afeta
git log --oneline origin/dev..origin/dev-local    # o que exatamente está indo
gh pr create --base dev --head dev-local --title "promoção: dev-local → dev"
```

**O que se verifica aqui é o que o CI não vê.** O CI roda typecheck, lint,
testes e build; ele não abre navegador. Ícone que virou texto, link sublinhado,
iframe vazio e tela que não hidrata passam inteiros por um CI verde — e do lado
de lá de `dev` há outra pessoa perdendo a manhã com isso.

Pode juntar várias frentes numa promoção só: `dev-local` acumula, e promover um
lote coerente é melhor do que um PR por frente. O que não se faz é pular a
camada — PR de branch de trabalho direto para `dev` é o atalho que tira o único
portão onde alguém de fato *olhou*.

**Depois do merge, `dev-local` fica 1 commit atrás de `dev` — e isso se
resolve sozinho** (ADR-104). O merge do PR nasce **no destino**: `dev` ganha um
*merge commit* que `dev-local` não tem, ainda que o conteúdo seja idêntico
(`git diff` entre as duas dá vazio).

```
antes:   dev-local  A───B───C          depois:  dev-local  A───B───C
         dev        A                                              ╲
                                                 dev       A────────M
```

Uma vez é cosmético. **O problema é que acumula**: a cada promoção mais um, e a
próxima frente nasce de uma base cada vez mais atrás do que está publicado. Pior,
**o primeiro hotfix muda isso de cosmético para real** — ele desce de `main` por
retro-merge e chega em `dev` antes de chegar aqui; uma frente aberta no meio
nasce sem a correção, que é o defeito que a ADR-101 existe para evitar.

O próximo `pnpm worktree criar` conserta antes de abrir a frente: como
`dev-local` está **contida** em `dev`, mover o ponteiro é *fast-forward* — não
cria commit nem muda arquivo. À mão, se quiser fazer na hora:

```bash
git switch dev-local && git merge --ff-only origin/dev
PERMITIR_PUSH_DIRETO=1 git push origin dev-local
```

O escape é deliberado e aparece na saída do script: `dev-local` é branch de
ambiente e o `pre-push` recusa push direto nela, mas um *fast-forward* não traz
conteúdo — só atualiza o ponteiro. **Se as duas divergirem de verdade** (cada uma
com commit que a outra não tem), o script RECUSA e manda resolver à mão: mover a
base por cima do que só existe nela perderia trabalho.

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

**Depois de mergear, o deploy não acabou quando o merge acaba.** Os passos são
independentes, e a falha de um deixa os outros aplicados — em 2026-09-15 o
`deploy-hub` de hml caiu e o ambiente ficou dez minutos com o banco migrado e a
api nova servindo um hub VELHO, numa promoção que renomeava papéis; `ativar-exps`
e `smoke` foram pulados e nada avisou. Confira o que subiu, não só o que falhou:

```bash
gh run view <id> --json jobs --jq '.jobs[] | "\(.name): \(.conclusion)"'
gh run rerun <id> --failed      # só para falha de INFRAESTRUTURA (credencial, rede)
```

Falha de código, teste ou migration não se resolve re-rodando: a correção nasce
numa frente sobre `dev-local` e sobe a escada de novo. O apêndice F do PDF traz os sintomas e o rollback por camada.

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
Não existe tag em `dev-local`, `dev` nem `hml`: ambiente de trabalho não tem
versão, tem ponta.

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
# e, depois desse, hml → dev e dev → dev-local pelo mesmo caminho
```

Hotfix que não volta é a correção que renasce como bug na promoção seguinte — e
ele tem de descer a escada **inteira**, até `dev-local`: parar em `dev` deixa a
sua base local sem a correção, e a próxima frente nasce sem ela. Se o
retro-merge não couber no mesmo dia, ele é o primeiro item do dia seguinte.

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
| `pre-push` | push direto em `dev-local`/`dev`/`hml`/`main` (inclusive deleção) | `PERMITIR_PUSH_DIRETO=1` |
| `pre-push` | nome de branch fora do padrão | `PERMITIR_BRANCH_FORA_DO_PADRAO=1` |
| `commit-msg` | assunto fora de Conventional Commits | `git commit --no-verify` |
| `pre-commit` | arquivo fora da fatia declarada da frente (só quando existe `<git-dir>/fatia` — a cópia principal segue livre) | `PERMITIR_FORA_DA_FATIA=1` |
| `post-merge` | **não recusa nada** — poda as frentes já mergeadas no `git pull` de `dev-local`. Nunca derruba o pull (ADR-103) | `PULAR_PODA_DE_WORKTREE=1` |

Os escapes existem e são nomeados de propósito: emergência acontece, e é melhor
que ela deixe rastro numa variável explícita do que numa flag genérica. **Hook é
conselho, não muralha** — quem clona e não roda `pnpm install` não tem nenhum.
No dia em que o repo virar Pro ou público, o mesmo conjunto de regras vira
*ruleset* no servidor, e aí é muralha.

## Higiene de branches

Branch mergeada é lixo com nome bonito: ela aparece no autocompletar, confunde
`git branch -a` e faz alguém partir de uma base velha.

```bash
git branch --merged origin/dev-local      # o que já está contido em dev-local
git branch -d <branch>                    # local
git push origin --delete <branch>         # remota
```

Ligar `delete_branch_on_merge` nas opções do repositório automatiza o lado
remoto — hoje está desligado, e por isso as branches remotas se acumulam.
