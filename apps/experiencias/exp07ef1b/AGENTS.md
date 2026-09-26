# apps/experiencias/exp07ef1b — A Seleção

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`.

| Manifesto | Dev | DS | api | e2e |
|---|---|---|---|---|
| `exp07ef1b` · 7EF · unidade 1 · `entre-redes` · `viewport` 375×812 · `permissoes: ["forms"]` · versão **1.0.0** (maior que a 0.1.5 do Eco, por causa do caminho no bucket — ADR-113) | `:5179`, hub `/exp/exp07ef1b` | `@edu/ui/ds-insta` (clone) + `@edu/ui/ds` (escola) | `apps/api/src/a-selecao` ↔ `/a-selecao/*`; enquetes em `/evidencias/exp07ef1b/perguntas/*` (E14) | `scripts/e2e/estudante/11-a-selecao.mjs` (dois estudantes + a professora) — **ainda não escrita** |

## O passo manda na tela

A api devolve o passo JÁ reconciliado com a etapa da turma (`regras/passos.ts#passoEfetivo`).
A tela lê `sessao.passo` e nada mais — `passoDoEstudante` é o cru, e usá-lo faria a
tela discordar do servidor no instante em que a professora abre o Mural. O espelho
do cliente (`lib/regras.ts`) existe para o teste provar a igualdade; `regras.test.ts`
LÊ o `passos.ts` da api e reprova divergência nas listas.

| Passo | Tela | Quem fala | Componentes do DS |
|---|---|---|---|
| `desafio` | E1 — a DM da Amara | Amara (clone) | `DirectThread`, `MessageBubble`, `ButtonInsta` |
| `feed` | E2 — o feed da cobertura | app | `TopBar`, `BadgeInsta`, `PostCard` (`.Header/.Media/.Actions/.Likes/.Caption/.Timestamp`), `FloatingButton`, `TabBar` |
| `salvos` | E3 — a poda + E3-ALU-02 | app | `TopBar`, `ButtonInsta`+`IconInsta`, `BadgeInsta`, `MediaGrid` (`selectable`), `StoryComposer`, `ConfirmDialog` (`destructive`), `TabBar` |
| `publicado` | E3-SIS-01 — a espera | app | `StoryViewer` (a própria tríade, `footer` = a legenda) |
| `mural` | E4-ALU-01 — o PICO | app | `SegmentedTabs`, `StoryViewer` (3 segmentos, `onNext`/`onPrev`, `footer`) |
| `fichas` | E4-ALU-02 — a revelação | app | o mesmo + `BottomSheet` não modal (`maxHeight 45%`) com `BadgeInsta` — por `React.lazy` |
| `explicacao` | E5 — carrossel + DM de fechamento | app, depois Amara | `TopBar`, `PostCard` (`.Media` sem `src`, `currentIndex/totalCount`), `ButtonInsta`, `DirectThread` — por `React.lazy` |
| `reflexao` | E6 | **escola** | `SectionHeader`, `Card`, `TextArea`, `Button` |
| `enquetes` | a confirmação, depois as enquetes | escola, depois Amara | `AlertBox`; `DirectThread`, `MessageBubble` (`bare`), `DmPoll` |
| `fim` | "Missão concluída!" | **escola** | `AlertBox` |
| 403 | missão não aberta aqui | **escola** | `AlertBox` |

A tela só anda quando a api responde: nenhum toque troca a tela de forma
otimista. É o que torna o latch da publicação à prova de rede ruim.

## A fronteira do disfarce é QUEM FALA

Do "Abrir Feed da Cobertura" até o fechamento da Amara, quem conduz é o clone —
inclusive a revelação, que é a ficha técnica sobre o Story. A reflexão sai do
clone porque a pergunta é sobre um jornal cobrindo OUTRA escola, e fazê-la dentro
do Instagram a devolveria à ficção. As enquetes voltam ao clone (é a Amara quem
pergunta, ordem do PO) e o fim volta à escola. Os avisos globais seguem a mesma
regra (`app/avisos.tsx`): na tela da escola eles saem pelo `AlertBox`, com copy
própria — a do sheet fala de "marcações de posts" e da "conta do grêmio".

## O que o bundle NÃO sabe

O gabarito de cada post (enquadramento, fonte ouvida, ângulo), a matriz, o nível
das alternativas das enquetes e os prompts moram no servidor. `lib/tipos.ts` não
tem campo para eles no feed; o gabarito cruza a fronteira UMA vez, em
`FichaDoPost`, dentro do Mural, e só com `fichasReveladas`.

**A copy que fala do MECANISMO também não viaja no chunk principal.** O card 2 da
E5 é a lente de cada veículo por extenso ("a Folha Oficial focou nas autoridades,
a Voz Coletiva nos moradores…"), e a ficha tem os nomes das três lentes. As duas
moram em `lib/textos-da-explicacao.ts` e `lib/textos-da-ficha.ts`, importadas SÓ
por `clone/explicar.tsx` e `clone/ficha-tecnica.tsx`, que entram por
`React.lazy` (`app/preguica.ts`, com repetição do `import()`). O arquivo continua
no bucket — o cuidado é não ENTREGÁ-LO durante o garimpo, legível no DevTools.
Importar uma dessas duas constantes de qualquer outro arquivo desfaz isso sem
erro nenhum. A verificação, depois do build:

```bash
cd apps/experiencias/exp07ef1b
find dist -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' \) | xargs grep -l -F -e tagFonte -e tagAngulo -e enquadramento -e matriz -e "redator jornalístico" -e "Você ajuda um professor"   # vazio
find dist -type f -name '*.js' | xargs grep -l -F "Folha Oficial"          # só explicar-*.js
find dist -type f -name '*.js' | xargs grep -l -F "Ficha Técnica"          # só ficha-tecnica-*.js
```

## Contagem em CODE POINTS, e o contador do DS que conta outra coisa

A api conta legenda e reflexão em code points (`[...s].length`), depois de
normalizar (a legenda sem quebra de linha, a reflexão aparada). A tela conta
igual (`lib/regras.ts`), e é essa régua que acende ou apaga os botões — com
emoji, `.length` diria o dobro. **O contador VISÍVEL da legenda é o do
`StoryComposer`, que conta `.length`**: com emoji ele diverge da régua. O da
reflexão é nosso (`showCounter={false}` no `TextArea`) e conta certo.

## Rede, sessão e o latch (`app/conexao.ts`)

Toda chamada passa por `conexao.executar`, que repete a falha de REDE (sem
status, 5xx, 429) e de SESSÃO (401) com o aviso diegético aceso, e só essas. É
seguro repetir todas as mutações daqui: `POST passo` pede um destino, `concluir`
é idempotente, a enquete guarda a primeira resposta, e `decisao`/`reflexao`
respondem 409 na segunda vez — aí a casca relê a sessão. **O latch nunca se perde
e nunca duplica, porque só existe quando a api confirma.**

O SDK não expõe "renovar token": ele pede um novo ao hub a cada 10 min. No 401 a
tela mostra "Sua conexão com a conta do grêmio expirou" e continua tentando;
"Revalidar acesso" só encurta a espera.

**O SDK joga o erro SEM o corpo** ("API POST /x → 422"). Os cinco 422 do
sanitizador chegam como um só (a frase nomeia os cinco motivos), e os dois 403
(`missao-nao-liberada`, `recurso-indisponivel`) também.

## Polling SÓ enquanto espera a professora

`GET /a-selecao/gate` a cada 5 s, só com `aguardandoOProfessor` (espera, Mural,
fichas). Compara passo, etapa, rodada e cobertura (`regras.ts#gateMudou`); mudou,
relê a sessão. Antes de publicar a etapa não toca a criança, e da explicação em
diante o passo é dela. O Mural é relido quando a etapa da sessão passa À FRENTE
da do Mural na tela — "diferente" releria em laço se o Mural voltasse adiantado.

## As enquetes pulam para o fim

Uma tentativa por pergunta (o SDK já reenvia o GET uma vez), sem repetição:
falhou (409 `sem-atividade-em-andamento`, rede, 404), a DM vai para o
encerramento. A conclusão da missão nunca fica presa numa pergunta opcional.
Nunca mostram acerto — o `DmPoll` não sabe qual é a certa. Da enquete, a
telemetria leva a PERGUNTA, nunca a alternativa (o id da alternativa é o nível
para quem conhece a ficha).

## `sessionStorage`: só ids e números, e a chave leva o `sessaoId`

`lib/memoria.ts`: os salvos, os desmarcados, o tempo de feed, o card da E5 e o
id votado em cada enquete. Nunca texto (a legenda em edição some num F5, de
propósito), nunca `localStorage` (a máquina da escola é compartilhada). A chave
leva o `sessaoId`: "Zerar a turma" cria outra sessão, e os salvos da rodada
anterior não reaparecem.

## Os posts sem fotografia (`lib/graficos.ts`)

`imagem.url` nula → o card procedural com a descrição da imagem; `grafico` → o
SVG desenhado dos NÚMEROS (barras, linhas, mapa de calor). **Todos os cards
procedurais são iguais em forma** (critério 1 do brief: a categoria não pode ser
adivinhável pela forma) — há teste. No feed o card é texto de verdade (o
`children` do `PostCard.Media`); na grade e no Story, que só aceitam `src`, é o
mesmo desenho em `data:` URI, com a cor lida dos tokens `--insta-*` em tempo de
execução (`componentes/midia.tsx#lerPaleta`). O `alt` do gráfico é escrito do que
o desenho mostra, não o `imagem.alt` da api (que descreve a imagem que o brief
pediu, e não foi desenhada).

## Props do DS que enganam (0.2.5)

- `StoryViewer` e `MediaGrid` exigem `src` e sempre montam `<img>` — daí o
  `data:` URI para o procedural e o gráfico.
- `PostCard.Media` com `src` que falha tira o `<img>` da árvore, e o `alt` sai
  junto. A descrição volta pelo `errorLabel` (aceita nó).
- `StoryComposer` conta `.length` (UTF-16) no contador visível; o `minLength`
  dele também.
- `TextArea` da plataforma: o `label` é um `<label>` SEM `htmlFor` — aparece e
  não dá nome ao campo. Passe `aria-label` junto.
- `Badge` tem `white-space: nowrap`: tag longa vaza da tela.
- `TopBar` e `DirectThread` reservam os 44 px da status bar por padrão, e o
  aparelho do hub não desenha status bar: aqui vão com `withStatusBarInset={false}`.
- `TabBar` sem `items` desenha as cinco abas do Figma — ver "Ausências".
- `ConfirmDialog`, `BottomSheet` modal e `FloatingButton` se posicionam contra o
  contêiner posicionado mais próximo: `.tela` é `position: relative`.

## Ausências deliberadas

- **Barra inferior com DUAS abas** (Feed e Salvos). A spec declara sem busca,
  sem Explorar, sem criar publicação (§5); desenhar os ícones mudos seria pôr
  alvos que não fazem nada.
- **Sem contador da sala na espera** (`e3.feedback.contador_sala`): a rota de gate
  é magra (ADR-93) e não traz contagem; inventar o número seria a tela mentindo.
- **Sem "há 2 horas" no Mural** (`e4.feedback.tempo_post`): a publicação é de
  minutos atrás, e o pico tem teto de 4 elementos.
- **Sem avanço automático do Story**: a imagem sairia da tela no meio da conversa
  da sala (e WCAG 2.2.2).
- **Sem `PhoneFrame`**: o aparelho é do hub (`viewport`).

## As compensações abertas

Marcadas `(b) COMPENSAÇÃO` em `src/estilos/globals.css`. Quando chegarem por
versão, o bloco local sai:

| Compensação | Pedido ao `storybook-unooria` |
|---|---|
| a faixa da dica do feed e do aviso da poda | `InlineHint` (tom neutro e de atrito) |
| o indicador do gesto de rolar ([D0-2]) | `GestureHint` |
| a tarja "Sem conexão com a rede…" | `Snackbar` na `instanooria` |
| a tag da ficha que quebra linha | `Badge` com `wrap` |

E três pedidos SEM compensação: o contador do `StoryComposer` em code points (ou
`count` controlado), o `htmlFor` do `label` do `TextArea` (compensado com
`aria-label`), e um `errorLabel`/`description` explícito no `PostCard.Media` para
não perder o `alt` no erro.

**Não é pedido**: as barras do "Equilíbrio editorial" — o Instagram não desenha
gráfico, e a ficha é a extensão da ficção que a missão acrescenta (o mesmo
argumento do mini-infográfico da exp05ef1b).

## A copy ESCRITA AQUI (para o PO revisar)

Marcada `ESCRITA AQUI` em `lib/textos.ts`: a conta da Amara (`amara.gremio`,
"Ativa agora"), "N curtidas", "Ver todos os N comentários", os nomes acessíveis
(abas, grade, campo, voltar), "Não foi possível carregar o feed agora.", a recusa
do sanitizador, "Continuar" (da confirmação às enquetes), o encerramento da Amara
("Valeu pela força com a cobertura! Até a próxima."), "Fechar conversa", o corpo
de "Missão concluída!", a tela de missão não liberada e os dois avisos globais na
voz da escola. E dois plurais resolvidos no sheet ("Remova 1 post", "mais 1 caractere").
E um desvio do sheet, de propósito: o card 2 e a DM de fechamento diziam "a mesma
praça", o tema do banco curado; com um tema gerado por IA ficava errado, e virou
"o mesmo acontecimento".

## Pendências

- **A suíte e2e** (`scripts/e2e/estudante/11-a-selecao.mjs`) não existe ainda.
  Duas armadilhas medidas na verificação visual: o `fill` do Chrome DevTools/
  Playwright pode não mover o estado controlado do `TextArea` (o contador fica
  parado) — digite, ou dispare `input`; e as enquetes vêm embaralhadas a cada GET,
  então a suíte casa pelo TEXTO da alternativa, nunca pela posição.
- Registro da porta 5179 no hub (`experiencias-dev.ts`) e no CORS da api: fora
  desta pasta.
