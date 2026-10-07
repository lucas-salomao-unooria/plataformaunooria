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
  `zerarTurma` a sobe (o gate sobrevive ao zerar; o relógio, não), e a sessão
  grava a rodada em que nasceu. O resolvedor (`contexto-da-evidencia.ts`) só
  aceita resposta no passo `resultado` e da sessão da rodada vigente. NÃO use a
  `tentativa` como rodada: com "Tentar de novo" livre e a melhor rodada, o
  estudante chega a "atingiu" por exclusão.
