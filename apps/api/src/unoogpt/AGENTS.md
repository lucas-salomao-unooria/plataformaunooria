# apps/api/src/unoogpt — Missão Tempestade (exp02em1b-v0, versão anterior)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

**Desde 2026-10-22 esta é a VERSÃO ANTERIOR (ADR-180).** A missão da 2ª série
do EM, unidade 1, foi reformulada (O Efeito Amplificador, `src/efeito-amplificador/`)
e tomou o código `exp02em1b`. Esta virou `exp02em1b-v0` (`regras/defaults.ts#EXP_ID`):
as tabelas são `exp02em1b_v0_*`, a ficha é `evidencias/fichas/exp02em1b-v0.ts`, e
a migração `20261022120000_exp02em1b_versao_anterior` levou o id como valor.
**O módulo continua no `app.module`** — não foi desligado: só saiu do catálogo
(a grade da sala a mostra só à turma que já a tinha liberado,
`salas/regras.ts#gradeDaTurma`). As telas do professor dela no hub ficaram sem
caminho de entrada: a ficha `/professor/entre-redes/2-serie/unidade-1` é da
missão nova. Onde abaixo se lê `exp02em1b`, leia `exp02em1b-v0`.

## Missão Tempestade (exp02em1b, `apps/api/src/unoogpt`)

- **Marco novo leva o relógio do INSTANTE, nunca `sessoes.minutos_gastos`.**
  `gravarMarco(..., estado)` recebe o `EstadoDoRelogio` de `relogioAgora(tx,
  escolaId, turmaId)` e grava `minuto`, `segundos_restantes` e `motivo_do_fim`
  dele. `minutos_gastos` é o retrato do último turno do Cientista — um turno
  leva 10–30 s (2–6 minutos da cidade), e as rotas diretas (`alocar`,
  `carregarConjuntos`, `simular`) gravavam com ele; a saída das equipes saía
  no minuto de um turno atrás (ADR-64). O relatório do professor lê o
  cronômetro gravado; reconstruí-lo depois é inviável ("+2 min" muda a duração
  sem histórico, "zerar" apaga o relógio).
- **O que o professor lê de TEMPO é derivado na leitura, não coluna**:
  `mudancasDeDestino` (pares consecutivos distintos — o cartão de duas opções
  manda dois POSTs e justificar passa pela mesma rota), `coberturaDoRisco`,
  `posicaoNaFaixa` (`regras/trilha.ts`, `regras/desfecho.ts`). Só se grava o
  que não dá para recalcular: o cronômetro do marco e `simulacoes.esperado`.
- **O turno cabe em 40 s, ou vira recusa** (ADR-175). O cliente desiste em
  45 s (`TIMEOUT_DO_TURNO_MS`), e a fila do Vertex já levou turnos a 194 s no
  dev. `TETO_POR_CHAMADA_DO_CIENTISTA_MS` (12 s) e
  `PRAZO_DO_TURNO_DO_CIENTISTA_MS` (40 s), em `regras/defaults.ts`, vão ao
  `conversar`; passado o prazo, o `ErroDeGeracao` vira `cientista-indisponivel`
  sem debitar pergunta. Os "10–30 s" acima são o turno NORMAL, não o teto.
- **A fala do estudante é datada por `agora`** (a hora do envio), porque a
  gravação acontece depois do `await` do provedor. Sem isso a hora é o fim do
  turno.
- **`reiniciar` grava `recomeco` na tentativa que FECHA**, com `origem` (vem do
  corpo, opcional — cliente antigo não manda) e `fase`/`modo` do relógio. Não
  existe "liberar recomeço" pelo professor; o que ele controla é o relógio.
- **`GET /resultado` do estudante filtra os tipos** `fontes|leitura|alocacao|envio`:
  a linha do tempo do cliente cai no ramo de `envio` para tipo desconhecido, e
  narraria `inicio` como "enviou 0 resgatadas".
- Número de resgate **só na rota individual** (`doEstudante`); a folha da turma
  fala de conduta, e `tests/unoogpt-postgres.spec.ts` quebra se `salvas`
  entrar nela.
- **A folha da turma conta por COMPUTADOR quando há equipes** (E13, ADR-111):
  `turmaDoProfessor` colapsa os membros de cada equipe numa linha só — a de
  quem entrou; com dois logins, o `atualizado_em` da sessão mais recente
  desempata — com `equipe` preenchida, e o `retrato` conta essas linhas
  (`porComputador: true`). "Abrir" continua indo para o representante. O mapa
  é lido DENTRO do `comTenancy`: fora dele a RLS das equipes devolve vazio e a
  folha volta a contar por criança, em silêncio. A `equipe` da linha é gente
  diante da mesma tela — não confundir com as equipes Alfa e Bravo da cidade.
