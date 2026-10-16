# apps/api/src/unoogpt — Missão Tempestade (exp02em1b)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

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
- **A evidência pedagógica (E14, ADR-154) não tem atividade: é a `"turma"`**,
  o mesmo id das equipes, e a rodada é da TURMA (`exp02em1b_gate_turma`). Só o
  `zerarTurma` a sobe (o gate sobrevive ao zerar; o relógio, não) — e APAGA a
  evidência da turma, marcas e níveis de todas as rodadas (ADR-155): sem isso,
  o encerramento seguinte relia as respostas de antes. A sessão
  grava a rodada em que nasceu. O resolvedor (`contexto-da-evidencia.ts`) só
  aceita resposta no passo `resultado` e da sessão da rodada vigente. NÃO use a
  `tentativa` como rodada: com "Tentar de novo" livre e a melhor rodada, o
  estudante chega a "atingiu" por exclusão.
- **O envio tem UM portão, `aoConfirmar`, para o botão e para a conversa.**
  Ele confere, sob o lock da sessão, o porquê de cada equipe COM destino
  (`faltaJustificar`) e devolve a recusa com motivo
  (`ResultadoDaConfirmacao`): `falta-justificar` ou `sem-destino`. Mandar com
  UMA equipe na base é permitido — a tela e o Cientista dizem isso —, e o que
  se recusa é nenhuma equipe ter destino (`sem-destino`, código próprio). Antes
  "pode mandar" no chat pulava a justificativa, e a equipe na base caía em
  `falta-justificar`, uma frase que acusava um porquê que não faltava.
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
