# apps/api/src/recursos — o interruptor da rede (ADR-87)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito. O eixo VERSÃO,
que não se mistura com este, está em `apps/api/src/experiencias/AGENTS.md`.

## Disponibilidade: o interruptor da rede (ADR-87, 2026-09-09)

**Três eixos decidem se algo abre, e confundi-los é o defeito caro.**

| Eixo | Pergunta | Quem decide | Onde |
|---|---|---|---|
| catálogo | que forma a experiência tem? | o manifesto / o CI | `experiencias` |
| liberação (ADR-69) | está aberta NESTA TURMA? | professor | `liberacoes` → `exigirMissaoLiberada` |
| **disponibilidade** | existe NESTA REDE? | Unooria (`admin`) | `disponibilidades` → `exigirRecursoDisponivel` |

Disponibilidade é **pré-condição** de liberação. Produto desligado tem o sintoma
de um bug de enturmamento — a missão sumiu da grade e ninguém liberou nada —, e é
por isso que o eixo tem nome próprio.

**Estado em 2026-09-10.** Completo: porta, painel e versão. Leitura
(`GET /recursos/efetivos`, qualquer autenticado) e, só para `admin` (ADR-88),
`GET /recursos/painel`, `PUT|DELETE /recursos/:recursoId`,
`GET|POST|PUT /recursos/experiencias/:expId/{versoes,ativar,versao}`. O
histórico (`GET /recursos/auditoria`) é a ÚNICA de `/recursos/*` que a REDE
alcança — ver "O histórico" abaixo.

## O histórico é tabela, e a REDE lê o dela (ADR-89, 2026-09-10)

`recursos_auditoria`, append-only, escrita por toda mudança do painel e lida por
DOIS painéis: `/unooria/recursos` (quem opera) e `/admin/recursos` (quem sofre).
A rede continua sem escrever nada — ADR-88 intacta —, mas `GET
/recursos/auditoria` aceita `GESTORES_DO_CONTRATO`, e é a única rota de
`/recursos/*` que volta atrás da linha do `admin`: ler por que o produto da
própria rede mudou de estado é informação do cliente; decidir o estado não é.

- **O registro NUNCA derruba a operação que o chamou.** `registrarAuditoria`
  (`src/recursos/auditoria.ts`) engole o próprio erro e o entrega ao `aoFalhar`
  do chamador, que loga `codigo: "recurso-auditoria-nao-gravada"`. O contrário
  seria pior de todos os jeitos: o interruptor da rede falhando porque o
  histórico dele falhou. O contador desse código no Cloud Logging é o que avisa
  que o histórico está incompleto (cap. 17).
- **`autor_nome` é CONGELADO na linha**, sem FK para `users` — nem em
  `autor_id`. Um JOIN mostraria o nome de HOJE, ou nada se a conta saiu da rede,
  e o histórico deixaria de dizer quem era aquela pessoa naquele dia; uma FK com
  `RESTRICT` travaria para sempre a exclusão de quem já mexeu no painel.
- **`UPDATE` é recusado pelo BANCO**, por trigger, e o `GRANT` da role de runtime
  é `SELECT, INSERT, DELETE`. "Append-only" que só o código promete é o que a
  próxima rotina de correção quebra. `DELETE` fica de propósito: retenção futura
  e isolamento de teste.
- **A ação tem vocabulário FECHADO** (`ACOES_DE_AUDITORIA` ↔ CHECK da migração),
  e `versao` tem CHECK BICONDICIONAL — preenchida exatamente nas duas ações de
  versão. Linha `desligado` com versão ao lado faria quem lê concluir que a
  versão foi parte da decisão.
- **O filtro por escola INCLUI as decisões de escopo-contrato** (`escolaId = X`
  OR `escolaId IS NULL`): foram elas que decidiram o que vale ali, e um
  histórico de escola que as omite mostra uma escola onde nada aconteceu no dia
  em que tudo mudou. Teto de 200 linhas, com `truncado` na resposta.
- **`remover` (herdar) só historia quando `count > 0`.** Apagar linha que não
  existia não é evento, e registrar isso encheria o histórico de "herdado" que
  não mudou nada.

**O que ainda não existe**: segmentação por turma ou janela de validade — gatilho
de reavaliação declarado na ADR-87.

**Suíte que LÊ tabela de contrato declara a pré-condição — não conte com o
seed.** `experiencias`, `periodos_letivos` e `disponibilidades` não têm
`escola_id`: quem só as lê depende de quem as escreveu. No banco de dev o
`seed` já preencheu o catálogo, e três suítes passavam por isso; no Postgres
descartável do CI a tabela nasce VAZIA e o vermelho mente — "o produto desligado
não fechou a porta" é falta de dado, não guarda quebrada, e não reproduz na
máquina. Hoje o `globalSetup` (`tests/catalogo-real.ts`) semeia o catálogo
real dos MANIFESTOS antes de qualquer suíte, com `update` mínimo para não
desfazer um rollback deliberado em dev. **Antes de empurrar mudança em suíte de
Postgres, rode contra um banco NOVO** — `docker run ... postgres:16` numa porta
livre, `migrate:deploy`, suíte inteira. É o que o CI faz.

