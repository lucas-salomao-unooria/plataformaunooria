# apps/api/src/vila — Vila do Lume (app-70)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

## Vila do Lume (app-70, `apps/api/src/vila`)
Jogo 3D **transversal** — não pertence a ano nenhum (`series: []`), e é o "Ato 1"
que o catálogo do Entre Redes sempre descreveu: *"fora da plataforma, um jogo
mede o perfil de valores do estudante"*. O perfil dele alimenta `exp08ef1b_app_70_perfis_importados`
(a largada do Instanooria) — M5.

**Duas leituras de uma partida, e elas NÃO SE TOCAM.** O retrato Schwartz
(`mapeamento.ts`, 10 valores + 2 eixos) lê escolhas com custo dentro do jogo; a
missão "A Noite Longa" (`mensagens.ts`) lê julgamento sobre 5 mensagens. A
separação é de MEDIDA: um golpe que custasse fagulha faria a criança que caiu
aparecer como menos generosa no retrato, e nada no relatório mostraria isso.

**O servidor recalcula; nunca aceita o perfil do cliente.** O jogo sabe computar
o retrato e deliberadamente não o envia — `CHAVES_DE_PERFIL` no contrato recusa
payload que traga. É isso que permite reprocessar o histórico quando
`VERSAO_MAPEAMENTO` subir (hoje 3, herdada do piloto para os dados serem
comparáveis).

