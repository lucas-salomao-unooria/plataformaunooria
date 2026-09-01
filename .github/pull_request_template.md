## O que muda, e por quê

<!-- Uma frase sobre o efeito para quem usa (estudante, professor, gestor,
     admin-contrato). O "como" está no diff; o "por quê" só está aqui. -->

## Como verifiquei

<!-- O que você rodou, e o que viu. "typecheck passou" não é verificação de
     tela: ícone virando texto e iframe vazio passam no compilador. -->

## Definition of Done

- [ ] `pnpm turbo typecheck lint test` verde
- [ ] Mexeu em tela? Suíte do papel afetado: `node scripts/e2e/rodar.mjs <papel>` — e tela nova virou passo novo, com `titulo`/`mostra`/`prova`
- [ ] Input externo validado com Zod
- [ ] Query nova escopada por `escola_id` (e `estudante_id` quando cabe)
- [ ] Nenhum segredo, prompt de sistema ou URL interna em código client
- [ ] Mexeu em experiência? `versao` do `public/experiencia.json` **e** `version` do `package.json` subiram juntas
- [ ] Regra mudou? O `AGENTS.md` da pasta afetada mudou no mesmo commit
- [ ] `documentacao-latex/` atualizada e `main.pdf` regerado — decisão com alternativa descartada = **ADR nova**

## Risco

<!-- O que pode dar errado depois do merge, e como se volta atrás.
     "Nenhum" é uma resposta válida — mas escreva-a. -->
