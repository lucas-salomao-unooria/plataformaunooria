# apps/experiencias/exp08ef1b — o feed que se revela (Unoovista)

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`.

| | |
|---|---|
| Manifesto | `exp08ef1b` · 8EF · `telemetria, progresso, ia` · viewport 375×812 |
| Dev | `pnpm --filter @edu/exp08ef1b dev` → :5173 |
| DS | `@edu/ui/ds-unoovista` no disfarce (desde a 1.2.0, ADR-133; antes era `ds-insta`) — o Raio-x (6a) inclusive, que vem ANTES da revelação; `@edu/ui/ds` só depois dela: os gráficos do dossiê, o 6b e o 6c, a reflexão e o "Rever meu relatório" (1.4.0, ADR-167), todos no chunk `lazy`, para o CSS da plataforma não descer com o feed |
| api | `motor`, `geracao`, `dossie`, `atividades` — tabelas `exp08ef1b_*` |
| e2e | `scripts/e2e/estudante/02-instanooria.mjs` (sobe DOIS contextos: o docente conduz) |
| Copy da revelação | `src/lib/copy-da-revelacao.ts` — **cópia gêmea** de `apps/hub/lib/insta/copy-da-revelacao.ts`, que o guia do professor lê. Mexeu numa, mexa na outra: nada no build cobra isso |

## Duas armadilhas que fizeram o post do estudante sumir (corrigidas na 1.3.0)

- **`permissoes: ["forms"]` no manifesto.** O compositor do post é o
  `StoryComposer` do DS, que é um `<form>`; sem `allow-forms` no `sandbox` do
  iframe o navegador bloqueia o envio ANTES do `onSubmit`, e o "Compartilhar"
  só fecha a tela. O sintoma no console é "Blocked form submission".
- **Rota que chama o modelo usa `api.postLento`** (45 s, `lib/api.ts`). O
  padrão do SDK é 10 s e as reações das personas levam 20–30 s: o navegador
  abortava, o servidor gravava as reações, e o `catch` do "sem rede" escondia
  que o estudante nunca as via.

## O cliente MEDE; quem decide é o servidor

`src/lib/eventos.ts` é buffer do MOTOR (flush a 4s, a 10 eventos, ou antes de
pedir o próximo bloco) e **nenhum peso, score ou classificação mora aqui**. O
feed adaptativo é da api: o cliente manda o que aconteceu e recebe o próximo
bloco. Colocar a regra no cliente é entregar o gabarito do próprio instrumento
(regra 3) — e torna impossível reprocessar a hipótese depois, que é o motivo de
o motor ser versionado do lado de lá.

## Dwell time tem uma definição, e ela não é intuitiva

`src/lib/dwell.ts`: `IntersectionObserver` com threshold **0.6** — o cronômetro
abre com ≥60% do card visível e fecha ao sair, revisitas somam, e a aba oculta
pausa. **Sheet aberto sobre o feed NÃO pausa**: comentário aberto continua
contando para o post, porque ler os comentários é atenção àquele post. Mudar
qualquer um dos três muda a medida, não só o número.

## O disfarce é o Unoovista, e o que ficou local tem nome

O app se chama **Unoovista** e a superfície inteira vem da seção `unoovista` do
DS. As cores do Tailwind (`surface`, `ink`, `action`…) são nomes da experiência
que apontam para os tokens `--unv-*` — **nunca** escreva hexadecimal de
interface aqui, e nunca `--unooria-*` no feed: o roxo é o mesmo, a seção não.
A folha `fonts/unoovista.css` é obrigatória, porque o `Icon` é ligadura.

O que ficou local é COMPENSAÇÃO, marcada no comentário do arquivo, e morre
quando o pacote publicar a peça:

| Peça | Arquivo | Lacuna do DS |
|---|---|---|
| grade de miniaturas (busca, perfis, debate) | `abas.tsx`, `debate.tsx` | o `MediaGrid` só desenha bloco com `src` e não entrega o elemento de cada bloco — e a busca registra CADA miniatura no dwell |
| coração do comentário | `comentarios-sheet.tsx` | não há botão de ícone sem contêiner |
| "Seguir" ao lado do cabeçalho do post; coração do duplo-toque | `post-card.tsx` | o `PostCard.Header` não tem slot de ação; embrulhar a `Media` mata a pílula de ações (`Media + Actions` precisa ser adjacente) |
| avatar das iniciais e mídia de emoji no story | `stories.tsx` | o `StoryViewer` só recebe URL (sem `initials`, sem slide sem `src`): os dois viram SVG em `data:` |
| seletor de figurinha | `onboarding.tsx` | não há seletor de avatar |
| camada `fixed` das folhas, do aviso e da doca | `sheet.tsx`, `sheets-extras.tsx`, `bottom-nav.tsx` | no DS eles se posicionam no `PhoneFrame`; aqui o contêiner é o viewport do iframe |

Duas armadilhas que a troca mostrou: o CSS de cada componente do DS entra
DEPOIS do da experiência, então utilitário do Tailwind que briga com a classe
do componente PERDE (o `justify-start` no `Chip` não pegava); e o `Avatar` do
DS não cai para as iniciais quando a imagem falha — a queda está em
`AvatarPerfil`, pelo `onErrorCapture`.

## Avatares

Personagens-símbolo, nunca rosto humano realista nem pessoa identificável — a
criança escolhe uma identidade para usar dentro de um feed que a está medindo.
A URL sai de `import.meta.env.BASE_URL`, **não** de `/`: o bundle é servido de
`{expId}/{versao}/` no bucket, e caminho absoluto aponta para a raiz da CDN.

## O Canal A (1.4.0, ADR-167): o desvio por fase

`lib/canal-a.ts#desvioDaFase` decide o que vem ANTES da tela da fase, a partir
de `GET /runs/:id/tarefas`: o Raio-x pendente antes da revelação (quem não o
fez antes do debate faz na entrada da explicação), a revelação antes do cinza
e das tarefas (quem foi puxado adiante vê a revelação e o relatório com
"Continuar"), e tarefa pendente antes da reflexão. Quem não teve feed com lado
não recebe tarefa. **O aparelho não sabe o lado de nenhum post**: a
composição do Raio-x e do envio, os gabaritos e as réguas são da api
(`apps/api/src/motor/canal-a/`), e todo envio responde `{ enviada: true }`.

