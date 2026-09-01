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
git switch -c fix/quota-por-perfil            # ou exp-07-fracoes, se for experiência nova
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
