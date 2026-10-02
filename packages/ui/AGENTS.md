# packages/ui — a ponte para o `@unooria/design-system`

Complementa o `AGENTS.md` da raiz (a regra de ouro do DS está lá: todo elemento
de interface vem do pacote, sempre na última versão, e as famílias nunca se
cruzam). Aqui está a mecânica.

`@edu/ui` **não é onde componente novo nasce** — ele nasce no repo
`storybook-unooria` e chega por versão publicada. O que existe aqui são as
oito pontes de re-export, uma por seção, e nada mais.

## Design System: consumo pela ponte

O pacote publica SEÇÕES independentes, cada uma com namespace de token e
prefixo de classe próprios. Nunca importar o `styles.css` consolidado: ele
arrasta as seis seções e a tipografia da plataforma para dentro de um clone.

| Ponte | Seção | CSS | Namespace | Onde vale |
|---|---|---|---|---|
| `@edu/ui/ds` | `unooria` | `/unooria.css` + `/fonts/unooria.css` | `--unooria-*`, `.unooria-theme-dark` | hub (login, `/professor`, `/admin`, `/analise`), header de todos os papéis, **telas pós-revelação do estudante**; o `AudioPlayer` da 0.2.7 é o do podcast da exp07ef1b; as peças `Chat*`, `AgentAvatar`, `RichContent` e `TypingIndicator` da 0.2.10 são o agente de IA do professor |
| `@edu/ui/ds-unoovista` | `unoovista` | `/unoovista.css` + `/fonts/unoovista.css` (**obrigatória**: o `Icon` é ligadura) | `--unv-*`, `data-unv-theme` | superfícies disfarçadas da exp08ef1b (ADR-133) e da exp07ef1b (ADR-135), o `PostCard` da gaveta do Jornal (exp04ef1b, ADR-136) e o Júri Estadual (exp06ef1b, ADR-137). Os nomes que colidem com a plataforma saem com o sufixo `Unv` (`ButtonUnv`, `AvatarUnv`, `IconUnv`, `BottomSheetUnv`, `SnackbarUnv`, `TextFieldUnv`, `LogoUnv`, `BadgeUnv`). A seção traz os mesmos 31 componentes do `instanooria`; a A Seleção trouxe para a ponte `DirectThread`, `MessageBubble`, `DmPoll`, `ConfirmDialog`, `FloatingButton`, `InlineHint`, `GestureHint` e `SegmentedTabs`; o Júri trouxe o `StoryPoll` (0.2.12, a enquete sobre a mídia da história, sem par no `instanooria`); os que ainda faltam entram quando tiverem consumidor |
| `@edu/ui/ds-insta` | `instanooria` | `/instanooria.css` (sem fonte: SF Pro é do sistema) | `--insta-*` | o clone da exp01ef1b (a exp08ef1b saiu dela na ADR-133, a exp07ef1b na ADR-135, o post do Jornal na ADR-136); reexporta também as sete extensões da 0.2.5 (`DirectThread`, `MessageBubble`, `DmPoll`, `ConfirmDialog`, `BottomSheet`, `FloatingButton`, `StoryComposer`) e as três da 0.2.7 (`InlineHint`, `GestureHint` e o `Snackbar` do clone, como `SnackbarInsta` porque colide com o da plataforma) |
| `@edu/ui/ds-unootube` | `unootube` | `/unootube.css` + `/fonts/unootube.css` | `--uni-*`, `[data-uni-theme]` | superfície disfarçada do UnooTube, ARQUIVADO (ADR-116): nenhuma missão viva a usa |
| `@edu/ui/ds-chatgpt` | `chatgpt` | `/chatgpt.css` + `/fonts/chatgpt.css` | `--gpt-*`, `data-gpt-theme` | a conversa da exp08ef4b. A exp02em1b saiu dela na 1.3.0 (ADR-138) |
| `@edu/ui/ds-unooriaai` | `unooriaai` | `/unooriaai.css` + `/fonts/unooriaai.css` (**obrigatória**: o `Icon` é ligadura) | `--uai-*`, `data-uai-theme` (`light` \| `dark`, `:root` = claro) | a exp02em1b INTEIRA (ADR-138): ela NÃO tem revelação no software, então nunca troca para a seção da plataforma. Cópia estrutural da `chatgpt` com a identidade da Unooria; o `GPTCard` virou `AssistantCard`, não há `gptGlyphs` e **não há cor primitiva** (só semântica) |
| `@edu/ui/ds-whatsapp` | `whatsappmobile` | `/whatsappmobile.css` + `/fonts/whatsappmobile.css` | `--wa-*`, `data-wa-theme` (**só `dark`**) | o mensageiro da exp06ef2b, inclusive os erros diegéticos (o `MessageBubble` do Jornal saiu dela na ADR-136) |
| `@edu/ui/ds-unoochat` | `unoochat` | `/unoochat.css` + `/fonts/unoochat.css` (**obrigatória**: `Icon` é ligadura) | `--unc-*`, `data-unc-theme` (`light` \| `dark`, `:root` = claro) | o grupo da turma da exp05ef1b, em tema claro (ADR-134), e o `MessageBubble` da gaveta do Jornal, também claro (exp04ef1b, ADR-136) — cópia estrutural do `whatsappmobile` com a identidade da Unooria |