- **A evidência pedagógica não tem atividade: é a `"turma"`**, o mesmo id das
  equipes, e a rodada é da TURMA (`exp02em1b_gate_turma`). Só o `zerarTurma` a
  sobe (o gate sobrevive ao zerar; o relógio, não) — e APAGA a evidência da
  turma, marcas e níveis de todas as rodadas (ADR-155), e as tarefas (cascata
  da sessão). NÃO use a `tentativa` como rodada: com "Tentar de novo" livre, a
  resposta repetida chegaria a "demonstra" por exclusão.
- **O Canal A (ADR-172) mora em `canal-a.service.ts`, as réguas em `regras/`**
  (uma por tarefa, puras, com a conferência de exaustividade em
  `tests/unoogpt/canal-a-regras.spec.ts`). Sete tarefas, cada uma um marcador
  da ficha v2 e uma linha em `exp02em1b_tarefas` com a APRESENTAÇÃO montada no
  servidor (os pares, os cartões, as comparações, a ordem das opções) — o F5
  mostra o mesmo, e o gabarito nunca desce: os ids da tela são POSIÇÃO (`p1`,
  `e1`), porque o tipo do par ou da comparação é a resposta. Não há pergunta,
  nem resolvedor: quem não fez a tarefa fica "não avaliado".
- **Duas réguas de agregação** (`regras/agregacao.ts`): "primeira da rodada"
  (Saúde, alerta, "E se…", WhatsApp, moradora) confere `jaMarcou` antes de
  `marcar`; "melhor tentativa" (leitura, fontes) só marca se a tentativa
  COMEÇOU com o relógio aberto (`sessoes.inicio_com_relogio_aberto`, gravado
  ao entrar na investigação). As duas sob o lock da sessão.
- **"Enviar equipes" é `POST /mandar`, e a conversa NÃO manda**:
  `confirmar_alocacao` só devolve `abrirEnvio` (a tela abre a decisão). O
  desfecho fica RETIDO até o registro (`GET /resultado` → 409
  `registro-pendente`). `POST /simular` é o alias do cliente 1.4.x: manda e
  fecha o registro sem tarefa nem marca.
- **O fechamento é do professor** (`abrir-fechamento` no relógio,
  `exp02em1b_relogio_turma.fechamento_aberto_em`): antes, 409
  `fechamento-fechado`; aberto, `reiniciar` recusa (`fechamento-aberto`). O
  "Zerar a turma" apaga o relógio e, com ele, o fechamento.
- **A contagem da Saúde não toca o modelo nem o podcast**, e o Cientista não a
  comenta (`VERSAO_PROMPT` 5). Mudou o texto do Cientista? Suba a versão e
  confira o teto de tamanho do prompt (`tests/unoogpt/agente-prompt.spec.ts`).
- **O envio tem UM portão, `aoConfirmar`** (de `mandar` e do alias
  `simular`). Ele confere, sob o lock da sessão, o porquê de cada equipe COM
  destino (`faltaJustificar`) e devolve a recusa com motivo
  (`ResultadoDaConfirmacao`): `falta-justificar` ou `sem-destino`. Mandar com
  UMA equipe na base é permitido — a tela e o Cientista dizem isso —, e o que
  se recusa é nenhuma equipe ter destino (`sem-destino`, código próprio). Antes
  "pode mandar" no chat pulava a justificativa; hoje a conversa nem manda.
- **Destino novo apaga o porquê, pelos dois caminhos** (`alocar` e
  `aoAlocar`): a razão era do bairro antigo. Repetir o mesmo destino não apaga.
- **Fonte só entra com o relógio aberto.** `PUT /unoogpt/conjuntos` (o painel,
  sem o Cientista) recusa antes da largada, depois do fim e depois do envio,
  como uma pergunta. Sem isso, chamar a rota direto fabricava o "pediu dados".
- **O cartão de leitura sorteia com a rodada DEPOIS da carga**, a mesma do
  mapa: `aoUsarDados` devolve `{ conjuntos, rodadas }`, e o turno anda a
  `rodadaAtual` com ela. Com a rodada de antes, o cartão "O que os dados
  mostram" e o mapa davam números diferentes (o ruído é de até 10%) para a
  mesma leitura, e um empate aparecia num e não no outro.
- **O "E se…" é PAREADO** (`corridasPareadas`, `modelo/tempestade.ts`): as
  duas decisões nas mesmas tempestades, com a mesma sorte da operação em cada
  corrida; a semente não leva a decisão. `esperadoDe` continua servindo a faixa
  de UMA decisão, e não serve para comparar duas — a semente dela leva a
  alocação. Mesma alocação nas duas pontas dá diferença zero em toda corrida.
- **O podcast de recapitulação é FIXO** (ADR-156, `podcast.ts` +
  `podcast-fonte.ts`): o mesmo roteiro em toda turma, sem vaga, sem IA e sem
  edição do professor, com a atividade `"turma"`. Ele cita três vieses das
  fontes (satélite, cadastro, telefonia) — mexer na ficha (`cenario.ts`) ou nos
  vieses que ele cita exige reler o texto e subir a `versao` do pedido de voz.