**O upsert do painel é SQL cru, e não por preferência.** O `upsert` do Prisma
não consegue endereçar a linha de escopo-CONTRATO: o único composto
`(recurso_id, escola_id)` tipa `escolaId` como `string` no `where`, porque um
único composto do Postgres não casa `NULL` — a MESMA limitação que obrigou o
índice parcial a existir. Com `upsert` o typecheck reprova; forçando o tipo, o
Postgres nunca acha a linha e cada clique em "desligar para a rede" tentaria um
INSERT novo. `ON CONFLICT (recurso_id) WHERE escola_id IS NULL` infere o índice
parcial, e são dois `ON CONFLICT` distintos porque são dois índices distintos.
`atualizado_em` vai na mão: `@updatedAt` é do Prisma, e SQL cru passa por baixo.

**Toda escrita loga `codigo: "recurso-alterado"`** com recurso, escopo, estado e
motivo, E grava a linha de `recursos_auditoria` (ADR-89). Os dois, não um: o log
é do turno de plantão, a tabela é da tela. A LINHA de `disponibilidades` é
sobrescrita a cada mudança — sem os dois, "quem desligou o jogo da rede, e
quando?" não tem resposta em lugar nenhum.

**`origem` do painel: a ordem das comparações é regra.** No escopo-contrato
`escopo` e `decididoEm` são os dois nulos, e testar `=== null` antes de
`=== escopo` faz uma decisão tomada ALI ser lida como "vem da rede" — soa
herdada de um nível que não existe. Visto na tela antes de virar teste
(`recursos-painel-postgres.spec.ts`).

**Onde a guarda entra, e por que num ponto só:**

- **Missões de estudante**: dentro de `exigirMissaoLiberada`
  (`comum/liberacao.ts`), ANTES da checagem de liberação. As seis experiências já
  passam por aquele funil, então um ponto cobre todas — e isso torna
  IMPOSSÍVEL existir liberação valendo num recurso que a rede não tem. Se cada
  experiência tivesse de chamar as duas guardas, a próxima nasceria chamando uma.
  A ordem importa para o DIAGNÓSTICO: produto desligado responde
  `recurso-indisponivel`, não `missao-nao-liberada` — invertido, o log mandaria
  quem investiga procurar na sala de aula um problema que está no painel.
- **Ferramentas de professor** (app-90, app-91, app-92): não têm liberação por
  turma e têm **28 rotas** entre as três. Anotar rota por rota é o desenho em que
  a 29ª nasce sem guarda, sem erro e sem sintoma — o produto simplesmente não
  desliga. Por isso é um GUARD DE CLASSE: `DisponibilidadeGuard` +
  `@Recurso("<expId>")` (`@Recurso("app-90-plano-de-aula")`) no `@Controller`, e a exceção é declarada com
  `@SemDisponibilidade()`.
- **`@SemDisponibilidade()` só para APAGAR os próprios dados.** Desligar um
  produto fecha tudo — é isso que o interruptor significa, e é o que um incidente
  exige. A única exceção é apagar o que já existe: "não consigo apagar meus dados
  porque o produto foi desligado" é indefensável, e mais ainda no check-in de
  bem-estar, que é DASS-21. Interruptor nunca pode prender dado de ninguém.
  Não use o escape para leitura, edição ou exportação.
- **Guard montado sem `@Recurso` LANÇA**, em vez de liberar. Liberar em silêncio
  é exatamente a falha que o guard existe para impedir.
- **A grade da sala filtra, e a missão SAI** (`salas.service.ts#catalogo`) —
  não fica com cadeado. Cadeado quer dizer "o professor ainda não abriu", e é um
  convite: existe alguém que pode abri-lo. Recurso que a rede não tem não abre
  para ninguém. `definirEstado` (liberar) também recusa: esconder o card é UX.
- **Sem linha em `experiencias` não tranca nada.** Stack de dev ou nova, antes do
  primeiro publish do CI, tem aquela tabela VAZIA — recusar ali faria toda missão
  morrer num ambiente recém-provisionado, com um 403 que não explica nada.
- **A mensagem do estudante é a MESMA de `missao-nao-liberada`.** Quem lê é uma
  criança dentro de um app disfarçado, e "este produto foi desativado para a sua
  rede" quebra a ficção que a experiência está medindo. Quem distingue é o
  `codigo`. Na ferramenta de professor não há disfarce, e a mensagem diz o que
  aconteceu.