**As peças do agente de IA do professor (0.2.10) são da seção `unooria`, e não
do `chatgpt` nem do `unooriaai`**: aqueles são CLONES (o `unooriaai` também, apesar do nome: é o assistente disfarçado da exp02em1b), e o agente é a Unooria
falando com o professor — misturar seria a plataforma dentro do clone ao
contrário. Elas deixam três coisas para o produto, de propósito, e nenhuma dá
erro se for esquecida: o FOCO (o `ChatPanel` não é modal e não move o foco), a
DATA do `ChatHistory` (chega formatada) e o MARKDOWN (o `RichContent` só dá
tipografia). A montagem está em `apps/hub/components/agente-professor/`. O
`RichContentTable` é o `table` do react-markdown: ele descarta o `node` que o
react-markdown repassa, então não precisa de invólucro.

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
medido com `document.fonts.check()` dentro do iframe da backup-exp04ef1b, onde
ele ficou `unloaded` do feed até a virada do ranking (desciam só ~150 KB de Open
Sans). Ou seja: nessa experiência os 5,36 MB eram peso morto no bucket, não
download do estudante — e uma armadilha, já que um ícone da plataforma
acrescentado ali amanhã puxaria tudo. Resolve de vez migrando o `Icon` da
plataforma para registro SVG (as outras cinco seções já são assim).

**O inverso tem UMA exceção (ADR-117):** numa tela da Unooria que mostra
conteúdo de outra plataforma — a gaveta do Jornal da Escola —, a PEÇA imitada
(o post, a mensagem) usa a seção dela. A regra está em
`docs/regras/design-system.md`.

**A linha que separa as seções é a REVELAÇÃO, não o arquivo.** O critério é
"quem está falando?", nunca "é depois no tempo?". No UnooTube (backup-exp04ef1b,
arquivado): feed, cromo, playlists, canal, o toast e o diálogo de limite falam de
dentro da ficção e usavam `ds-unootube`; ranking, os dois diálogos da missão, o
botão "Concluir missão" e a TELA DE ENTRADA usavam `ds`. A entrada é a única que
fica ANTES do feed, e não é exceção: no briefing quem fala é a escola, e não há
disfarce a proteger porque a criança ainda não viu um Short. O disfarce começa no
toque em "Começar missão" (ADR-22).

**Tema:** cada seção de clone lê o atributo de tema dela na raiz (coluna
Namespace); a da plataforma recebe `theme` por PROP. Quem troca escreve nos dois
(`backup-exp04ef1b/src/lib/tema.ts`), senão o estudante escolhe escuro no clone e
a tela da plataforma volta branca. Lembrar a escolha em `localStorage` vale: a
regra 4 o proíbe para TOKEN, não para preferência de tela.

**Componente que falta no pacote não nasce na experiência.** Vira compensação
local marcada no CSS (`(b) COMPENSAÇÃO`) e um pedido ao `storybook-unooria` — e
some quando o pacote publica. Os quatro pedidos da backup-exp04ef1b na 0.1.14
foram atendidos na 0.1.17 e as compensações correspondentes foram apagadas;
sobraram duas lá: o girador de carregamento do `ShortsPlayer` e a etiqueta de
estado do diálogo de limite, que sai NEUTRA e não âmbar porque a seção não tem
token de aviso e derivar um seria inventar valor. Uma ligação, não compensação: o
véu do `ShortsPlayer` tem altura FIXA de 194px, então numa miniatura de 88px sem
legenda ele cobre o quadro inteiro (retângulo preto com o vídeo carregado por
baixo).

**Migração de versão do DS: o que morde.** `VideoPlayer`, `VideoPlayerFull` e
`VideoCardHorizontal` mudaram o sentido de `src` na 0.1.13 — era o quadro
estático, agora é o VÍDEO, e o quadro virou `poster`. Passar imagem em `src`
monta um `<video>` que não carrega. Nenhum dos três é usado neste repo hoje.

**O Eco no Grupo (retirado, ADR-113) abriu quatro pedidos em `whatsappmobile`**, e três deles são
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
folha genérica (`BottomSheet`) —, mas a exp06ef2b NÃO foi migrada
(outra frente). Duas lacunas medidas na exp05ef1b, com compensação marcada lá:
o `ForwardButton` só esmaece por `:disabled` (e `disabled` engole o toque) e o
`.Media` não publica `onClick`. O `Button` da ponte colide no NOME com o da
plataforma: numa tela que use as duas seções, o alias é obrigatório.

E **a seção publica só o tema escuro** (`WaTheme = 'dark'`; o CSS traz
`:root, [data-wa-theme=dark]` e nada mais). Derivar a paleta clara que os
wireframes descrevem é proibido, pela mesma regra do `unootube`. Duas armadilhas
medidas ali: o `ListItem` tem `white-space: nowrap` no título — errado para as
opções longas do Eco, que truncariam —, e o `PhoneFrame` da seção **não entra
na experiência**, porque quem desenha o aparelho é o hub, pelo `viewport` do
manifesto.

Sobrescrever classe do DS exige DOIS seletores (`.app-shell > .x`): o CSS do
pacote é injetado pelo módulo do componente, ou seja, DEPOIS do CSS da
experiência no grafo de importação — com peso igual, quem ganha é sempre o DS.

## Compensações da seção `unooria` (o hub): `styles/AGENTS.md`

As compensações da plataforma e as regras que as cercam moram em
`packages/ui/styles/AGENTS.md`, que carrega sozinho quando você mexe em
`plataforma.css`. Mas a regra vale ao escrever TELA do hub, então abra-o antes de
usar `Table` (`.tabela-rolavel`, soma das colunas), `Button` (`.acao-destrutiva`;
variante inventada não dá erro de compilação), `ScrollBar` (toda área rolável do
hub é um; `autoHide` é hover) ou uma página que embeda experiência e não rola
(`.tela-cheia`), e antes de integrar `HeaderMenu`, `Selection` ou `Breadcrumb`
(pedidos abertos ao `storybook-unooria`).
