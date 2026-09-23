# apps/experiencias/exp05ef1b — Quem mandou isso?

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`.

| Manifesto | Dev | DS | api | e2e |
|---|---|---|---|---|
| `exp05ef1b` · 5EF · unidade 1 · `entre-redes` · `viewport` 375×812 · `permissoes: ["forms"]` | `:5184`, hub `/exp/exp05ef1b` | `@edu/ui/ds-whatsapp` (clone) + `@edu/ui/ds` (escola) | `apps/api/src/quem-mandou-isso` ↔ `/quem-mandou-isso/*` | `scripts/e2e/estudante/10-quem-mandou-isso.mjs` (dois contextos) |

## O clone é ESCURO, e isso não é escolha

A seção `whatsappmobile` do `@unooria/design-system` publica **só o tema
escuro** (`WaTheme = 'dark'`; o CSS traz `:root, [data-wa-theme=dark]` e nada
mais). **Derivar uma paleta clara aqui é proibido**, pela mesma regra do
`unitube` e da exp06ef2b: a fidelidade do clone é ao que o pacote publica, e uma
paleta inventada seria um WhatsApp que não existe. O contraste do escuro
(`#D3DAE0` sobre `#101D25`, ~11:1) passa o AA com folga.

Se um dia o pacote publicar o tema claro, é ele que muda — não este código.

## A missão NASCE VAZIA, e não há queda para o banco curado

`lote === null` ⇒ tela de espera do preparo, em QUALQUER passo
(`telaDoPasso` checa `preparada` antes do `switch`, e há teste). Diferente da
exp08ef4b, **não existe reserva**: o lote é escrito em cima do TEMA que a professora
escolheu, e servir outro faria a criança ler mensagens sobre um acontecimento
que não existiu na escola dela.

Quem tira o estudante dessa tela é o **polling**, não um F5: o gate compara
`passoEfetivo`, `preparada` **e** `etapa`, e é a segunda comparação que faz a
homologação chegar sozinha às trinta telas. Tirá-la do `if` é o defeito que
ninguém vê em dev, onde o lote já está homologado antes de a sessão abrir.

A **terceira** comparação custou a tela do dilema: "Liberar reflexão final" não
mexe no passo efetivo de quem já está em `revelado` (o piso da etapa `reflexao`
É `revelado`), então sem ela o `if` saía cedo para sempre — `turma.etapa`
congelava em `revelacao` e o botão "Responder a última pergunta" nunca aparecia.
A sala esperava um botão que só um F5 traria, e nada em tela dizia por quê.

## Onde a fronteira do disfarce cai — e por que ela é mais tarde que na exp06ef2b

O disfarce vale **do "Entrar no grupo" até o card de síntese**, revelação
inclusive. Na exp06ef2b ele cai no breakpoint, e a diferença não é inconsistência:

- O Mural revelado é uma **lista de mensagens com etiquetas**, e mensageiro real
  tem etiqueta de checagem — o próprio WhatsApp marca "encaminhada com
  frequência". O que a exp06ef2b recusou foi um **visualizador de topologia de
  rede**, que app de mensagem nenhum tem.
- A pergunta do tio sai do disfarce porque ela **não é sobre o grupo da turma**:
  é sobre o grupo da FAMÍLIA dele. A transferência para fora da tela é o que a
  missão existe para produzir, e fazê-la dentro do mensageiro a devolveria para
  dentro da ficção.

O critério continua sendo *quem está falando*, nunca *é depois no tempo*.

## O que o cliente NÃO sabe — e por que aqui é mais barato que na exp06ef2b

O bundle é público, e nesta missão o segredo não precisa ser escondido: **ele
não desce**. `MensagemPublica` é um `Omit` de `veracidade`, `tom` e `explicacao`
no servidor, e `src/lib/tipos.ts` não tem campo para os três dentro do lote. Não
há `opcao === "B"` possível porque não há com o que comparar.

O gabarito cruza a fronteira UMA vez, dentro de `estado.revelacao`, e só depois
de a professora acender o telão.

**O `grep` do bundle é por CONTEÚDO, não pelas palavras.** `veracidade`,
`explicacao`, `verdadeira` e `ambigua` aparecem em `dist/` e isso está certo:
são as PROPS do componente da fita, as chaves do mapa de rótulos e os nomes de
classe `fita--*` — tudo desenhado com o que a revelação trouxe. Um
`grep -l veracidade dist/` acusa vazamento onde não há, e foi o que ele fez na
primeira verificação desta missão.

O que prova o segredo são duas perguntas, e as duas têm de vir vazias:

```bash
A=apps/experiencias/exp05ef1b/dist/assets/*.js
grep -oh "URGENTE GENTE\|Coordenação Pedagógica\|reordenamento de turmas" $A   # o texto do lote
grep -ohE "msg-[1-8][^;]{0,60}(verdadeira|falsa|ambigua)" $A                   # o par id↔resposta
```

## O toque longo é do app, e ele tem duas armadilhas

- **O alvo NÃO pode ser um `<button>`.** O balão de voz tem um botão de play
  dentro, e `<button>` aninhado é HTML inválido: o React derruba a hidratação e
  o feed inteiro para de responder ao toque. Custou uma execução da suíte na
  exp06ef2b porque typecheck e lint passam por cima. Aqui é
  `div[role=button] + tabIndex + Enter/Espaço`.
- **Cancelar no movimento precisa de folga (10 px).** Sem cancelamento, a
  rolagem vira seleção acidental e a criança encaminha o que não escolheu para
  um Mural que o latch não desfaz. Sem a folga, o tremor de um dedo de criança
  cancela toda pressão e o gesto parece quebrado.

O `click` que o navegador dispara depois do `pointerup` é **suprimido** quando o
toque longo já ativou a seleção — senão o mesmo gesto seleciona e desseleciona.

## Os três estados do botão do Mural, e por que ele nunca fica mudo

A doutrina do repo diz que alvo que não faz nada ensina a desconfiar da tela. A
saída aqui não é apagar o botão: é fazer a **recusa falar**. Falta piso → o
banner fixo do rodapé diz quantas faltam; falta rolagem → toast; liberado →
abre o Mural. As duas recusas são coisas pedagogicamente diferentes, e é por
isso que a api também as separa em dois códigos de erro
(`piso-nao-atingido` e `leitura-incompleta`).

## O avanço para a reflexão é do SERVIDOR (`POST /avancar`)

Avançar só no cliente parece funcionar e quebra 5 s depois: o polling manda o
passo cru e compara o `passoEfetivo` que volta — o servidor continuaria dizendo
`revelado` e jogaria a criança de volta ao Mural com a pergunta pela metade.

E o botão só aparece com `turma.etapa === "reflexao"` **E** `confirmou`: a api
exige o par (snapshot, reflexão) e responde 409 `curadoria-nao-confirmada` a
quem não fechou a curadoria a tempo. Quem perdeu a janela volta pela professora
("Voltar para a exploração" no painel) — e é isso que o rodapé dele diz.

## O podcast fica no FIM, não junto do dilema

A exp06ef2b põe o episódio na mesma tela do "Meu percurso". Aqui não dá: o bloco
"Provocação e transferência" do roteiro **descreve o áudio do tio e diz o que
fazer com ele**. Na tela da pergunta, isso seria a resposta impressa acima do
campo.

## Zero mídia binária, e é decisão de produto

O áudio é transcrição + player simulado; a imagem é uma moldura com o rótulo
escrito; o link é um card de texto. Não é asset que faltou: um `.mp3` por turma
gerado por IA é conteúdo que ninguém revisa antes da aula, uma foto de aviso
escolar é PII de uma escola real, e a missão mede a leitura do TEXTO.

**A transcrição do áudio nasce ABERTA.** Numa sala de informática o estudante
sem fone é a regra, e atrás de um toque a evidência só chega a quem já
desconfiava. O botão só a FECHA — é essa a diferença entre acessibilidade e
fallback.

## `permissoes: ["forms"]`, e o modo de falhar é mudo

A `TextArea` do DS é um campo de formulário. Sem o token no `sandbox` do iframe
o submit morre **em silêncio**: a criança escreve, toca em "Concluir Missão" e
nada acontece, sem erro em lugar nenhum. É a única permissão que esta missão
pede — a exp06ef2b pede zero, e a diferença é exatamente esse campo.

## Props do DS que enganam (0.2.2)

- `ChatHeader` é `presence`, não `status` — e **não tem slot `trailing`**: o
  cadeado da espera é compensação posicionada por cima.
- `MessageComposer` **não tem `disabled`**: inerte é não passar `onChange` nem
  `onAction`. Ele monta sozinho três glifos e o FAB do microfone, então a tarja
  de admin precisa de `pointer-events: none` no contêiner.
- `MessageBubble.Media` **exige `src`** de imagem: não serve para mídia descrita.
- `Badge` é contador NUMÉRICO (`count`), não etiqueta de texto.
- `EncryptionNotice` traz o texto padrão **em inglês** — passe o pt-BR por
  `children` (ADR-91).
- `Menu` não se posiciona sozinho nem traz véu; `AttachmentSheet` tem
  vocabulário fechado de anexo e não serve como folha genérica.
- Não existe ícone `close`/`x`, `play` nem `pause`. Existem `forward`, `lock`,
  `tick`, `sbAlert`, `camera`. A lista é `WaIconName`.

## As compensações abertas

Todas marcadas `(b) COMPENSAÇÃO` em `src/estilos/globals.css` (e em
`componentes/glifos.tsx`), cada uma com a lacuna e o PEDIDO ao
`storybook-unooria`. Quando chegarem por versão, o bloco local sai:

| Compensação | Pedido |
|---|---|
| barra de seleção contextual | `SelectionBar` |
| folha inferior "Encaminhar para..." | `BottomSheet` genérico |
| selo "Encaminhada" | `ForwardedBadge` |
| faixa fixa de instrução no chat | `ChatBanner` |
| tarja de grupo só-administradores | `AdminOnlyNotice` |
| cadeado no header | `ChatHeader` com `trailing` |
| balão de voz com transcrição | `ChatAudioBubbleWithTranscript` |
| play / pausa / X | `play`, `pause`, `close` em `whatsappmobile/Icon` |
| moldura de foto sem arquivo | `MessageBubble.MediaPlaceholder` |
| card de link | `MessageBubble.LinkPreview` |
| card de sistema com ações | `SystemCard` |
| fita de veracidade | `MessageTag` |

**Duas NÃO são pedido, e a distinção importa**: o mini-infográfico de duas
barras (mensageiro não faz gráfico — pedir um poluiria a seção com componente
que o app real não tem) e o posicionamento do `Menu` (o componente está certo;
o lugar é de quem o usa).

## As três fitas se distinguem SEM cor

Pictograma (✓ / ✕ / meia-lua) + rótulo por extenso. A cor é redundância. O
Mural revelado é a tela em que a decisão da turma inteira está escrita, e um
estudante daltônico tem de conseguir lê-la.

## Zero IA no cliente

Nenhuma chamada a `/ai/*`, nenhum token de quota. A IA desta missão vive no
PREPARO da professora (`apps/api/src/quem-mandou-isso/preparo.service.ts`), e o
lote chega ao estudante já homologado. Uma aula de 35 minutos não pode depender
de o Vertex estar de pé.
