# scripts/e2e/anteriores — suítes das VERSÕES ANTERIORES (ADR-181)

Complementa o `AGENTS.md` de `scripts/e2e`, que vence em conflito.

O runner (`rodar.mjs`) só percorre as pastas dos PAPÉIS. Esta pasta não é um
papel, como `arquivados/`: aqui ficam as suítes de uma missão que perdeu o código
para uma reformulação e virou `expNNxxUb-vN`. A diferença para a arquivada é que
a versão anterior continua NO AR (módulo, dados e liberações seguem) — mas saiu do
catálogo: a ficha do professor em `/professor/entre-redes/<ano>/<unidade>` passou a
ser da missão nova, e é por ela que estas suítes entravam. Rodando, só poderiam
reprovar; ficam guardadas como estavam, com o id trocado.

| Suíte | Experiência | Era | Desde |
|---|---|---|---|
| `04-unoogpt-v0.mjs` | Missão Tempestade (`exp02em1b-v0`) | `estudante/04` | 2026-10-22 — O Efeito Amplificador tomou `exp02em1b` |
| `10-equipes-na-missao-v0.mjs` | equipes da missão SEM atividade, na Tempestade | `professor/10` | idem: era a única missão sem atividade (ADR-130) |

Os imports relativos (`../lib/…`) continuam resolvendo daqui. Para rodar uma
delas de novo, ela volta para a pasta do papel com um caminho de entrada que não
seja a ficha do catálogo (a URL `/exp/exp02em1b-v0` numa turma que já a tinha
liberado).
