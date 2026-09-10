<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- As regras acima são geradas pelo Next e ficam entre os marcadores.
     Tudo abaixo é do projeto e sobrevive a uma regeração. -->

# apps/hub — Next.js (App Router)

Complementa o `AGENTS.md` da raiz.

**A raiz (`/`) é a LANDING pública** (2026-08-29, ADR-40): sem sessão, renderiza
`components/landing/` — porte da tela do Stitch com a estrutura, a copy e o
movimento do modelo, e a cor, a tipografia, os ícones, o logo e os botões do DS
(nunca a paleta/fontes que o Stitch gera). Com sessão, `/` continua roteando
para a home do papel: o `login-form` e o `trocar-senha` fazem
`router.replace("/")` e dependem disso. Duas armadilhas medidas: o cleanup do
shader NÃO pode chamar `loseContext()` (o Strict Mode remonta o efeito no mesmo
canvas e o contexto volta perdido — fundo em branco), e cor de ícone vai pela
prop `color` do `Icon`, não por classe (a folha do DS vence e o ícone sai preto).
Suíte: `node scripts/e2e/rodar.mjs publico` (a landing e o login; só o hub).

**`/privacidade` e `/termos` são a MESMA superfície pública da landing**
(ADR-70), alcançadas pelo rodapé dela. `components/legal/` importa
`landing.css` e monta o mesmo `FundoAnimado` — não copie a nav, o fundo nem a
escala tipográfica para cá: a cópia diverge na primeira mudança de marca, e as
duas páginas passam a parecer de outro produto justo onde a confiança está sendo
decidida. **O conteúdo entra como DADO** (`SecaoLegal[]` com `id`, `titulo`,
`conteudo`), nunca como marcação livre: sumário, numeração e âncora saem da
mesma lista que renderiza as seções, então o índice não pode prometer um item
que o corpo não tem. Duas proibições que já foram rejeitadas em revisão:
**nenhuma `<table>`** no texto legal (célula altíssima e rolagem lateral no
celular, que é onde a família abre o link — use `.legal-card`) e **nenhum
`[A DEFINIR]` espalhado**; o que depende do contrato mora no bloco
`IDENTIFICACAO` no topo de cada página, e o que falta decidir tem uma seção
final própria. **O texto só afirma o que o código faz** — a ADR-70 lista as
promessas que hoje seriam falsas (retenção, exclusão por titular, log de acesso,
dados no Brasil, consentimento). Suíte: `publico/03-documentos-legais`.

**Header: um só para todos os papéis.** `components/header-plataforma.tsx`
(marca → home do papel, e o `MenuDaConta` com nome, série/papel e avatar) é o header de
`/estudante`, `/professor`, `/admin`, `/analise` E de `/exp/*` — antes cada área
copiava o seu e a experiência não tinha nenhum. A casca visual (CSS do DS,
compensações, fontes) saiu do layout do grupo `(plataforma)` para
`components/casca-plataforma.tsx`, porque `/exp/*` e `/dev-embed` estão fora do
grupo e também precisam dela. A regra de ouro passou a valer um nível abaixo: o
header é chrome do HUB, desenhado ACIMA do aparelho — dentro do iframe nada da
marca institucional entra.

**O "Sair" mora no menu do avatar, não na barra** (`components/menu-da-conta.tsx`,
`HeaderMenu` do DS 0.1.19). Era um `Button variant="ghost"` solto: a ação mais
destrutiva do header com o mesmo peso visual da marca, a um clique de distância.
Duas coisas para saber antes de mexer nele:

- **O nome e o papel moram DENTRO do `MenuDaConta`, e é obrigatório.** A tira do
  `HeaderMenu` é um overlay ancorado à esquerda do gatilho e o componente assume
  espaço vazio ali. No nosso header ali fica a identidade: devolver o bloco para
  o `header-plataforma.tsx` faz o item "Sair" abrir DESENHADO EM CIMA do nome.
  Passa no typecheck, passa no build, e só aparece abrindo o menu.
- **Item de menu novo precisa de tela que exista.** "Trocar senha" parece o
  próximo item óbvio e é um link morto: `middleware.ts` devolve quem já trocou
  para a home do papel. Menu curto é melhor que menu com item que não leva a
  lugar nenhum.


## A marca ancora na JANELA, e o gutter é um só (ADR-83, 2026-09-08)

**O miolo do header é full-bleed: `px-6` e mais nada.** Sem `max-width`, sem
`mx-auto`. O `HeaderPlataforma` teve um parâmetro `largura` (`5xl` | `6xl` |
`cheia`) cujo comentário dizia, com todas as letras, que ele "casava com o
`max-width` do `<main>` de cada área" — e é exatamente esse acoplamento que era
o defeito: o miolo é centralizado, então a coluna da área virava a posição da
marca.

Medido com Playwright, logado em cada papel, a marca ocupava **quatro** X
diferentes (viewport de 1440px):

| superfície | `largura` | marca X @1440 | @1920 |
|---|---|---|---|
| `/admin/**`, `/exp/:expId`, `/dev-embed` | `cheia` | 20px | 20px |
| `/analise` | `6xl` | 164px | 404px |
| `/professor/**`, `/estudante` | `5xl` (default) | 228px | 468px |

208px de salto em 1440, **448px em 1920** — num header que é o mesmo em todas as
telas, com a mesma altura e os mesmos elementos. O dono do produto viu isso como
"a marca desliza para a direita em algumas páginas", que é a descrição exata do
sintoma sem a causa à vista.

**E o acoplamento nunca teve como convergir.** `/admin` tem navegação lateral e
`/exp` é aparelho em tela cheia: essas áreas jamais terão a coluna de
`/professor`. Unificar as colunas não resolveria — só reduziria de quatro
posições para duas.

**O gutter é 24px (`px-6`) no chrome E na coluna.** O header andava em `px-5` e
o `<main>` de `/analise` em `px-6`: a marca ficava 4px à esquerda do título da
própria página. Quatro pixels ninguém nomeia olhando, e voltam sozinhos se os
dois valores forem escritos separados de novo — por isso o header carrega a
constante `GUTTER` e os layouts usam o mesmo `px-6`. Em telas estreitas (abaixo
do `max-width` da coluna) header e conteúdo passam a começar no MESMO X; medido
em 900px: 24/24 nas cinco áreas.

