# apps/api/src/efeito-amplificador — O Efeito Amplificador (exp02em1b)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

Missão da 2ª série do EM, unidade 1. A **2.1.0** (ADR-191) segue a revisão do
PO (`artefatos_exp02em1b`, 2026-10-27: o PRD 2.1.0, o banco `01e`, a copy `06`
e o protótipo de 32 estados) e SUPERA as decisões da 2.0.x (ADR-181) no que é
desta missão. O código `exp02em1b` continua dela; a Missão Tempestade é
`exp02em1b-v0` (módulo `unoogpt`), no ar e fora do catálogo.

O estudante é o comunicador do grêmio: pede o post ao **UnooriaAI**, audita o
rascunho (a estatística inventada, o trecho copiado sem crédito, o colega
exposto), escolhe a manchete e **publica no Unoovista** (o latch 1). O relógio
corre até 02h30, o algoritmo pinça um trecho e entrega de madrugada para
TODOS, e o feed vira crise. Ele modera (o aviso de cuidado com o motivo, a
Configuração da Publicação) e busca apoio (a Central: denúncia e relato). O
professor pausa as telas, conduz o debate e libera os **bastidores** (Etapa 5);
o estudante conclui (o latch 2) e lê o podcast. Quatro tabelas, as mesmas da
2.0.x (`20261022130000`), alteradas por `20261028120000_exp02em1b_2_1_0`.

## Fora desta versão (decisão do dono do produto)

A transferência da Etapa 6 (o caso do streaming de áudio, o diário de bordo e
`exp02em1b_reflexoes` do PRD) e o Canal B. A ficha é 100% Canal A.

## O que não é óbvio

- **A aula NÃO chama IA** (PRD RNF-012 e §17.4). O UnooriaAI é a árvore de
  intenções do 01e (`regras/intencoes.ts`): minúsculas, sem acento, lista
  FECHADA, precedência (a revisão ampla antes de tudo; autoria + LGPD juntas são
  o direito digital inteiro; a fonte antes de aprovar e de gerar), mais os
  gatilhos que vêm do pacote (o instituto, o primeiro nome do colega, as
  palavras da autoria). A IA da 2.0.x (quota do estudante, guardrails,
  corrida de 12 s) saiu com a `conversa.service.ts`.
- **Perguntar a fonte não corrige.** A fala da fonte termina em "Deseja que
  eu atualize a prévia?" e só o "sim" logo depois (ou a revisão ampla)
  corrige. A EM13CO14 mede as duas coisas: atingiu = as duas; a revisão ampla
  sem perguntar é "em processo".
- **O pedido parcial corrige só o seu nó** (`auditar_autoral`,
  `auditar_lgpd`): é o que deixa existir o "em processo" da EM13CO26. O TC-03
  corrige os dois.
- **Sem edição livre do texto, sem tirar parágrafo.** A gaveta aponta as
  pendências e aprova; exportar NÃO é bloqueado por pendência (o dilema é do
  estudante). A prévia da 2.0.x (com parágrafo tirado) continua legível:
  `removido` conta como resolvido.
- **O recorte sobrevive às correções**: a régua o obriga a morar num parágrafo
  de ligação (ou num nó, no original E no corrigido). O trecho pinçado é a
  estatística, se ficou; senão o recorte; senão a manchete — o cuidado do
  estudante não salva o post. É a virada.
- **As marcas.** CO14 e CO26 no PUBLICAR, na transação do latch. CO24 e CO08 a
  cada ação no feed, só o já alcançado (vale a melhor); o "não atingiu" de
  quem nada fez entra quando o feed FECHA — a abertura dos bastidores
  (`POST /explicar`). Quem não chega ao feed fica "Não avaliado".
- **EM13CO24 é o MOTIVO do aviso**: saúde = atingiu; outro motivo ou
  restringir comentários = em processo. O aviso é UM: outro motivo depois é
  409 `aviso-ja-fixado` — trocar depois de ver a reação apagaria a medida.
