# apps/experiencias/exp05ef1b — Quem Mandou Isso? v2.2

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`. A v1 saiu na
ADR-114; esta é a v2.2, com o MESMO código de experiência.

| Manifesto | Dev | DS | api | e2e |
|---|---|---|---|---|
| `exp05ef1b` · 5EF · unidade 1 · `entre-redes` · `viewport` 375×812 · `permissoes: ["forms"]` | `:5184` (`strictPort`), hub `/exp/exp05ef1b` | `@edu/ui/ds-unoochat` (clone, tema claro, DS ≥ 0.2.9) + `@edu/ui/ds` (casca) | `apps/api/src/quem-mandou-isso` ↔ `/quem-mandou-isso/*` (a evidência é marcada lá, nas ações; não há pergunta) | `scripts/e2e/estudante/10-quem-mandou-isso.mjs` (dois contextos) e o passo da ficha em `professor/10-equipes-na-missao.mjs` |

O percurso: lista de conversas → chat da Nina (convite) → grupo "Turma 5ºB"
(encaminhar exatamente 3 ao Mural) → Mural (confirmar) → enquete do motivo →
espera → revelação (crachás + **alerta do grupo**) → síntese → **casca**: o
desafio do tio (o **robô do grupo montado com blocos**, ligado em quatro
mensagens) → "Missão Concluída" com o card do robô.

**Só o Canal A (desde a 0.5.0, ADR-171).** As três habilidades são medidas
pelo que a criança FAZ: a seleção do Mural (EF05CO08), o **alerta do grupo**
(EF05CO03: quatro filtros com E/OU/NÃO sobre o quadro das oito mensagens,
executados pelo servidor e enviados ao grupo) e o **robô do grupo**
(EF05CO04: laço opcional, SE, ENTÃO e E DEPOIS, ligado e enviado). Na 0.6.0
o alerta substituiu o cartão de frases e o robô substituiu a regra do tio com
previsão (o Figma de 20/10 tirou a previsão). Nada de texto livre: o PO tirou
o Se/Então de texto (ADR-145), e os blocos têm critério fixo.

## A fronteira do disfarce cruza UMA vez, no fim

O critério é o do repo — *quem está falando?*, nunca *é depois no tempo?* —, e
aqui ele produz um vaivém que parece inconsistência e não é:

1. **Do convite até a síntese, é o mensageiro** — revelação inclusive. O Mural
   revelado é uma lista de mensagens com ETIQUETAS (`MessageTag`), e app de
   mensagem real etiqueta mensagem ("encaminhada com frequência"). O termômetro
   da turma e a lâmina da síntese entram como IMAGEM enviada no chat
   (`MessageBubble.Media` desenhada) — mensageiro não tem gráfico, mas recebe
   foto de gráfico. É a diferença para a exp06ef2b, onde o visualizador de
   topologia não existe em app nenhum e por isso fala pela escola (ADR-72).
2. **O alerta do grupo fica no clone**, no fim do Mural revelado, abaixo da
   faixa "Alerta do grupo · Role para montar os alertas ↓": o montador é um
   balão com o quadro das oito mensagens (`MessageTag` dos crachás), os chips
   do filtro (`FilterChip` do Unoochat: NÃO, Falsa, Emocional, E, OU — a ponte
   ganhou o `FilterChip` na 0.6.0) e o `Button` do clone; o alerta enviado é
   uma bolha ENVIADA no grupo. Alerta de grupo é gesto de app de mensagem.
3. **O desafio do tio e "Missão Concluída" são a casca**: o desafio não é
   sobre o grupo da turma, é sobre o grupo da FAMÍLIA, e montar o robô dentro
   do clone o devolveria à ficção que a missão acabou de desmontar. A fala da
   Nina aparece num `Card` com o rosto dela, não num balão. O robô é o
   `PuzzleTrack` + `PuzzleBlock` da `unooria`, no padrão do Montador da Chave
   da exp04ef1b (só toques: o bloco da bandeja encaixa na vaga dele, o
   encaixado volta); arrastar não existe no DS e não entrou.

Arquivo por família: `telas-do-clone.tsx` importa só `@edu/ui/ds-unoochat`;
`telas-da-escola.tsx` só `@edu/ui/ds`. No CSS a fronteira está MARCADA — e
importa MAIS que antes: o Unoochat copia os literais da paleta da Unooria, então
token `--unc-*` numa tela da casca não destoa nem some, passa.
Na casca a rolagem é o
`ScrollBar` do DS (a seção ali É a `unooria`); no clone é a barra do sistema,
como em toda experiência.

## O que o cliente NÃO sabe

O bundle é público, e o segredo aqui não é escondido: **ele não desce**.

- `MensagemPublica` (em `lib/tipos.ts`) não tem `veracidade` nem `tom` — a api
  a monta por `Omit`. O gabarito cruza a fronteira UMA vez, dentro de
  `revelacao`, só o das três do estudante, e só depois do voto E da revelação
  aberta pela turma.
- O quadro do alerta traz os crachás das OITO mensagens depois da revelação
  (decisão de produto), mas os pedidos chegam SEM a expressão esperada, e
  quem executa o filtro é o servidor: a tela recebe os ids que passaram e só
  pinta (contorno + etiqueta "Destacada", sem cor de acerto).
- Os blocos do robô chegam com `id`, rótulo e ícone: o TIPO de cada ação é o
  gabarito dele, e quem executa o robô é o servidor (o resultado de cada
  mensagem volta pronto em `robo.ligacoes`; a tela só anima a chegada). Os
  sinais das quatro mensagens do robô são ABERTOS — descem em `robo.mensagens`.
- O pacote (as 8 mensagens), o convite da Nina com o `{tema}`, a despedida, o
  desafio do tio, os rótulos de motivo e dos blocos, os pedidos e os rótulos
  do quadro, as mensagens do robô e o callback do motivo vêm da api.
  `lib/textos.ts` tem só a copy da TELA.

**O grep do bundle é por CONTEÚDO, não por nome de prop.** `veracidade` e
`Verdadeira` aparecem no `dist/` e está certo: são as chaves e os rótulos dos
crachás. O que prova o segredo são perguntas que têm de vir vazias:

```bash
A=apps/experiencias/exp05ef1b/dist/assets
grep -ohE "Pedro Henrique|portão lateral|Ofício Circular|passeio ao museu" $A/*.js   # o banco curado
grep -ohE "msg_[1-8][^;]{0,60}(verdadeira|falsa|emocional|neutra)" $A/*.js          # o par id ↔ gabarito
grep -ohE "nao_atingiu|em_processo" $A/*.js                                         # o nível
grep -ohE 'comparo com fonte|Checou antes de encaminhar|Passou direto|Tio Paulo|Banco Seguro' $A/*.js  # os blocos e as mensagens do robô
grep -ohE 'pegaOTio|"checagem"|"repasse"|esperada:|Destaque para o grupo|Falsa E Emocional' $A/*.js  # o gabarito do robô e do alerta
```

`src/lib/textos.test.ts` faz a mesma varredura sobre o `src/` (sem precisar de
build), para quem copiar texto da api para cá descobrir no `vitest`.

## O passo é do servidor; a VISTA é da aba

`passo` vem pronto (`passoEfetivo(latches, fase)` na api) e `telaDe(passo, vista)`
(`lib/regras.ts`) escolhe a tela. A `Vista` é o que só a aba sabe — lista ou
chat da Nina, grupo ou Mural — e nenhum
campo dela vale como estado: um F5 cai sempre numa tela certa do passo.

Dois casos que não são óbvios:

- **O alerta não é passo, é uma janela da revelação** (`alerta.aberto`): o
  montador só aparece com a turma na revelação, um pedido por vez ("Alerta n
  de 4"), e a síntese o fecha — ficam as bolhas enviadas. "Ver resultado" só
  acende com uma expressão inteira; "Enviar alerta ao grupo", só com a
  expressão da tela IGUAL à última executada (`podeEnviarAlerta`; a api cobra
  com 400 `execute-antes`). O montador é estado da aba; um F5 volta ao último
  filtro executado do pedido. Na reflexão, todo mundo vai ao robô.
- **O robô alterna MONTAR e LIGADO**: "Ligar o robô" (condição e uma ação)
  devolve a ligação e a tela vira a simulação dela (as mensagens chegam uma a
  uma, `MS_POR_MENSAGEM_DO_ROBO`; com `prefers-reduced-motion`, tudo de uma
  vez); "Mudar o robô" volta à montagem. Até 5 ligações. Enviar sem ligar é
  permitido. **Enviar o robô fecha a missão**: o `POST /concluir` sai sozinho
  depois do `POST /robo` (idempotente, e tenta de novo sem rede), e a casca
  "Missão Concluída" mostra o card "Seu robô do grupo" (os blocos e a frase)
  e a despedida da Nina.

## O polling compara QUATRO coisas

`GET /quem-mandou-isso/gate` a cada 3 s (ADR-93), e a sessão só é relida se
mudou `passo`, `preparada`, `fase` OU `atividade` (`gateMudou`). A `fase` é a
que não parece necessária e é: quem ainda está no grupo quando a revelação abre
continua no grupo (o passo não muda). A `atividade` pega "Zerar a turma" e o
pacote novo — aí a aba zera a vista (e o filtro e o robô em montagem), porque tudo
era de outro grupo. Na releitura, com a mesma atividade e ainda no grupo, a
SELEÇÃO da tela vence a do servidor: o `PUT` do último toque pode estar em voo.

Os `PUT /selecao` saem EM FILA, e o `POST /mural` espera a fila e manda a
seleção que a criança está VENDO — é ela que fecha o latch, não a última que o
`PUT` gravou.

**Nasce vazia**: sem pacote aprovado (`preparada: false`) a lista de conversas
fica vazia com uma linha de espera, e quem tira a criança dali é o polling.

## As falhas falam na voz de quem está na tela

O SDK joga `Error("API POST /x → 409")` SEM o corpo, então a classificação é
pelo STATUS (`lib/api.ts#classificar`) e quem decide o que ele quis dizer é a
ação que o recebeu:

| Status | No clone | Na casca |
|---|---|---|
| sem rede, 5xx, 429 | presença do cabeçalho vira "Conectando..." (e aviso rápido se foi toque) | um `AlertBox` de erro na tela do robô |
| 401 | janela "Sua conexão expirou. Toque para reconectar." — reconectar é RELER; o hub renova o token sozinho | a mesma janela |
| 403 | "Este grupo ainda não abriu para a sua turma…" | idem |
| 409 | relê a sessão (o relógio da turma andou) — sem mensagem | idem |

A missão não tem texto livre de menor: o robô é montado com blocos, e o
`POST /reflexao` (o Se/Então de texto, ADR-145) não volta.

## O mensageiro é o Unoochat, não o clone do WhatsApp (ADR-134, 0.3.0)

Até a 0.2.1 o clone era a seção `whatsappmobile` (só escuro, paleta do app
real). O Unoochat é cópia ESTRUTURAL dela — mesmos componentes, props e medidas
—, com a identidade da Unooria e dois temas; a missão usa o CLARO
(`data-unc-theme="light"` no `index.html`). O que a troca pediu, e o que morde
quem mexer depois:

- **A dependência do DS NA EXPERIÊNCIA** tem de ser `≥ 0.2.9`: a pasta resolve a
  própria cópia do pacote para as folhas de CSS, e a 0.2.8 que ela tinha não
  publica `unoochat.css` (o `@edu/ui` já estava na 0.2.11 — duas cópias).
- **A folha de fonte do clone é obrigatória**: o `Icon` do Unoochat é ligadura
  do Material Symbols, e sem `fonts/unoochat.css` o ícone vira o nome escrito.
- **Dois tokens sem par de nome**: `--wa-color-accent-badge` → `--unc-color-accent`
  (os acentos foram consolidados) e `--wa-color-text-meta` →
  `--unc-color-text-secondary`. O papel do comunicado era a INVERSÃO de dois
  tokens do tema escuro; no claro daria branco sobre lavanda, então é
  `surface-canvas` + `border-divider`.
- **A suíte casa por classe do DS** (`.unc-poll`, `.unc-forwardbutton`…):
  trocar de seção é trocar o prefixo nela também.
- O avatar de iniciais do `ChatHeader` não tem círculo visível (o fundo é o da
  barra) — já era assim no `whatsappmobile`; é do pacote.

## Props do DS que enganam (0.2.4 a 0.2.6, iguais no Unoochat)

- `ForwardButton` com `disabled` ENGOLE o toque, e a copy pede que o toque na
  quarta FALE ("Limite de 3…"). Por isso a seta esgotada usa `exhausted` (desde
  a 0.2.6): esmaecida, com `aria-disabled`, e acionável. O Playwright recusa
  clicar em `aria-disabled` — na suíte, `click({ force: true })`, e isso é do
  Playwright, não do DS.
- `MessageBubble.Media` sem `src` desenha `children` com `role="img"` e o `alt`
  como nome: o texto desenhado precisa estar no `alt`. Com `onClick` (desde a
  0.2.6) a moldura vira `<button>` com o mesmo desenho; o nome é o
  `actionLabel` ("Abrir imagem de…"), e ali a mídia desenhada perde o
  `role="img"` — os filhos de um botão são apresentacionais.
- `Toast` fica a 40px da base; aqui ele cobriria "Ir para o Mural da Turma"
  e "Confirmar envio" — sobe para 148px (posição, em `globals.css`).
- `MessageComposer` não tem `disabled`: passa "Mensagem" (no `whatsappmobile` o
  padrão era inglês; no Unoochat já é pt-BR, mas a copy é nossa) e o contêiner
  é `inert`.
- `ChatHeader` sempre desenha voltar e as duas chamadas; sem callback, são
  inertes (como na exp07ef1b).
- `CardHeader` (seção `unooria`) declara `avatar` no tipo e não o desenha: use
  `icon`. `AlertBox` nasce `theme="dark"` — na casca clara, passe `light`.
- `Poll` é controlado de ponta a ponta e vive DENTRO de um `MessageBubble`
  (`maxWidth={300}`: os motivos da enquete são frases longas).

## Compensações sobre o DS: nenhuma aberta

A seta esgotada que ainda responde (`exhausted`) e o toque na mídia desenhada
(`.Media` com `onClick`) são do DS, e nenhum CSS local os compensa. Compensação nova vai marcada
`(b) COMPENSAÇÃO` no código, com a lacuna e o pedido, e entra nesta seção.

**Não são pedido**: o desenho do comunicado, da lâmina e do termômetro — são
CONTEÚDO dentro da moldura que o DS já dá (`.Media` sem `src`), não controle.

## Zero mídia binária, zero IA no cliente, sem áudio na V1

O comunicado é o texto do pacote desenhado como papel; o link é a prévia
montada da `legenda` ("Nome do site: manchete"). A IA desta missão vive no
PREPARO do professor, na api. O áudio assistivo (D0-4) só entra quando houver
gravação — não há botão de "ouvir" nesta versão, e não há benchmarking.

## O grupo chega, a Nina tem rosto, e cada imagem tem cara (0.4.0)

Os pedidos visuais do PO de 2026-10-05:

- **As mensagens chegam uma a uma** (`useChegadaEmSequencia`, ~0,9 s cada:
  `MS_ENTRE_MENSAGENS` + `MS_DIGITANDO`). Só na PRIMEIRA abertura do grupo e
  com a seleção vazia (`grupoChegaEmSequencia`; `Vista.grupoChegou`): quem
  volta do Mural, ou dá F5 no meio da escolha, vê tudo de uma vez. Com
  `prefers-reduced-motion`, também. A e2e espera a OITAVA linha, nunca conta
  logo depois da primeira.
- **A foto da Nina é ilustração em SVG** (`src/assets/nina.svg`, importada
  pelo Vite e inlinada no bundle), em `avatarSrc` do `ChatListItem` e do
  `ChatHeader`. SVG é texto: a regra de "zero mídia binária" continua.
- **Cada imagem do grupo tem um desenho** (`estiloDaImagem`): comunicado,
  cartaz, print de tela ou bilhete, cada um com `alt` e proporção próprios.
  As duas imagens de um pacote saem sempre diferentes, e o par muda com o
  texto delas — o desenho não vira pista de veracidade entre turmas.

## `permissoes: ["forms"]`

Os rádios do `Poll` e da folha de encaminhar são campos de formulário, e sem
o token no `sandbox` do iframe um formulário morre em silêncio (a lição da
exp02em1b).
