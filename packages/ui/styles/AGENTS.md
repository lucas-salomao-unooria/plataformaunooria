# packages/ui/styles — as compensações da seção `unooria` (`plataforma.css`)

Complementa o `AGENTS.md` de `packages/ui` (a mecânica das pontes e a regra da
revelação estão lá). Aqui ficam os componentes do DS que a PLATAFORMA (o hub)
precisa compensar, e as classes de `plataforma.css`: tabela rolável, ação
destrutiva, `.tela-cheia`, `ScrollBar` e `Button`. Componente que falta no
pacote não nasce na tela: vira compensação marcada aqui e um pedido ao
`storybook-unooria`, e some quando o pacote publica.

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
flex por `:has(> .tela-cheia)` — sem esse recorte, as outras páginas do
professor mudariam de contexto de layout por causa de três telas.

### Rolagem: `ScrollBar` do DS, e o que sobrou para a compensação

**Toda área rolável do hub é um `<ScrollBar>` do DS** — as tabelas, o sumário
das páginas legais e as tabelas largas do guia. Dele vêm o `overflow`, a barra,
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