- **EM13CO08 conta as três proteções**: uma chave da Configuração da
  Publicação (privacidade), denunciar o perfil suspeito e ENCAMINHAR um relato
  (comentário + equipe). Só abrir a Central já é "em processo" (PRD §14.1).
- **O gabarito não desce.** O comentário vai sem `tipo` e o parágrafo sem o
  nó. Desce só o `perfilSuspeito` (o nome da conta anônima que comentou
  primeiro): a tela precisa dizer quem vai denunciar.
- **O TC-10 vem daqui, com o tema**: `feed.instrucao` = `{antes, destaque,
  depois}`. A experiência o publica em `exp:estado` e o HUB o desenha FORA do
  aparelho — dentro dos 375 px ele sufocaria o pico.
- **O gate da turma**: `exploracao → pausa → explicar`, só para a frente; cada
  mudança vai a `_gates_historico` (EVT-P05). `pausa` é camada sobre qualquer
  passo, e as jogadas respondem 409 `telas-pausadas`. O passo é derivado
  (`abertura → conversa → feed → explicar → concluida`), e a `etapa` do PRD
  (E1_DESAFIAR … E7_CONCLUIDO) é o mesmo estado com o nome do contrato.
- **Os bastidores não travam** (PRD RF-007): dois cartões, os dois revelam o
  critério; apontar abre a citação de Nico e não é evidência; concluir não
  exige os cartões.
- **A atividade é o PACOTE; a rodada é o "Zerar"** (ADR-130/155): homologar
  cria a atividade PRONTA; `em-andamento` a põe no ar; `banco-padrao` faz os
  dois num toque, sem IA (o caminho curto); `zerar` apaga a evidência do pacote
  e guarda as sessões.
- **O texto do estudante no chat é texto livre de menor**: fica em
  `_sessoes.conversa` para o F5 e não vai a painel, telemetria nem log. O
  painel dá por computador o passo, a manchete e o tempo parado; a lousa
  (`resumo`) é só agregada, com a matriz das quatro habilidades.
- **O podcast é FIXO** (`podcast.ts`, o one-pager §11 literal) e é do
  PROFESSOR (o áudio, ADR-150); a sessão do estudante leva só a transcrição,
  para a tela de conclusão.
- **A IA do preparo** (`preparo.service.ts`, a ÚNICA da missão): quota do
  perfil `professor`, `temSaldo` antes e o pago debitado depois (ADR-74); sem
  saldo ou com o vendor fora, o rascunho sai do banco curado. A saída passa pela
  MESMA régua da homologação.
- **O comentário aceita 300 caracteres na forma e 280 na régua**: a forma é
  larga para o pacote da 2.0.x continuar legível; a homologação cobra o PRD.
- **Migração que mexe em DADO destas tabelas tira o `FORCE` da RLS dentro da
  transação** (`NO FORCE` … `FORCE`, o molde de `20261022120000`). Sem
  `app.escola_id`, o UPDATE do dono não vê linha nenhuma e afeta 0 — passa em
  banco virgem e no superusuário local, e quebra o primeiro banco com dados no
  CHECK seguinte. Foi o que derrubou o `migrate` do dev na 2.1.0 (2026-10-28).
- **Vocabulário em dois lugares**: disciplina, gate, manchete e indicadores
  estão em `conteudo.ts` e nos CHECKs; `tests/efeito-amplificador-regras.spec.ts`
  compara os textos.

## As duas suítes

- `tests/efeito-amplificador-regras.spec.ts` — sem banco: o banco 01e e os
  textos-chave, a régua do pacote, a árvore de intenções, a prévia, o trecho
  pinçado, as tabelas-verdade das quatro habilidades, o feed, o passo e a etapa,
  e o espelho dos CHECKs.
- `tests/efeito-amplificador-postgres.spec.ts` — a porta da sala em toda rota
  de estudante, o preparo com quota, a homologação, a aula sem IA, o latch com
  as marcas, o gabarito ausente, o aviso e as proteções, a pausa, os bastidores,
  o painel de quatro cartões sem o texto do menor, a RLS com a role sem
  `BYPASSRLS`, o CHECK do gate e o zerar.