**O que isto custa, declarado:** em telas largas a marca não alinha mais com o
título da página nas áreas de coluna estreita (472px de distância em 1920, em
`/professor`). É deliberado. O header é chrome do hub — pertence à janela, não à
página —, e um chrome que se move ao navegar é o defeito que esta seção existe
para não deixar voltar.

**A superfície pública ficou de fora, por decisão.** A nav de `/`,
`/privacidade` e `/termos` (`.landing-nav__miolo`, em `components/landing/landing.css`)
mantém miolo de 1440px centralizado e `Logo size="md"` — em 1920px a marca dela
cai em 264px, contra os 24px do app. É outra superfície, com outro público e
outra linguagem; mexer nela é decisão de marketing, não de chrome. Quem for
reabrir isso um dia: a mudança é trocar o `max-width` do `.landing-nav__miolo`
por `none`.


## A trilha é do LAYOUT da área, nunca da página (2026-09-07)

**Nenhuma página do hub desenha o próprio breadcrumb.** Quem desenha é o layout
da área, com `<TrilhaDaRota papel={...} />` (`components/trilha.tsx`), e os itens
saem de um registro de rotas — `NOS`, em `lib/trilha.ts`, com o padrão da rota
como chave (`/professor/entre-redes/[ano]/[unidade]`, igual à pasta em `app/`).

Era por página, e o resultado foi o que o dono do produto viu: 22 telas com
trilha e 15 sem — cinco na própria área do professor, as 7 de `/admin`, as 2 de
`/analise` e o hub do estudante. Ninguém decidiu isso. A trilha era
responsabilidade da página, e responsabilidade de página se esquece; a barra
lateral de `/admin` era a razão de ninguém notar, porque ela cobre a navegação
de primeiro nível e esconde a falta do segundo.

**Rota nova = uma linha em `NOS`, e nada na página.** Esquecer a linha não apaga
a trilha: a rota não registrada cai num rótulo humanizado do segmento
(`plano-de-ensino` → "Plano de ensino"), que é um defeito visível e barato de
corrigir. O que não pode acontecer nunca é a trilha desaparecer, e o desenho
tira essa possibilidade da mesa.

**A página só PUBLICA nome próprio, com `RotuloDaTrilha`** — o título da
atividade, o nome da turma, o nome do estudante: o que uma tabela de rotas não
tem como saber. Sem publicação o item fica no rótulo de domínio do registro
("Atividade", "Turma", "Estudante"), **nunca no id do endereço**. `para=` ajusta
um ANTEPASSADO (é como `/professor/atividades/:id/analise` nomeia a atividade
acima dela) e `href=` corrige o endereço quando ele carrega query
(`/analise?escolaId=`). O custo é um quadro: o HTML do servidor traz o rótulo
genérico e a hidratação troca pelo nome — inevitável, porque o layout renderiza
ANTES da página e não tem como perguntar nada a ela.

**O `ProvedorDaTrilha` não pode renderizar DOM.** Em `/professor/**` a altura das
três telas de embed vem de `main:has(> .tela-cheia)`: um elemento a mais ali
quebra o seletor de filho direto e devolve a barra de rolagem parada que a seção
`.tela-cheia` deste arquivo existe para explicar.

**A largura da coluna é do layout, não da página.** Em `/admin` eram 1080px em
quatro telas e 1180px em duas, em `/analise` 5xl e 6xl — sem razão registrada em
nenhum dos casos. Com a trilha no layout, largura por página faz o breadcrumb
nascer 50–64px à esquerda do texto. **Mas a largura da coluna não é do HEADER**:
ele ancora na janela, e o porquê está em "A marca ancora na JANELA".

**Duas exceções declaradas, e só elas.** `aPaginaDesenha: true` nas rotas de guia
da aula, porque `components/guia/guia-da-aula.tsx` renderiza a trilha por dentro
— some quando ele deixar de receber a prop `trilha`. E a home de cada papel
(`homeDoPapel`) não leva trilha: um item só, que é a própria página, é ruído.
Tela sem sessão (`/login`, `/trocar-senha`), aparelho em tela cheia com `voltar`
no header (`/exp/:expId`), superfície pública (`/`, `/privacidade`, `/termos`) e
ferramenta de dev ficam fora porque não estão dentro de layout de área nenhum —
**área nova precisa de layout novo, e layout novo desenha `TrilhaDaRota`**; sem
isso a área nasce como `/admin` nasceu.

