# apps/experiencias/exp-91-bem-estar — check-in do professor (DASS-21)

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`.

| | |
|---|---|
| Manifesto | `exp-91-bem-estar` · `publico: "professor"` · `series: []` · `telemetria, ia` |
| Dev | `pnpm --filter @edu/exp-91-bem-estar dev` → :5176 · hub `/professor/bem-estar` |
| DS | `@edu/ui/ds` |
| api | `/bemestar/*` (`hoje`, `historico`, `dados`) — as decisões estão em `apps/api/AGENTS.md` |
| e2e | `scripts/e2e/professor/04-bem-estar.mjs` (`AI_PROVIDER=mock` usa os textos fixos) |

## Instrumento, não conversa: os 21 itens são verbatim

As três frases do dia vêm do catálogo da api, palavra por palavra. **Nunca
reescreva, encurte nem "melhore" um item na tela** — reformular quebra a
validação psicométrica e as faixas de corte, e o resultado continua parecendo
uma medida. O que a IA gera é só o entorno (abertura, pergunta aberta,
acolhimento), e ela nunca recebe nome, escola, pontuação nem faixa.

## Dado do professor, e de mais ninguém

Não existe tela de gestor, agregado, comparação entre docentes nem exportação —
e não é lacuna a preencher (LGPD art. 11, dado sensível). Quem lê é o próprio
professor, e `DELETE /bemestar/dados` apaga tudo. Texto livre não vai a log nem
à telemetria: só contagens.

**Mas o texto livre VAI ao Vertex** — é dele que sai o acolhimento
(`bemestar.service.ts#gerarAcolhimento`; sem texto, nem chama a IA). Por isso a
copy da caixa não pode prometer sigilo de leitura: ela dizia *"Só você lê o que
escreve aqui"*, o que era verdade sobre PESSOAS e silêncio sobre a IA. **Toda
promessa de privacidade nesta tela tem que bater com o que o service faz** — é
aqui que o professor decide se conta que não está bem, e uma garantia que ele
descobre depois ser parcial não custa a frase, custa o instrumento: o próximo
check-in ele responde com reserva. A suíte `professor/04-bem-estar` cobra as
duas metades da frase; nenhum typecheck protege string de UI.

## Data é string, e `new Date()` estraga

`formatarDia` (`src/lib/estado.ts`) fatia `2026-08-25` na mão de propósito: o
parse ISO-só-data é UTC e, à noite em `America/Sao_Paulo`, vira o dia — o
check-in de hoje apareceria como o de ontem no histórico.
