## Promoção de ambiente

<!-- Use este template nos PRs `dev → hml` e `hml → main`.
     Link: …/compare/hml...dev?template=promocao.md -->

**De → para:** `dev` → `hml`  <!-- ou `hml` → `main` -->

## O que vai junto

<!-- Cole a saída de:  git log --oneline origin/hml..origin/dev
     Promoção é lote: o que se revisa aqui é o CONJUNTO, não cada commit. -->

```
```

## Antes de mergear

- [ ] Suíte de ponta a ponta INTEIRA verde contra o ambiente de origem: `node scripts/e2e/rodar.mjs`
- [ ] Nenhuma migração pendente de decisão — migração é sempre para frente (`RENAME`, nunca `DROP/CREATE`)
- [ ] Variável de ambiente nova já existe nas `vars` do environment de destino (`scripts/configurar-github-ci.sh`)
- [ ] Experiência com versão nova: o `ativar-exps` vai escrever `versaoAtiva` — confira que o bundle subiu antes
- [ ] Merge por **merge commit** (não squash): o histórico do ambiente precisa mostrar o que veio junto

## Só para `hml → main` (produção)

- [ ] Versão escolhida: `vX.Y.Z` — MAJOR só em quebra de contrato externo (protocolo do bridge, manifesto, telemetria, contrato do Terraform)
- [ ] Depois do merge: `git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z && gh release create vX.Y.Z --generate-notes`
- [ ] Plano de volta conhecido para o que está subindo (experiência = `versaoAtiva`; hub/api = revisão do Cloud Run)
