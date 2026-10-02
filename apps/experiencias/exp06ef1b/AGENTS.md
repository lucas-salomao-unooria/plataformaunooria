# apps/experiencias/exp06ef1b — O Júri Estadual de Projetos

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`.

| Manifesto | Dev | DS | api | e2e |
|---|---|---|---|---|
| `exp06ef1b` · 6EF · unidade 1 · `entre-redes` · `viewport` 375×812 · `permissoes: ["forms"]` · versão **0.1.0** | `:5185` (`strictPort`), hub `/exp/exp06ef1b` | `@edu/ui/ds-unoovista` (clone, DS `^0.2.11`) + `@edu/ui/ds` (escola) | `apps/api/src/juri-estadual` ↔ `/juri-estadual/*`; enquetes em `/evidencias/exp06ef1b/perguntas/*` (E14) | pendente (`scripts/e2e/estudante/`, dois contextos: estudante + professor) |

## O passo manda na tela

A api devolve o passo JÁ reconciliado com a etapa da turma
(`regras/passos.ts#passoEfetivo`). A tela lê `sessao.passo` e nada mais —
`passoDoEstudante` é o cru. O espelho do cliente (`lib/regras.ts#passoEfetivo`,
`lib/tipos.ts`) existe para o teste provar a igualdade; `lib/espelho.test.ts` LÊ
os arquivos da api (`vocabulario.ts`, `regras/passos.ts`, `conteudo.ts`,
`contrato-de-rotas.ts` e a ficha) e reprova divergência nas listas, nos números e
nos CAMPOS dos schemas que a tela lê.

| Passo | Tela | Quem fala | Componentes do DS |
|---|---|---|---|
| `credencial` | E1 — o crachá | comissão (clone) | `TopBar`, `PostCard` (`.Header` com `verified`, `.Media` sem `src` = o crachá), `IconUnv`, `BadgeUnv` (as áreas), `ButtonUnv` |
| `feed` | E2/E3-ALU-01 — o feed | app | `TopBar`, `InlineHint` (dica do carrossel; depois "10 estandes avaliados…"), `PostCard` (`.Header/.Media/.Actions/.Caption`, carrossel de 2 lâminas com `currentIndex/totalCount`), `GestureHint` (`swipe-left`, só no 1º post), `ButtonUnv` `link` ("...mais"), `FloatingButton` (a barra da cédula), `TabBar` (2 abas), `SnackbarUnv` (inatividade 60 s; "Avalie os dez…") |
| `feed` (cédula aberta) | E3-ALU-02 — a cédula | app | `BottomSheetUnv` modal, `ListItem` + `AvatarUnv` + `IconUnv` (`Escolha`, rádio por atributos), `Chip` (convicção), `ButtonUnv` |
| — (depois do voto) | E3-ALU-03 — o lacre | app | `TopBar`, `IconUnv` (o carimbo é moldura local, ver abaixo) |
| `lacrada` | E4-ALU-01 — a plenária, o PICO | comissão | `IconUnv` (brasão) — e só: **três elementos** |
| `galeria` | E4-ALU-02/03 — a Galeria Oculta | comissão, depois app | `TopBar`, `InlineHint` `friction` (a taxa real), `SearchField`, `Chip` (4 hashtags), `MediaGrid`, `BottomSheetUnv` (ficha; cédula de revisão), `BadgeUnv` `wrap`, `ButtonUnv` |
| `pacotes` | E5 — a curtida em pacotes (EF06CO07) | **escola** | `ScrollBar`, `Logo`, `SectionHeader` (o Léo), `PuzzleBlock`, `PuzzleTrack`, `AlertBox` (a errada), `Button` |
| `cadeia` | E5 — a cadeia (EF06CO03) | **escola** | os mesmos |
| `mariana` | E6-ALU-01 — o caso Mariana | comissão (clone) | `TopBar`, `PostCard` (só `.Header` + `.Caption`), `ListItem` (`Escolha`), `ButtonUnv` |
| `enquetes` | E6-ALU-02 — a consulta nos Stories | comissão, tema ESCURO | `StoryViewer` (3 segmentos, `onNext`/`onPrev`, `footer`), `DmPoll` **no lugar do `StoryPoll`** (compensação, ver abaixo), `ButtonUnv` |
| `fim` | E6-ALU-03 — o crachá homologado | comissão | `TopBar`, `PostCard` (o crachá), `IconUnv`, `ListItem` (o infográfico em texto e ícone) |
| 403 | missão não aberta aqui | **escola** | `AlertBox` |

A tela só anda quando a api responde: nenhum latch é otimista. A única coisa
otimista é o coração (a curtida é ESTADO, e o servidor devolve a lista inteira a
cada ida).

## A fronteira do disfarce é QUEM FALA

Do crachá à galeria quem conduz é a comissão da mostra, dentro do Unoovista —
inclusive a revelação (a Galeria Oculta é um comunicado da comissão). Os pacotes
e a cadeia saem do clone: são a Unooria mostrando a engrenagem, e dentro do app
a explicação voltaria para a ficção que a missão acabou de desmontar. O caso
Mariana, a consulta e o fim voltam ao clone, porque quem pergunta e quem
homologa é a comissão. Os avisos globais seguem a mesma regra (`app/avisos.tsx`,
`regras.ts#vozDaTela`): `SnackbarUnv`/`BottomSheetUnv` no clone, `AlertBox` na
escola.

A tela de abertura (o crachá) é do clone, e não é exceção à regra da entrada: a
escola fala ANTES dela só quando a porta está fechada (o 403).

## O feed é servido um post por vez

`POST /juri-estadual/passo {para:"feed"}` serve a abertura (4 posts, um de cada
área). Cada vez que o ÚLTIMO post servido fica ≥ 60% visível, a tela pede o
próximo (`POST feed/eventos` com `proximo: true`), junto com as curtidas e as
permanências da fila. A fila (`juri-app.tsx`) junta os eventos por 400 ms, manda
UMA ida por vez e guarda para qual tamanho de feed o próximo já foi pedido — o
mesmo fim não pede dois. Quem escolhe o post seguinte é o motor da api; a tela
não sabe a regra. Antes do voto, a fila é esvaziada (o voto vai DEPOIS das
últimas curtidas).

A permanência (`lib/permanencia.ts`) é a ideia do `dwell.ts` da exp08ef1b com
outro alvo: um FATO por post (> 5 s seguidos com ≥ 60% visível, aba visível),
não o tempo somado.

## Polling SÓ na plenária

`GET /juri-estadual/gate` a cada 3 s, só com `aguardandoOProfessor` (o passo
`lacrada`). Compara etapa, rodada e atividade (`regras.ts#gateMudou`); mudou,
relê a sessão. A galeria é lida (`GET galeria`) ao entrar no passo dela; o 403
`galeria-nao-liberada` relê a sessão em vez de mostrar a porta fechada.

## A galeria não manda texto

Da busca, a api recebe `{tipo:"buscar", busca:"hashtag"|"texto", area}` —
`regras.ts#classificarBusca` —, NUNCA o que foi digitado (texto livre de
menor). Uma busca conta quando a digitação para (1,2 s) ou no toque do chip, e a
mesma busca seguida não conta duas vezes. As ações vão numa fila sem bloquear a
tela, e a revisão do voto ESPERA a fila esvaziar: a evidência da EF06CO01 é
marcada no latch da revisão sobre o que a api já gravou.

`galeria/acoes` responde **204 sem corpo**, e o SDK faz `res.json()` em toda
resposta `ok`: o corpo vazio vira `SyntaxError` sem status, que a `tipoDaFalha`
leria como queda de rede e a `comRepeticao` repetiria para sempre.
`lib/api.ts#postSemResposta` trata o `SyntaxError` como o sucesso que ele é.

## Os latches e o F5

- **Voto** (LATCH 1) e **revisão** (LATCH 2) só existem quando a api confirma; a
  repetição de uma ida perdida volta 409 e a tela relê a sessão.
- O **lacre** é a passagem (4 s), não um passo: num F5 depois do voto, a criança
  cai direto na plenária.
- **Pacotes, cadeia, cartões e enquetes** reabrem como estavam: a calha montada
  pela metade, os cartões tocados e a alternativa de cada enquete ficam no
  `sessionStorage` (`lib/memoria.ts`, só ids, chave = estudante + atividade +
  rodada). A api guarda a primeira resposta de cada enquete de qualquer jeito.
- A **dica do carrossel** não volta depois do primeiro deslize (memória).

## As enquetes pulam para o fim

Uma tentativa por pergunta, sem repetição: falhou (409, rede, 404), a consulta
encerra e o botão "Encerrar consulta" leva ao `POST concluir`. Nunca mostram
acerto. Da enquete, a telemetria leva a PERGUNTA, nunca a alternativa.

## O que o bundle NÃO sabe

A ordem certa dos pacotes e dos blocos (os ids são opacos por sessão), o cartão
certo do caso Mariana, os pesos e o limiar do motor do feed, a área líder, os
estandes que o feed NÃO serviu (só descem no `GET galeria`, depois da liberação)
e o nível das alternativas das enquetes. `lib/tipos.ts` não tem campo para
nenhum deles. Depois do build:

```bash
cd apps/experiencias/exp06ef1b
find dist -name '*.js' | xargs grep -l -F -e "certo:" -e "LIMIAR_DA_BOLHA" -e "PESO_DA_CURTIDA" -e "Formação de bolha temática"   # vazio
```

## As compensações

1. **`DmPoll` no lugar do `StoryPoll` — TEMPORÁRIA** (`app/clone/figurinha-de-enquete.tsx`,
   `.figurinha-de-enquete` no CSS). O `StoryPoll` (a enquete de HISTÓRIA, que se
   centraliza sozinha no `StoryViewer`) foi pedido por esta missão e está em PR no
   `storybook-unooria`; chega na **0.2.12**. A casca só centraliza e limita a
   largura (320 px). Quando sair: DS `^0.2.12` (e a versão nos três lugares),
   `StoryPoll` na ponte `packages/ui/src/ds-unoovista.ts`, troca no componente, e
   o arquivo e a regra CSS morrem.
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

**Não são compensação**: o carimbo do lacre (moldura tracejada de ficção — o
desenho do selo é o `IconUnv`), a arte procedural dos estandes (conteúdo, não
controle) e o deslize do carrossel (o DS publica os pontos, o gesto é do
produto; `touch-action: pan-y` deixa a rolagem com o navegador).

## Ausências deliberadas

- **Barra inferior com DUAS abas** (Feed e Cédula). Sem DM, sem comentários,
  sem busca nesta etapa (a busca é a ferramenta da galeria, depois do pico).
  A Cédula antes do décimo post responde com a frase da comissão.
- **Os botões de comentar, compartilhar e salvar do `PostCard.Actions`** ficam na
  pílula sem ação: o DS não tem prop para escondê-los, e escondê-los por CSS
  seria mexer na aparência do controle. Pedido: ações configuráveis no
  `PostCard.Actions`.
- **Sem contagem de curtidas no post** (`PostCard.Likes`): a jornada recua os
  contadores, e a api não tem o número — inventar seria a tela mentindo.
- **Sem confirmação dupla do voto**: o botão fica travado até as duas escolhas, e
  as duas convicções afirmam certeza (é a aposta que a galeria confronta).
- **Sem contador da sala na plenária**: o gate é magro, e o pico tem três
  elementos.
- **Sem avanço automático do Story** (WCAG 2.2.2).
- **Sem `PhoneFrame`**: o aparelho é do hub (`viewport`).

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

## A copy ESCRITA AQUI

Marcada em `lib/textos.ts`; o inventário está no `README.md`. As três correções
sobre o sheet: nenhuma taxa cravada (nem "75%" nem "12 projetos" — a taxa vem da
api), UMA exclamação na missão (a do Léo), nenhuma marca real. O
`lib/textos.test.ts` cobra as três, e também que nada antes da galeria diga
"algoritmo", "bolha", "filtro" ou "oculto".

## Vitrine (verificação visual)

Não mora no repositório. A receita: um `vite.config` fora da pasta com `root`
nesta experiência e um alias de `@edu/sdk` para uma SDK falsa que responde a api
por `?passo=` (`credencial`, `feed&posts=N`, `lacrada`, `galeria`, `pacotes`,
`cadeia`, `mariana`, `enquetes`, `fim`, `bloqueada=1`), fotografada pelo
Playwright do pnpm (`node_modules/.pnpm/playwright@*/`). Molde: a da exp07ef1b.
