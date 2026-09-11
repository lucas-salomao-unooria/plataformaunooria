# apps/experiencias/exp-08-manifesto-ia — O Manifesto da IA

Complementa o `AGENTS.md` da raiz.

8º ano do EF, **unidade 4**. Porta de dev **5182**; rota do hub
`/exp/exp-08-manifesto-ia`; módulo da api `apps/api/src/manifesto-ia/` ↔
`/manifesto-ia/*`. Seções do DS: **`chatgpt`** (a conversa) e **`unooria`** (o
briefing, o Meu Percurso e o fechamento).

O estudante audita um sistema de predição escolar dentro de um clone do
ChatGPT, derruba a tese de neutralidade dele e fixa uma cláusula de governança
que a máquina passa a obedecer.

## As quatro regras que, se você não souber, você quebra

1. **NÃO há WebSocket** (ADR-93). A pausa da turma para o debate (Checkpoint A)
   é uma linha em `exp_08_gates_turma` que a tela lê por **polling HTTP de 5s**
   em `GET /manifesto-ia/gate`. O handoff original previa `hub:pause` por
   WebSocket, e não existe WebSocket de aplicação no Cloud Run. O polling só
   roda de `decisao` a `percurso` (`deveObservarOGate`): ligado sempre, custaria
   7 req/s por turma durante os 50 minutos inteiros.
2. **Nenhum componente novo no design system.** Os candidatos dos wireframes
   (`StructuredPromptSelector`, `GovernanceClauseCardGroup`,
   `PedagogicalPauseOverlay`, `CodeBlock`…) são composições locais em
   `src/app/componentes/`, com o que as pontes `@edu/ui` já exportam. Toda
   lacuna do pacote está MARCADA em `src/estilos/globals.css`, com o pedido
   nomeado — a lista está abaixo.
3. **Não existe gabarito, e a ausência é o desenho.** As quatro cláusulas são
   salvaguardas válidas. Calcular acerto, percentual ou ranking entre elas está
   na lista de métricas proibidas do handoff, e `PROIBIDO_NO_PAINEL` (na api)
   tem o teste que cobra. Com quatro opções e uma "mais votada", esse é o erro
   natural de quem chegar depois.
4. **Dado pessoal na justificativa é RECUSADO (422), não gravado.** A decisão e
   as duas alternativas descartadas estão em
   `apps/api/src/manifesto-ia/regras/moderacao.ts`. O filtro é conservador de
   propósito e **não tenta adivinhar nome próprio** — recusar "meu tio Silva foi
   reprovado" cortaria justamente o argumento situado que a Etapa 5 mede.

## `permissoes` do manifesto: `["forms"]`, e só

`forms` porque o `Composer` do DS é um `<form>` e sem o token de sandbox o
navegador BLOQUEIA o submit em silêncio — o estudante escolheria o card,
apertaria enviar e nada aconteceria (a armadilha que custou um bug inteiro na
exp-03).

**`clipboard-write` NÃO entra aqui**, ainda que o botão "Copiar texto" precise
da Clipboard API. O vocabulário de `permissoes` é FECHADO
(`pointer-lock | forms | downloads`, em `apps/api/src/experiencias/contrato-de-rotas.ts`)
e o `allow` do `ExpFrame` já concede `clipboard-write` a TODAS as experiências.
Declará-lo derrubaria o `PUT /experiencias/:expId` do deploy com 400 — depois de
os bundles já terem subido. O `versao.test.ts` prende o valor.

## As lacunas do DS que esta missão expôs

Cada uma tem compensação marcada no CSS e um pedido nomeado para o
`storybook-unooria`. Elas existem **para morrer** quando o pacote publicar.

| Pedido | Seção | O que a compensação faz hoje |
|---|---|---|
| **`CodeBlock`** | `chatgpt` | A maior. O não-negociável 4 exige o manifesto dentro do bloco nativo com cabeçalho "markdown" e ação de cópia — é a moldura que faz o documento parecer emitido PELO SISTEMA. Hoje é `.bloco` + `.bloco__barra`; o botão de copiar já é o `Button` do pacote. |
| `SelectableCard` | `chatgpt` | O cartão de cláusula do PICO. `GPTCard` é para grade de agentes e `Tag` é etiqueta curta; nenhum tem seleção exclusiva com corpo longo. O elemento continua sendo `<input type="radio">` real — a exclusividade e a navegação por seta vêm do navegador. |
| `StreamingCursor` | `chatgpt` | O cursor do efeito de digitação. `ChatBubble` desenha a fala pronta. |
| `Spinner` | `chatgpt` | O indicador de 16px do delay de 2000ms. |
| `ContextBanner` | `chatgpt` | A faixa dos três princípios em disputa. |
| `InlineNotice` | `chatgpt` | O aviso de bloqueio por cliques rápidos (15 palavras — `Badge` é curto demais). |
| `Toast` | `chatgpt` | A notificação de canto de Amara e a de cópia. `Snackbar` existe, mas na `unooria`. |
| `BlockingOverlay` | `unooria` | O congelamento do debate. `Modal` traz `closeOnEscape` e botão de fechar, que dariam à criança o jeito de sair do congelamento que ele existe para impedir. |
| `StampBadge` | `unooria` | O selo de protocolo da certidão. |

