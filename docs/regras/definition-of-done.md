---
paths:
  - "apps/**/*.{ts,tsx}"
  - "packages/**/*.{ts,tsx}"
---

# Definition of Done (qualquer tarefa)

A lista completa, com o porquê de cada item. Complementa o `AGENTS.md` da raiz,
que vence em conflito — e que carrega a versão curta desta lista.

## Definition of Done (qualquer tarefa)

- [ ] Typecheck + lint + testes passando (`pnpm turbo typecheck lint test`).
      No PR para `dev-local` este item É o portão: o CI só roda nos PRs para
      `dev`, `hml` e `main` (ADR-121), e o GitHub não mostra check nenhum ali.
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
- [ ] **Produto ou experiência nova: aparece no painel da Unooria e DESLIGA**
      (regra 8). Experiência declara `produto` no `public/experiencia.json`;
      superfície nova de produto entra debaixo do layout que chama
      `exigirProdutoLigado`, e rota de api nova da ferramenta herda o
      `DisponibilidadeGuard` da classe. O modo de falhar é MUDO: tudo funciona
      e o produto deixa de poder ser desligado
- [ ] Se tocou contrato (bridge/telemetria/provider): docs atualizados
      (`docs/regras/bridge-postmessage.md` e `secoes/09-contratos-integracao.tex`)
- [ ] Se a regra mudou: o `AGENTS.md` da pasta ou o `docs/regras/` afetado mudou no mesmo commit
- [ ] **`documentacao-latex/` atualizada e `main.pdf` regerado** (a tabela "Se você mudou…" está em
      `docs/regras/documentacao-latex.md`).
      Decisão com alternativa descartada = ADR nova em `secoes/18-adr.tex`
- [ ] **Mudou tela ou regra de negócio? O mapa de produto muda no mesmo PR**
      (`documentacao-latex/produto/mapa-de-produto/`, PU-PRD-001): a história
      troca o selo, história nova ganha id novo (nunca reaproveitado) e o PDF é
      recompilado com `tectonic -k mapa-de-produto.tex` na pasta. É a
      documentação de PRODUTO (pessoas, telas e regras, sem rota, tabela nem
      módulo), separada da técnica (PU-DOC-001): uma não substitui a outra, e é
      a de produto que o PO lê. Sem isso ela vira retrato de um dia e para de
      responder "o que a plataforma faz hoje"
