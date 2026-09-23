# apps/experiencias/exp-06-rastro-boato — O Rastro do Boato

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`.

| Manifesto | Dev | DS | api | e2e |
|---|---|---|---|---|
| `exp-06-rastro-boato` · 6EF · unidade 2 · `viewport` 375×812 · `permissoes: []` | `:5181`, hub `/exp/exp-06-rastro-boato` | `@edu/ui/ds-whatsapp` (clone) + `@edu/ui/ds` (escola) | `apps/api/src/rastro-boato` ↔ `/rastro-boato/*` | `scripts/e2e/estudante/07-rastro-boato.mjs` |

## O clone é ESCURO, e isso não é escolha

A seção `whatsappmobile` do `@unooria/design-system` publica **só o tema
escuro** (`WaTheme = 'dark'`; o CSS traz `:root, [data-wa-theme=dark]` e nada
mais). O PRD e os wireframes cravam "tema claro forçado" e descrevem balões
verdes sobre fundo branco — **não existe paleta clara no pacote, e derivar uma
aqui é proibido**, pela mesma regra do `unitube` e da exp-07. O contraste do
escuro (`#D3DAE0` sobre `#101D25`, ~11:1) passa o `RNF-A11Y-001` com folga.

Se um dia o pacote publicar o tema claro, é ele que muda — não este código.

## Onde a fronteira do disfarce cai — e por que ela não é a do PRD

O disfarce vale **até o fim da Etapa 3**. Do breakpoint em diante quem fala é a
escola: a espera entre as aulas, o gráfico, o mapa da rede, o construtor do
ciclo e o "Meu percurso".

Os wireframes põem a Etapa 4 dentro do clone, como "painel de métricas do
grupo". **O WhatsApp real não tem visualizador de topologia de rede.** Inventar
essa tela dentro do disfarce quebraria o "Teste do App sem Legenda" que o
próprio QA de design aplicou — é o oposto da verossimilhança seletiva, que
permite ausências e não invenções. É a mesma decisão que o ranking do UnooTube
já tinha tomado, e a regra do repo diz o que fazer: *a linha é a REVELAÇÃO, não
o arquivo*.

## O que o cliente NÃO sabe

O bundle é público. Três coisas seguem daí:

- **A tela nunca compara com a letra da resposta.** Ela usa `estado.desfecho`
  (`interrompeu | amplificou | silenciou`), que a api devolve DEPOIS do envio.
  Um `opcao === "B"` para decidir entre o mapa cortado e a dispersão iria
  legível para o JS — a resposta certa no DevTools antes de a criança responder
  (regra 3). A exp-07 registrou essa mesma armadilha.
- **A ordem certa do ciclo não vem.** O servidor manda os 4 blocos e recebe a
  sequência montada; quem confere é `regras/ciclo.ts`.
- **A matriz de propagação é do servidor.** `regras/topologia.ts` calcula o
  alcance e devolve a malha pronta.

O `grep` do bundle faz parte da definição de pronto: `interrompeu`,
`amplificou`, `silenciou` e `ORDEM_CORRETA` não podem aparecer em `dist/`.

## 1.200 nós, e nenhum deles no DOM

O beat memorável compara a quebra no nó 3 com 1.200 ramificações. **1.200
elementos SVG travam o Chromebook da escola** (`RISCO-001`), e desenhar menos
mentindo no número desfaria o Aha!.

A resposta está no contrato: cada anel traz `nos` (o número REAL, que a legenda
escreve por extenso) e `desenhar` (quantos círculos pôr no DOM, teto de 36). A
mancha comunica a escala; o texto dá o número. Mexer em `desenhar` sem mexer no
teto do servidor é o caminho para o engasgo voltar — o teste
`rastro-boato-regras.spec.ts` cobra os dois.

## Encaminhar e calar NÃO dão no mesmo número

1.200 contra 850. Se os dois empatassem, a tela ensinaria que a inação é neutra
— e o que a missão descobre é exatamente o contrário: *na metade, o estudante
ainda não sabe que o medo alimenta a mesma curva do encaminhamento intencional*.
Há teste cobrando a diferença.

## O silêncio do PICO é de 90 segundos, e é medido

Na tela da decisão não há scaffolding, dica nem personagem-guia. **Teto estrito
de 5 elementos**: banner de contágio, balão do áudio e os três cards. Só depois
de 90 s de inação uma frase aparece — e ela nomeia o custo de não agir, nunca a
opção a tomar (P6 do aprendizado).

Encurtar esse tempo tira a pressão que o pico existe para produzir. O valor está
em `lib/regras.ts` com teste.

## O construtor é por TOQUE, não por arraste

Toca no bloco, toca no slot. `drag-and-drop` num Chromebook de escola é hostil,
não funciona com teclado e é inacessível a leitor de tela. O PRD previa o toque
sequencial como *alternativa*; aqui ele é o caminho principal, e não há arraste
nenhum para manter em paralelo.

Tocar num slot cheio devolve o bloco ao banco — é o "desfazer" que a criança
procura primeiro, e sem ele a única saída seria recarregar a página.

## O gate da aula manda na tela

`estado.passo` já chega reconciliado com a etapa da turma — **use ele**, nunca o
`passoDoEstudante` cru. Só o par `passo` + `aguardandoATurma` distingue "a aula
acabou, seu progresso está salvo" de qualquer outro estado.

São duas etapas (`aula1`/`aula2`), não quatro como na exp-07: o PRD pede UM
botão ("Liberar Aula 2") e o seu inverso. Gates que ninguém aperta enchem o
painel de controles mortos.

O polling é de 5 s e compara só o `passoEfetivo`; quando ele diverge, relê a
sessão inteira. Falha de rede ali é **silenciosa de propósito** — um alerta a
cada 5 s sobre algo que não afeta o estudante seria pior que o silêncio.

## As duas compensações abertas

O pacote não publica duas coisas que esta missão precisa. As duas estão marcadas
`(b) COMPENSAÇÃO` em `src/estilos/globals.css` ou em `componentes/glifos.tsx`, e
as duas são PEDIDO ao `storybook-unooria` — quando chegarem por versão, o código
local sai e o componente entra pela ponte:

1. **`play`/`pause`** — não há player de áudio na seção, então também não há o
   triângulo. Sem ele, um balão de voz sem alvo de toque.
2. **`ChatAudioBubbleWithTranscript`** — o balão de voz inteiro. É a lacuna que
   não dá para compor: `MessageBubble` aceita texto, `.Media` e `.Document`.

O selo de encaminhada, o anexo do laudo e o banner de contágio **não** são
compensações: `forward`, `filePdf` e `sbAlert` existem no pacote e vêm pela
ponte.

## Props que o pacote realmente tem

Adivinhar a assinatura custou uma rodada inteira de typecheck. As que enganam:

- `ChatListItem` é `preview`/`unread`, não `message`/`unreadCount` — e **não tem
  subtítulo**. O contador de auditoria por conversa aparece pelo sumiço do badge
  de não-lidas, que é a affordance nativa de "já vi isto aqui".
- `ChatHeader` é `presence`, não `status`.
- `MessageComposer` **não tem `disabled`**: inerte é não passar `onChange` nem
  `onAction`.
- Não existe ícone `person` nem `flame`. A lista completa está em
  `whatsappmobile/components/Icon/IconPaths.d.ts` (`WaIconName`).

## Sem áudio gravado, a missão roda igual

Nenhum `aud-06-*` nem o podcast foram gravados. **A transcrição está sempre na
tela** — é acessibilidade (`RNF-A11Y-002`), não fallback —, e o episódio de
recapitulação é servido em texto pela api. Quando a locução chegar, ela entra ao
lado do texto, nunca no lugar dele.

## Zero IA, e a ausência é o desenho

`RNF-CUST-001`: nenhuma chamada a `apps/api/src/ai`, nenhum token de quota.
Reações, mapa e validação do ciclo são determinísticos. Uma aula de 35 minutos
não pode depender de o Vertex estar de pé.
