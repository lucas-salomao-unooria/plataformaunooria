# packages/ui — a ponte para o `@unooria/design-system`

Complementa o `AGENTS.md` da raiz (a regra de ouro do DS está lá: todo elemento
de interface vem do pacote, sempre na última versão, e as famílias nunca se
cruzam). Aqui está a mecânica.

`@edu/ui` **não é onde componente novo nasce** — ele nasce no repo
`storybook-unooria` e chega por versão publicada. O que existe aqui são as
cinco pontes de re-export, uma por seção, e nada mais.

## Design System: consumo pela ponte

O pacote publica SEÇÕES independentes, cada uma com namespace de token e
prefixo de classe próprios. Nunca importar o `styles.css` consolidado: ele
arrasta as seis seções e a tipografia da plataforma para dentro de um clone.

| Ponte | Seção | CSS | Namespace | Onde vale |
|---|---|---|---|---|
| `@edu/ui/ds` | `unooria` | `/unooria.css` + `/fonts/unooria.css` | `--unooria-*`, `.unooria-theme-dark` | hub (login, `/professor`, `/admin`, `/analise`), header de todos os papéis, **telas pós-revelação do estudante** |
| `@edu/ui/ds-insta` | `instanooria` | `/instanooria.css` (sem fonte: SF Pro é do sistema) | `--insta-*` | superfície disfarçada da exp08ef1b |
| `@edu/ui/ds-unootube` | `unootube` | `/unootube.css` + `/fonts/unootube.css` | `--uni-*`, `[data-uni-theme]` | superfície disfarçada do UnooTube, ARQUIVADO (ADR-116): nenhuma missão viva a usa |
| `@edu/ui/ds-chatgpt` | `chatgpt` (25) | `/chatgpt.css` + `/fonts/chatgpt.css` | `--gpt-*`, `data-gpt-theme` | a exp02em1b INTEIRA: ela NÃO tem revelação no software, então nunca troca para a seção da plataforma |
| `@edu/ui/ds-whatsapp` | `whatsappmobile` (39) | `/whatsappmobile.css` + `/fonts/whatsappmobile.css` | `--wa-*`, `data-wa-theme` (**só `dark`**) | a casca móvel da exp07ef1b, o mensageiro da exp06ef2b e o grupo da turma da exp05ef1b, inclusive os erros diegéticos |

**A folha de fonte é uma linha SEPARADA e obrigatória** (0.1.17: as folhas de
componente não declaram mais `@font-face`). Nas marcas de clone, esquecê-la só
cai no fallback — feio. Na PLATAFORMA ela quebra: os ícones são fonte de
LIGADURA (Material Symbols Rounded), o `.unooria-icon` recebe o NOME do ícone
como texto, e sem a família a tela escreve "search" no lugar da lupa. As fontes
são auto-hospedadas (woff2 no pacote): não há mais nenhuma requisição a
`fonts.googleapis.com` em lugar nenhum, e por isso o `FontesDaPlataforma`
(`@edu/ui/fontes`), que existia só para injetar aquele `<link>`, foi removido.
Quem usa `next/font` NÃO escreve a linha — mas aí o Material Symbols precisa
vir por lá.

**Custo medido do Material Symbols (2026-08-27):** 5,36 MB num woff2 só. O
`@font-face` é preguiçoso, então o arquivo só desce se a família for aplicada —
medido com `document.fonts.check()` dentro do iframe: na backup-exp04ef1b ele fica
`unloaded` do feed até a virada do ranking (as telas da plataforma que ela usa
não têm ícone de ligadura), e o que desce ali são ~150 KB de Open Sans. Ou seja:
os 5,36 MB são peso morto no bucket, não download do estudante — e uma armadilha, já
que um ícone da plataforma acrescentado à backup-exp04ef1b amanhã puxaria tudo. Resolve de
vez migrando o `Icon` da plataforma para registro SVG (as outras cinco seções já
são assim).

