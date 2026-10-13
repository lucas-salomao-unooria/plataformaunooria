# apps/hub/components — a casca e as medidas

Complementa o `AGENTS.md` de `apps/hub`, que vence em conflito. **Componente
de UI novo não nasce aqui** — nasce no `storybook-unooria` e chega por versão.
O que mora nesta pasta é composição e compensação MARCADA.

## A marca ancora na JANELA, e o gutter é um só (ADR-83, 2026-09-08)

**O miolo do header é full-bleed: `px-6` e mais nada.** Sem `max-width`, sem
`mx-auto`, e **sem parâmetro `largura`** (`5xl` | `6xl` | `cheia`) que case o
header com o `max-width` do `<main>` de cada área: é exatamente esse acoplamento
o defeito, porque o miolo é centralizado e a coluna da área vira a posição da
marca.

Com o parâmetro, a marca ocupou **quatro** X diferentes conforme a área (medido
com Playwright, logado em cada papel): 208px de salto em 1440px de viewport,
**448px em 1920** — num header que é o mesmo em todas as telas, com a mesma
altura e os mesmos elementos. O dono do produto viu isso como "a marca desliza
para a direita em algumas páginas", que é a descrição exata do sintoma sem a
causa à vista.

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

**A superfície pública ficou de fora, por decisão.** A nav de `/landing-anterior`,
`/privacidade` e `/termos` (`.landing-nav__miolo`, em `components/landing/landing.css`)
mantém miolo de 1440px centralizado e `Logo size="md"` — em 1920px a marca dela
cai em 264px, contra os 24px do app. O site da raiz (`/`, `components/site/`)
tem a nav própria do porte e também não segue este gutter. São outras
superfícies, com outro público e outra linguagem; mexer nelas é decisão de
marketing, não de chrome. Quem for reabrir a da landing: a mudança é trocar o
`max-width` do `.landing-nav__miolo` por `none`.

## Celular e tablet: a coluna ao lado da `SideBar` leva `min-w-0` (ADR-159)

**Coluna de conteúdo que é item de `flex` leva `min-w-0`.** Em `/admin` e
`/unooria` a coluna mora ao lado da `SideBar`, e item de flex não encolhe abaixo
do conteúdo: a tabela larga empurrava a coluna para fora da janela (419px de
página num celular de 375, 812 num tablet de 768) e o `ScrollBar` dela nunca
rolava — rolava a página inteira, com a coluna da direita fora da tela. No
desktop não aparece. Área nova com barra lateral nasce com o `min-w-0`.

**A `SideBar` fica no celular** (44px, só ícones): o defeito nunca foi ela.
**`Tag` com frase quebra linha** por compensação em `plataforma.css` — a lacuna,
e quando ela morre, estão no comentário de lá.

**Medir de novo**: compare com a largura NOMINAL da tela. Emulando celular, o
Chrome afasta o zoom para caber o transbordo e `window.innerWidth` cresce junto —
uma página de 419px responde "419 de 419" e parece certa.

## As fontes do DS não vêm de graça

**No hub, o CSS do DS não basta: as fontes também.** `components/casca-plataforma.tsx`
(e `components/tela-de-erro.tsx`, que renderiza fora dela) importa
`@unooria/design-system/fonts/unooria.css`, as fontes AUTO-HOSPEDADAS do DS: só
`@font-face` com `url()` relativa, que o bundler resolve. É o que tira o
`@import` de URL remota do caminho — o **Next remove `@import` externo** de CSS
importado por JS, silenciosamente: a regra continua lá, o `getComputedStyle`
responde "Open Sans" e o navegador desenha com a fonte do sistema. Como
`Material Symbols Rounded` é fonte de ligadura, o sintoma de a família não
carregar é o ÍCONE VIRANDO TEXTO ("addInvestigação"). O import é obrigatório, não
decorativo, e toda tela que renderize fora da casca precisa dele por conta
própria.

