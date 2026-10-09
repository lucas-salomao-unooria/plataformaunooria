# apps/api/src/quem-mandou-isso — Quem Mandou Isso? v2.2 (exp05ef1b)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

Missão do 5º ano, unidade 1. Esta é a v2.2, que substitui a v1 com o MESMO
código (ADR-114). Oito mensagens num grupo de WhatsApp simulado, na matriz 2x2
(verdadeira/falsa × emocional/neutra); o estudante encaminha EXATAMENTE três
ao Mural da Turma, vota no motivo, e só então o professor abre a revelação.
Depois, a síntese e a reflexão: as duas perguntas de evidência no chat da
Nina. **Nasce com ficha (E14) e com equipe (E13).** A regra Se/Então que vinha
antes das perguntas saiu (ADR-145, instrumento 2.3.0): a tabela
`_reflexoes` e o carimbo `reflexao_em` ficam só pelo histórico, e nenhuma rota
os escreve.

Quatro tabelas (`exp05ef1b_pacotes`, `_gates_turma`, `_sessoes`,
`_reflexoes`); CHECKs, índices parciais e RLS na migration
`20260926130000_exp05ef1b_quem_mandou_isso_v2`.

## O que não é óbvio

- **O passo NÃO é coluna.** É `regras/passos.ts#passoEfetivo(latches, fase)`.
  Os latches são carimbos da sessão (`confirmado_em`, `votou_em`,
  `concluido_em`), cada um com CHECK exigindo o anterior (o do fim exige o
  voto desde a migração `20261005120000`). Uma
  coluna `passo` seria a terceira fonte de uma verdade que os carimbos já dizem.
  `grupo` cobre o grupo E o Mural — as duas vistas da mesma seleção.
- **A revelação NÃO empurra a triagem.** Quem não confirmou quando o professor
  abre a revelação continua no grupo, confirma, vota — e só então recebe a
  própria `revelacao`, junto com o passo da turma (que pode já ser `sintese`
  ou `perguntas`). A fase `reflexao` da turma leva ao passo `perguntas`: elas
  SÃO a reflexão. O servidor não guarda "já viu os crachás"; a experiência os
  mostra antes do passo corrente.
- **O gabarito desce SÓ depois do voto E da revelação aberta**, e só o das três
  do estudante. As mensagens saem por `mensagensPublicas` (um `Omit`). O teste
  varre as CHAVES (`veracidade`, `tom`), não o texto: a fala da Nina antes da
  P1 contém "verdadeira", e um `toContain` sobre a resposta inteira reprovaria
  em falso.
- **A atividade da evidência é o PACOTE aprovado; a rodada é a reaplicação.**
  Aprovar cria a atividade PRONTA (ADR-130): o pacote em andamento continua, e
  a fase da turma não muda; aprovar de novo o MESMO que o aprovado mais recente
  é idempotente (a comparação é por `assinatura`, porque o JSONB reordena as
  chaves). Quem põe no ar é `colocarEmAndamento` (`POST
  :turmaId/pacotes/:pacoteId/em-andamento`): liga `ativo` no escolhido, abre a
  rodada SEGUINTE à última com sessão e volta a fase a `triagem` — senão a
  atividade nova nasceria com a revelação aberta. A lista das atividades é
  `GET :turmaId/pacotes` (os APROVADOS; o rascunho não é atividade). "Zerar a
  turma" é `rodada_atual + 1` e apaga a evidência do pacote (ADR-155); as
  sessões ficam.
- **A marca da EF05CO08 é da MESMA transação do latch do Mural.** Se a
  evidência falhar, o Mural não fecha (há teste com o `marcar` quebrado). A
  régua é `regras/evidencia.ts#nivelCO08` (a v2, ADR-120: só três verdadeiras
  atingem), conferida nas 56 combinações. **Toda rodada a marca de novo**,
  também no mesmo pacote (ADR-145, que tirou o "uma vez por criança e pacote"
  da ADR-120). CO03 vem da P1 e CO04 da P2 — as perguntas do PO,
  literais (ficha v3, ADR-131). A rubrica do Se/Então saiu com a regra
  (ADR-145): o ajuste do professor é o do painel de habilidades.
