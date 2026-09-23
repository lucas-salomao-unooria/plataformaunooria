# apps/experiencias/exp08ef1b — o feed que se revela

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`.

| | |
|---|---|
| Manifesto | `exp08ef1b` · 8EF · `telemetria, progresso, ia` · viewport 375×812 |
| Dev | `pnpm --filter @edu/exp08ef1b dev` → :5173 |
| DS | `@edu/ui/ds-insta` no disfarce, `@edu/ui/ds` depois da revelação |
| api | `motor`, `geracao`, `dossie`, `atividades` — tabelas `exp08ef1b_*` |
| e2e | `scripts/e2e/estudante/02-instanooria.mjs` (sobe DOIS contextos: o docente conduz) |
| Copy da revelação | `src/lib/copy-da-revelacao.ts` — **cópia gêmea** de `apps/hub/lib/insta/copy-da-revelacao.ts`, que o guia do professor lê. Mexeu numa, mexa na outra: nada no build cobra isso |

## O cliente MEDE; quem decide é o servidor

`src/lib/eventos.ts` é buffer do MOTOR (flush a 4s, a 10 eventos, ou antes de
pedir o próximo bloco) e **nenhum peso, score ou classificação mora aqui**. O
feed adaptativo é da api: o cliente manda o que aconteceu e recebe o próximo
bloco. Colocar a regra no cliente é entregar o gabarito do próprio instrumento
(regra 3) — e torna impossível reprocessar a hipótese depois, que é o motivo de
o motor ser versionado do lado de lá.

## Dwell time tem uma definição, e ela não é intuitiva

`src/lib/dwell.ts`: `IntersectionObserver` com threshold **0.6** — o cronômetro
abre com ≥60% do card visível e fecha ao sair, revisitas somam, e a aba oculta
pausa. **Sheet aberto sobre o feed NÃO pausa**: comentário aberto continua
contando para o post, porque ler os comentários é atenção àquele post. Mudar
qualquer um dos três muda a medida, não só o número.

## Avatares

Personagens-símbolo, nunca rosto humano realista nem pessoa identificável — a
criança escolhe uma identidade para usar dentro de um feed que a está medindo.
A URL sai de `import.meta.env.BASE_URL`, **não** de `/`: o bundle é servido de
`{expId}/{versao}/` no bucket, e caminho absoluto aponta para a raiz da CDN.
