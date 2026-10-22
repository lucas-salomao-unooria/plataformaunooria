# apps/api/src/efeito-amplificador — O Efeito Amplificador (exp02em1b)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

Missão da 2ª série do EM, unidade 1 (ADR-181), vinda da esteira
(`artefatos_exp02em1b`, 2026-10-22). Ela tomou o código `exp02em1b`; a Missão
Tempestade que o tinha é `exp02em1b-v0` (módulo `unoogpt`, tabelas
`exp02em1b_v0_*`), no ar e fora do catálogo.

O estudante é comunicador do grêmio: pede o post ao **UnooriaAI**, audita o
rascunho (a estatística inventada, o trecho copiado sem crédito, o colega
exposto), escolhe a manchete e **publica no Unoovista** (o LATCH). O relógio
corre até 02h30, o algoritmo pinça um trecho e entrega de madrugada para
TODOS, e o feed vira crise (saúde física, mental e contas invasivas). O
professor pausa as telas, conduz o debate e libera a **Etapa 5**: a folha de
bastidores, onde o estudante aponta os dois indicadores que comprovam a
retenção, e conclui. Quatro tabelas: `exp02em1b_pacotes`, `_gates_turma`,
`_gates_historico`, `_sessoes` (migração `20261022130000_exp02em1b_efeito_amplificador`).

## As orientações do PO que vencem os artefatos (2026-10-22)

- **SEM a etapa de transferência e SEM o Canal B.** O one-pager previa o
  diário de bordo (texto livre de menor) e quatro enquetes no `StoryPoll`;
  saíram os dois. A ficha (`evidencias/fichas/exp02em1b.ts`) é só Canal A, e
  não há tabela de reflexão.
- **A abertura do chat é a fala literal** `conteudo.ts#falaDeAbertura`, com o
  tema do pacote no lugar de "[tema customizado]".

## O que não é óbvio

- **O UnooriaAI da aula NÃO é IA.** É a árvore de intenções do 01e
  (`regras/intencoes.ts`), no servidor, sobre o pacote homologado: minúsculas,
  sem acento, sem pontuação, lista fechada e PRECEDÊNCIA (a revisão geral antes
  da LGPD). Mais três gatilhos vêm do pacote (cada palavra distintiva do
  instituto inventado, o primeiro nome do colega e o veículo inteiro), porque o
  pacote que a IA escreve para Biologia não tem "DataBrasil" nem "Lucas". O
  "sim" só aceita a substituição logo depois da fala da fonte, que a oferece.
  Até 5 mensagens (CHECK); a quinta leva o aviso do limite junto.
- **Perguntar a fonte não corrige.** A EM13CO14 separa as duas coisas: o
  pedido (`pediuFonte`) e a correção (a substituição, a revisão geral ou tirar
  o parágrafo). Atingiu = as duas.
- **Sem edição livre do texto.** O estudante tira/devolve parágrafos
  (`POST /paragrafo`) e pede correções ao UnooriaAI; não reescreve frase. Com
  texto livre, a régua dependeria de uma heurística sobre texto de menor
  ("ainda expõe o colega?"). Tirar o parágrafo de um nó o RESOLVE para a régua.
- **Sem a tag "Nome e turma identificados" na prévia.** O handoff a pedia; o
  one-pager (§6, ausências) proíbe aviso que telegrafe o dilema — vale o
  one-pager.
- **O trecho pinçado** (`regras/previa.ts#trechoPincado`), sempre há um: a
  estatística, se ficou (o erro vira munição); senão o RECORTE do pacote, que a
  régua obriga a morar no trecho copiado, no original E na correção — por isso
  o cuidado não o tira do post; senão a manchete. É a virada: o incentivo é da
  rede, não do texto.
- **As marcas.** CO14 e CO26 no PUBLICAR, na transação do latch. CO24 e CO08 a
  cada ação no feed, só o que já foi alcançado (vale a melhor); o "não atingiu"
  de quem nada fez entra quando o feed FECHA — a abertura do Explicar
  (`POST /explicar`). Quem não chega ao feed fica "Não avaliado".
- **O gabarito não desce.** O comentário vai sem `tipo` (a categoria de saúde
  é o que a CO24 lê), o indicador sem `comprova`, o parágrafo sem o nó.
- **Fases da turma**: `aberta → debate → explicar`, só para a frente; cada
  mudança vai a `_gates_historico` (EVT-P05). `debate` é a PAUSA: camada sobre
  qualquer passo (`pausada`), e as jogadas respondem 409 `telas-pausadas`. O
  passo é derivado (`abertura → conversa → feed → explicar → concluida`).
- **Arquivar o post exige as métricas abertas** (one-pager §6: não apagar antes
  de confrontar o gráfico).
- **O Explicar tem 4 indicadores, 2 que comprovam** (os da copy) e 2 que não
  (curtidas, alcance da tarde — PROPOSTA, para o clique não ser trivial). O
  que não comprova acende uma dica; concluir exige os dois. Não é evidência.
- **A atividade é o PACOTE; a rodada é o "Zerar"** (ADR-130/155), como na
  exp05ef1b: homologar cria a atividade PRONTA; `em-andamento` a põe no ar;
  `banco-padrao` faz os dois num toque (o caminho curto do one-pager);
  `zerar` apaga a evidência do pacote e guarda as sessões.
- **O texto do estudante no chat é texto livre de menor**: fica em
  `_sessoes.conversa` para o F5 e não vai a painel, telemetria nem log. O painel
  diz passo e manchete por computador; a lousa (`resumo`) é só agregada.
- **O podcast é FIXO** (`podcast.ts`): o roteiro do one-pager §11, literal,
  com as rubricas de trilha que o PO corrigiu; a trilha vai na direção de
  atuação, não no roteiro. A atividade é o pacote; sem vaga, `padrao` sempre.
- **A IA só no preparo** (`preparo.service.ts`): quota do perfil `professor`,
  `temSaldo` antes e o pago debitado depois (ADR-74); sem saldo ou com o vendor
  fora, o rascunho sai do banco curado. A saída passa pela MESMA régua da
  homologação (`regras/pacote.ts#problemasDoConteudo`).
- **Vocabulário em dois lugares**: disciplina, fase, manchete e indicadores
  estão em `conteudo.ts` e nos CHECKs; `tests/efeito-amplificador-regras.spec.ts`
  compara os textos.

## As duas suítes

- `tests/efeito-amplificador-regras.spec.ts` — sem banco: a régua do pacote, a
  árvore de intenções, a prévia, o trecho pinçado, as tabelas-verdade das
  quatro habilidades, o feed, o passo e o espelho dos CHECKs.
- `tests/efeito-amplificador-postgres.spec.ts` — a porta da sala em toda rota
  de estudante, o preparo com quota, a homologação, o latch com as marcas, o
  gabarito ausente, a pausa, o Explicar, o painel sem o texto do menor, a RLS
  com a role sem `BYPASSRLS` e o zerar.
