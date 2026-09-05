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
| `@edu/ui/ds-insta` | `instanooria` | `/instanooria.css` (sem fonte: SF Pro é do sistema) | `--insta-*` | superfície disfarçada da exp-01 |
| `@edu/ui/ds-unootube` | `unootube` | `/unootube.css` + `/fonts/unootube.css` | `--uni-*`, `[data-uni-theme]` | superfície disfarçada da exp-02 |
| `@edu/ui/ds-chatgpt` | `chatgpt` (25) | `/chatgpt.css` + `/fonts/chatgpt.css` | `--gpt-*`, `data-gpt-theme` | a exp-03 INTEIRA: ela NÃO tem revelação no software, então nunca troca para a seção da plataforma |
| `@edu/ui/ds-whatsapp` | `whatsappmobile` (29) | `/whatsappmobile.css` + `/fonts/whatsappmobile.css` | `--wa-*`, `data-wa-theme` (**só `dark`**) | a casca móvel da exp-07, da tela de bloqueio à validação de Amara, inclusive os erros diegéticos |

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
medido com `document.fonts.check()` dentro do iframe: na exp-02 ele fica
`unloaded` do feed até a virada do ranking (as telas da plataforma que ela usa
não têm ícone de ligadura), e o que desce ali são ~150 KB de Open Sans. Ou seja:
os 5,36 MB são peso morto no bucket, não download do estudante — e uma armadilha, já
que um ícone da plataforma acrescentado à exp-02 amanhã puxaria tudo. Resolve de
vez migrando o `Icon` da plataforma para registro SVG (as outras cinco seções já
são assim).

**A linha que separa as seções é a REVELAÇÃO, não o arquivo.** O critério é
"quem está falando?", nunca "é depois no tempo?". Na exp-02: feed, cromo,
playlists, canal, o toast ("Vídeo salvo!") e o diálogo de limite ("sua playlist
tem três lugares") usam `ds-unootube` — todos falam de dentro da ficção. Ranking,
os dois diálogos da missão, o botão "Concluir missão" e a TELA DE ENTRADA usam
`ds`. A entrada é a única que fica ANTES do feed, e não é exceção: no briefing
quem fala é a escola, e não há disfarce a proteger porque a criança ainda não viu
um Short. O disfarce começa no toque em "Começar missão" (ADR-22).

**Tema:** a seção do clone lê `data-uni-theme` na raiz; a da plataforma recebe
`theme` por PROP. Quem troca escreve nos dois (`exp-02/src/lib/tema.ts`), senão
o estudante escolhe escuro no feed e o ranking volta branco. Na exp-02 a escolha é
do estudante (Perfil → APARÊNCIA) e é lembrada em `localStorage` — que a regra 4
proíbe para TOKEN, não para preferência de tela.

**Componente que falta no pacote não nasce na experiência.** Vira compensação
local marcada no CSS (`(b) COMPENSAÇÃO`) e um pedido ao `storybook-unooria` — e
some quando o pacote publica. Os quatro pedidos abertos pela exp-02 na 0.1.14
foram atendidos na 0.1.17 (`Modal`/`Snackbar`/`Table`/`EmptyState` em
`unootube`, `showSubscribe` no `ChannelHeader`, token semântico na capa do
canal, `@import` duplicado da Roboto), e as compensações correspondentes foram
apagadas. Sobraram DUAS na exp-02: o girador de carregamento (o
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

**A exp-07 abriu quatro pedidos novos em `whatsappmobile`**, e três deles são
composição, não compensação: `ForwardedBadge` (o selo "Encaminhada com
frequência" — sai de `Icon name="forward"` + tokens), `PinnedMessageBanner` (a
barra do alfinete — o *tone* `pin` existe, o **glifo de alfinete não**, e ele é
desenhado local junto de `play`/`pause`) e `ReplyQuoteSelectionSheet` (o menu
das 3 respostas — `Radio` + card de citação). A compensação de verdade é uma só:
`ChatAudioBubbleWithTranscript`, porque `MessageBubble` aceita texto, `.Media` e
`.Document`, e a seção não tem player de áudio.

E **a seção publica só o tema escuro** (`WaTheme = 'dark'`; o CSS traz
`:root, [data-wa-theme=dark]` e nada mais). Derivar a paleta clara que os
wireframes descrevem é proibido, pela mesma regra do `unitube`. Duas armadilhas
medidas ali: o `ListItem` tem `white-space: nowrap` no título — errado para as
opções longas da exp-07, que truncariam —, e o `PhoneFrame` da seção **não entra
na experiência**, porque quem desenha o aparelho é o hub, pelo `viewport` do
manifesto.

Sobrescrever classe do DS exige DOIS seletores (`.app-shell > .x`): o CSS do
pacote é injetado pelo módulo do componente, ou seja, DEPOIS do CSS da
experiência no grafo de importação — com peso igual, quem ganha é sempre o DS.
