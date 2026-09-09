# documentacao-latex — a documentação técnica é entregável, não subproduto

Complementa o `AGENTS.md` da raiz (a tabela "o que mudei → o que atualizo" está
lá, e a Definition of Done exige esta pasta atualizada e o `main.pdf` regerado
**no mesmo commit**).

**As convenções completas de edição estão no `README.md` ao lado, e ele não
entra sozinho no seu contexto: abra-o antes de escrever `.tex`.** Aqui ficam as
armadilhas que já custaram tempo e não avisam quando você cai nelas:

- **A PRÓXIMA ADR é a 83.** A numeração vai até ADR-82, sem lacuna: a 65 (que
  ficou vaga numa colisão entre frentes paralelas) já foi ocupada pelo guia da
  aula. **Confira na HORA de escrever o número, e não só `origin/dev`**: confira
  as branches de trabalho abertas E a de integração. Conferir `origin/dev` não
  basta — em 2026-09-07 duas frentes simultâneas reservaram a 76 e uma teve de
  ceder, e a base de trabalho pode estar à frente de `dev` (a 79 nasceu sobre
  `dev-local`, que já tinha 78 e `dev` tinha 71). **Número de ADR nunca é
  reaproveitado nem renumerado**: ele já viaja em mensagem de commit, PR e PDF
  distribuído, e renumerar não quebra a referência — faz ela apontar para outra
  decisão, em silêncio.
- **Dentro de `tikzpicture`, `\texttt{}` cru** — as macros `\cd`/`\arq`/`\rota`
  têm cor pensada para fundo claro e ficam invisíveis em nó escuro.
- **Setas são `\seta` e `\implica`**, nunca `→`/`⇒` literais: a Roboto não tem o
  glifo, o XeTeX avisa "Missing character" e **não desenha nada**.
- **ER grande vai em duas figuras retrato**, não em landscape — os grandes
  ficaram ilegíveis em paisagem antes de serem divididos.
- **Diagrama TikZ novo exige o par Mermaid** em `apendices/a-mermaid.tex`:
  diagrama sem par é diagrama que só uma pessoa consegue alterar.
- **`apendices/c-endpoints.tex` é GERADO** (`node scripts/gerar-endpoints-tex.mjs`,
  a partir de `docs/openapi.json`). Editar à mão é perder o texto na próxima
  execução.

```bash
cd documentacao-latex && ./compilar.sh      # --rapido p/ iterar, --limpar p/ limpar
```

`main.pdf` **é versionado de propósito** — é entregável de projeto (cliente,
edital, revisão) e quem precisa dele não tem TeX instalado. Os auxiliares e
`build/` ficam fora. Alterou `.tex` sem regerar o PDF? O commit está incompleto.
