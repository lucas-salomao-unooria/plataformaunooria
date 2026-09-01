# apps/experiencias/exp-03-unoogpt — a missão que nunca sai do disfarce

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`.

| | |
|---|---|
| Manifesto | `exp-03-unoogpt` · 2EM (unidade 1) · `telemetria, ia` · `permissoes: ["forms"]` |
| Dev | `pnpm --filter @edu/exp-03-unoogpt dev` → :5178 · hub `/exp/exp-03-unoogpt` |
| DS | `@edu/ui/ds-chatgpt` **na experiência inteira** |
| api | módulo `unoogpt` — trilha pedagógica em `exp_03_marcos` |
| e2e | `scripts/e2e/estudante/04-unoogpt.mjs` |

**Ela não tem revelação no software.** Por isso nunca troca para a seção da
plataforma: não existe momento em que a escola passa a falar dentro da tela. Um
componente de `@edu/ui/ds` aqui é sempre erro.

## O timeout padrão do SDK está errado nesta experiência

Um turno do Cientista passa por até 6 voltas de ferramenta e leva de 10 a 30
segundos; o default do SDK é 10s. `src/lib/api.ts` declara o próprio teto — sem
ele o estudante vê falha no meio de uma resposta que estava chegando.

## Dois canais que não são o mesmo

Telemetria **analítica** (SDK → batch → `telemetria_eventos`) mede o uso.
A trilha **pedagógica** é `exp_03_marcos`, gravada pela api. Não misture: o que
vale nota nunca vem do canal que o cliente preenche.

E o corte de PII é por design: `fontesCarregadas` registra **quantas** fontes,
nunca as palavras com que o estudante pediu.

## Erro tem status, e cada status tem uma frase

O SDK lança `Error("API POST /x → 409")` sem corpo. A tela escolhe o texto pelo
STATUS (409 = regra do jogo, 429 = quota/rate limit), sem refazer o pedido e sem
expor detalhe interno.
