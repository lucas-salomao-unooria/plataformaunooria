# apps/experiencias/exp07ef1b — O Eco no Grupo

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`.

| Manifesto | Dev | DS | api | e2e |
|---|---|---|---|---|
| `exp07ef1b` · 7EF · `viewport` 375×812 · `permissoes: ["forms"]` | `:5179`, hub `/exp/exp07ef1b` | `@edu/ui/ds-whatsapp` (clone) + `@edu/ui/ds` (escola) | `apps/api/src/o-eco-no-grupo` ↔ `/o-eco-no-grupo/*` | `scripts/e2e/estudante/06-o-eco-no-grupo.mjs` |

## O clone é ESCURO, e isso não é escolha

A seção `whatsappmobile` do `@unooria/design-system` publica **só o tema
escuro** (`WaTheme = 'dark'`; o CSS traz `:root, [data-wa-theme=dark]` e nada
mais). Os wireframes e o sheet de copy descrevem balões verdes sobre fundo
claro — não existe paleta clara no pacote, e **derivar uma aqui é proibido**,
pela mesma regra do `unitube`. O contraste do escuro (`#D3DAE0` sobre
`#101D25`, ~11:1) passa o AA que o RNF de acessibilidade pede com folga.

Se um dia o pacote publicar o tema claro, é ele que muda — não este código.

## O aparelho é do HUB

`viewport` no `public/experiencia.json` é o que liga o `DispositivoFrame`, e é
assim que a missão aparece dentro de um celular. **Não use o `PhoneFrame` do
pacote**: ele existe para o Storybook, e empilhá-lo daria um celular dentro de
outro. Dentro do iframe, `100dvh` também não serve — `dvh` se refere à janela do
navegador, não ao aparelho, e a barra de baixo sairia do recorte. Daí o
`height: 100%` em `.app`.

## As quatro compensações abertas

O pacote não publica quatro coisas que esta missão precisa. Todas estão marcadas
`(b) COMPENSAÇÃO` no `src/estilos/globals.css` ou no `componentes/glifos.tsx`, e
todas são PEDIDO ao `storybook-unooria` — quando chegarem por versão, o código
local sai e o componente entra pela ponte:

1. **`ForwardedBadge`** — o selo "Encaminhada com frequência". Composto aqui com
   o ícone `forward` (que o pacote tem) e os tokens dele.
2. **`ChatAudioBubbleWithTranscript`** — o balão de voz. É a única lacuna que
   não dá para compor: `MessageBubble` aceita texto, `.Media` (imagem) e
   `.Document`, e não há player de áudio na seção.
3. **`PinnedMessageBanner`** — a barra do alfinete. O pacote tem o *tone* `pin`,
   com a cor certa, mas nenhum glifo de alfinete; ele é desenhado em
   `glifos.tsx`, junto de `play`/`pausa`.
4. **`ReplyQuoteSelectionSheet`** — o menu das 3 respostas. Composto com `Radio`
   e o card de citação.

**`ListItem` não serve para as 3 opções.** O título dele tem
`white-space: nowrap` — certo numa lista de conversas, errado aqui: as opções
são texto longo, e truncá-las faria a criança escolher sem ler, que é
exatamente o comportamento que a missão existe para desfazer. Use `Radio` com o
texto no `label`, que quebra linha por construção.

## O que o cliente NÃO sabe

O bundle é público. Duas coisas seguem daí:

- **A tela nunca compara com a letra da resposta.** Ela usa `estado.desfecho`
  (`checada | ruido | conflito`), que a api devolve DEPOIS do envio. A primeira
  versão fazia `opcao === "B"` para decidir entre o alfinete e o "apagar para
  todos", e essa comparação ia legível para o JS — a resposta certa estava no
  DevTools antes de a criança responder (regra 3).
- **Nenhum prompt vive aqui.** Reações, Amara e devolutiva são escritas no
  servidor (`apps/api/src/o-eco-no-grupo/prompts.ts`). O prompt descreve o
  mecanismo da missão em português; publicá-lo seria pior que publicar o
  gabarito.

## Sem mídia, a missão roda igual

`GET /o-eco-no-grupo/midia` devolve `null` no que não foi preparado, e `null` é
informação: o áudio cai na **transcrição** (que está sempre na tela, por
acessibilidade) e a foto cai na ilustração procedural. Quem prepara é o
professor, no painel — não o primeiro estudante que abre a missão.

**A transcrição é verbatim da fala gravada.** Alterar uma palavra de um lado
sem alterar do outro faz a legenda contar outra coisa que o ouvido; o teste
`o-eco-no-grupo-ia.spec.ts` (na api) compara os dois.

## O gate da aula manda na tela

`estado.passo` já chega reconciliado com a etapa da turma — **use ele**, nunca o
`passoDoEstudante` cru. O par `passo` + `aguardandoATurma` distingue as duas
esperas, que são pedagogicamente opostas: o breakpoint ("a aula acabou, seu
progresso está salvo") e o debate congelado ("agora é conversar com a turma").

O polling é de 5 s e compara só o `passoEfetivo`; quando ele diverge, relê a
sessão inteira. Falha de rede ali é **silenciosa de propósito** — um alerta a
cada 5 s sobre algo que não afeta o estudante seria pior que o silêncio.

## Duas armadilhas medidas

- **`resultado` e `contexto` da telemetria são OBJETOS.** Mandar string derruba
  o lote inteiro com `eventos.N.resultado: invalid_type`, e o único rastro é um
  400 no console que ninguém lê.
- **O feed precisa rolar sozinho.** Sem o auto-scroll do `FeedDoGrupo`, a
  criança envia a resposta e continua olhando o topo do chat: a própria
  mensagem e a cascata acontecem fora da tela, e o pico da missão não é visto.

## A cadência da cascata é do SERVIDOR

2 s → 3 s → 2 s vêm em `atrasoMs` de cada reação. A tela só obedece
(`reacoesVisiveis`, `digitando`). A espera É o pico da missão, e o balão do
estudante aparece **otimista**, antes de a api responder: a geração das reações
leva alguns segundos, e sem isso o toque em "enviar" não produz nada visível.
