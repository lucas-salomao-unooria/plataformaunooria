# apps/experiencias/exp04ef1b — Jornal da Escola: A Edição de Bento

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`. A missão do 4º ano,
1º bimestre (Entre Redes, U1): a dupla edita a capa do jornal da escola com 3 de 8
notícias, publica, vê o que a edição causou nos leitores, monta a Chave do Editor
(fonte, data, autoria), revisa, republica e compara. O PDF "proposta revisada"
vence o PRD da esteira quando divergem.

| Manifesto | Dev | DS | api | e2e |
|---|---|---|---|---|
| `exp04ef1b` · 4EF · unidade 1 · `entre-redes` · `viewport` 375×812 · `permissoes: ["forms"]` · capabilities `telemetria progresso ia avaliacao` · versão **2.0.0** (acima do UnooTube 1.2.8 que o caminho `exp04ef1b/` do bucket pode ter, ADR-116) | `:5174` (`--strictPort`), hub `/exp/exp04ef1b` | `@edu/ui/ds` (a redação inteira) + `@edu/ui/ds-insta` (SÓ o post) + `@edu/ui/ds-whatsapp` (SÓ a mensagem) — ADR-117 | `apps/api/src/jornal-escola` ↔ `/jornal-escola/*`; P1/P2 em `/evidencias/exp04ef1b/perguntas/*` (E14) | `scripts/e2e/estudante/12-jornal-da-escola.mjs` |

## A redação é da Unooria; cada PEÇA fala na seção de onde veio (ADR-117)

A missão não é clone de nada: mesa, gaveta, página, Bento, leitores, Chave e o
desafio final são a seção `unooria`. A exceção é por PEÇA, nunca por tela:

| Peça | Onde aparece | Seção | Componente | Arquivo |
|---|---|---|---|---|
| post de rede social | gaveta (meio `rede_social`) | `instanooria` | `PostCard` (`.Header`, `.Media`, `.Caption`) — sem `Actions`, `Likes` nem `Timestamp` | `app/pecas/post-de-rede-social.tsx` (só `ds-insta`) |
| mensagem encaminhada | gaveta (meio `mensagem`) e o boato da E6 | `whatsappmobile` | `MessageBubble` com `forwardedLabel` — sem `time` nem `delivery` | `app/pecas/mensagem-encaminhada.tsx` (só `ds-whatsapp`) |
| jornal, rádio, telejornal, blog, portal, mural | gaveta | `unooria` | `NewsArticle` | `app/redacao/materia-original.tsx` |

`Meio` → `NewsMedium` é um `Record` exaustivo em `lib/meios.ts` (`MEIO_PARA_MEDIUM`,
`PECA_DO_MEIO`); o `espelho.test.ts` cobra que os oito meios da api têm desenho.

**Sem timestamp no post e sem hora no balão, de propósito**: a DATA é uma pista que
a criança revela à parte; o carimbo a entregaria antes da hora. Sem curtidas pelo
mesmo motivo (PDF §1 — e número de curtidas vira pista falsa de confiabilidade).

### CSS: três seções na mesma tela, e nenhuma vaza (verificado em 2026-09-27, DS 0.2.8)

A gaveta é a primeira tela do repo com três seções ao mesmo tempo. Verificado nas
folhas agregadas (`unooria.css`, `instanooria.css`, `whatsappmobile.css` e as de
fonte) E nas de cada componente (que o módulo importa sozinho):

- todo seletor tem o prefixo da seção (`.unooria-*`, `.insta-*`, `.wa-*`); nenhum
  reset de `body`, `html`, `*` ou elemento solto — as únicas regras globais do
  `dist/` são as de `estilos/globals.css`;
- os blocos `:root` só definem variáveis do próprio namespace; as famílias das
  folhas de fonte não colidem (Open Sans e Material Symbols × PT Sans e Poppins);
- **tema**: o Instanooria escurece os `--insta-*` com o sistema em modo escuro
  (`@media (prefers-color-scheme: dark) { :root:not([data-insta-theme=light]) }`),
  e o `PostCard theme="light"` põe `data-insta-theme="light"` no próprio cartão;
  o WhatsApp só publica tema escuro, e o balão vai no contêiner `.peca-whatsapp`
  pintado com `--wa-color-surface-base` — não o `ChatWallpaper`, que é o FUNDO do
  app (a peça não traz o fundo).

Nada exigiu mexer no DS nem nas pontes.

## O passo manda na tela

A api devolve o passo JÁ reconciliado com a etapa da turma
(`regras/passos.ts#passoEfetivo`). A tela lê `sessao.passo` e nada mais
(`lib/regras.ts#TELA_DO_PASSO`, exaustivo).

| Passo | Tela | Quem fala | Componentes do DS |
|---|---|---|---|
| `desafio` | E1 — o Bento e a restrição | Bento | `SectionHeader`+`Tag`, `SpeechBubble` (`guide`), `NewspaperPage` vazia, `Button` |
| `mesa` | E2/E3 — a mesa em abas, a gaveta, a página, o latch | redação (Bento calado) | `Tabs` ("Pautas da Semana" \| "Primeira Página N/3"), `ScrollBar`, 8 `NewsCard`, `BottomSheet` (`NewsArticle` \| `PostCard` \| `MessageBubble`, 3 `RevealClue`, `AlertBox` da capa cheia), `NewspaperPage` (`renderSlotAction` = "Trocar Matéria"), `Modal` |
| `motivo` | a pergunta de motivo, DEPOIS do latch | redação | `RadioGroup`, `Button` |
| `publicada` | E4-ALU-02 — a espera neutra | redação | `NewspaperPage` (miniatura), `Card`, `Button` |
| `resultado` | E4-ALU-01 — o mural dos leitores + a espera da revisão | leitores | `NewspaperPage` (miniatura), `SpeechBubble` (`reader`, `mood`) |
| `chave` | E5 — a Chave do Editor | Bento | `SpeechBubble`, `PuzzleTrack`, 6 `PuzzleBlock` (`placed`/`returned`/`locked`) |
| `revisao` | EREV-ALU-01 — a mesma mesa, com os marcadores | redação | a mesa + `NewspaperSlot.marker` + `AlertBox` do aviso da Chave |
| `comparativo` | EREV-ALU-02 — o antes e o depois | leitores | duas `NewspaperPage` em miniatura, `SpeechBubble` |
| `transferencia` | E6 — o desafio individual, fora da redação e sem Bento | Unooria | `SectionHeader`, `MessageBubble` (whatsapp, o boato), `RadioGroup`, `Card`, `Button` |
| `fim` | E6-ALU-04 — o modo leitura | redação | `Tabs` ("Ver 1ª Edição" \| "Ver 2ª Edição"), `NewspaperPage` `readOnly` |
| 403 | missão não aberta aqui | Unooria | `AlertBox` |

A tela só anda quando a api responde: nenhum toque troca a tela de forma
otimista. É o que torna os dois latches à prova de rede ruim.

## As duas decisões que mudaram o PRD, e por quê

- **O motivo vem DEPOIS do latch** (decisão de 2026-09-25). O PRD punha "Como a
  dupla escolheu essas três matérias?" dentro do modal de publicar. Perguntar
  antes se a escolha foi pelas fotos ou pela checagem ANTECIPA a descoberta — o
  PDF §4 é explícito: "também não perguntamos se ele escolheu pela beleza ou pela
  confiabilidade". Depois do latch a resposta não muda a edição, só registra
  como a dupla ACHA que escolheu (é o agregado do painel); e antes do resultado,
  senão sairia contaminada pela consequência. O modal ficou com título, uma
  linha de aviso e os dois botões ("Distribuir Jornal Agora" / "Revisar mais").
- **A síntese final é ÚNICA** (`e6.feedback.sintese_inicial` para todos). O
  recibo de P1/P2 é `{ enviada: true }` para qualquer alternativa: a criança
  nunca sabe o nível, e a tela também não. As outras duas sínteses do sheet
  ("Você comprovou…", "Você começou a identificar…") só existiriam se a tela
  soubesse — o `textos.test.ts` cobra que elas não estão no bundle.

## O que o bundle NÃO sabe

O gabarito de cada notícia (`publicavel`, `pilarEmFalta`, `explicacao`), a
`consequencia`, o prompt da diagramação e QUAIS blocos abrem a Chave moram no
servidor. `lib/tipos.ts` não tem campo para eles na mesa; o que cruza a fronteira
é o que cada portão libera: as REAÇÕES no `GET resultado` (depois do "Liberar
resultado"), o pilar de cada vaga no `GET revisao` (depois da Chave) e no
comparativo. A lista dos seis blocos é SÓ tipo (`IdDeBloco`): uma constante com
eles na ordem da api (pilares primeiro) seria o conjunto certo no bundle; o
`Record` de ícones é alfabético pelo mesmo motivo. O grep do `dist/` que prova
isso está no `README.md`; o único nome do gabarito que aparece no bundle é
`pilarEmFalta`, uma vez, e está certo: é o CAMPO que a tela lê da resposta do
`GET revisao`/`comparativo` (o marcador da vaga), não dado.

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
  em `sessionStorage` (`lib/memoria.ts`, só ids, chave com o `sessaoId`); a copy
  promete "Suas matérias continuam salvas na mesa editorial!". Também ficam lá as
  alternativas enviadas de P1/P2.
- **Polling de 5 s SÓ nas esperas** (`aguardandoOProfessor`: a espera e o
  resultado), `gateMudou` compara passo, etapa, rodada e pacote. Na mesa, na Chave
  e depois dela, nenhum `GET gate` — o `fluxo.test.tsx` conta.
- **A diagramação** é pedida quando as três vagas estão cheias, uma vez por
  combinação (cache por ids na ordem), com "A redação está montando a página…";
  publicar espera o layout. Sem repetição: se a rede cair, a reserva da TELA
  (`classic`, `origem: "modelo"`) vale na hora, sem mensagem de erro.
- **A Chave** vai sozinha ao `POST /chave` com a terceira vaga cheia. As iscas
  voltam à bandeja no estado `returned` (com o aviso escrito do `PuzzleBlock`), os
  pilares ficam na calha. Cada envio conta no servidor e leva o NÚMERO dele
  (`estado.chaveTentativas` + 1, calculado antes da repetição): a api descarta a
  repetição da rede. Formada, a casca segura a tela até "Abrir a Mesa de
  Revisão". Os rótulos vêm da api em caixa normal: a caixa alta é do CSS.

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

## Compensações abertas — duas, marcadas `(b) COMPENSAÇÃO` em `estilos/globals.css`

**Alvos de 64px na tela da criança.** O `Button` para em `lg` = 52px, as abas em
`lg` = 56px e a opção do `RadioGroup` tem o tamanho do texto; a copy e o RNF pedem
≥ 64px (o `RevealClue`, o `PuzzleBlock` e o `Snackbar` já dão). A compensação é só
altura e recuo (`.acao-crianca`, `.mesa__abas .unooria-tab`, `.opcoes-amplas
.unooria-radio`). **Pedido ao `storybook-unooria`**: um tamanho de toque infantil
no `Button`, no `Tab` e no `RadioButton`. Morre quando publicar.

**As abas da mesa nos 375px.** Com `fullWidth` o `Tab` não quebra o rótulo
(511px numa lista de 375, uma aba cortada): a compensação divide a largura e
quebra o rótulo. **Pedido**: quebrar com `fullWidth`.

## A copy ESCRITA AQUI e os testes

O que o sheet não tinha e a tela precisou está marcado `ESCRITA AQUI` em
`lib/textos.ts`, e a lista para o PO revisar está no `README.md` desta pasta,
junto da tabela de telemetria e do que cada teste prova. O `DEG_SLOTS_INCOMPLETOS`
sai como linha sob o botão, e não balão do Bento: a mesa é silêncio.

## Ausências deliberadas

- **Sem arrastar**: "Adicionar ao Jornal" e "Trocar Matéria" são o caminho (PDF
  §4: "sem depender do gesto de arrastar"); o arraste é atalho, fora desta versão.
- **Sem reordenar as vagas**: trocar a manchete é esvaziar a vaga 0 e adicionar
  outra — a próxima escolha volta para ELA.
- **Sem `@mesa_[iniciais]`**: a faixa "Sua equipe" do hub já identifica a dupla.
- **Bento sem áudio** até haver gravação (o `action` do `SpeechBubble` fica vazio).
- **O balão do leitor não diz de qual notícia é** (PDF §7).
