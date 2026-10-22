# exp02em1b — O Efeito Amplificador

Missão da 2ª série do Ensino Médio, unidade 1 ("Como os algoritmos decidem por
nós?"). O estudante é comunicador do grêmio: cria o post da campanha com o
UnooriaAI, audita o rascunho (dado inventado, trecho sem crédito, colega
exposto), publica no Unoovista e vê o algoritmo pinçar um trecho e entregar o
post de madrugada — para todo mundo, qualquer que seja o texto. Depois do
debate, aponta nos bastidores os indicadores que comprovam a retenção.

```bash
pnpm --filter @edu/exp02em1b dev     # :5178 → hub /exp/exp02em1b
pnpm --filter @edu/exp02em1b test    # versão em três lugares, bundle sem gabarito, seções do DS
```

A regra pedagógica, o gabarito e as marcas de evidência estão na api
(`apps/api/src/efeito-amplificador`).