- **O resolvedor da E14 só responde no passo `perguntas`** (voto dado,
  reflexão liberada pela turma, missão não concluída). Antes ou depois, a resposta é 409
  `sem-atividade-em-andamento`: uma P1 por POST direto antes do Mural não mede
  nada, e quem concluiu sem responder fica "Não avaliado" — a ausência de marca.
- **A turma do estudante é `users.turma_id`**, a mesma fonte do painel e das
  equipes — não o claim do token. Se divergissem, a criança jogaria numa sala
  que o painel do professor não mostra.
- **O painel conta por COMPUTADOR**: `mapaDeEquipes` DENTRO do `comTenancy` +
  `colapsarEmUnidades` (a linha de quem jogou representa a equipe). O
  Termômetro é `null` antes da revelação e não tem lugar para nome. A revelação
  do estudante leva as mesmas duas barras (sala sem projetor).
- **O `Então` é TEXTO LIVRE DE MENOR.** Tabela confinada, redação do log
  (`entao`, `acaoEntao`, `acao_entao` em `observabilidade/redaction.ts`), e no
  painel só para quem leciona: `professorLeciona(undefined)` é `true` para o
  gestor, então a distinção mora no service (`professorId ? texto : null`), não
  no `@Roles`.
- **A IA não decide a estrutura.** `regras/pacote.ts#sortearMolde` sorteia o
  tipo e o quadrante de cada posição (sorteado para a posição não virar pista
  entre turmas); o modelo só escreve, e a saída passa pela MESMA régua da
  curadoria (`validarPacote`). Sem saldo ou com o vendor fora, o rascunho sai
  do banco curado com `motivo` `sem-saldo`/`indisponivel` — a frase 429 × 503 da
  copy. A turma é conferida (404) ANTES de gastar token.
- **O rascunho é gravado** (um por turma, índice único parcial): o preparo
  custou saldo, e um F5 não pode jogá-lo fora. O ativo também é único por turma.
- **O GAP do preset** (default até o Lucas responder): imagem e link têm UMA
  verdadeira e UMA falsa cada. No preset, `msg_5` virou link (a prévia é texto
  novo) e `msg_7` virou texto. A versão original dos artefatos REPROVA na régua,
  e há teste que prende isso.
- **Tema = a frase da Nina.** "Rolou uma confusão sobre {tema}." — por isso o
  preset tem `tema: "o passeio ao museu"` (minúsculo, e a fala reproduz a copy
  literal) e `nome: "O Mistério do Passeio ao Museu"` para a vitrine. O tema
  herda as réguas do clone: ≤ 60 caracteres, ≤ 8 palavras, sem termo proibido.
- **Termos proibidos no clone**: `atividade`, `gabarito`, `nota`, `exercício`,
  por PALAVRA INTEIRA, sem acento, com plural ("notícia" passa). "Professor"
  fica de fora de propósito: a "Professora Helena" escreve no grupo da turma.
- **Vocabulário em dois lugares**: disciplina, origem, motivo, condição e fase
  estão no código e nos CHECKs; a suíte de Postgres compara os dois.
- **O podcast de recapitulação é da plataforma** (ADR-150, `src/podcast/`):
  aqui ficam o roteiro do one-pager v2.2 (`podcast.ts`, Lucas e Camila, com o
  Unoochat no lugar do WhatsApp e sem a "regra da tela final" do Se/Então que
  saiu) e a fonte (`podcast-fonte.ts`). As três vagas (o que o grupo trazia, a
  falsa calma, a verdadeira desesperada) o professor revisa na criação, e
  `aprovar` as grava em `podcast_roteiros` na MESMA transação.

## As duas suítes

- `tests/quem-mandou-isso-regras.spec.ts` — sem banco: a régua do pacote, o
  preset e o GAP, o passo derivado, a EF05CO08 exaustiva, as contas do
  Termômetro por unidade, o molde da IA em 500 sorteios, as falas da Nina, e a
  redação.
- `tests/quem-mandou-isso-postgres.spec.ts` — o que só o banco responde: RLS
  isolando com a role sem `BYPASSRLS`, CHECKs, a porta da sala em TODA rota de
  estudante (e nas perguntas da E14), latches sob toques simultâneos, a marca
  na transação do Mural, a cópia para a equipe, o painel por computador, o
  texto do menor só para quem leciona, a rodada nova e o pacote novo.
