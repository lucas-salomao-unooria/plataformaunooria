# documentacao-latex — a documentação técnica é entregável, não subproduto

Complementa o `AGENTS.md` da raiz (a tabela "Se você mudou… → Atualize" está em
`docs/regras/documentacao-latex.md`; a Definition of Done exige esta pasta e o
`main.pdf` regerados
**no mesmo commit**).

**As convenções completas de edição estão no `README.md` ao lado, e ele não
entra sozinho no seu contexto: abra-o antes de escrever `.tex`.** Aqui ficam as
armadilhas que já custaram tempo e não avisam quando você cai nelas:

- **`produto/` é OUTRA documentação, não um capítulo desta.** O mapa de produto
  (PU-PRD-001, `produto/mapa-de-produto/`) é premissa do trabalho, tanto quanto
  a PU-DOC-001, e é escrito em linguagem de produto: pessoas, telas e regras,
  sem rota, tabela nem módulo. O rastreio técnico fica no Apêndice B dele.
  Frente que muda tela ou regra troca o selo da história no mesmo PR
  (`docs/regras/definition-of-done.md`). Ele compila sozinho, na própria pasta,
  com `tectonic -k mapa-de-produto.tex`, e não pelo `compilar.sh` daqui.

- **O número da próxima ADR se lê em `secoes/18-adr.tex`, não aqui**: é o seguinte ao
  maior que o arquivo tem. **Confira na HORA de escrever o número, e confira
  `origin/dev-local`**, que é a base de toda frente (ADR-101), mais as branches de
  trabalho abertas — `origin/dev` não basta, porque fica ATRÁS, e frentes
  paralelas já reservaram o mesmo número (a 76 em 2026-09-07; a 65 ficou vaga
  numa colisão). **Número de ADR nunca é reaproveitado nem renumerado**: ele já
  viaja em mensagem de commit, PR e PDF distribuído, e renumerar não quebra a
  referência — faz ela apontar para outra decisão, em silêncio.
- **Dentro de `tikzpicture`, `\texttt{}` cru** — as macros `\cd`/`\arq`/`\rota`
  têm cor pensada para fundo claro e ficam invisíveis em nó escuro.
- **Setas são `\seta` e `\implica`**, nunca `→`/`⇒` literais: a Roboto não tem o
  glifo, o XeTeX avisa "Missing character" e **não desenha nada**.
- **ER grande vai em duas figuras retrato**, não em landscape — os grandes
  ficaram ilegíveis em paisagem antes de serem divididos.
- **Diagrama TikZ novo exige o par Mermaid** em `apendices/a-mermaid.tex`:
  diagrama sem par é diagrama que só uma pessoa consegue alterar.
- **A modelagem UML mora em `secoes/05b-modelagem-uml.tex`, e ele NÃO tem
  `\chapter`**: continua o Capítulo 5 (ADR-122). Um capítulo novo no meio
  renumera os seguintes, e "cap. 17" é citado em comentário de código. Mexeu na
  ponte, na quota, na disponibilidade, na sessão, nos papéis ou na implantação?
  A figura UML daquilo muda no mesmo commit — cada uma cita os arquivos de onde
  saiu.
- **`apendices/c-endpoints.tex` é GERADO** (`node scripts/gerar-endpoints-tex.mjs`,
  a partir de `docs/openapi.json`). Editar à mão é perder o texto na próxima
  execução.

```bash
cd documentacao-latex && ./compilar.sh      # --rapido p/ iterar, --limpar p/ limpar
```

`main.pdf` **é versionado de propósito** — é entregável de projeto (cliente,
edital, revisão) e quem precisa dele não tem TeX instalado. Os auxiliares e
`build/` ficam fora. Alterou `.tex` sem regerar o PDF? O commit está incompleto.