- **O fim da revelação é do servidor**: o "Ver meu relatório" chama
  `POST /runs/:id/revelacao/concluida` (idempotente). Sem ele o 6b e o 6c não
  abrem.
- **O relatório expande também a pedido** ("Rever meu relatório", no cinza e na
  reflexão): `passo: "relatorio"` no `exp:estado`, em qualquer fase. As tarefas
  publicam `passo: "tarefas"` para o hub tirar a moldura do cinza.
- **Quem publica `passo` desfaz ao DESMONTAR, não só no botão** (1.4.1). O
  desvio por fase montava o `RelatorioComSaida` por um instante, com as tarefas
  de antes do fim da revelação, e o trocava pelo cinza quando elas chegavam: o
  `passo` ficava publicado, o cinza preso em tela cheia e a moldura do hub
  nunca aparecia — só no dev publicado, onde a latência abre a janela. A casca
  também recarrega as tarefas ao gravar o fim da revelação
  (`aoConcluirRevelacao`). Para diagnosticar, escute `exp:estado` na página do
  hub: a última mensagem com `passo` é a culpada.
- **O `Checkbox` do DS tem o `<input>` sr-only, fora da área visível**: na e2e
  marca-se pelo RÓTULO (`getByText`), nunca `check()` no input.
- Compensação local: o texto da miniatura do envio abre por inteiro num
  `<button>` sem estilo de controle (`tarefas-pos-revelacao.tsx`) — o DS não tem
  "texto que expande"; o `Collapse` sequestra o teclado.