**Rótulo é português com acento e vocabulário de domínio** (`estudante`, `turma`,
`missão`), o nome do produto quando a rota é um produto ("Gerador de Plano de
Aula"), e o último item nunca é link. Colapso, separador, tamanho e tema são
props do `Breadcrumb` do DS — não se resolve nada disso na mão.

**A lógica mora em `lib/trilha.ts`, e o motivo é o teste.** O `vitest.config.ts`
do hub só varre `lib/**/*.test.ts`; enquanto o registro vivia no componente ele
não tinha rede nenhuma. E o modo de falha dele é silencioso: `rotuloDaUnidade`
ESPELHA `rotuloDaMissao` de `lib/entre-redes/catalogo.ts` de propósito (o
catálogo é pesado e este módulo é client), então mudar o formato do slug do ano
faz a trilha cair em "Missão" sem erro nenhum. Mexeu no slug, mexa nos dois — e
`lib/trilha.test.ts` prende os dois formatos.


## Papéis e roteamento

`lib/papeis.ts` é contrato congelado com a api (`apps/api/src/auth/claims.ts`):
quatro papéis, replicados em quatro fontes que precisam concordar sem
compartilhar código — o validador do token, este arquivo (que o middleware edge
importa), o `CHECK` no Postgres e o atributo `perfil` do WSO2. `/estudante` e
`/exp/*` são a MESMA área no middleware.

**Escola ativa é estado de SESSÃO.** Quem tem mais de uma escolhe no cabeçalho
(`components/seletor-de-escola.tsx`); a troca passa por `POST /api/escola-ativa`,
que valida contra `GET /escolas/minhas` **da api** — nunca contra a lista que o
cookie carrega.

## Trocar de escola REMONTA o miolo da área (ADR-85, 2026-09-09)

**O layout de cada área envolve `{children}` em `<EscopoDaEscola>`**
(`components/escopo-da-escola.tsx`) — um `Fragment` com `key` na escola ativa.
Quando a escola muda, o React desmonta a subárvore e monta outra: estado zerado,
efeitos refeitos, iframe recarregado.

`router.refresh()` sozinho **não** faz isso. Ele re-renderiza só os Server
Components; um Client Component já montado não remonta, os `useEffect` dele não
re-disparam (as dependências não mudaram), um `useState(propDoServidor)` não
reinicializa e um `<iframe>` não recarrega. O comentário do seletor dizia "as
telas são Server Components e leem a escola da sessão" — verdade em
`/professor/**`, falso em `/admin/**` e nas três telas de embed. Medido em
2026-09-09 com um gestor lotado em duas unidades:

| tela | antes da correção |
|---|---|
| `/admin/usuarios` | cabeçalho na escola nova, tabela com as 49 pessoas da antiga (as 1004 da nova só com F5) |
| `/admin/turmas` | 27 turmas da outra unidade |
| `/admin/turmas/[id]`, `/admin/importar` | idem, presas em `useState`/deps que não mudam |
| `/professor/plano-de-aula`, `/plano-de-ensino`, `/bem-estar`, `/exp/:expId` | hub já emitia token de `escola-demo-2`, iframe seguia com o de `escola-demo` |

O último é o grave: numa tela de embed o token viaja UMA vez, no `hub:init` que
responde ao `exp:ready`. Sem remontar o aparelho não é tela velha — é **escrita
na escola errada**, e a RLS não barra porque o token é legítimo, só é o da
escola de antes. Nas telas de admin a RLS salva: a ação vai com o token novo, a
api não acha a linha e a pessoa vê um erro genérico.

**É do LAYOUT da área, nunca da página** — a mesma razão da trilha, logo acima:
página nova nasce escopada sem escrever uma linha. As quatro telas quebradas
eram quatro esquecimentos independentes do mesmo detalhe. **Área nova precisa de
layout novo, e layout novo envolve o miolo em `EscopoDaEscola`**; sem isso a área
nasce com o defeito que esta seção existe para não deixar voltar.

**Envolve o miolo, não o cabeçalho**: o `HeaderPlataforma` hospeda o próprio
seletor, e remontá-lo tiraria o foco do teclado de quem acabou de trocar. E é
`Fragment`, não `<div>`: um elemento a mais quebraria o `main:has(> .tela-cheia)`
e devolveria a barra de rolagem parada das telas de embed.

**O F5 mascarava tudo, inclusive no teste.** A suíte
`gestor_escola/02-quem-trabalha-em-duas-escolas` trocava a escola e fazia `goto`
em seguida — provava que o *token* mudava e nunca olhava a tela onde a troca
aconteceu. Ela agora tem os dois passos que faltavam: rebuscar a lista **na
mesma tela** e remontar o aparelho da experiência (marca-se o `<iframe>` e
confere-se se a marca sobreviveu).

## Regionais e Escolas são DUAS telas (ADR-79)

`/admin/regionais` antes de `/admin/escolas` no menu — a ordem da hierarquia, e a
ordem em que quem chega lê a lateral. As duas são `admin-contrato` (o id novo
entrou em `SO_ADMIN_DO_CONTRATO` de `components/nav-admin.tsx`, e a página faz
`redirect` como a de escolas já fazia).

**Era uma tela só, e a mistura era o problema**: os três níveis na mesma `Table`
com o tipo numa `Tag`, `"—"` nas colunas de turma e estudante das linhas de
regional, um resumo que somava níveis diferentes ("3 registros · 2 unidades") e
um filtro de **Tipo** cuja única função era desfazer a mistura. Separar as telas
REMOVEU um controle — se o filtro de Tipo voltar a `/admin/escolas`, é porque a
tabela voltou a misturar. A suíte e2e cobra isso.

**Três armadilhas de rótulo que a separação corrigiu, e que valem para qualquer
tela de lista:**

- **"Sem regional" MENTIA.** A opção tinha `value: ""`, e o `carregar()` só manda
  `paiId` quando ele é truthy: escolher "Sem regional" limpava o filtro e
  mostrava a rede inteira. Hoje é "Todas as regionais", que é o que ela sempre
  fez. Opção de filtro cujo valor é o vazio do "sem filtro" nunca pode se chamar
  pelo nome de um subconjunto.
- **"Professores" no resumo era vínculo, não pessoa.** Por escola o número é de
  pessoas (índice único por escola+pessoa+papel); o total SOMADO conta duas vezes
  o professor lotado em duas escolas. A coluna diz "Professores", o resumo diz
  "vínculos de professores".
- **A regional é informação DA ESCOLA**, na segunda linha da célula junto do id.
  Sem isso, o filtro seria o único lugar do produto que diz a que diretoria a
  unidade pertence.

**A tela de Regionais não soma turma nem estudante das unidades.** É permitido
(`admin-contrato` é a exceção cross-escola) e seria útil, mas aproxima a tela da
visão somada de diretoria que a ADR-34 recusa, e custaria uma agregação sobre
cinco mil escolas. O único número dela é `unidades` — quantas escolas agrupa —, e
ele vem de um `groupBy` FORA do filtro da consulta: com `tipo=regional` as filhas
não estão no resultado, e contá-las ali daria zero em toda linha.

**O botão Excluir abre SEMPRE o diálogo**, mesmo quando a exclusão é impossível.
Decidir na hora do clique e não fazer nada é indistinguível de botão quebrado: o
diálogo é onde a última regional da rede e a regional com escolas explicam o
impedimento (e, no segundo caso, oferecem a transferência). Os textos e os
códigos de conflito estão em `apps/api/AGENTS.md`.

## Papéis: seis, e o formulário sai da cadeia (ADR-80)

`lib/papeis.ts` é a cópia edge-safe do vocabulário da api, e agora carrega
também a **cadeia de atribuição** (`papeisQueCria`). Duas coisas a respeitar:

- **`rotuloDoPapel` é um `Record` EXAUSTIVO, não uma escada de `if`.** Papel novo
  sem rótulo passa a ser erro de compilação; com a escada, ele caía no `return`
  final e aparecia no cabeçalho como "Estudante".
- **A lista de papéis do formulário de novo usuário sai de `papeisQueCria`**, não
  de um array fixo com um `if` para o papel de rede. Com a lista à mão, o papel
  novo aparecia para quem não podia criá-lo e a pessoa preenchia a tela inteira
  para receber 403 no fim. **Quem decide continua sendo a api** — isto só evita
  oferecer o que ela recusa.
- Os quatro papéis de gestão dividem a MESMA área do middleware. Quem separa o
  que cada um pode é o `RolesGuard` da api, item a item — nunca o middleware.
- **"Coordenação", não "Gestor"**, na interface: é a palavra que a rede usa, e era
  a que já estava no filtro de Usuários enquanto o modal dizia "gestor" para a
  MESMA coisa.

## O modal de vínculo busca na REDE (ADR-80)

O campo "Onde a pessoa está hoje" **saiu**, e não por gosto: ele filtrava por
`users.escola_id`, que é o cache da lotação PRINCIPAL — quem trabalha em duas
escolas só era achado pela principal, e procurando pela outra a lista voltava
vazia. Agora é `GET /escolas/profissionais`, sem escola de origem.

- **Quatro estados de busca distintos**: inicial (orienta), buscando, vazia
  (só DEPOIS de uma busca concluída) e erro. A tela dizia "nenhum professor
  encontrado nesta escola" **antes** de qualquer busca — afirmação sobre uma
  consulta que nunca aconteceu.
- **O botão fica sempre visível**, e a seleção da tabela é SUGESTÃO de destino,
  editável. Antes ele só aparecia com linha marcada, e duplicava o botão da barra
  de seleção — dois botões idênticos lado a lado.
- **Destino já vinculado é marcado e sai da criação**; se todos estiverem, a tela
  diz que não há o que criar e o botão não habilita.
- **UM perfil no resumo, com a frase dizendo que vale em todas as escolas.**
  `users.role` é global e é ele que o `RolesGuard` lê; o papel da lotação é
  registro, não autorização. Um seletor de perfil por escola prometeria o que o
  guard não cumpre — é a mesma armadilha que a ADR-79 fechou em outro lugar.

## `/admin/relatorios` — o relatório da diretoria (ADR-82)

Duas tabelas: o consolidado por missão e a quebra por escola. Só
`gestor_regional` (a própria regional) e os perfis de contrato (com seletor).

- **O seletor de regional NÃO existe para o `gestor_regional`.** Ele lê a dele, e
  a api ignora o parâmetro. Se o seletor aparecer para ele, a tela passou a
  oferecer a diretoria do vizinho — a suíte e2e cobra a ausência.
- **As duas medidas ficam lado a lado, sempre.** "Turmas encerradas" é a AULA;
  "Estudantes com registro" é a CRIANÇA. Juntar numa coluna apaga os dois casos
  que interessam (aula fechada sem a sala entrar; sala no meio do caminho).
- **Nome de criança não entra**, e o CSV também não o leva: o relatório é
  contagem. Para ver uma criança, abre-se a escola dela.
- **O CSV é montado no CLIENTE**, com os números que a tela já tem. Uma rota de
  exportação seria a segunda fonte da mesma conta, e as duas divergiriam na
  primeira coluna nova. (O `﻿` no começo do arquivo é o que faz o Excel abrir
  acento certo.)

## O vocabulário das telas administrativas

Decidido no card de textos, e vale para texto de TELA (rótulo, título,
descrição, placeholder, mensagem) — não para nome de campo da api:

- **escola**, nunca "unidade". **regional**, nunca "diretoria" (nem alternando
  com ela). **vínculo/vincular**, nunca "lotação/lotar" — `lotacoes` segue sendo
  o nome da tabela, porque é o termo que a rede pública usa para o registro.
- **"Coordenação"** para `gestor_escola` na interface; o identificador continua
  `gestor_escola` (contrato replicado em quatro fontes).
- **"Código interno"** para o id de escola e de regional NOS FORMULÁRIOS. Na
  LISTAGEM ele aparece sem rótulo, e de propósito: é a chave que a secretaria
  usa nas planilhas de importação — a e2e registra isso como prova. Um
  "Código interno:" em cada linha dobraria a altura da célula.
- **Pessoa ≠ vínculo, e a tela diz qual é qual.** A coluna "Professores" conta
  pessoas naquela escola; o total do resumo conta vínculos na rede, e leva a
  frase "Um professor pode ter vínculo com mais de uma escola." Essa confusão já
  custou duas conversas.

O `unidades` da resposta de `GET /escolas` **não** foi renomeado: é campo de
contrato publicado (OpenAPI + apêndice C), e trocá-lo por pureza de vocabulário
é churn sem ganho para quem usa a tela. Fica registrado que ele diverge.

## Embed de experiência

A montagem (token, manifesto, dev server, origin) é uma só:
`lib/embed-experiencia.ts`, usada por `/exp/[expId]`, `/dev-embed`,
`/professor/plano-de-aula` e `/professor/bem-estar`. O contrato `postMessage` e
o manifesto estão em `apps/experiencias/AGENTS.md`.

**A origem do bundle é do AMBIENTE; o manifesto diz o que a experiência
declara.** Os dois estavam conflatados em `emDev = !manifesto && !emProducao` —
"tabela vazia logo é dev" — e isso quebrou quando o seed passou a popular
`experiencias` (ADR-69): sem `NEXT_PUBLIC_CDN_EXP_URL`, a URL versionada caía no
default `localhost:5173`, o dev server da exp-01, que responde a qualquer caminho
com a SPA dele. TODA missão abria o Instanooria, o handshake completava e o boot
dava 403 — nada dizia "endereço errado".

## A sala de aula no hub (ADR-69)

`/estudante` lê `GET /salas/minhas` (`lib/salas.ts`): a turma e a grade do ano
dela, com o estado de cada missão. `null` (api fora do ar) e `[]` (sem turma) são
telas DIFERENTES — mandar a criança falar com a coordenação por causa de um 503 é
o pior conselho possível.

`/professor/turmas/[id]` é a SALA, com abas em `?aba=` (`missoes` | `estudantes`)
e o `Tabs` do DS em modo controlado — a URL é o estado, como o `?turmaId=` dos
resultados. O botão de liberar é client-side porque o professor aperta na FRENTE
DA SALA, e passa pelo BFF: **`PUT` precisou ser exportado lá** (`app/api/plataforma/[...path]/route.ts`),
e método que falta no BFF não dá 404 e sim **405**, sem linha no log — o sintoma
chega como "o botão não faz nada".

O caminho para conduzir a missão sai da sala, com a turma já na URL
(`lib/rotas-da-missao.ts` traduz `expId` → rota do professor; é o único lugar que
faz essa tradução). A trilha do Entre Redes continua por ano e virou catálogo,
com faixa dizendo que quem abre é a turma.

`/exp/[expId]` confere a liberação ANTES de montar o embed e responde 404 sem
ela. Só para estudante: professor e gestor não chegam nesta rota, e `/dev-embed`
segue sem porta (é bancada de desenvolvimento). A api recusaria de qualquer
jeito, mas aí o aparelho carregaria e quebraria por dentro, com o token já
assinado.

## O interruptor da rede na porta do produto (ADR-87, 2026-09-10)

**A guarda de produto é do LAYOUT da área, nunca da página** — mesma doutrina da
trilha (ADR-77) e pelo mesmo motivo: o layout cobre a subárvore inteira, então
rota nova nasce coberta. `professor/entre-redes/layout.tsx` protege as missões, os
guias e os resultados de todas elas; `plano-de-aula`, `plano-de-ensino` e
`bem-estar` têm o próprio. Cada um é uma linha: `await exigirProdutoLigado(slug)`.

Verificado: com o Entre Redes desligado,
`/professor/entre-redes/8-ano/unidade-1/guia` responde 404 **sem nenhuma mudança
na página** — foi o layout.

- **Fragmento, não elemento.** Um `<div>` no layout mudaria o fluxo de altura que
  a página de dentro monta com margens negativas (`tela-cheia`).
- **404, e não uma tela de "produto desativado".** Para o professor daquela rede
  o produto não existe; uma tela explicando que existe mas foi desligado é a
  Unooria contando ao cliente o que ela vendeu a quem.
- **`lib/produtos.ts` deixou de ser a LISTA e é só a COPY.** A lista efetiva vem
  de `GET /recursos/efetivos` (`lib/recursos.ts`). É o mesmo movimento que
  `lib/missoes-do-estudante.ts` fez na ADR-69, e pelo mesmo motivo: constante
  compilada no bundle é igual para toda rede, e o que existe numa rede é DADO.
- **FALHA ABERTA quando a api não responde**, como `/exp/[expId]` já fazia com
  `minhasSalas()`: a porta de verdade é do servidor, então deixar passar aqui não
  abre nada — a api recusa na primeira chamada. Falhar FECHADA faria uma api
  pendurada esvaziar a home do professor, com a tela dizendo "você não tem
  produto" em vez de "não carregou".
- **`/exp/[expId]` ficou coberta de graça**: ela já consulta a grade
  (`minhasSalas`), e a grade passou a filtrar o indisponível na api. Não houve
  linha nova nessa rota.
- **Não conte produtos na copy.** O texto da home dizia "Quatro produtos"; com um
  deles desligado a frase mente sobre a própria tela.

## A área `/unooria` — o painel da fornecedora (ADR-88, 2026-09-10)

Área própria, papel `admin`, layout próprio (e portanto trilha própria).
`NavUnooria` + `lib/recursos.ts` + `app/(plataforma)/unooria/recursos/`.

**A armadilha do middleware, que passa no typecheck.** O redirect cross-área
comparava UMA string (`areaDoPathname` contra `areaDoPapel`). O `admin` tem
DUAS casas — o painel da Unooria e a área administrativa, que ele divide com os
gestores — então com uma string só ele era EXPULSO de uma delas, com o sintoma
"clico em Recursos e caio em Usuários" e nada no console. Hoje a checagem é de
MEMBRESIA (`areasDoPapel` / `podeEntrarNaArea`), e `lib/papeis.test.ts` cobra
que todo papel entra na própria casa e que ninguém além do `admin` entra em
`/unooria`.

**`homeDoPapel("admin")` é `/unooria/recursos`**: a casa da conta da Unooria é o
painel dela, não a área da escola.

### Trocar de escopo REMONTA o painel — e sem isso a tela MENTE

`PainelDeRecursos` guarda o painel em `useState(inicial)` para poder reler
sozinho depois de cada mudança. `useState` só usa o valor inicial na MONTAGEM:
trocar de escopo faz `router.push`, o servidor devolve o painel da escola nova,
e o componente não remontado continua exibindo o do escopo anterior.

**O custo não é cosmético.** O `escolaId` que as escritas usam sai do painel em
estado. Com o estado velho, escolher uma ESCOLA e desligar um produto gravava a
linha no **CONTRATO** — a rede inteira — com a tela afirmando que era a escola.
Foi medido: a suíte e2e do `admin` derrubou o produto para todas as escolas
enquanto o roteiro dizia operar numa só, e o print mostrou o painel inteiro com
os rótulos do escopo-contrato.

O conserto é o `key={escopo}` na página, e é a mesma doutrina do
`<EscopoDaEscola>` (ADR-85): **quando o escopo é insumo de tudo o que a tela
mostra, trocar de escopo remonta o miolo em vez de tentar sincronizar estado.**

E a suíte e2e não confia na URL: ela exige o RÓTULO do interruptor
("Herda de cima" só existe fora do contrato) antes de desligar qualquer coisa.

### Três estados, nunca dois

`ligado | desligado | herda`. Sem o terceiro, "ligado nesta escola" fica
idêntico a "herdado ligado" e desfazer uma exceção é impossível. O rótulo de
`herda` MUDA com o escopo — "Padrão (ligado)" no contrato, onde não existe
"de cima"; "Herda de cima" numa escola. Chamar as duas coisas de "Herda" faria o
operador do escopo-contrato procurar um nível que não existe.

O controle da experiência sob um produto desligado fica **desabilitado com o
motivo ao lado**, não escondido: mostrá-lo ativo prometeria uma mudança que o
resolvedor ignoraria, e escondê-lo pareceria defeito.

### A janela de versão: uma alavanca por escopo

`modal-de-versao.tsx`. No escopo-CONTRATO só existe **Ativar para a rede**
(troca a `versao_ativa` e restaura o manifesto daquela versão); fora dele, só
**Fixar neste escopo** / **Soltar a fixação**. As duas nunca aparecem juntas, e a
razão está na ADR-87: fixar no contrato trocaria a versão do bundle SEM
restaurar o manifesto, reabrindo o defeito do `allow-pointer-lock` que o
histórico existe para consertar.

**A janela FICA ABERTA depois de gravar**, e relê o próprio histórico. Os dois
por medida: quem ativa uma versão precisa ver o aviso de que a conferência no
CDN não foi possível (é ele que decide se o trabalho acabou), e sem reler o
histórico a faixa "está em rollback" continuava na tela DEPOIS de a ativação
resolver o rollback — a tela mentindo sobre o que ela mesma acabou de fazer.
Visto no navegador.

**A etiqueta da versão É o botão** da janela: um botão "Versão" separado
repetiria a informação que a etiqueta já dá.

### O `SideBar` do DS traz um item que não é seu

Ele renderiza sempre um primeiro item **"Iniciativas"**, fixo no componente, que
abre um painel de `appsItems`. Sem `appsItems` o clique não faz nada — e nenhuma
área deste hub passa `appsItems`. Vale para `/admin` desde sempre e agora para
`/unooria`. É lacuna do pacote (pedido no `storybook-unooria`), não coisa a
contornar aqui: item de menu que não leva a nada é pior que item nenhum.

## O guia da aula (ADR-65)

Toda missão publicada tem guia em `/professor/.../guia`, e **missão nova nasce
com o guia dela** — `lib/entre-redes/guias/index.test.ts` recusa missão
publicada sem guia, com uma lista de exceções que exige razão escrita.

**O guia é DADO** (`lib/entre-redes/guias/<exp>.ts`, tipo `GuiaDaAula`)
renderizado por um componente único (`components/guia/`). Não escreva um guia
como página: a versão antiga era 447 linhas de JSX só do Instanooria, e a quinta
cópia dela seria o arquivo em que alguém esquece uma seção sem ninguém notar. A
ordem das seções é do renderizador, não do autor — é isso que faz a segunda
missão que o professor roda ter a informação no mesmo lugar da primeira.

**O que tem fonte viva NÃO vira texto no guia.** Entra por bloco vivo: um
`ReactNode` que a página da missão ancora ao fim de uma seção
(`blocos={{ debate: <... /> }}`). **Toda missão publicada tem o seu**: os
momentos e a revelação do Instanooria, os cartões da Vila por turma, a tabela
dos vieses do unooGPT, os vídeos do UnooTube com o gabarito, as intervenções do
Rastro do Boato e as respostas do Eco no Grupo — as quatro últimas por rota
`professor-only` da api (`/<slug>/professor/...`). O custo de copiar qualquer um
deles é o professor projetar para a turma uma mensagem que ninguém recebeu.

**Missão nova cujo conteúdo a turma LÊ na tela nasce com bloco vivo, não com a
descrição dele.** A prosa diverge e ninguém percebe: a do UnooTube dizia
"metade… a outra metade" quando a divisão real do catálogo é 11 e 10, e nenhum
título de vídeo aparecia — o professor não tinha como reconhecer o vídeo que a
criança de 9 anos citava pelo apelido do canal. Número que o guia mostra é
CALCULADO do catálogo (`resumo`, `pontuacao`), nunca digitado.

**Os links para o guia saem de `lib/rotas-da-missao.ts`**, nunca de
`` `${rota}/guia` `` montado na tela: é ele que sabe se a missão tem guia, e a
sala de aula mostra o link em toda turma × toda missão a partir dele. Uma
concatenação na mão vira link para 404 na primeira missão publicada sem guia.

**A folha de impressão é parte do guia**, em `components/guia/guia.css` — o
professor conduz a aula com o papel na mão enquanto o computador projeta a tela
da turma. Ela mira classes próprias (`.guia-bloco`, `.guia-fora-do-papel`),
nunca as do `@unooria/design-system`: nome interno de componente muda por versão
e ninguém imprime para conferir depois de subir o DS. Bloco novo no guia entra
com `guia-bloco` (e `guia-bloco--longo` se puder quebrar entre folhas).

**BNCC Computação: o texto da habilidade é verbatim do MEC**, e os códigos são
**por ano** (`EF04CO08`, `EF08CO11`) mais `EF15CO*` (1º–5º), `EF69CO*` (6º–9º) e
`EM13CO*`. `EF67CO`/`EF89CO` **não existem** — a analogia com as outras áreas já
produziu códigos inventados uma vez, e um teste guarda a forma.

## As fontes do DS não vêm de graça

**No hub, o CSS do DS não basta: as fontes também.** O `unooria.css` declara
`Open Sans` e `Material Symbols Rounded` por `@import` de URL remota, e o **Next
remove `@import` externo** de CSS importado por JS — silenciosamente: a regra
continua lá, o `getComputedStyle` responde "Open Sans" e o navegador desenha com
a fonte do sistema. Como `Material Symbols Rounded` é fonte de ligadura, o
sintoma é o ÍCONE VIRANDO TEXTO ("addInvestigação"). Por isso
`components/casca-plataforma.tsx` também monta `FontesDaPlataforma`
(`@edu/ui/fontes`). Numa experiência Vite o `@import` sobrevive e isso não é
necessário.

**Frames: dois níveis, não empilhar.** `PhoneFrame` (instanooria, whatsappmobile,
tiktooria) e `DesktopFrame` (unitube) são cascas de aparelho DO CLONE, para
Storybook e telas soltas. Dentro da plataforma quem desenha o aparelho é o hub,
em `components/DispositivoFrame.tsx`, dirigido pelo `viewport` do manifesto — a

## Clarity: dois pontos de montagem, e nenhum é arbitrário

O Microsoft Clarity (ADR-60) entra em **dois** lugares no hub, por razões
diferentes — mover qualquer um deles quebra cobertura em silêncio.

| Componente | Onde monta | Por que ali |
|---|---|---|
| `components/clarity-hub.tsx` (o `<Script>`) | `app/layout.tsx` **raiz** | É o único layout que cobre a landing pública e o `/login`, que estão fora do grupo `(plataforma)`. Na casca, a landing ficaria sem gravação — e é onde a pessoa chega. |
| `components/clarity-identidade.tsx` (identify + tags) | `components/casca-plataforma.tsx` | É o único componente por onde `(plataforma)/**` e `/exp/**` passam os dois. No layout raiz não daria: lá não há sessão. Num layout por papel dariam quatro cópias. |

A casca virou `async` por causa disso (chama `await auth()`). Ela é usada por
dois layouts de servidor, então isso é transparente — mas é a razão de ela não
ser mais uma função síncrona.

**A identificação re-dispara a cada rota**, via `usePathname()`. Não é
redundância: o App Router navega sem recarregar a página, e a doc do Clarity
pede `identify` por PÁGINA. Sem isso, tudo depois do primeiro render cai numa
página só no painel.

**O snippet não é escrito aqui.** Ele vem de `@edu/sdk` (`snippetClarity`), que
é a mesma fonte que as experiências injetam dentro do iframe. Colar o script no
layout cria a segunda cópia.

**`NEXT_PUBLIC_CLARITY_PROJECT_ID` é a única `NEXT_PUBLIC_*` do hub que chega ao
bundle do CLIENT** — as outras duas são lidas só em código server-only, e por
isso são env de runtime. Esta é inlinada no `next build`, entra por `ARG` no
`Dockerfile`, e trocá-la exige rebuild. Ela é lida num lugar só,
`lib/clarity.ts`: a referência a `process.env` precisa ser estática para o Next
substituir o literal, e `process.env[nome]` calculado chegaria `undefined` sem
erro nenhum.


## Log, saúde e erro (2026-09-02)

**O log do servidor do hub é o pino de `lib/log.ts`**, em JSON com os nomes do
Cloud Logging (`severity`, `message`, `serviceContext`,
`logging.googleapis.com/trace`). Nada de `console.*` em código de servidor. É
uma **cópia deliberada** do logger da api (`apps/api/src/observabilidade/`),
sem o AsyncLocalStorage: o contexto entra por `logDaRequisicao(headers)`, que
lê `traceparent`/`X-Cloud-Trace-Context` e devolve um `child` com `requestId`.
Mudou a forma da linha? Muda nos dois (packages/AGENTS.md diz por que não é um
pacote).

- **`apiDoServidor` continua devolvendo `null`** em falha — as páginas dependem
  disso —, mas cada falha vira UMA linha `warn` (`codigo: api-recusou |
  api-indisponivel | api-timeout`) com rota, status e o `requestIdDaApi` que a
  api devolveu no corpo do 500. Antes, "a api caiu" e "não há dados" eram a
  mesma coisa. **Toda chamada tem teto**: `TIMEOUT_DA_API_MS` (10 s) no
  `apiDoServidor`, `TIMEOUT_DO_BFF_MS` (30 s) no BFF, que repassa CSV e
  planilha. Falha de rede vira `Response` sintética 599 (598 no timeout): quem
  chama trata status, não exceção.
- **O `traceparent` da requisição de origem segue para a api** nos dois
  caminhos (`apiDoServidor` e BFF): é o que põe o render do professor e o span
  da api no mesmo trace. Sem cabeçalho de origem (build, teste), nada é
  inventado.
- **O 404 da allowlist do BFF loga** (`codigo: bff-prefixo-recusado`, só o
  prefixo). É o sintoma de uma tela nova que esqueceu de pedir passagem — e
  parecia "a api não tem a rota".
- **`GET /api/healthz`** responde `{ok:true}` sem tocar em nada: é a sonda de
  vida do serviço e o que separa "hub caiu" de "api caiu" no alerta. Fora do
  `matcher` do middleware; `force-dynamic`.
- **`app/error.tsx` e `app/global-error.tsx`** mostram `components/tela-de-erro.tsx`
  (o `AlertBox` do DS) com o `digest` do erro como código do incidente. O
  registro do erro é do `onRequestError` em `instrumentation.ts`: uma linha
  `ERROR` com o MESMO `digest`, stack, rota e `routeType` — a ponte entre o
  relato e o Logs Explorer sem inventar id. A `TelaDeErro` importa o CSS do DS
  por conta própria porque o `error.tsx` da raiz renderiza fora da
  `CascaPlataforma`. Erro de render no CLIENTE não tem digest e não passa pelo
  servidor: o registro dele entra com a captura de erros de cliente (fase 2).
- **`server-only` nos testes**: o pacote real LANÇA fora de um RSC. O
  `vitest.config.ts` aponta o alias para `lib/stub-server-only.ts`; sem isso
  qualquer teste que toque `lib/log.ts` ou `lib/api-servidor.ts` morre na
  importação.
- Envs: `LOG_LEVEL` (o Terraform já manda: `debug`/`info`/`warn` por ambiente),
  `GCP_PROJECT_ID` (já vem), `LOG_FORMATO=json` para ver a linha como o Cloud
  Logging a verá. Em teste (`NODE_ENV=test`) é JSON sem transporte.

## OpenTelemetry no hub (2026-09-02)

O `register()` de `instrumentation.ts` liga o SDK (`lib/otel.node.ts`) só no
runtime Node e só com o gate de `lib/otel-config.ts` (`OBS_TRACE_RATIO > 0` E
`GCP_PROJECT_ID` ou `OBS_DEBUG=1`). **Não há `instrumentation-http` aqui, de
propósito**: o Next já emite os spans de servidor (`GET /api/healthz`,
`resolve page components`, `executing api route`) e já extrai o `traceparent`
de entrada assim que existe um `TracerProvider` global — medido: um
`traceparent` forjado na requisição vira o `traceId` de todos os spans do
render. Instalar o `http` duplicaria o span raiz. Só o `undici` entra, para o
`fetch` de saída levar o cabeçalho.

- `lib/otel-propagacao.ts#traceparentDeSaida`: `propagation.inject` do span
  ativo; sem SDK (dev, teste) a API do OTel é no-op e o fallback é o
  `traceparent` que a requisição de origem trouxe. `apiDoServidor` e o BFF
  usam isso — nunca montam o cabeçalho na mão.
- `next.config.mjs#serverExternalPackages`: o SDK, a instrumentação do
  `undici` e o exportador do Google (`@grpc/grpc-js`) ficam fora do bundle do
  servidor; empacotados, `require-in-the-middle` e o gRPC quebram. `pino` já
  está na lista padrão do Next.
- Em dev: `OBS_DEBUG=1 OBS_TRACE_RATIO=1 pnpm dev` imprime os spans no console.
- **Nunca setar `NEXT_OTEL_VERBOSE=1`** em produção: dobra os spans internos do
  Next e o custo, sem dizer nada que o trace normal não diga.


## Sinais do navegador que passam pelo hub (2026-09-02)

- **`config.obs` do `hub:init`**: `montarEmbed` põe `obs: { traceRatio }` (de
  `OBS_TRACE_RATIO_CLIENTE`, env de runtime) no `Embed`; o `ExpHost` recebe
  `obs` e o mete em `config`; as páginas do professor que renderizam `ExpFrame`
  direto (plano de aula, bem-estar) passam `config={{ expId, obs: embed.obs }}`.
  É assim que a amostragem do OpenTelemetry Web das experiências muda sem
  rebuild do hub nem republicar bundles. Sem `obs`, o `ExpHost` manda
  `{ traceRatio: 0 }` — desligado, nunca "sem valor".
- **`exp:erro`**: o `ExpFrame` repassa a `onErro`; o `ExpHost` cobre o aparelho
  com o `AlertBox` "A missão travou" (`data-testid="erro-da-experiencia"`) e o
  botão **Recarregar** remonta o iframe (`key`). A mensagem do erro não aparece;
  o `hash` aparece, para relatar. O registro já foi SDK → api.
- **`/api/ponte`**: `sendBeacon` do `ExpFrame` com o resultado do handshake
  (`ok` | `protocolo-incompativel`); vira UMA linha `INFO`
  `codigo=ponte.handshake`. A métrica "handshakes por resultado" é de LOG
  (Terraform), não contador em processo. Sem `auth()` de propósito: o dado é
  dois enums e um número, e `sendBeacon` não garante cookie.
- **Erros de cliente do hub**: `instrumentation-client.ts` instala a captura da
  SDK (`lib/erros-do-hub.ts`) com `expId: "hub"` e `versao =
  NEXT_PUBLIC_HUB_VERSAO` (o SHA do build, ARG do Dockerfile — a segunda e
  última `NEXT_PUBLIC_*` que chega ao bundle, junto com a do Clarity). Posta pelo
  BFF (`observabilidade` entrou na allowlist); sem sessão o BFF dá 401 e fica no
  console. `error.tsx`/`global-error.tsx` reportam pelo mesmo caminho.
- **Web Vitals do hub**: `components/vitals-hub.tsx` no layout raiz
  (`useReportWebVitals`), 10% por aba, `rota = pathname` (a api normaliza).
- **OpenTelemetry Web no hub**: `instrumentation-client.ts` chama o MESMO
  `iniciarTracesWeb` da SDK, com `apiUrl: "/api/plataforma"` (exporta pelo
  BFF, que assina o token) e o ratio lido do `<meta name="unooria-obs-ratio">`
  que o `generateMetadata` do layout raiz escreve a partir de
  `OBS_TRACE_RATIO_CLIENTE` — env de runtime, sem rebuild. Com ratio 0 nada é
  baixado (os pacotes são `import()` dinâmico), então a landing pública não paga
  o peso. Sem sessão o BFF dá 401 e o lote morre no exportador — aceito.

## Rolagem: sempre o `ScrollBar` do DS (2026-09-07)

**Nenhuma tela do hub declara `overflow` para rolar.** Área que rola é um
`<ScrollBar>` do `@edu/ui/ds` — as 24 tabelas (de `/admin`, `/analise` e
`/professor`), o sumário de `/privacidade` e `/termos`, e as 5 tabelas largas do
guia da aula. Dele vêm a barra, o `autoHide` e o fade; a mecânica e as
armadilhas estão em `packages/ui/AGENTS.md`.

Tabela nova nasce assim, e não com um `<div>` em volta:

```tsx
<ScrollBar orientation="both" autoHide className="tabela-rolavel">
  <Table … />        {/* ou a <table> crua */}
</ScrollBar>
```

`orientation="both"` não é enfeite: o default (`vertical`) traz
`overflow-x: hidden` e cortaria a coluna da direita das tabelas largas — que é a
maioria delas aqui. E a `tabela-rolavel` continua obrigatória, com o papel
reduzido: a altura que provoca a rolagem e o cabeçalho preso, que o DS ainda não
publica.

**No papel, o `ScrollBar` sai da frente.** `components/guia/guia.css` devolve
`overflow: visible` e `max-height: none` a ele em `@media print`: o guia é feito
para ser impresso e levado para a sala, e `overflow` recortaria a tabela na
largura da coluna.

## Altura de tela cheia: `.tela-cheia`, nunca subtração do header

A página do professor que embeda experiência e **não** rola
(`/professor/plano-de-aula`, `/plano-de-ensino`, `/bem-estar`) usa a classe
`.tela-cheia`. Ela substituiu `height: calc(100dvh - 64px)`, escrito à mão nas
três: o `HeaderPlataforma` mede **65px** (o `h-16` são 64 e a `border-b` põe 1),
então a página transbordava 1px e ganhava uma barra de rolagem vertical PARADA
na tela — visível o tempo todo, sem ter o que rolar. Agora a casca do professor
é coluna (`flex min-h-dvh flex-col`) com o `main` em `flex-1`, e a classe (em
`@edu/ui/styles/plataforma.css`) distribui o resto por flex.

Isto é o oposto do `ScrollBar`: lá o objetivo é rolar bem, aqui é **não existir
área rolável**. Uma barra que não rola nada não é detalhe estético — é a tela
dizendo que há conteúdo escondido quando não há.

Duas armadilhas medidas:

- **`h-full` no lugar do flex NÃO funciona.** A altura de um item que cresceu por
  `flex-grow` dentro de um contêiner de `min-height` não é *definite*: o
  percentual cai para `auto` e o `<iframe>` volta aos 150px de altura padrão dele.
  `display: grid` com `grid-template-rows: auto 1fr` tem o mesmo problema.
- **O `main` só vira contêiner flex via `:has(> .tela-cheia)`.** Sem isso, as
  outras 16 páginas do professor passariam a ter os filhos como itens de flex
  (margem que não colapsa mais, altura que muda) por causa de três telas.

`app/exp/layout.tsx` já fazia certo (`height: 100dvh` + `flex flex-col`) e não
precisou mudar — é a referência do arranjo.
