# documentacao-latex — a documentação técnica é entregável, não subproduto

Complementa o `AGENTS.md` da raiz (a tabela "o que mudei → o que atualizo" está
lá, e a Definition of Done exige esta pasta atualizada e o `main.pdf` regerado
**no mesmo commit**).

**As convenções completas de edição estão no `README.md` ao lado, e ele não
entra sozinho no seu contexto: abra-o antes de escrever `.tex`.** Aqui ficam as
armadilhas que já custaram tempo e não avisam quando você cai nelas:

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
