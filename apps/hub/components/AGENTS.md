# apps/hub/components — a casca e as medidas

Complementa o `AGENTS.md` de `apps/hub`, que vence em conflito. **Componente
de UI novo não nasce aqui** — nasce no `storybook-unooria` e chega por versão.
O que mora nesta pasta é composição e compensação MARCADA.

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

## `MetricCard` recebe NÚMERO ou rótulo curto — nunca frase (2026-09-15)

O cartão do DS é de KPI: `.unooria-metric-card__value` é `white-space: nowrap`
com `font-size: clamp(26px, 4vw, 36px)`, e o cartão tem `height: 128px` e
`max-width: 301px` — ~269px úteis. Valor que passa disso **vaza para fora do
cartão**, por cima do que está ao lado, e nada acusa: não é defeito de CSS, é o
componente usado para o que ele não é.

Quem descobriu foi o `Ao confirmar` do relatório individual do Instanooria, que
mostrava `estourou — a chuva chegou` derramado sobre a página. Os outros 40
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

## `Modal` montado com `ModalTitle`: o nome acessível (2026-09-25)

Lacuna do DS até a 0.2.2; corrigido na 0.2.3. O `Modal` só ligava o título ao
`role="dialog"` quando o título vinha pelo atalho `title=`. Montado com
`ModalHeader` + `ModalTitle` — o jeito de quase todas as janelas do hub —, o
`ModalTitle` ganhava um id e o diálogo NÃO apontava para ele: ~34 janelas do hub
ficavam sem nome acessível, e o leitor de tela anunciava "diálogo" sem dizer
qual. Desde a 0.2.3 o `Modal` liga sozinho o `ModalTitle` (`aria-labelledby`) e
o `ModalDescription` (`aria-describedby`) — nas seções `chatgpt` e `unootube`
também. `aria-labelledby`/`aria-label` explícitos continuam vencendo: por isso
as janelas de `equipes/`, que compensavam com `useId` + `<Modal
aria-labelledby={id}>` + `<ModalTitle id={id}>`, ficaram como estavam. Janela
nova não precisa do par — o `ModalTitle` basta.

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
