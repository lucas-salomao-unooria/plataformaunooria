# apps/experiencias/exp05ef1b — Quem Mandou Isso? v2.2

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`. A v1 saiu na
ADR-114; esta é a v2.2, com o MESMO código de experiência.

| Manifesto | Dev | DS | api | e2e |
|---|---|---|---|---|
| `exp05ef1b` · 5EF · unidade 1 · `entre-redes` · `viewport` 375×812 · `permissoes: ["forms"]` | `:5184` (`strictPort`), hub `/exp/exp05ef1b` | `@edu/ui/ds-unoochat` (clone, tema claro, DS ≥ 0.2.9) + `@edu/ui/ds` (casca) | `apps/api/src/quem-mandou-isso` ↔ `/quem-mandou-isso/*` e `apps/api/src/evidencias` ↔ `/evidencias/exp05ef1b/perguntas/*` | `scripts/e2e/estudante/10-quem-mandou-isso.mjs` (dois contextos) e o passo da ficha em `professor/10-equipes-na-missao.mjs` |

O percurso: lista de conversas → chat da Nina (convite) → grupo "Turma 5ºB"
(encaminhar exatamente 3 ao Mural) → Mural (confirmar) → enquete do motivo →
espera → revelação → síntese → **clone**: a reflexão, as perguntas P1 e P2 no
chat da Nina → **casca**: "Missão Concluída".

**A regra Se/Então saiu (ADR-145, 0.4.0).** O PO a achou confusa: a missão mede
as habilidades por critérios fixos, e só ela era texto livre. As perguntas de
múltipla escolha SÃO a reflexão (Etapa 6), e o chat delas não repete o convite
da abertura (que mandava a criança de volta ao grupo).

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
2. **As perguntas P1/P2 ficam no clone** (decisão do Lucas): são a Nina
   perguntando no chat dela, com a MESMA enquete (`Poll`) da Etapa 3. O
   enunciado e as alternativas são da ficha (E14); a fala que as antecede é da
   missão (`textos.perguntas`).
3. **"Missão Concluída" é a casca**: a escola fechando a missão.

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
- As alternativas de P1/P2 chegam embaralhadas e SEM o nível; o recibo é sempre
  `{ enviada: true }`. A tela responde pelo `id`, nunca pela posição, e carrega
  cada pergunta UMA vez por aba (cada GET embaralha de novo).
- O pacote (as 8 mensagens), o convite da Nina com o `{tema}`, a despedida,
  as falas antes das perguntas, os rótulos de motivo e o callback do motivo
  vêm da api. `lib/textos.ts` tem só a copy da TELA.

**O grep do bundle é por CONTEÚDO, não por nome de prop.** `veracidade` e
`Verdadeira` aparecem no `dist/` e está certo: são as chaves e os rótulos dos
crachás. O que prova o segredo são perguntas que têm de vir vazias:

```bash
A=apps/experiencias/exp05ef1b/dist/assets
grep -ohE "Pedro Henrique|portão lateral|Ofício Circular|passeio ao museu" $A/*.js   # o banco curado
grep -ohE "msg_[1-8][^;]{0,60}(verdadeira|falsa|emocional|neutra)" $A/*.js          # o par id ↔ gabarito
grep -ohE "Não dá pra saber só pelo tom|nao_atingiu|em_processo" $A/*.js            # as alternativas e o nível
```

`src/lib/textos.test.ts` faz a mesma varredura sobre o `src/` (sem precisar de
build), para quem copiar texto da api para cá descobrir no `vitest`.

## O passo é do servidor; a VISTA é da aba

`passo` vem pronto (`passoEfetivo(latches, fase)` na api) e `telaDe(passo, vista)`
(`lib/regras.ts`) escolhe a tela. A `Vista` é o que só a aba sabe — lista ou
chat da Nina, grupo ou Mural, a despedida — e nenhum
campo dela vale como estado: um F5 cai sempre numa tela certa do passo.

Dois casos que não são óbvios:

- **Quem votou atrasado** (confirmou o Mural depois da revelação) cai direto no
  passo da TURMA. Em `sintese` os crachás estão no histórico do Mural; em
  `perguntas` o chat da Nina tomaria a tela sem ele ter visto nada — então
  aparece o Mural revelado com "Continuar" (`revelacao-atrasada`). O servidor
  não guarda "já viu": um F5 mostra de novo, sem dano. A `revelacao-atrasada`
  NÃO marca `viuRevelacao` ao aparecer — se marcasse, `telaDe` pularia para as
  perguntas no mesmo render.
- **A despedida da Nina segura a casca por 6 s** (`MS_DA_DESPEDIDA`), com o
  `POST /concluir` JÁ feito: fechar a aba no meio não perde nada.

## O polling compara QUATRO coisas

`GET /quem-mandou-isso/gate` a cada 3 s (ADR-93), e a sessão só é relida se
mudou `passo`, `preparada`, `fase` OU `atividade` (`gateMudou`). A `fase` é a
que não parece necessária e é: quem ainda está no grupo quando a revelação abre
continua no grupo (o passo não muda). A `atividade` pega "Zerar a turma" e o
pacote novo — aí a aba zera a vista, as perguntas e as respostas, porque tudo
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
| sem rede, 5xx, 429 | presença do cabeçalho vira "Conectando..." (e aviso rápido se foi toque) | — (a casca só mostra "Missão Concluída") |
| 401 | janela "Sua conexão expirou. Toque para reconectar." — reconectar é RELER; o hub renova o token sozinho | a mesma janela |
| 403 | "Este grupo ainda não abriu para a sua turma…" | idem |
| 409 | relê a sessão (o relógio da turma andou) — sem mensagem | idem |

A missão não tem mais texto livre de menor: a regra Se/Então e o
`POST /reflexao` saíram (ADR-145).

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
  (`maxWidth={300}`: as alternativas de P1/P2 são frases longas).

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

Era para o `TextArea` e o `Selection` da regra Se/Então, que saíram (ADR-145).
Fica: os rádios do `Poll` são campos de formulário, e sem o token no `sandbox`
do iframe um formulário morre em silêncio (a lição da exp02em1b).