**A linha que separa as seções é a REVELAÇÃO, não o arquivo.** O critério é
"quem está falando?", nunca "é depois no tempo?". Na backup-exp04ef1b: feed, cromo,
playlists, canal, o toast ("Vídeo salvo!") e o diálogo de limite ("sua playlist
tem três lugares") usam `ds-unootube` — todos falam de dentro da ficção. Ranking,
os dois diálogos da missão, o botão "Concluir missão" e a TELA DE ENTRADA usam
`ds`. A entrada é a única que fica ANTES do feed, e não é exceção: no briefing
quem fala é a escola, e não há disfarce a proteger porque a criança ainda não viu
um Short. O disfarce começa no toque em "Começar missão" (ADR-22).

**Tema:** a seção do clone lê `data-uni-theme` na raiz; a da plataforma recebe
`theme` por PROP. Quem troca escreve nos dois (`backup-exp04ef1b/src/lib/tema.ts`), senão
o estudante escolhe escuro no feed e o ranking volta branco. Na backup-exp04ef1b a escolha é
do estudante (Perfil → APARÊNCIA) e é lembrada em `localStorage` — que a regra 4
proíbe para TOKEN, não para preferência de tela.

**Componente que falta no pacote não nasce na experiência.** Vira compensação
local marcada no CSS (`(b) COMPENSAÇÃO`) e um pedido ao `storybook-unooria` — e
some quando o pacote publica. Os quatro pedidos abertos pela backup-exp04ef1b na 0.1.14
foram atendidos na 0.1.17 (`Modal`/`Snackbar`/`Table`/`EmptyState` em
`unootube`, `showSubscribe` no `ChannelHeader`, token semântico na capa do
canal, `@import` duplicado da Roboto), e as compensações correspondentes foram
apagadas. Sobraram DUAS na backup-exp04ef1b: o girador de carregamento (o
`ShortsPlayer` distingue "parado" de "tocando" mas não "ainda carregando") e a
etiqueta de estado do diálogo de limite (a seção não publica `Tag` nem `Badge` —
e por isso ela sai NEUTRA, não âmbar como o Figma pede: a seção não tem token de
aviso e derivar um seria inventar valor). Uma terceira ligação, não compensação:
o véu do `ShortsPlayer` tem altura FIXA de 194px, então numa miniatura de 88px
sem legenda ele cobre o quadro inteiro e o sintoma é retângulo preto com o vídeo
carregado por baixo.

**Migração de versão do DS: o que morde.** `VideoPlayer`, `VideoPlayerFull` e
`VideoCardHorizontal` mudaram o sentido de `src` na 0.1.13 — era o quadro
estático, agora é o VÍDEO, e o quadro virou `poster`. Passar imagem em `src`
monta um `<video>` que não carrega. Nenhum dos três é usado neste repo hoje.

**A exp07ef1b abriu quatro pedidos novos em `whatsappmobile`**, e três deles são
composição, não compensação: `ForwardedBadge` (o selo "Encaminhada com
frequência" — sai de `Icon name="forward"` + tokens), `PinnedMessageBanner` (a
barra do alfinete — o *tone* `pin` existe, o **glifo de alfinete não**, e ele é
desenhado local junto de `play`/`pause`) e `ReplyQuoteSelectionSheet` (o menu
das 3 respostas — `Radio` + card de citação). A compensação de verdade é uma só:
`ChatAudioBubbleWithTranscript`, porque `MessageBubble` aceita texto, `.Media` e
`.Document`, e a seção não tem player de áudio.

**A 0.2.4 publicou dez EXTENSÕES em `whatsappmobile`** (primeiro consumidor:
a exp05ef1b), todas exportadas pela ponte: `Button` (`filled | outline`),
`ForwardButton`, `BottomSheet`, `MediaViewer`, `ChatBanner`, `AdminOnlyNotice`,
`SystemMessage`, `Poll`, `MessageTag` e `Toast` — e o `MessageBubble` ganhou
`sender`, `forwardedLabel`, `.LinkPreview`, `.Invite` e `.Media` sem `src` (a
mídia DESENHADA, `children` + `alt`). Três das compensações acima já têm peça no
pacote — o selo "Encaminhada" (`forwardedLabel`), a faixa fixa (`ChatBanner`) e a
folha genérica (`BottomSheet`) —, mas a exp07ef1b e a exp06ef2b NÃO foram migradas
(outra frente). Duas lacunas medidas na exp05ef1b, com compensação marcada lá:
o `ForwardButton` só esmaece por `:disabled` (e `disabled` engole o toque) e o
`.Media` não publica `onClick`. O `Button` da ponte colide no NOME com o da
plataforma: numa tela que use as duas seções, o alias é obrigatório.

E **a seção publica só o tema escuro** (`WaTheme = 'dark'`; o CSS traz
`:root, [data-wa-theme=dark]` e nada mais). Derivar a paleta clara que os
wireframes descrevem é proibido, pela mesma regra do `unitube`. Duas armadilhas
medidas ali: o `ListItem` tem `white-space: nowrap` no título — errado para as
opções longas da exp07ef1b, que truncariam —, e o `PhoneFrame` da seção **não entra
na experiência**, porque quem desenha o aparelho é o hub, pelo `viewport` do
manifesto.

Sobrescrever classe do DS exige DOIS seletores (`.app-shell > .x`): o CSS do
pacote é injetado pelo módulo do componente, ou seja, DEPOIS do CSS da
experiência no grafo de importação — com peso igual, quem ganha é sempre o DS.

**A seção `unooria` tem TRÊS pedidos abertos, os três do hub, e as
compensações estão em `styles/plataforma.css` — menos a terceira, que não é CSS:**

- **`Table` sem cabeçalho fixo.** `TableProps` não publica `stickyHeader` nem
  `maxHeight`, e o `.unooria-table-container` só rola na horizontal. Numa turma
  de 40 estudantes o cabeçalho sai da tela junto com a página. Compensação:
  **`.tabela-rolavel`** — dá altura máxima ao contêiner (tela útil menos o
  cromo, piso de 20rem) e gruda o `<th>`. Serve às duas famílias de tabela do
  hub: a `<table>` crua (onde SUBSTITUI o `overflow-x-auto`, não convive com
  ele) e a do DS (`className="tabela-rolavel"` — o `Table` repassa `className`
  ao contêiner). O fundo do cabeçalho é herdado em cadeia e os seletores da
  cadeia vão em `:where()`: fixar branco apagaria o `bg-unooria-neutral-100` que
  algumas telas põem no `<thead>`. **A `<table>` é elo obrigatório dessa
  cadeia** — o pai do `<thead>` é ela, não o contêiner, e sem esse elo o
  `inherit` pega o transparente da tabela: o cabeçalho gruda mas fica VAZADO, e
  as linhas passam por baixo dele. Tabela de listagem NOVA no hub nasce com a
  classe; a exceção é o guia da aula, que é material de projeção e não rola.
  **Antes de aplicá-la a uma tabela larga, confira a soma das colunas**: a
  rolagem vertical torna VISÍVEL um transbordo horizontal que já existia e
  ninguém via (medido em `/admin/usuarios`: 9 colunas somando 1199px num
  contêiner de 1178). O conserto é dar `width` à coluna de ação — sem ela o
  algoritmo da tabela reparte a folga entre as colunas de texto e os botões
  quebram em duas linhas, engordando TODAS as linhas — e ceder os pixels que
  faltam numa coluna que já trunca.
- **`Button` sem variante de perigo discreta.** Compensação: **`.acao-destrutiva`**
  sobre `variant="outline"`.
- **`HeaderMenu` cobre o que está à esquerda do gatilho, em vez de empurrar**
  (2026-09-07, com a 0.1.19). A tira é um overlay ancorado à esquerda do avatar,
  e o componente assume que ali há espaço vazio — verdade num header que só tem
  o avatar à direita, falsa no nosso, onde ali ficam o nome e a linha de apoio.
  Integrado ingenuamente, o item "Sair" abre DESENHADO EM CIMA das letras.
  Compensação: NÃO é CSS — é `apps/hub/components/menu-da-conta.tsx`, que junta
  identidade e menu na mesma peça e esconde o bloco (`invisible`, não
  desmontado, senão o gatilho escorrega embaixo do cursor) enquanto a tira está
  aberta. Morre no dia em que o `HeaderMenu` publicar reflow ou âncora à direita.
  Não tem entrada em `plataforma.css` de propósito: a compensação é
  comportamento de página, e escondê-la numa classe faria o próximo a integrar
  o componente achar que era decoração.

**E dois pedidos que nasceram junto e não têm compensação nenhuma**, porque
compensar sairia pior que esperar:

- **`Selection` não aceita rótulo acessível sem rótulo visível.** O `...rest`
  dele aterra no `<div>` de fora, e o `aria-labelledby` do `combobox` só existe
  se você passar `label` — que renderiza uma linha acima do controle. Num header
  de 64px isso não cabe. É o que impede o `<select>` cru de
  `components/seletor-de-escola.tsx` de migrar: trocar um controle com
  `aria-label` por um sem nome acessível é regressão, não modernização. O resto
  da API casa 1:1 (`options`, `value`, `onChange`, `size="sm"` = 40px, `error`),
  então a migração é de minutos no dia em que o `ariaLabel` existir — o
  `Breadcrumb` e o `Avatar` já publicam essa prop, é inconsistência do pacote.
- **`Breadcrumb`: `isCurrent` + `as` se contradizem.** Com `as`, o DS renderiza o
  componente polimórfico mesmo no item marcado `isCurrent`, e a página vira link
  para si mesma. `apps/hub/components/trilha.tsx` compensa omitindo `href`/`as`
  no último item, com o comentário no lugar. É bug do pacote, não escolha nossa.

E uma classe que NÃO é compensação de componente, e mora aqui porque
`plataforma.css` é a folha por onde toda a casca da plataforma passa:
**`.tela-cheia`**, para a página do professor que embeda experiência e não rola.
Ela existe para acabar com a subtração da altura do header
(`calc(100dvh - 64px)`, que errava por 1px — o header mede 65 com a borda — e
punha uma barra de rolagem PARADA na tela). Duas coisas medidas ao escrevê-la:
`height: 100%` no lugar do flex não resolve (a altura de um item que cresceu por
`flex-grow` num contêiner de `min-height` não é *definite*, o percentual cai para
`auto` e o `<iframe>` volta aos 150px padrão dele), e o `main` só vira contêiner
flex por `:has(> .tela-cheia)` — sem esse recorte, as outras 16 páginas do
professor mudariam de contexto de layout por causa de três telas.

### Rolagem: `ScrollBar` do DS, e o que sobrou para a compensação

**Toda área rolável do hub é um `<ScrollBar>` do DS** — as 24 tabelas, o sumário
das páginas legais e as 5 tabelas largas do guia. Dele vêm o `overflow`, a barra,
o `autoHide` e o fade. Não escreva `overflow-y: auto` numa tela do hub: se a
área rola, ela tem um `ScrollBar` em volta.

As props que este repo usa: `orientation="both"` nas tabelas (elas são largas —
`orientation="vertical"`, que é o default, traz `overflow-x: hidden` e cortaria
a coluna da direita), `orientation="horizontal"` nas tabelas do guia, e
`autoHide` em todas.

**`.tabela-rolavel` encolheu, e o nome ficou.** Ela já foi a rolagem inteira;
hoje traz só o que o DS não publica — a `max-height` que provoca a rolagem e o
`<th>` preso. **Não devolva `overflow` a ela**: seriam dois contêineres de
rolagem, um dentro do outro.

**A armadilha do cabeçalho preso dentro do `ScrollBar`:** a `Table` do DS traz o
próprio `.unooria-table-container` com `overflow-x: auto`, e é NELE que o `<th>`
sticky se prende — um contêiner que não rola na vertical, então o cabeçalho
deixa de grudar. Por isso `.tabela-rolavel .unooria-table-container { overflow:
visible }`: devolve o papel de contêiner ao `ScrollBar`, que cuida dos dois
eixos. Medido: sem essa regra o `<th>` sobe junto com as linhas.

**`autoHide` do DS é HOVER, não rolagem.** O `ScrollBar.types.ts` documenta
"hover ou rolagem", mas o CSS só tem regras `:hover` — a barra aparece ao passar
o mouse por cima e continua invisível quando a rolagem vem da roda ou do teclado.
É a diferença conhecida entre o que o pacote promete e o que entrega, e está
como pedido no `storybook-unooria`. Quando ele publicar o gatilho por rolagem,
nada muda aqui: a prop já está no lugar.

**Variante que não existe não é erro de compilação — é botão sem cor.** O
`Button` monta a classe por interpolação (`unooria-button--variant-${variant}`),
então `variant="tertiary"` vira uma classe que folha nenhuma define e o botão
perde fundo, cor e borda. O typecheck não pega. `ButtonVariant` é
`primary | secondary | outline | ghost | danger` — e só.