**SEM CACHE, e é decisão.** São duas idas ao banco (a escola e as linhas que
valem), as duas por índice, numa tabela de dezenas de linhas — e a regra da casa é
não acrescentar estado sem gargalo medido. Gatilho para reavaliar: latência medida
em `GET /salas/minhas` ou na home do professor, as duas superfícies que resolvem
isto a cada render.

## A armadilha de TESTE que esta tabela criou (2026-09-10)

**Suíte NUNCA escreve linha de escopo-CONTRATO (`escola_id IS NULL`).**

`disponibilidades` está fora da RLS por desenho, então a linha de contrato vale
para a stack INTEIRA — e o Jest paraleliza. Enquanto ela existe, toda suíte
concorrente vê o produto desligado. Custou duas suítes vermelhas
(`vila-postgres` e `o-eco-no-grupo-postgres`) que **passam sozinhas e falham
juntas**, com o sintoma apontando para a Vila e a causa em
`disponibilidade-porta-postgres`. Pior: a corrida abortada deixa fixture para
trás, e a corrida SEGUINTE falha em outra suíte ainda — a cascata esconde a
origem.

Exercite o escopo-contrato com um `expId` que não existe no catálogo e que
ninguém mais usa; a cadeia inteira já se prova sem banco em
`recursos-regras.spec.ts`. A mesma regra vale para a suíte e2e.

**As duas regras do resolvedor** (`src/recursos/regras.ts`, puro e testado):

1. **O escopo mais específico ganha**: escola → regional → contrato → padrão.
   Escola e regional são a MESMA tabela `escolas`, distinguidas por `tipo`, então
   uma coluna `escola_id` nulável cobre os três níveis.
2. **O produto é um TETO**: produto desligado no escopo que vale ⇒ nada dentro
   dele liga, mesmo com linha própria dizendo `ligado`. Religar o produto no
   escopo menor é o caminho — e é explicável na tela; exceção por experiência
   sobrepondo o produto foi descartada na ADR-87.

**Ausência de linha = LIGADO**, o contrário de `liberacoes`. Lá a ausência é o
bloqueio; aqui é o mundo normal, porque este interruptor é mecanismo de EXCEÇÃO.
Nascer desligado exigiria uma linha por recurso a cada contrato provisionado, e
toda experiência nova ficaria invisível até alguém lembrar de ligá-la.

**A linha inteira é a decisão**: `ligado` e `versao_fixa` não se resolvem em
cadeias separadas. Campo a campo daria mais flexibilidade e produziria estados
que ninguém explica olhando a tela.

## A torneira ao lado do interruptor: a quota de IA (ADR-105, 2026-09-15)

`quotas-de-ia.controller.ts` — `GET /recursos/quotas-de-ia` e
`PUT /recursos/quotas-de-ia/:perfil`, `@Roles("admin")` e nada mais, pela razão
da ADR-88: quanto de IA uma rede gasta por dia é o custo variável da
fornecedora. Mora AQUI, e não em `src/ai`, porque é o painel da Unooria que a
opera: mesma guarda, mesmo histórico, mesmo prefixo `recursos` no BFF do hub.
`src/ai` só LÊ a linha.

- **Motivo obrigatório SEMPRE** (Zod), ao contrário de `disponibilidades`, onde
  só desligar pede: aqui toda mudança é exceção ao padrão da plataforma.
- **Zero e negativo são recusados** (Zod + CHECK `ck_ia_quotas_tokens_positivos`),
  e há teto de sanidade de 100 milhões. Fechar a IA de um produto é o
  interruptor, não a quota — e um zero a mais não pode virar quota infinita.
- **Valor igual ao atual não grava nem historia** (`alterada: false`), pela
  mesma razão de `remover` só historiar com `count > 0`.
- **A mudança entra em `recursos_auditoria`** com ação `quota-alterada`,
  `recurso_id = quota:<perfil>`, `escola_id` NULO e `detalhe = {de, para}`
  (coluna JSONB com CHECK bicondicional, o mesmo desenho de `versao`). O hub
  recorta essas linhas com `GET /recursos/auditoria?prefixo=quota:`. `ACOES` do
  `historico-de-recursos.tsx` é `Record` exaustivo: ação nova sem rótulo não
  compila.
- **`ia_quotas` é tabela de CONTRATO** (sem `escola_id`, sem RLS) e as duas
  suítes que a exercitam (`quotas-de-ia-postgres.spec.ts`, e2e `admin/02`)
  ESCREVEM nela — exceção declarada à regra "suíte nunca escreve linha de
  escopo-contrato". A precaução: só SUBIR o teto (não recusa ninguém se a
  corrida abortar) e devolver o valor no fim.
