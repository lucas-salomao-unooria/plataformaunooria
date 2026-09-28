## Promoção de ambiente

<!-- Use este template nas TRÊS promoções: `dev-local → dev`, `dev → hml` e
     `hml → main` (ADR-101). Link: …/compare/hml...dev?template=promocao.md -->

**De → para:** `dev-local` → `dev`  <!-- ou `dev` → `hml`, ou `hml` → `main` -->

## O que vai junto

<!-- Cole a saída de:  git log --oneline origin/<destino>..origin/<origem>
     Promoção é lote: o que se revisa aqui é o CONJUNTO, não cada commit. -->

```
```

## Só para `dev-local → dev`

É a primeira promoção da escada, e a única cujo portão é **você olhando a coisa
rodar** — antes dela nada saiu da sua máquina.

- [ ] `pnpm docker:dev` de pé, e a mudança vista na tela
- [ ] **`pnpm turbo typecheck lint test` na raiz: verde.** Aqui ele SUBSTITUI o
      CI: o `ci.yml` não roda em nada que vá para `dev-local`, nem no PR nem no
      merge (ADR-121), então o vermelho se acumula até esta promoção — e costuma aparecer coisa que não é sua
- [ ] Nenhuma frente de trabalho ficou de pé: `pnpm worktree listar` sem
      sobras (a poda é automática no `git pull`, mas confira — ADR-103)

<!-- Depois do merge, `dev-local` fica 1 commit atrás de `dev`: o merge commit
     nasce no destino. Não faça nada — o próximo `pnpm worktree criar`
     realinha por fast-forward (ADR-104). -->

## Antes de mergear

- [ ] Suíte de ponta a ponta INTEIRA verde contra o ambiente de origem: `node scripts/e2e/rodar.mjs`
      <!-- Em `dev-local → dev` que só mexe em documentação ou ferramenta (zero
           .ts/.tsx/.css), diga isso aqui e marque o item como não cumprido, com
           a razão. Não marque o que não fez. -->
- [ ] Nenhuma migração pendente de decisão — migração é sempre para frente (`RENAME`, nunca `DROP/CREATE`)
- [ ] Variável de ambiente nova já existe nas `vars` do environment de destino (`scripts/configurar-github-ci.sh`)
- [ ] Experiência com versão nova: o `ativar-exps` vai escrever `versaoAtiva` — confira que o bundle subiu antes
- [ ] Merge por **merge commit** (não squash): o histórico do ambiente precisa mostrar o que veio junto

## Só para `hml → main` (produção)

- [ ] Versão escolhida: `vX.Y.Z` — MAJOR só em quebra de contrato externo (protocolo do bridge, manifesto, telemetria, contrato do Terraform)
- [ ] Depois do merge: `git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z && gh release create vX.Y.Z --generate-notes`
- [ ] Plano de volta conhecido para o que está subindo (experiência = `versaoAtiva`; hub/api = revisão do Cloud Run)