**Duas props do pacote que diferem entre as seções** e já custaram um erro de
typecheck aqui: o `AlertBox` da `unooria` usa `variant`, não `type`; o `Modal`
da `unooria` usa `isOpen`, não `open` (o da `chatgpt` usa `open`). O typecheck
pegou as duas — mas o `Button` da `unooria` **aceita prop inventada em
silêncio**, então nem sempre pega.

## A fronteira das duas seções, nesta missão

A linha é a de sempre — **quem está falando** —, mas aqui ela NÃO é uma
revelação: o estudante sempre soube que era uma aula, e o clone é o ambiente da
tarefa, não uma armadilha.

- `unooria`: o briefing de Amara (E1-ALU-01), o overlay de pausa, o Meu Percurso
  (E5) e o fechamento (E6). O handoff coloca a Etapa 5 explicitamente "fora da
  simulação".
- `chatgpt`: da abertura da conversa até o manifesto promulgado (E1-ALU-02 a E4).

O que a fronteira protege é o **TOM**: a máquina precisa soar corporativa para a
tese de neutralidade dela ser derrubável, e um `Button` institucional dentro da
conversa a faria soar amigável no exato momento em que ela defende a vigilância.

## Amara é SILENCIADA nas Etapas 2 e 3

Não-negociável 3. A única quebra é o balão de apoio depois de **120 segundos**
sem ação na Etapa 2 (caminho degenerado), e ele é o balão da guia, não uma dica
de sistema. Na tela do PICO ela está 100% ausente: teto de cinco elementos, sem
barra de progresso, sem tutorial.

## Os áudios ainda NÃO existem

O brief pede `e1-alerta-amara.mp3` (~650 KB, CDN) e
`e6-podcast-manifesto.mp3` (~3,8 MB, bucket de mídia). Nenhum foi gravado.

A tela é honesta sobre isso e faz duas coisas, nesta ordem: **o texto está
sempre visível** (é acessibilidade de sala sem fone, não fallback de mídia
ausente) e **não há player morto** — o botão de ouvir aparece desabilitado com o
motivo no `title`, em vez de sumir. Um botão de play que não toca nada ensina o
estudante a desconfiar da interface, e é o mesmo motivo pelo qual o `Composer`
esconde os alvos de anexo e de voz.

Quando os MP3 chegarem, entram AO LADO do texto — não no lugar dele.

## O que muda em DOIS lugares

- **A versão vive em TRÊS:** `public/experiencia.json`, `package.json` e
  `EXP_VERSION` em `src/lib/tipos.ts`. O `versao.test.ts` cobra os três (ADR-84).
- **O texto do diálogo vem da API, não daqui.** `src/lib/textos.ts` tem só o que
  a TELA escreve; a premissa da máquina, as réplicas, as cláusulas, a concessão
  do pico e o podcast saem de `apps/api/src/manifesto-ia/catalogo.ts` — porque
  são parametrizáveis por turma e porque corrigir uma palavra não pode exigir
  republicar um caminho imutável no bucket.
- **A suíte e2e casa por TEXTO EXATO** (`scripts/e2e/estudante/08-manifesto-ia.mjs`).
  Trocar copy sem atualizar a suíte a derruba com timeout, e o timeout reporta o
  seletor que faltou, nunca a causa.

## O `inert` do congelamento

Quando a turma está em debate, o conteúdo de baixo recebe `inert` — que bloqueia
clique, rolagem **e FOCO**. `pointer-events: none` pararia o clique e deixaria o
Tab passar: botões focáveis atrás de um véu é a mesma classe de defeito que o
`Collapse` da exp-92 produziu, com 30 alvos dentro de um `aria-hidden`.

## O que NÃO tem, de propósito

- **Nota, score e pontuação.** O `exp:concluir` da bridge tem o campo `score` e
  esta missão não o manda: as quatro cláusulas valem igual, e um número ali
  deixaria a tela pontuar uma escolha que a missão não pontua. O progresso da
  plataforma lê o `concluido_em` que a api grava.
- **Digitação livre.** Ausência deliberada da spec: guardrail contra jailbreak e
  conteúdo fora da faixa numa aula de 50 minutos com adolescentes.
- **IA em sala.** A única chamada ao provider roda ANTES da aula, na preparação
  docente, com o professor olhando. Zero tokens de estudante, e nenhuma aula
  depende de o Vertex estar de pé.
- **Tema escuro.** Fixado em claro institucional (campo 3 dos nove do handoff):
  a missão roda em uma aula, e trocar de tema no meio não é caminho que alguém
  percorra — um controle a mais no cromo é um alvo que distrai.
