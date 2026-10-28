# apps/api/src/efeito-amplificador — O Efeito Amplificador (exp02em1b)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

Missão da 2ª série do EM, unidade 1. A **2.1.0** (ADR-191) segue a revisão do
PO (`artefatos_exp02em1b`, 2026-10-27: o PRD 2.1.0, o banco `01e`, a copy `06`
e o protótipo de 32 estados) e SUPERA as decisões da 2.0.x (ADR-181) no que é
desta missão. A **2.2.0** (ADR-192) traz a IA de volta SEM mexer na régua: o
classificador do chat, as reações do feed e a devolutiva. A **2.3.0**
(ADR-193) põe o classificador para ler PRIMEIRO, com a árvore como reserva. O código `exp02em1b` continua dela; a Missão Tempestade é
`exp02em1b-v0` (módulo `unoogpt`), no ar e fora do catálogo.

O estudante é o comunicador do grêmio: pede o post ao **UnooriaAI**, audita o
rascunho (a estatística inventada, o trecho copiado sem crédito, o colega
exposto), escolhe a manchete e **publica no Unoovista** (o latch 1). O relógio
corre até 02h30, o algoritmo pinça um trecho e entrega de madrugada para
TODOS, e o feed vira crise. Ele modera (o aviso de cuidado com o motivo, a
Configuração da Publicação) e busca apoio (a Central: denúncia e relato). O
professor pausa as telas, conduz o debate e libera os **bastidores** (Etapa 5);
o estudante conclui (o latch 2) e lê a devolutiva. Quatro tabelas, as mesmas da
2.0.x (`20261022130000`), alteradas por `20261028120000_exp02em1b_2_1_0` e
`20261028150000_exp02em1b_devolutiva` (a coluna da devolutiva).

## Fora desta versão (decisão do dono do produto)

A transferência da Etapa 6 (o caso do streaming de áudio, o diário de bordo e
`exp02em1b_reflexoes` do PRD) e o Canal B. A ficha é 100% Canal A.

## O que não é óbvio

- **A IA nunca decide o que a régua lê** (ADR-192; supera o RNF-012 do PRD
  nesta missão). O UnooriaAI é a árvore de intenções do 01e
  (`regras/intencoes.ts`): minúsculas, sem acento, lista FECHADA, precedência
  (a revisão ampla antes de tudo; autoria + LGPD juntas são o direito digital
  inteiro; a fonte antes de aprovar e de gerar), mais os gatilhos do pacote.
  **A IA lê PRIMEIRO e a árvore é a reserva** (ADR-193, `rotaDaMensagem` e
  `decidirIntencao` em `regras/intencoes.ts`): a IA traduz a mensagem para uma
  intenção da MESMA lista (sem `substituir_dado`); confiança < 0,7, lenta, sem
  saldo ou recusada = vale a árvore. **Três caminhos nunca vão à IA**: o "sim"
  logo depois da oferta (`estado`), as três sugestões da copy tocadas como
  estão (`sugestao` — o TC-03 corrige as duas coisas sempre) e o texto que
  tenta mandar no classificador (`guarda`: nome de intenção com sublinhado,
  "ignore as instruções"; vira fora do tema — a árvore o leria pela palavra
  "fonte"). Palavra solta como "confiança" NÃO é guarda: "essa fonte é de
  confiança?" é pedido legítimo. Três tempos em `mensagem()`: a leitura com a
  rota, a IA FORA da transação, a gravação — sessão que andou no meio = vale
  a árvore. A fala grava `classificador: "ia" | "arvore" | "guarda"` e, quando
  a IA discordou da árvore, `arvore` (o dado do piloto sobre onde ela lia
  errado). A fala continua a do 01e.
