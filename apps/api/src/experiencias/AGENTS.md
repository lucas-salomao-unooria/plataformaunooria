# apps/api/src/experiencias — catálogo e versão

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito. O eixo
DISPONIBILIDADE, que não se mistura com este, está em
`apps/api/src/recursos/AGENTS.md`.

## Versão: duas alavancas, e elas não se misturam

- **`POST .../ativar`** troca `experiencias.versao_ativa` do CONTRATO e
  **RESTAURA o manifesto daquela versão** (`viewport`, `permissoes`, `series`,
  `unidade`, `produto`), lendo `experiencias_versoes.manifesto`. É o conserto
  do defeito que a fase 0 descobriu: `publicar-manifesto.mjs --versao x.y.z`
  manda o número antigo com o `experiencia.json` ATUAL, então voltar a versão
  nunca voltou as permissões de iframe — a app-70 reabria sem
  `allow-pointer-lock` e a câmera do jogo não girava, sem erro em lugar nenhum.
  Versão fora do histórico é RECUSADA: não se aponta a rede para o desconhecido.
- **`PUT .../versao`** grava `disponibilidades.versao_fixa` num escopo — o
  canário. `versao: null` solta a fixação e **preserva o `ligado`** da linha,
  que é decisão à parte; e `ligado`/`desligado` **não apagam** a versão fixada
  (o `versaoFixa` ausente no payload do `gravar` quer dizer "não mexe", e é o
  `CASE WHEN` do `ON CONFLICT`). Sem essas duas assimetrias, desligar e
  religar apagaria em silêncio a versão que alguém fixou.
- **A tela oferece UMA por escopo**: ativar só no contrato, fixar só fora dele.
  Fixar no contrato seria um segundo jeito, mais fraco, de fazer o que ativar faz
  — trocaria a versão sem restaurar o manifesto, reabrindo o defeito acima.
- **`experiencias_versoes.manifesto` tem DUAS formas** em circulação: o corpo do
  PUT do CI (`versaoAtiva`) e o `experiencia.json` cru do backfill e do seed
  (`versao`). `recursos/manifesto-guardado.ts` lê só os campos que precisam voltar, e
  nenhum deles é a versão — que vem do parâmetro da rota. Manifesto ILEGÍVEL
  troca só o número em vez de recusar o rollback: rollback é operação de
  incidente.
- **A conferência no CDN** é um HEAD no `index.html` da versão (`CDN_EXP_URL`),
  e a resposta carrega `conferida`. Sem a env (dev) ela é pulada e a tela diz
  isso: "ativei" e "ativei e conferi que o bundle está lá" são garantias
  diferentes. Apontar a rede para versão que não subiu é tela branca para todos,
  e o erro só apareceria quando a primeira criança abrisse a missão.
- **O HUB honra a fixação**: `montarEmbed` lê `GET /recursos/efetivos` em
  paralelo com o manifesto. Sem essa leitura, a coluna seria gravada, o painel a
  mostraria e nada mudaria.

## `experiencias_versoes` conserta um bug que ninguém tinha notado

`publicar-manifesto.mjs --versao x.y.z` manda o número **antigo** com o
`experiencia.json` **atual** do repositório. Voltar a versão nunca voltou
`viewport`, `permissoes`, `series` nem `unidade` — a app-70 reabria sem
`allow-pointer-lock`, a criança entrava na Vila e a câmera não girava, sem erro em
lugar nenhum. Por isso a tabela guarda o **manifesto inteiro** por versão: o
rollback pela tela reescreve as colunas com o que aquela versão tinha de fato.

Quem escreve a linha é o próprio `PUT /experiencias/:expId`, na mesma transação
do upsert do catálogo — e o `semearCatalogo` do seed faz igual, senão uma stack de
dev abre o painel dizendo que não conhece versão nenhuma do que está no ar.
`publicada_por` é TEXTO sem FK: quem publica quase sempre é o CI, cujo token tem
`sub = 'ci-deploy'` — não é uuid e não existe em `users`.
