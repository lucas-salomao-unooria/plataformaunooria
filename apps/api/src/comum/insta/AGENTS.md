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
  inteira presa na tela da resposta com o painel dizendo "Investigação". Foi
  assim por meses, porque o ramo do `feed` em `faseAoVoltar` era INALCANÇÁVEL:
  a condição que o guardava (`sessaoCongelada`) era sempre verdadeira.
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
  comentários, conclusão e reflexão; `moverEtapa` não apaga nada disso. Corrigir
  um clique do adulto destruindo a produção de trinta crianças é desproporcional
  — e era a única saída que o produto oferecia.
- **Fase legada NUNCA vira `onboarding` por fallback** (`normalizarFase`): uma
  run em `dossie` era EXPULSA para o seletor de avatar no meio da
  explicabilidade.
