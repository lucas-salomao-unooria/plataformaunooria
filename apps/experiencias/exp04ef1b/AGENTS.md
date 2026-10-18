# apps/experiencias/exp04ef1b — Jornal da Escola: A Edição de Bento

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`. A missão do 4º ano,
1º bimestre (Entre Redes, U1): a dupla edita a capa do jornal da escola com 3 de 8
notícias (julgando as pistas que abre), publica, vê o que a edição causou nos
leitores, MONTA a Chave do Editor, revisa, republica, compara, testa a Chave em
duas matérias novas e decide sozinha o que faz com um boato. O PDF "proposta
revisada" vence o PRD da esteira quando divergem; o desenho do plenário
pedagógico da 3.0.0 (ADR-168) vence os dois no que ele cobre.

**3.0.0 — Canal A puro (ADR-168).** Toda habilidade é medida por AÇÃO: o
"✓ Confio / ✗ Não confio" na mesa, a Chave montada (sem correção), a simulação e
o boato com "Repassar" à mão. **P1/P2 saíram por completo**: nenhuma rota de
`/evidencias/exp04ef1b/perguntas/*`, nenhum `RadioGroup` de múltipla escolha, e
o `api.test.ts`/`fluxo.test.tsx` cobram a ausência.

| Manifesto | Dev | DS | api | e2e |
|---|---|---|---|---|
| `exp04ef1b` · 4EF · unidade 1 · `entre-redes` · `viewport` 375×812 · `permissoes: ["forms"]` · capabilities `telemetria progresso ia avaliacao` · versão **3.0.0** (major: o Canal A muda o que a missão mede — ADR-168; a série já era maior que a do dono anterior do caminho `exp04ef1b/` no bucket, o UnooTube — ADR-116) | `:5174` (`--strictPort`), hub `/exp/exp04ef1b` | `@edu/ui/ds` (a redação inteira) + `@edu/ui/ds-unoovista` (SÓ o post) + `@edu/ui/ds-unoochat` (SÓ a mensagem) — ADR-117, ADR-136 | `apps/api/src/jornal-escola` ↔ `/jornal-escola/*` (só ele — sem `/evidencias`) | `scripts/e2e/estudante/12-jornal-da-escola.mjs` |

## A redação é da Unooria; cada PEÇA fala na seção de onde veio (ADR-117)

A missão não é clone de nada: mesa, gaveta, página, Bento, leitores, Chave e o
desafio final são a seção `unooria`. A exceção é por PEÇA, nunca por tela:

| Peça | Onde aparece | Seção | Componente | Arquivo |
|---|---|---|---|---|
| post de rede social | gaveta (meio `rede_social`) | `unoovista` | `PostCard` (`.Header`, `.Media`, `.Caption`) — sem `Actions`, `Likes` nem `Timestamp` | `app/pecas/post-de-rede-social.tsx` (só `ds-unoovista`) |
| mensagem encaminhada | gaveta (meio `mensagem`), a simulação (se a matéria for mensagem) e o boato da E6 | `unoochat` | `MessageBubble` com `forwardedLabel` — sem `time` nem `delivery` | `app/pecas/mensagem-encaminhada.tsx` (só `ds-unoochat`) |
| jornal, rádio, telejornal, blog, portal, mural | gaveta | `unooria` | `NewsArticle` | `app/redacao/materia-original.tsx` |

Até a 2.0.0 as duas peças eram o `instanooria` e o `whatsappmobile`, clones de
aplicativos reais; a 2.1.0 as passou para as redes da própria Unooria, as mesmas da
exp08ef1b/exp07ef1b e da exp05ef1b (ADR-136). A API das seções é idêntica: a troca
foi de ponte, de token e de tema, e a criança faz exatamente o mesmo.

`Meio` → `NewsMedium` é um `Record` exaustivo em `lib/meios.ts` (`MEIO_PARA_MEDIUM`,
`PECA_DO_MEIO`); o `espelho.test.ts` cobra que os oito meios da api têm desenho.

**Sem timestamp no post e sem hora no balão, de propósito**: a DATA é uma pista que
a criança revela à parte; o carimbo a entregaria antes da hora. Sem curtidas pelo
mesmo motivo (PDF §1 — e número de curtidas vira pista falsa de confiabilidade).

### CSS: três seções na mesma tela, e nenhuma vaza

A gaveta é a primeira tela do repo com três seções ao mesmo tempo. O que vale, nas
folhas agregadas (`unooria.css`, `unoovista.css`, `unoochat.css` e as de fonte)
E nas de cada componente (que o módulo importa sozinho):

- todo seletor tem o prefixo da seção (`.unooria-*`, `.unv-*`, `.unc-*`); nenhum
  reset de `body`, `html`, `*` ou elemento solto — as únicas regras globais do
  `dist/` são as de `estilos/globals.css`;
- os blocos `:root` só definem variáveis do próprio namespace;
- as folhas de fonte das três seções declaram as MESMAS faces (Open Sans +
  Material Symbols, as mesmas URLs): a repetição não baixa nada a mais, e as três
  ficam importadas porque o `Icon` de ligadura escreve o NOME do glifo sem a dele;
- **tema**: as duas seções têm claro e escuro, o `:root` é o claro e nenhuma segue
  o modo escuro do sistema. Cada peça fixa o claro mesmo assim — `PostCard
  theme="light"` e `data-unc-theme="light"` no contêiner `.peca-unoochat` —,
  porque sem isso herdariam o tema de quem estiver em volta. O contêiner da
  mensagem é pintado com `--unc-color-surface-base` (lavanda): o balão recebido é
  branco e sumiria no branco da redação. Não é o `ChatWallpaper`, que é o FUNDO do
  app (a peça não traz o fundo).

## O passo manda na tela

A api devolve o passo JÁ reconciliado com a etapa da turma
(`regras/passos.ts#passoEfetivo`). A tela lê `sessao.passo` e nada mais
(`lib/regras.ts#TELA_DO_PASSO`, exaustivo).

| Passo | Tela | Quem fala | Componentes do DS |
|---|---|---|---|
| `desafio` | E1 — o Bento e a restrição | Bento | `SectionHeader`+`Tag`, `SpeechBubble` (`guide`), `NewspaperPage` vazia, `Button` |
| `mesa` | E2/E3 — a mesa em abas, a gaveta, a página, o latch | redação (Bento calado) | `Tabs` ("Pautas da Semana" \| "Primeira Página N/3"), `ScrollBar`, 8 `NewsCard`, `BottomSheet` (`NewsArticle` \| `PostCard` \| `MessageBubble`, 3 `RevealClue` com "✓ Confio / ✗ Não confio" sob o texto — dois `Button`, e o veredito marcado num `Tag` neutro —, `AlertBox` da capa cheia), `NewspaperPage` (`renderSlotAction` = "Trocar Matéria"), `Modal`. A 3ª notícia leva à "Primeira Página" (2.2.0) |
| `motivo` | a pergunta de motivo, DEPOIS do latch — "Escolhi porque chamou atenção" \| "Escolhi porque conferi as pistas"; não avalia nada | redação | `RadioGroup`, `Button` |
| `publicada` | E4-ALU-02 — a espera neutra | redação | `NewspaperPage` (miniatura), `Card`, `Button` |
| `resultado` | E4-ALU-01 — o mural dos leitores + a espera da revisão | leitores | `NewspaperPage` (miniatura), `SpeechBubble` (`reader`, `mood`) |
| `chave` | E5 — a Chave do Editor, o MONTADOR (3.0.0) | Bento | `SpeechBubble`, `AlertBox` ("Combinem antes de tocar."), `PuzzleTrack` com 3 vagas ordenadas, 6 `PuzzleBlock` (`idle`/`placed`/`locked`), em cada vaga cheia 2 `RadioGroup` dos cartões ("A pista passa" \| "A pista falha") e 1 do "se falhar"; o `RadioGroup` da repetição, `Button` "Pronto", `Modal` de confirmação |
| `revisao` | EREV-ALU-01 — a mesma mesa, com os marcadores | redação | a mesa + `NewspaperSlot.marker` + `AlertBox` do aviso da Chave. Abre na "Primeira Página" (2.2.0) |
| `comparativo` | EREV-ALU-02 — o antes e o depois; "Testar a minha Chave" | leitores | duas `NewspaperPage` em miniatura, `SpeechBubble`, `Button` |
| `simulacao` | ESIM — a Chave DELA em duas matérias novas (3.0.0) | redação (Bento calado) | `PuzzleTrack` com os blocos `locked` (o roteiro), a matéria original (`NewsArticle` \| `PostCard` \| `MessageBubble`), 3 `RevealClue` com o julgamento obrigatório, `Button` "Publicar" \| "Não publicar", `Card` da referência |
| `transferencia` | E6 — o boato, numa tela NEUTRA, fora da redação e sem Bento (3.0.0) | Unooria | `SectionHeader`, `MessageBubble` (unoochat), 3 `RevealClue` sem julgamento, `Button` "Repassar para o grupo" \| "Não repassar", `Card` da síntese |
| `fim` | E6-ALU-04 — o modo leitura | redação | `Tabs` ("Ver 1ª Edição" \| "Ver 2ª Edição"), `NewspaperPage` `readOnly` |
| 403 | missão não aberta aqui | Unooria | `AlertBox` |

A tela só anda quando a api responde: nenhum toque troca a tela de forma
otimista. É o que torna os dois latches à prova de rede ruim.

## As decisões que mudaram o PRD, e por quê

- **O motivo vem DEPOIS do latch.** O PRD punha "Como a
  dupla escolheu essas três matérias?" dentro do modal de publicar. Perguntar
  antes se a escolha foi pelas fotos ou pela checagem ANTECIPA a descoberta — o
  PDF §4 é explícito: "também não perguntamos se ele escolheu pela beleza ou pela
  confiabilidade". Depois do latch a resposta não muda a edição, só registra
  como a dupla ACHA que escolheu (é o agregado do painel); e antes do resultado,
  senão sairia contaminada pela consequência. O modal ficou só com título, aviso e os
  dois botões.
- **A síntese final é ÚNICA** (`e6.feedback.sintese_inicial` para todos): a
  criança nunca sabe o nível, e a tela também não. As outras duas sínteses do
  sheet ("Você comprovou…", "Você começou a identificar…") só existiriam se a
  tela soubesse — o `textos.test.ts` cobra que elas não estão no bundle.
- **Canal A puro (3.0.0, ADR-168).** O julgamento é OPCIONAL na mesa (fechar sem
  marcar só não conta; vale o PRIMEIRO, e o veredito desenhado é o da RESPOSTA
  do `POST julgamento`) e OBRIGATÓRIO na simulação (aberta, a pista só deixa
  seguir marcada). Não existe "Deixar de fora": a decisão é a capa. Na revisão
  as pistas abrem sem julgamento. A Chave é UM envio, sem correção, sem
  "devolvidos" nem nova tentativa: a errada segue e é TESTADA na simulação, cuja
  ordem é a evidência (a tela não a força) e cuja resposta é a frase de
  referência igual para todos. O boato tem os dois botões desde o início, sem
  destaque nas pistas: o que se mede é se ela abre alguma ANTES de decidir.

## O que o bundle NÃO sabe

O gabarito de cada notícia (`publicavel`, `pilarEmFalta`, `explicacao`), a
`consequencia`, o prompt da diagramação, QUAIS blocos são pilares, o LADO CERTO
de cada cartão de condição e o gabarito das matérias da simulação moram no
servidor. `lib/tipos.ts` não tem campo para eles na mesa; o que cruza a fronteira
é o que cada portão libera: as REAÇÕES no `GET resultado` (depois do "Liberar
resultado"), o pilar de cada vaga no `GET revisao` (depois da Chave) e no
comparativo. A lista dos seis blocos é SÓ tipo (`IdDeBloco`): uma constante com
eles na ordem da api (pilares primeiro) seria o conjunto certo no bundle; o
`Record` de ícones é alfabético pelo mesmo motivo. O vocabulário do Canal A
(`Veredito`, `LadoDaCondicao`, `SeFalhar`, `Repeticao`, as decisões) também é SÓ
tipo: `["aprova", "reprova"]` no bundle seria, letra por letra, o `LADO_CERTO` da
api (o cartão de índice 0 de um pilar aprova). As opções da tela saem dos
`Record` de rótulos de `lib/textos.ts`, e a tela guarda o lado pela posição
CANÔNICA do cartão (`Cartao.indice`), não pela ordem embaralhada em que o mostra. O grep do `dist/` que prova
isso está no `README.md`; o único nome do gabarito no bundle é `pilarEmFalta`,
uma vez, e está certo: é o CAMPO que a tela lê do `GET revisao`/`comparativo` (o
marcador da vaga), não dado.

## As pistas são reveladas pelo SERVIDOR

O texto de fonte, data e autoria não está na sessão: desce no `POST pista`, e é
esse registro que mede a EF15CO04. O toque abre o `RevealClue` na hora ("Abrindo a
pista…") e o texto chega com a resposta. A api registra cada par uma vez POR
FASE, e cada `pistasAbertas` diz a `fase`: o chip já consultado NESTA fase reabre
aberto (também depois do F5), sem ida à api; na revisão, o lido só na mesa nasce
fechado, e o toque registra a fase 2.

## F5, a memória da aba e o polling

- **F5 é um `GET sessao`**: passo, edições publicadas, motivo, Chave e pistas com
  texto. O que a api NÃO guarda — a página em montagem antes de cada latch — vive
  em `sessionStorage` (`lib/memoria.ts`, só ids e escolhas fechadas, chave com o
  `sessaoId`); a copy promete "Suas matérias continuam salvas na mesa
  editorial!". Também ficam lá a Chave em montagem (antes do "Pronto"), a
  simulação em curso (as pistas marcadas NA ORDEM e as decisões, antes do envio)
  e as pistas do boato abertas antes da decisão. Os julgamentos da mesa voltam
  da api (`estado.julgamentos`), não daqui.
- **Polling de 5 s SÓ nas esperas** (`aguardandoOProfessor`: a espera e o
  resultado), `gateMudou` compara passo, etapa, rodada e pacote. Na mesa, na Chave
  e depois dela, nenhum `GET gate` — o `fluxo.test.tsx` conta.
- **A diagramação** é pedida quando as três vagas estão cheias, uma vez por
  combinação (cache por ids na ordem), com "A redação está montando a página…";
  publicar espera o layout. Sem repetição: se a rede cair, a reserva da TELA
  (`classic`, `origem: "modelo"`) vale na hora, sem mensagem de erro.
- **A Chave** vai ao `POST /chave` UMA vez, pelo "Pronto" (que só acende com
  tudo escolhido) e a confirmação ("Depois de enviar, a Chave não muda."). A
  repetição da rede manda o MESMO corpo, e a api devolve o estado; outro corpo
  seria 409 `chave-ja-montada`. Montada, a casca segura a tela até "Abrir a Mesa
  de Revisão". Os rótulos vêm da api em caixa normal: a caixa alta é do CSS.
- **A simulação** vai ao `POST simulacao` sozinha quando a segunda matéria é
  decidida; a casca segura a tela na frase de referência até "Continuar" (o
  passo já é `transferencia`). Rodada antiga, sem Chave montada, vai do
  comparativo direto ao boato: quem decide é a api.
- **O boato** vai ao `POST transferencia` na decisão, com as pistas abertas
  antes dela; o passo continua `transferencia`, e o "Concluir Missão" exige a
  decisão (409 `transferencia-pendente`).

## As falhas falam na voz da redação

O SDK joga o erro SEM o corpo; a classificação é pelo status
(`lib/api.ts#tipoDaFalha`). Rede e 5xx repetem com "Conexão com a gráfica
oscilou…" (`Snackbar` da `unooria`); 429 repete com "muitos pedidos"; 401, com
"Sua sessão na redação pausou…"; 403 é a tela da escola; 409, 400 e 404 relêem a
sessão — e se ela voltar OUTRA (`rodada-mudou`: o professor zerou no meio), um
aviso diz por quê. Imagem que falha cai no desenho do meio.

## Props do DS que enganam (0.2.8)

- `AlertBox` nasce `role="alertdialog"` + `aria-modal`: dentro da gaveta (que já é
  o modal) ele calaria o resto para o leitor de tela — aqui vai com `role="status"`.
- `Tabs` gera ids GLOBAIS (`tab-${value}`, `tabpanel-${value}`) e o `TabPanel` só
  monta o painel ativo: valores de aba únicos na tela. O modo leitura usa só a
  `Tabs.List` e escreve o `tabpanel` com os mesmos ids.
- `RadioGroup` com `value={undefined}` vira não controlado: passe `""` sem seleção.
- `BottomSheet` devolve o foco a `finalFocusRef`: a mesa passa o `NewsCard` que a
  abriu (o Safari não foca botão no clique).

## Compensações abertas — duas, marcadas `(b) COMPENSAÇÃO` em `estilos/globals.css`, e um pedido sem compensação

**Alvos de 64px na tela da criança.** O `Button` para em `lg` = 52px, as abas em
`lg` = 56px e a opção do `RadioGroup` tem o tamanho do texto; a copy e o RNF pedem
≥ 64px (o `RevealClue`, o `PuzzleBlock` e o `Snackbar` já dão). A compensação é só
altura e recuo (`.acao-crianca`, `.mesa__abas .unooria-tab`, `.opcoes-amplas
.unooria-radio`, e a divisão da linha nos pares horizontais do Montador).
**Pedido ao `storybook-unooria`**: um tamanho de toque infantil no `Button`, no
`Tab` e no `RadioButton`. Morre quando publicar.

**As abas da mesa nos 375px.** Com `fullWidth` o `Tab` não quebra o rótulo
(511px numa lista de 375, uma aba cortada): a compensação divide a largura e
quebra o rótulo. **Pedido**: quebrar com `fullWidth`.

**O bloco escolhido no Montador não tem estado visual.** O `PuzzleBlock` tem
`idle`, `placed`, `returned` e `locked`, e nenhum "escolhido, esperando a vaga".
A tela diz por escrito (a linha de status da calha, `aria-live`: "Fonte
escolhido. Toque numa vaga para colocar.") e as vagas vazias viram o botão
"Colocar aqui"; o bloco leva `aria-pressed`. **Sem compensação de CSS**, porque
seria aparência de controle. **Pedido ao `storybook-unooria`**: um estado
`selected` no `PuzzleBlock`.

## A copy ESCRITA AQUI e os testes

O que o sheet não tinha e a tela precisou está marcado `ESCRITA AQUI` em
`lib/textos.ts`, e a lista para o PO revisar está no `README.md` desta pasta,
junto da tabela de telemetria e do que cada teste prova. O `DEG_SLOTS_INCOMPLETOS`
sai como linha sob o botão, e não balão do Bento: a mesa é silêncio.

## Ausências deliberadas

- **Sem nível, acerto, nota nem ranking em tela nenhuma** (3.0.0): nem na Chave,
  nem na simulação, nem no boato. O par de decisão é sempre do MESMO peso
  (`outline` + `outline`), e o veredito marcado é um `Tag` neutro, sem verde nem
  vermelho.
- **Sem P1/P2** (3.0.0): a missão não tem pergunta de múltipla escolha.

- **Sem arrastar**: "Adicionar ao Jornal" e "Trocar Matéria" são o caminho (PDF
  §4: "sem depender do gesto de arrastar"); o arraste é atalho, fora desta versão.
- **Sem reordenar as vagas**: trocar a manchete é esvaziar a vaga 0 e adicionar
  outra — a próxima escolha volta para ELA.
- **Sem `@mesa_[iniciais]`**: a faixa "Sua equipe" do hub já identifica a dupla.
- **Bento sem áudio** até haver gravação (o `action` do `SpeechBubble` fica vazio).
- **O balão do leitor não diz de qual notícia é** (PDF §7).
