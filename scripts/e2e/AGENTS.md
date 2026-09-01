# scripts/e2e — a suíte de ponta a ponta

Complementa o `AGENTS.md` da raiz.

**A doutrina desta pasta é o `README.md` ao lado, e ele não entra sozinho no seu
contexto: leia-o antes de escrever ou alterar uma suíte.** O que está aqui é só
o que decide se você precisa abri-lo.

- **Tela nova ou alterada = passo novo, com `titulo`/`mostra`/`prova`.** O deck e
  as legendas dos vídeos nascem do `passos.json`, não de um roteiro à mão — que
  existiu, com 66 KB, e divergiu.
- **A suíte vai pelo PAPEL de quem usa, não pela experiência** (ADR-51), e a
  ordem do runner não é alfabética: `estudante` PRODUZ o estado que `professor`
  lê, e a administração vem por último porque importa gente e troca senha.
- **Espera nova corre contra o erro** (`lib/smoke.mjs`: `esperarOuFalharCedo`,
  `esperarOuFalharPorHttp`). Espera cega paga o timeout inteiro e reporta o
  seletor que faltou em vez da causa.
- **Erro provocado de propósito se declara** (`r.provocado(...)`), senão a
  corrida que prova que a trava funciona é a que pinta de vermelho.
- **`testes/` é descartável e está no `.gitignore`** — prints, deck e vídeos se
  reproduzem rodando de novo. Nunca commite nada de lá, e nunca compare prints
  de duas corridas na mesma pasta: ela é apagada a cada execução.

Rodar só o papel afetado (`node scripts/e2e/rodar.mjs professor`) é o caminho
normal; a suíte inteira leva o tempo de uma pessoa almoçar.
