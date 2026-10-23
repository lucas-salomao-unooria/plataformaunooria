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
  (a marca de evidência fica: vale o primeiro envio, ADR-167); `moverEtapa` não apaga nada disso. Corrigir
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
- **As réguas são as do PO, validadas com a pedagogia (ADR-179) e ajustadas por
  ele (ADR-180)**: a EF08CO11 é SÓ o Raio-x (5–6 / 4 / 0–3: os 3 acertos ficam
  em "não atingiu" porque a regra dos 3 deixa o chute acertar 3), e a mensagem
  que ridiculariza dá "não atingiu" no envio. Os termos
  de uso aparecem na ENTRADA (`GET /runs/termos-de-uso`, sem sessão), com as 5
  cláusulas do 6b enterradas no texto (`TERMOS_DA_ENTRADA`). Mudou uma
  cláusula? Ela muda nas duas telas, porque o texto da entrada é montado a
  partir de `CLAUSULAS` — nunca copie a frase para o texto denso.
- **"Visto" sai dos EVENTOS também, não só do `engine_state`**: o motor só
  processa os eventos quando o aparelho pede o próximo bloco, e os do último
  bloco ficariam fora do Raio-x (a e2e mostrou: `vistosPorPost` vazio com 21
  eventos `visto` gravados).
- **A reflexão NÃO passa pela IA (ADR-180)**: a leitura que sugeria um nível
  da EF08CO11 saiu, com o serviço e o prompt. A tabela
  `exp08ef1b_leituras_da_reflexao` e a coluna `primeiro_texto` ficam, sem
  escrita, com o que já foi gravado; as marcas `reflexao` antigas não contam
  (o marcador saiu da ficha). Não religue a leitura sem decisão do PO: a
  página de privacidade deixou de dizer que a reflexão vai para a IA.
- **O relatório do estudante esconde lado, intensidade e categoria do
  `topDwell` enquanto o Raio-x está pendente** — o post do lado dele em que mais
  parou entra sempre no Raio-x.