**Frames: dois níveis, não empilhar.** `PhoneFrame` (instanooria, whatsappmobile,
tiktooria) e `DesktopFrame` (unootube) são cascas de aparelho DO CLONE, para
Storybook e telas soltas. Dentro da plataforma quem desenha o aparelho é o hub,
em `components/DispositivoFrame.tsx`, dirigido pelo `viewport` do manifesto — a
casca do clone por dentro dela desenharia dois aparelhos, um dentro do outro.

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
- **O `main` só vira contêiner flex via `:has(> .tela-cheia)`.** Sem isso, todas
  as outras páginas do professor passariam a ter os filhos como itens de flex
  (margem que não colapsa mais, altura que muda) por causa das telas de embed.

`app/exp/layout.tsx` já fazia certo (`height: 100dvh` + `flex flex-col`) e não
precisou mudar — é a referência do arranjo.

## `MetricCard` recebe NÚMERO ou rótulo curto — nunca frase (2026-09-15)

O cartão do DS é de KPI: `.unooria-metric-card__value` é `white-space: nowrap`
com `font-size: clamp(26px, 4vw, 36px)`, e o cartão tem `height: 128px` e
`max-width: 301px` — ~269px úteis. Valor que passa disso **vaza para fora do
cartão**, por cima do que está ao lado, e nada acusa: não é defeito de CSS, é o
componente usado para o que ele não é.

Quem descobriu foi o `Ao confirmar` do relatório individual do Instanooria, que
mostrava `estourou — a chuva chegou` derramado sobre a página. Os outros
`MetricCard` do hub são número ou `n/m`; aquele era o único com frase — e nem
era só o caso extremo: `sem cronômetro (modo livre)` e `faltavam 1:40` também
passavam da largura.

A saída não foi compensar no CSS, foi separar as duas leituras, as duas em
`lib/unoogpt-leitura.ts`: `envioNoCartao` (`1:40`, `esgotado`, `sem relógio`)
para o cartão e `envioEmTexto` (`tempo esgotado — a chuva chegou`) para o texto
corrido. **O porquê não cabe num KPI e não precisa
caber** — ele já está por extenso na linha do tempo logo abaixo, e a nota sob a
grade ensina a ler os três valores.

**Meça, não estime.** A largura útil é 267px com a fonte do DS; `tempo
esgotado` parecia caber e mede 291px. O recorte é por PIXEL, não por número de
caracteres — o jeito barato de medir é montar um `.unooria-metric-card` no DOM
de qualquer rota da plataforma (o CSS do DS é global no bundle do hub) e ler o
`getBoundingClientRect().width` do valor depois de `document.fonts.ready`.

## `Modal` montado com `ModalTitle`: o nome acessível

O `Modal` do DS liga sozinho o `ModalTitle` (`aria-labelledby`) e o
`ModalDescription` (`aria-describedby`) ao `role="dialog"` — nas seções
`chatgpt` e `unootube` também. É o que dá nome acessível às janelas montadas com
`ModalHeader` + `ModalTitle`, que é o jeito de quase todas as do hub; só o atalho
`title=` ligava o título no DS antigo, e sem a ligação o leitor de tela anuncia
"diálogo" sem dizer qual. `aria-labelledby`/`aria-label` explícitos continuam
vencendo: por isso as janelas de `equipes/`, que compensam com `useId` + `<Modal
aria-labelledby={id}>` + `<ModalTitle id={id}>`, seguem como estão. Janela nova
não precisa do par — o `ModalTitle` basta.

## Rolagem: sempre o `ScrollBar` do DS (2026-09-07)

**Nenhuma tela do hub declara `overflow` para rolar.** Área que rola é um
`<ScrollBar>` do `@edu/ui/ds` — as tabelas (de `/admin`, `/analise` e
`/professor`), o sumário de `/privacidade` e `/termos`, e as tabelas largas do
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