**`grau` é invariante de API, não regra de tela.** Valor com UMA fonte de medida
não recebe número. A api devolve linhas em que só a variante `scored` tem
`numero: number`; as outras têm `null` POR TIPO (`leitura.ts`). O hub fica
estruturalmente incapaz de imprimir "Poder 100" a partir de um sinal só. E a
diferença entre `zero` ("teve a chance e não foi", entra na média) e `none` ("a
oportunidade não chegou", sai da conta) é a coisa mais importante do modelo.

**A bolha é do SERVIDOR.** `POST /vila/sessoes` atribui A/B/C balanceada dentro
da TURMA, persiste em `app_70_bolhas` (estável entre partidas: a folha do professor
diz "esse estava na C") e devolve os cartões — **só os desta criança e sem
gabarito**, como o `factual` do UnooTube. Era `estudanteSlot % 3` no navegador, o que
punha no bundle a condição do próprio instrumento e deixava as três versões
legíveis antes da aula. Nos anos iniciais (1EF–5EF) a bolha B não é servida
("suporte" exige entender o que é suporte) — regra que só a api pode aplicar,
porque só ela sabe a série. O lock consultivo por turma não é zelo: a sala clica
junto, e sem ele os 25 caem todos na bolha A.

**O relatório abre pelo NÍVEL, antes do que ela fez.** "Caiu em 2 de 3" sem dizer
que era o nível C faz o adulto concluir que a criança é ingênua — o rótulo que
este projeto existe para não produzir.

**`cartoesServidos` ≠ `apareceram`.** O primeiro é quantos a api entregou; o
segundo, quantos chegaram a aparecer. Zero aparecidos ⇒ a tela diz "as mensagens
não chegaram nesta partida", **nunca** "ela ignorou tudo" — é a mesma distinção
entre `zero` e `none`.

**Sem tabela de evento fino.** O bruto vive em `app_70_sessoes.payload` (fonte do
reprocessamento) e o canal analítico do SDK já grava em `telemetria_eventos`.
`eventos[].dados` só aceita número, booleano ou string de um **vocabulário
fechado** — o `texto` livre que existia era o único canal de texto arbitrário do
payload, e o caminho por onde o nome de uma criança chegaria a um JSONB de 90
dias. Trava estrutural, não lista de proibidos.

**Telas do professor** (`/professor/entre-redes/vila-do-lume`): ficha (para que
serve, quem consome o perfil, passo a passo), `/guia` (o debate),
`/resultados?turmaId=` (com o botão de **zerar a turma**) e `/estudantes/:id`.

**O `/guia` precisa saber a TURMA.** Nos anos iniciais a api não serve a bolha B,
e uma tela que projetasse as três mandaria o professor esperar a reação de um
grupo que a sala dele não tem — `GET /vila/professor/cartoes?turmaId=` filtra
pela mesma regra de `abrir` (`bolhasElegiveis`).

**Zerar a turma apaga as BOLHAS junto.** Rodar de novo com a mesma bolha serviria
à criança o mesmo golpe: ela reconhece, e a segunda rodada não mede nada. O que
NÃO é tocado é `exp08ef1b_app_70_perfis_importados` — aquilo pertence à atividade do Instanooria, e
apagar de lá trocaria os lados de uma aula em andamento. O `/guia` projeta as mensagens das TRÊS bolhas lado a lado — é a
revelação da missão, e a primeira vez que a turma vê as outras versões. Os textos
vêm de `GET /vila/professor/cartoes` (COM gabarito, professor only), nunca de
cópia no hub: os textos SÃO o instrumento, e uma vírgula divergente entre o que o
jogo serviu e o que o professor projeta põe a sala discutindo uma mensagem que
ninguém recebeu. A LISTAGEM da
turma não mostra valor de Schwartz nenhum — listagem é ordenável, e uma coluna
"Poder" viraria ranking de crianças; os valores vivem na tela individual, uma
criança por vez, com o grau ao lado. O agregado (`/vila/agregado/*`) abre para
gestor; a linha de uma criança, não — são controllers separados, e não um
`@Roles` misto com exceção por método.

**Do DS, o que a Vila usa** (conferido no pacote): o `MetricCard` **não inventa
tendência** (o prop é `tagText?` e sem ela a etiqueta não é renderizada), e o
`PositiveNegativeBarChart` tem escala **fixa** em ±100 (`h = (val / 100) * 110`)
— é exatamente o que os eixos do circumplexo pedem, então a barra divergente NÃO
se escreve à mão. `AlertBox` é diálogo de 436px; para faixa de contexto,
`FeedbackAlert` (o prop é `type`, não `variant`).

**Cor da plataforma vem de classe escrita à mão** em
`packages/ui/styles/plataforma.css`, e o tema do Tailwind está VAZIO
(`theme.extend: {}`). Classe de cor que não existe ali não é erro em lugar
nenhum: em texto ela herda a cor e passa desapercebida, em FUNDO o elemento fica
branco no branco. Foi o que aconteceu com `bg-unooria-neutral-900` (letra da
bolha invisível). O smoke da app-70 checa o `backgroundColor` COMPUTADO do
círculo por isso — `toBeVisible()` não pega. Só existem hoje:
`bg-unooria-{navy-800,neutral-50,neutral-100,neutral-200}`,
`border-unooria-neutral-200`,
`text-unooria-{danger,navy-900,neutral-500,neutral-700,neutral-800,neutral-950}`.

**Ato 1 do Instanooria: deixou de ser externo.** `POST
/atividades/:id/perfis/da-vila` (professor) colapsa o perfil da Vila nos quatro
quadrantes e grava em `exp08ef1b_app_70_perfis_importados` com `origem: "jogo"` — é o que decide
de que lado o feed nasce (`largada.ts`). `PERFIL_IMPORT_TOKEN` e
`POST /perfis/importar` continuam vivos como compatibilidade.
O colapso (`vila/quadrantes.ts`) tem duas travas que CUSTAM estudantes, de propósito:
valor não observado (`indicative`/`none`) **fica fora da média**, nunca entra como
zero; e quadrante sem nenhum membro observado **invalida o perfil inteiro** —
sem perfil, o Instanooria cai no sorteio balanceado, que é honesto sobre não
saber. Exige `amostraSuficiente`: o `dominante` vira coluna no CSV do `/analise`
ao lado da identidade da criança, e deixar uma partida curta decidir isso seria
dizer pelas costas o que o relatório se recusa a dizer na frente.
O disparo é do PROFESSOR e `ladoForcado` é PRESERVADO no upsert: importar
sozinho, ou levar o objeto inteiro no `update`, desfaria em silêncio uma
redistribuição que ele fez antes da aula.

**O perfil importado guarda a PARTIDA e a VERSÃO** (`vila_sessao_id`,
`versao_mapeamento` — ADR-50). Sem elas, subir `VERSAO_MAPEAMENTO` recalculava
`app_70_perfis` e deixava a CÓPIA que decide o feed na geração anterior, em
silêncio: a armadilha do `expires_at` de novo. **Sem FK** para `app_70_sessoes`, de
propósito — zerar a turma na Vila apaga sessões, e a cascata levaria o perfil que
está decidindo o lado de uma aula em andamento; é rastro da medida, não
integridade. Gravadas no `create` E no `update`, senão reimportar não tiraria a
linha do estado "desatualizada" e o aviso da tela nunca sumiria. Nenhum valor
novo de `origem`: duas CHECKs congelam o vocabulário, e `vila_sessao_id IS NULL`
já diz "não veio da Vila desta instalação". Não há rotina de reprocessamento, e
continua não havendo — o que existe é o AVISO no painel.

**Retenção: NÃO HÁ PRAZO DECLARADO** (decisão de 2026-08-26). Houve um
`expires_at` de 90 dias no schema e nenhuma rotina que o cumprisse — e coluna de
prazo que ninguém lê é pior que prazo nenhum, porque quem lê o schema acredita
nela. É a mesma armadilha do `turmas.consentimento_em` do app de origem: a regra
saiu do código, a coluna ficou, e todo mundo continuou acreditando.

O que se ganha em troca é o REPROCESSAMENTO, que é requisito de verdade deste
instrumento: `payload` é a única fonte para recomputar o perfil quando
`VERSAO_MAPEAMENTO` subir, e o mapeamento é hipótese de design que VAI mudar.
90 dias matavam exatamente a comparação entre duas gerações.

Se um contrato exigir prazo, ele volta **junto com a rotina que o cumpre** —
nunca só a coluna. A mesma pergunta está aberta para `telemetria_eventos`, que
guarda evento por `estudante_id` de todas as experiências e também não tem prazo: se
a resposta importar, ela é da plataforma inteira, não de um módulo.
