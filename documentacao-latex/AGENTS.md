# documentacao-latex — a documentação técnica é entregável, não subproduto

Complementa o `AGENTS.md` da raiz (a tabela "o que mudei → o que atualizo" está
lá, e a Definition of Done exige esta pasta atualizada e o `main.pdf` regerado
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

- **A PRÓXIMA ADR é a 120.** A numeração vai até ADR-119 (o podcast da A
  Seleção é do professor, e a IA reescreve só as três falas do tema); a 118 é
  Quem mandou isso? v2.2 (a atividade é o pacote, a rodada é a reaplicação, e a
  régua mede pela seleção e pelas perguntas do PO). A 117 (o Jornal da Escola) está RESERVADA
  para a frente que corre em paralelo — o número foi fechado entre as sessões
  antes de qualquer uma escrever. A 116 é o UnooTube ARQUIVADO, e não apagado,
  para o Jornal da Escola tomar o código `exp04ef1b`; a 115 é A Seleção (o par
  do Mural é do computador, e a IA gradua a legenda); a 114 a primeira versão de
  Quem mandou isso? retirada, para a v2.2 voltar com o mesmo código; a 113 a
  retirada do Eco no Grupo para A Seleção; e a 112 a evidência pedagógica por
  atividade e rodada, com a melhor rodada valendo por habilidade. Este número envelhece a cada frente, então ele é
  ponto de partida, nunca a resposta. Das mais citadas: a 86 é o
  guia da aula, 87 o eixo da disponibilidade, 88 o painel da Unooria só do
  `admin`, 89 o histórico append-only que a rede também lê e 90 a suíte da API
  em um worker. Antes dela: a 65 (que
  ficou vaga numa colisão entre frentes paralelas) já foi ocupada pelo guia da
  aula; a 80 é o modelo de seis papéis, 81 o panorama da diretoria, 82 o
  relatório dela, 83 o header full-bleed, 84 a observabilidade sem sessão e
  85 a remontagem do miolo ao trocar de escola. **Confira na HORA de escrever o número, e confira `origin/dev-local`**,
  que é a base de toda frente (ADR-101) — mais as branches de trabalho abertas.
  `origin/dev` não basta: ele fica ATRÁS. Em 2026-09-07 duas frentes
  simultâneas reservaram a 76 e uma teve de ceder, e a 79 nasceu sobre
  `dev-local`, que já tinha 78 enquanto `dev` tinha 71. **Número de ADR nunca é
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
