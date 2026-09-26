# apps/experiencias/exp05ef1b — Quem Mandou Isso? v2.2

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`. A v1 saiu na
ADR-114; esta é a v2.2 com o MESMO código, começando na 0.2.0.

| Manifesto | Dev | DS | api | e2e |
|---|---|---|---|---|
| `exp05ef1b` · 5EF · unidade 1 · `entre-redes` · `viewport` 375×812 · `permissoes: ["forms"]` | `:5184` (`strictPort`), hub `/exp/exp05ef1b` | `@edu/ui/ds-whatsapp` (clone, DS ≥ 0.2.4) + `@edu/ui/ds` (casca) | `apps/api/src/quem-mandou-isso` ↔ `/quem-mandou-isso/*` e `apps/api/src/evidencias` ↔ `/evidencias/exp05ef1b/perguntas/*` | `scripts/e2e/estudante/10-quem-mandou-isso.mjs` (dois contextos) e o passo da ficha em `professor/10-equipes-na-missao.mjs` |

O percurso: lista de conversas → chat da Nina (convite) → grupo "Turma 5ºB"
(encaminhar exatamente 3 ao Mural) → Mural (confirmar) → enquete do motivo →
espera → revelação → síntese → **casca**: a regra Se/Então → **clone**: as
perguntas P1 e P2 no chat da Nina → **casca**: "Missão Concluída".

## A fronteira do disfarce cruza DUAS vezes, e cada travessia tem razão

O critério é o do repo — *quem está falando?*, nunca *é depois no tempo?* —, e
aqui ele produz um vaivém que parece inconsistência e não é:

1. **Do convite até a síntese, é o mensageiro** — revelação inclusive. O Mural
   revelado é uma lista de mensagens com ETIQUETAS (`MessageTag`), e app de
   mensagem real etiqueta mensagem ("encaminhada com frequência"). O termômetro
   da turma e a lâmina da síntese entram como IMAGEM enviada no chat
   (`MessageBubble.Media` desenhada) — mensageiro não tem gráfico, mas recebe
   foto de gráfico. É a diferença para a exp06ef2b, onde o visualizador de
   topologia não existe em app nenhum e por isso fala pela escola (ADR-72).
2. **A regra Se/Então sai para a casca** porque não é sobre o grupo da turma:
   é sobre o grupo da FAMÍLIA do tio. A transferência para fora da tela é o que
   a missão existe para produzir, e escrevê-la dentro do clone a devolveria
   para dentro da ficção que a revelação acabou de desmontar.
3. **As perguntas P1/P2 VOLTAM ao clone** (decisão do Lucas): são a Nina
   perguntando no chat dela, com a MESMA enquete (`Poll`) da Etapa 3. O
   enunciado e as alternativas são da ficha (E14); a fala que as antecede é da
   missão (`textos.perguntas`).
4. **"Missão Concluída" é a casca de novo**: a escola guardando a regra.

Arquivo por família: `telas-do-clone.tsx` importa só `@edu/ui/ds-whatsapp`;
`telas-da-escola.tsx` só `@edu/ui/ds`. No CSS a fronteira está MARCADA — token
`--wa-*` numa tela da casca não quebra nada, só some sobre o branco
(`fronteira-do-disfarce-e-tokens` nas memórias). Na casca a rolagem é o
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
- O pacote (as 8 mensagens), o convite da Nina com o `{tema}`, o tio, a
  despedida, as falas antes das perguntas, os rótulos de motivo/condição e o
  callback do motivo vêm da api. `lib/textos.ts` tem só a copy da TELA.

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
chat da Nina, grupo ou Mural, a confirmação da regra, a despedida — e nenhum
campo dela vale como estado: um F5 cai sempre numa tela certa do passo.

Dois casos que não são óbvios:

- **Quem votou atrasado** (confirmou o Mural depois da revelação) cai direto no
  passo da TURMA. Em `sintese` os crachás estão no histórico do Mural; em
  `reflexao` a casca tomaria a tela sem ele ter visto nada — então aparece o
  Mural revelado com "Continuar" (`revelacao-atrasada`). O servidor não guarda
  "já viu": um F5 mostra de novo, sem dano. A `revelacao-atrasada` NÃO marca
  `viuRevelacao` ao aparecer — se marcasse, `telaDe` pularia para a casca no
  mesmo render.
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
| sem rede, 5xx, 429 | presença do cabeçalho vira "Conectando..." (e aviso rápido se foi toque) | `AlertBox` "Não foi possível enviar sua regra agora…" |
| 401 | janela "Sua conexão expirou. Toque para reconectar." — reconectar é RELER; o hub renova o token sozinho | a mesma janela |
| 403 | "Este grupo ainda não abriu para a sua turma…" | idem |
| 409 | relê a sessão (o relógio da turma andou) — sem mensagem | idem |
| 400 no `POST /reflexao` | — | `entao-sem-sentido` (o tamanho já foi conferido antes), na copy `e6.erro.entropia_baixa` |

O `Então` nunca vai a `reportarErro`, log ou telemetria: é texto livre de menor.

## Props do DS que enganam (0.2.4/0.2.5)

- `ForwardButton` esmaece só por `:disabled`, e `<button disabled>` ENGOLE o
  toque. A copy pede que o toque na quarta FALE ("Limite de 3…"): a seta fica
  acionável com `aria-disabled` e a opacidade é compensação
  (`.encaminhar--esgotado`). O Playwright recusa clicar em `aria-disabled` —
  na suíte, `click({ force: true })`.
- `MessageBubble.Media` sem `src` desenha `children` com `role="img"` e o `alt`
  como nome: o texto desenhado precisa estar no `alt`. Ele NÃO publica
  `onClick` — o toque é um `<button>` sem aparência em volta (compensação
  `.toque-na-midia`). A `LinkPreview` publica `onClick`.
- `Toast` fica a 40px da base; aqui ele cobriria "Ir para o Mural da Turma"
  e "Confirmar envio" — sobe para 148px (posição, em `globals.css`).
- `MessageComposer` não tem `disabled` e o placeholder padrão é INGLÊS ("Type a
  message"): passa "Mensagem" e o contêiner é `inert`.
- `ChatHeader` sempre desenha voltar e as duas chamadas; sem callback, são
  inertes (como na exp07ef1b).
- `CardHeader` (seção `unooria`) declara `avatar` no tipo e não o desenha: use
  `icon`. `AlertBox` nasce `theme="dark"` — na casca clara, passe `light`.
- `Poll` é controlado de ponta a ponta e vive DENTRO de um `MessageBubble`
  (`maxWidth={300}`: as alternativas de P1/P2 são frases longas).

## Compensações abertas (pedidos ao `storybook-unooria`)

| Compensação | Onde | Pedido |
|---|---|---|
| seta esgotada que ainda responde | `.encaminhar--esgotado` | `ForwardButton` com estado esgotado |
| toque na mídia desenhada | `.toque-na-midia` | `MessageBubble.Media` acionável |

**Não são pedido**: o desenho do comunicado, da lâmina e do termômetro — são
CONTEÚDO dentro da moldura que o DS já dá (`.Media` sem `src`), não controle.

## Zero mídia binária, zero IA no cliente, sem áudio na V1

O comunicado é o texto do pacote desenhado como papel; o link é a prévia
montada da `legenda` ("Nome do site: manchete"). A IA desta missão vive no
PREPARO do professor, na api. O áudio assistivo (D0-4) só entra quando houver
gravação — não há botão de "ouvir" nesta versão, e não há benchmarking.

## `permissoes: ["forms"]`

O `TextArea` e o `Selection` da casca são campos de formulário; sem o token no
`sandbox` do iframe o envio morre em silêncio (a lição da exp02em1b).
