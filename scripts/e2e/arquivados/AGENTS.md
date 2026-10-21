# scripts/e2e/arquivados — suítes de experiências ARQUIVADAS (ADR-116)

Complementa o `AGENTS.md` de `scripts/e2e`, que vence em conflito.

O runner (`rodar.mjs`) só percorre as pastas dos PAPÉIS (`estudante`,
`professor`, `gestor_escola`, `gestor_contrato`, `admin`…). Esta pasta não é um papel, e é por isso que ela
existe: aqui ficam as suítes das experiências arquivadas, guardadas como estavam
e **fora da execução** — uma experiência arquivada não abre para ninguém, então a
suíte dela só poderia reprovar.

| Suíte | Experiência | Arquivada em |
|---|---|---|
| `backup-03-unootube.mjs` | UnooTube (`backup-exp04ef1b`), que era `estudante/03` | 2026-09-26 — o Jornal da Escola tomou o código `exp04ef1b` |

Os imports relativos (`../lib/…`) continuam resolvendo daqui: a suíte não foi
editada além do caminho. Para desarquivar, ela volta para a pasta do papel junto
com a migração que desfaz o arquivamento.
