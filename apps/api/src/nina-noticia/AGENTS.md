# apps/api/src/nina-noticia — Nina e a Notícia que Desapareceu (exp03ef1b)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

## A missão (exp03ef1b 0.1.0 — instrumento 1.0.0 —, ADR-197, rotas `/nina-noticia/*`)

Missão de 3º ano, unidade 1, no Unoojornal (DS HÍBRIDO, ADR-197). A feira de
livros saiu em TRÊS suportes (mural, portal, telão), as três fotos mostram o
pátio, mas a ficha do telão tem o campo Onde VAZIO: a busca "Onde: Pátio" do
jornal o deixa de fora. Passos: `galeria → aposta → filtro → omissao → ficha →
carimbos → reparo → desfecho → ponte → rotina → caso → fim`. Dois portões da
professora: "Liberar Filtro" (`aposta → filtro`) e "Liberar Inspeção" (`filtro →
inspecao`), mais Pausar/Retomar (flag `pausada`) e Zerar (nova rodada, ADR-155).
Tabelas `exp03ef1b_*` (pacotes, gates_turma, gates_historico, sessoes).

**Hoje a pasta tem só a FUNDAÇÃO** — o contrato puro, sem controller, service
nem Prisma. Quem implementar o resto segue o desenho do Júri
(`src/juri-estadual/`) e a spec da frente.

**A espinha é contrato com a experiência e o hub**: `vocabulario.ts`,
`conteudo.ts`, `banco-padrao.ts`, `invariantes.ts`, `erros.ts`,
`contrato-de-rotas.ts` (com o índice `ROTAS`) e `regras/`. Os dois lados têm
espelhos dessas listas; mudar a forma aqui sem avisar quebra os dois.

- **"aposta" é nome INTERNO** (passo e etapa). Na tela é "escolha" (ajuste do PO,
  spec §7.1); nenhuma frase de `erros.ts` diz "aposta", e o teste cobra.
- **A ESTRUTURA é do servidor, nunca da IA** (`conteudo.ts#FICHA_DO_SUPORTE`,
  `aplicarEstrutura`): três suportes na ordem; Quem = estudantes e Quando = sexta
  nas três; Onde = pátio no mural e no portal e VAZIO no telão; a foto é do pátio
  nas três. A IA escreve só texto e descrição de cena (`TextosGeradosSchema`);
  `invariantes.ts#problemasDoPacote` confere, inclusive que a cena do telão FALA
  do pátio — o prompt (`promptDaImagem`) exige o pátio inequívoco, porque K1
  ("A foto mostra o pátio?") é ✔.
- **O filtro é HONESTO** (`regras/filtro.ts`): booleano por campo, campo vazio
  nunca casa. Os valores de Quem e Quando oferecidos (`VALORES_DO_FILTRO`) NÃO são
  os da feira — só assim "Quem/Quando devolvem 0" (decisão 8) sem mentir no
  resultado. Só Onde = Pátio resolve; o resto conta em `filtro_tentativas`.
- **Gabaritos só no servidor**: os carimbos (K1 ✔ K2 ✖ K3 ✔ K4 ✔ K5 ? K6 ✖, em
  `conteudo.ts#CARTOES_DA_MISSAO`), a `SEQUENCIA_CERTA` da rotina e a regra do
  reparo. Ids OPACOS por sessão (`regras/ordem.ts`): `rp-` reportagens, `et-`
  etiquetas, `bl-` blocos. A bandeja da rotina é sorteada pela semente e NUNCA
  sai na ordem certa (teste em 500 sementes).
- **O reparo (spec §7.6, supera o item 7 da §0)**: a ficha do telão começa com
  os três campos vazios; `POST reparo` manda a ficha MONTADA (uma etiqueta por
  campo, as três); válido ⇔ Pátio em Onde, as outras duas gravadas e não
  avaliadas. Desfecho `sucesso | erro`, os dois com "Continuar".
- **Passo efetivo = min(passo, teto da etapa)** (`regras/passos.ts`): teto
  `aposta`/`omissao`/`fim`. Gravado acima do teto = aguardando a professora.
  `podeAgir`: pausada → 409 `turma-pausada`; jogada além do teto → 403
  `etapa-nao-liberada`; outra → 409 `passo-fora-de-ordem`. O gate só avança.
- **O painel** (`regras/painel.ts`): a linha diz progresso e os dois alertas
  (`semParada`: > 3 testes da rotina sem a válida; `uniformes`: os três carimbos
  de uma etapa iguais) — nunca acerto, escolha nem nível
  (`PROIBIDO_NA_LINHA_DO_PAINEL`, com teste). A escolha da E2 só no agregado.
- **Sem Canal B e sem podcast** nesta frente (spec §0.1 e §0.9).

## A evidência (E14) — `regras/evidencia.ts`

Ficha `evidencias/fichas/exp03ef1b.ts` versão 1 (a escrever), só ação:
`inspecao` EF15CO08 (no `POST ficha`: certo de primeira e sem o pulso =
atingiu), `carimbos` EF03CO01 (no `POST carimbos` da E6; a UNIFORMIDADE vence:
uniforme = não atingiu; K3 ✔ e K5 ? e ≥ 5 de 6 = atingiu), `rotina` EF03CO02 (≤ 2
tentativas contando a válida), `reparo` EF03CO03 e `previsao` EF15CO01 (os dois no
`POST reparo`). Tarefa não feita = sem marca (`null`).

## As suítes

- `tests/nina-noticia-regras.spec.ts` — SEM banco: banco padrão e régua,
  gabaritos, filtro, latch da escolha, reparo, rotina (500 sementes), níveis,
  passos e gate, painel, allowlist do contrato e disciplinas contra o catálogo.
