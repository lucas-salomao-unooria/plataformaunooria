# apps/experiencias/exp06ef1b/src/app — a interface do Júri

Complementa o `AGENTS.md` da experiência (`../../AGENTS.md`), que vence em
conflito: a tabela passo → tela → componente, a fronteira do disfarce e o ciclo
do voto estão lá. Aqui fica o que só importa a quem ESCREVE a tela: o que o DS
não cobre (e a compensação marcada que existe para morrer) e as props do DS que
passam no typecheck e enganam.

## As compensações

1. **Resolvida em 2026-10-02:** a `DmPoll` no lugar do `StoryPoll`. O DS 0.2.12
   publicou o `StoryPoll` (pedido por esta missão), a ponte `ds-unoovista` o
   exporta, e a casca `figurinha-de-enquete.tsx` e a regra CSS saíram.
2. **`ListItem` que quebra linha** (`.escolha`, `.infografico__passos`): o
   `ListItem` corta título e subtítulo numa linha, certo para conversas e errado
   para um cartão de 20 palavras. Só `white-space` e alinhamento. Pedido: prop
   `wrap` no `ListItem`.
3. **A camada da dica do gesto** (`.gesto-do-carrossel`): o `GestureHint` se
   posiciona contra o pai, e a mídia com `src` não aceita filho; a camada vem
   ANTES da mídia (depois dela quebraria o `media + actions` que põe a pílula
   sobre a imagem). Posição pura. Pedido: `hint` (ou `children` com `src`) no
   `PostCard.Media`.
4. **O botão preso na base da folha** (`.cedula__confirmar`): `position: sticky`
   dentro do corpo que rola do `BottomSheetUnv`. Posição pura.
5. **As setas do carrossel** (`.setas-do-carrossel`, 0.2.0, o pedido do PO: o
   carrossel não andava com MOUSE). O `PostCard.Media` da 0.2.18 não tem prop
   de navegação; as setas são `ButtonUnv` `primary` `sm` com o `IconUnv` `back`
   (espelhado com `flipX` para a próxima), numa camada posicionada como a da
   dica — daqui sai só ONDE elas ficam. Pedido: `onPrevious`/`onNext` (ou
   setas próprias) no `PostCard.Media`, e um glifo `forward` no registro.

**Não são compensação**: o carimbo do lacre (moldura tracejada de ficção — o
desenho do selo é o `IconUnv`), a arte procedural dos estandes (conteúdo, não
controle) e o deslize do carrossel (o DS publica os pontos, o gesto é do
produto; `touch-action: pan-y` deixa a rolagem com o navegador).

**O arrasto com MOUSE (0.2.0)**: o `<img>` do `PostCard.Media` é arrastável, e
o `dragstart` nativo da imagem cancelava o gesto com `pointercancel` — no
computador da escola a lâmina nunca trocava. Hoje o `dragstart` é cancelado, o
ponteiro é CAPTURADO no `pointerdown` e a leitura do gesto é pura
(`regras.ts#lerGesto`, com teste). A e2e arrasta com `page.mouse`, não com
teclado: o teclado já funcionava e escondia o defeito.

## Props do DS que enganam (0.2.11)

- `ListItem` não aceita `type`/`disabled` (são do `<button>`): ele já põe
  `type="button"`, e o desabilitado aqui é `aria-disabled` + guarda no toque.
- `TopBar` reserva os 44 px da status bar por padrão: vai com
  `withStatusBarInset={false}` (o aparelho do hub não desenha status bar).
- `StoryViewer` e `MediaGrid` exigem `src`: a arte vai em `data:` URI, com a cor
  lida dos tokens `--unv-*` (`componentes/midia.tsx#lerPaleta`, que lê o tema
  escuro num elemento de prova). Texto dentro do SVG não pega a fonte do app (um
  `<img>` não carrega a webfont) — por isso o título da consulta está no `footer`.
- `BottomSheetUnv`, `FloatingButton` e `SnackbarUnv` se posicionam contra o
  contêiner posicionado mais próximo: `.tela` é `position: relative`.
- O `PuzzleBlock` desenha o glifo por ligadura do Material Symbols: a folha
  `fonts/unooria.css` é obrigatória (sem ela, "mail" aparece escrito).
