# apps/api/src/comum/insta — o relógio da aula (exp08ef1b, ADR-92)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

## Instanooria: o relógio da aula tem DOIS ponteiros (exp08ef1b, ADR-92)

`comum/insta/etapas.ts` reconcilia `activities.etapa` (a TURMA, que o professor
move) com `runs.fase` (a tela daquela criança). É puro e testado
(`tests/insta-etapas.spec.ts`), e nada dele aparece no typecheck: trocar piso
por teto compila e sai errado em 30 telas ao mesmo tempo, no meio de uma aula.

- **Indo para frente a etapa é PISO; voltando, é TETO.** O piso existe para não
  punir quem leu mais rápido DENTRO do momento liberado; voltar é outra
  intenção, e com a regra do piso o retorno mudaria o rótulo no painel e nada
  na tela dos estudantes. `debate` é a exceção nas duas direções: trava.
- **Sair da investigação CONGELA; voltar para ela REABRE. Os dois, sempre.**
  `moverEtapa` chama `encerrarRun` em toda run que entrou no aparelho ao sair
  (sem isso o relatório abre vazio) e, ao voltar, apaga o dossiê e zera
  `finished_at` de quem volta ao `feed`. **Mexeu num, mexa no outro**: com o
  congelamento sem o par, o retorno é `voltou: true, movidos: 0` — a turma
  inteira presa na tela da resposta com o painel dizendo "Investigação".
- **Apagar o dossiê é o que o torna recomputável.** `encerrarRun` é idempotente
  PELO DOSSIÊ: existindo a linha, devolve a de antes sem recomputar. Zerar só o
  `finished_at` deixaria o relatório seguinte sem nada do que a criança fizer
  daí em diante.
- **A trava do retorno é a REVELAÇÃO, não o congelamento** (`jaViuARevelacao`,
  `explicabilidade` em diante). Quem já sabe que o feed era enviesado não pode
  ser medido por ele de novo — o motivo é o instrumento. Quem não viu volta ao
  feed. **Ela lê a fase ATUAL, e a fase é regressiva**: voltando passo a passo,
  a run desce até `conclusao` antes de a turma chegar à investigação, e daquele
  degrau a proteção não se aplica — o pulo direto para na resposta, os cinco
  cliques terminam no feed. Limitação deliberada (fechar exige persistir o
  marco, que a fase não guarda), fixada nos dois sentidos em
  `tests/insta-etapas.spec.ts`. Não "conserte" um dos dois sem ler a ADR-92.
- **Voltar não é `reset`.** `POST /runs/:id/reset` apaga eventos, posts salvos,
  comentários, conclusão, reflexão, as tarefas do Canal A e o fim da revelação
  (a marca de evidência e a leitura da reflexão ficam: vale o primeiro envio, ADR-167); `moverEtapa` não apaga nada disso. Corrigir
  um clique do adulto destruindo a produção de trinta crianças é desproporcional
  — e era a única saída que o produto oferecia.
- **Fase legada NUNCA vira `onboarding` por fallback** (`normalizarFase`): uma
  run em `dossie` era EXPULSA para o seletor de avatar no meio da
  explicabilidade.

## O Canal A (ADR-167): as travas moram em `motor/canal-a/`

- **O 6a Raio-x abre da resposta em diante e FECHA no fim da revelação**
  (`runs.revelacao_concluida_em`, gravado pelo `POST :id/revelacao/concluida`);
  o 6b e o 6c só abrem do `perdidos` em diante COM a revelação terminada. Quem
  não teve feed com lado não recebe tarefa. A situação sai de `GET :id/tarefas`,
  e é ela que decide o desvio por fase no aparelho.
- **"Visto" sai dos EVENTOS também, não só do `engine_state`**: o motor só
  processa os eventos quando o aparelho pede o próximo bloco, e os do último
  bloco ficariam fora do Raio-x (a e2e mostrou: `vistosPorPost` vazio com 21
  eventos `visto` gravados).
- **A leitura da reflexão é UMA, com até 3 tentativas** (`motor/canal-a/leitura-da-reflexao.service.ts`):
  só a falha técnica tenta de novo, sempre o mesmo `primeiro_texto`, com teto
  de 60 s por tentativa. Ela é disparada sem `await` depois da transação do
  salvamento (`void this.leitura.ler(...)`): a criança não espera, e nada dela
  passa pelo teto de 30 s do BFF. Reiniciar a api no meio perde a leitura em
  andamento (a linha fica sem `lida_em`).
- **O relatório do estudante esconde lado, intensidade e categoria do
  `topDwell` enquanto o Raio-x está pendente** — o post do lado dele em que mais
  parou entra sempre no Raio-x.