- **A IA da aula corre e perde em silêncio.** Quota do perfil `estudante`
  (`temSaldo` antes, débito por tentativa), rate limit por usuário, uma
  tentativa só, tetos de 5 s (classificar) e 7 s (devolutiva) — o SDK da
  experiência desiste em 10 s e a rota ainda lê e grava. Perdeu = árvore ou
  modelo, nunca erro na tela. `scripts/medir-classificador-exp02em1b.ts` mede o
  caminho de produção num conjunto-ouro com o Vertex real. Na 2.2.0 (árvore
  primeiro): a IA 57/57, os 6 erros eram da árvore. Na 2.3.0 (IA primeiro, 89
  frases): 88/89 e 89/89 em duas rodadas, zero falso crédito nas duas; a IA
  divergiu da árvore em 45 e acertou as 45. Errar um pedido de revisão para
  fora do tema ainda acontece (a IA não é determinística): custa o estudante
  reformular, nunca um crédito.
- **O feed reage ao post de cada um, e o estímulo é o mesmo** (`regras/reacoes.ts`).
  O preparo faz uma SEGUNDA chamada (`SYSTEM_DAS_REACOES`) e grava
  `conteudo.reacoes[manchete.trecho][comentarioId]`; o trecho é `dado` se a
  estatística viralizou, `recorte` se não. A variante troca SÓ o texto de quem
  AMPLIFICA (`anonimo_agressivo`, `engajamento`): os relatos de saúde (o
  estímulo da CO24), o autor, o horário, o tipo e o perfil suspeito (a CO08)
  são os do pacote em toda variante. Reação a comentário de saúde é ignorada no
  feed. Sem `reacoes` (o banco padrão, que é o 01e literal, e todo pacote da
  2.1.0) o feed é o mesmo para todos. Duas réguas: a da homologação é tolerante
  (o professor muda o tipo de um comentário), a da IA exige as seis variantes e
  texto que muda com o post. As reações falhando não derrubam o pacote.
- **A devolutiva** (`regras/devolutiva.ts`, `POST /devolutiva`): um parágrafo
  por habilidade, gerado UMA vez na conclusão e gravado em
  `exp02em1b_sessoes.devolutiva`. Sai dos FATOS que a régua já lê, pelas mesmas
  funções de `evidencia.ts` — nunca do texto do estudante —, com "o que se
  observa" de cada habilidade (sem isso a IA cobrou ação que a habilidade não
  pede). A régua da IA recusa palavra da avaliação ("nível", "atingiu"),
  comparação com colegas e elogio onde nada foi feito; recusou = o modelo
  curado (`devolutivaDoModelo`, [PROPOSTA], testado em 384 combinações). O
  professor a lê em `GET /turmas/:turmaId/pacotes/:pacoteId/devolutivas`, e
  quem concluiu sem ela recebe a do modelo calculada na hora.
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
  `_sessoes.conversa` para o F5, vai ao classificador como DADO delimitado
  (nunca à devolutiva) e não vai a painel, telemetria nem log. O
  painel dá por computador o passo, a manchete e o tempo parado; a lousa
  (`resumo`) é só agregada, com a matriz das quatro habilidades.
- **O podcast é FIXO** (`podcast.ts`, o one-pager §11 literal) e é do
  PROFESSOR (o áudio e a transcrição, ADR-150 e ADR-194): a sessão do
  estudante não leva nada do podcast — o episódio é tocado em aula.
- **A IA do preparo** (`preparo.service.ts`): quota do perfil `professor`,
  `temSaldo` antes e o pago debitado depois (ADR-74); sem saldo ou com o vendor
  fora, o rascunho sai do banco curado. A saída passa pela MESMA régua da
  homologação.
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
  o espelho dos CHECKs, as variantes e as duas réguas das reações, o
  classificador e a devolutiva.
- `tests/efeito-amplificador-postgres.spec.ts` — a porta da sala em toda rota
  de estudante, o preparo com quota, a homologação, a aula sem IA, o latch com
  as marcas, o gabarito ausente, o aviso e as proteções, a pausa, os bastidores,
  o painel de quatro cartões sem o texto do menor, a RLS com a role sem
  `BYPASSRLS`, o CHECK do gate e o zerar — e a 2.2.0: as reações no preparo,
  o classificador (acerto, falha, prazo), o feed que reage com a régua igual e
  a devolutiva do estudante e do professor.
