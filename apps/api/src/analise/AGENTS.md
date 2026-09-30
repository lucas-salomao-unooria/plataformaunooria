# apps/api/src/analise — o relatório da diretoria

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

## Relatório da diretoria: laço, não política de RLS (ADR-82)

`GET /escolas/minhas/relatorio` — consolidado por missão + quebra por escola,
para `gestor_regional` (a própria regional) e os perfis de contrato
(`?regionalId=`).

- **`liberacoes` e `progresso` estão SOB a RLS**, e o relatório atravessa escolas
  abrindo a tranca **uma escola por vez** (`comTenancy` por escola, em lotes de
  8 com `aosPares`), somando na aplicação. A política **não** é tocada. É o mesmo
  padrão de `lotarEmLote` e da transferência.
  **Afrouxar a política seria UMA linha** (ela é gerada por laço sobre as
  tabelas com `escola_id`) — o custo não é escrever, é que ela É a garantia de
  que a escola A nunca vê a criança da escola B. O laço mantém a garantia literal.
- **A autorização mora em `regionalDoRelatorio`**, um método, não no controller.
  Para `gestor_regional` a regional vem de `users.regional_id` e o
  `?regionalId=` é **IGNORADO** — ignorado, e não validado contra o dele: o
  efeito é o mesmo, mas por um caminho em que esquecer a comparação não vira "leia
  a diretoria do vizinho por querystring".
- **As DUAS medidas, lado a lado**: `estudantes` é a CRIANÇA com registro (a PK
  de `progresso` é (escola, estudante, exp), então contar linha já é contar
  criança distinta); `turmasLiberadas`/`turmasEncerradas` é a AULA. A diferença
  entre elas é a informação — turma encerrada com poucos registros é aula que
  passou sem a sala entrar.
- **Cobre as nove experiências sem código por experiência**, porque as duas
  tabelas são da PLATAFORMA. A décima entra de graça.
- **Fora, e não por esquecimento**: bem-estar (dado de saúde, sem rota de gestor
  nenhum), o retrato de valores da Vila agregado (listagem ordenável vira ranking
  de criança) e **nome de criança** — o relatório é contagem.
- **O teto**: uma transação por escola. Diretoria muito grande ficar lenta é
  gatilho para agregado materializado, **não** para afrouxar a política.
