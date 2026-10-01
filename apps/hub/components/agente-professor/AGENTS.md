# apps/hub/components/agente-professor — o chat flutuante do agente de IA do professor

Complementa o `AGENTS.md` de `apps/hub`, que vence em conflito. **O contrato das
quatro pontas (eventos do SSE, quem fala com quem, o produto sem card) é
`docs/regras/agente-professor.md` — não o repita aqui.** Aqui está o que quebra
do lado do hub se você não souber.

## As peças, e o que o DS NÃO faz

A interface é o DS 0.2.10 pela ponte `@edu/ui/ds` (`ChatLauncher`, `ChatPanel`,
`ChatPanelAction`, `ChatHistory`, `ChatMessage`, `RichContent`,
`RichContentTable`, `ChatComposer`, `TypingIndicator`; o mascote é o
`AgentAvatar` embutido — **nenhum PNG no hub**). Três coisas o DS deixa de
propósito para o produto, e esquecê-las não dá erro nenhum:

- **Foco.** O painel não é modal e não move o foco: `agente-flutuante.tsx` o leva
  ao compositor ao abrir (`requestAnimationFrame`, depois do commit que tira o
  `hidden`) e o devolve ao botão ao fechar. Sem isso, o Esc fecha e o foco cai
  no `<body>`.
- **Data.** O `ChatHistory` recebe `atualizadaEm` JÁ formatada:
  `lib/agente-professor/formatar.ts` ("Hoje, 14:32"), sobre o `@edu/sdk`
  (ADR-98/99). Nunca `toLocale*` aqui.
- **Markdown.** O `RichContent` só dá tipografia; quem converte e tranca é
  `markdown.tsx`.

**O título do painel é FIXO ("Agente de IA do professor") e o da conversa vai
no `subtitle`.** O título é o nome acessível da região: com o da conversa ali, o
leitor de tela acharia um painel com nome diferente a cada conversa — e a suíte
e2e também.

## O turno: quem aborta e quem não aborta

O estado vive em `use-agente-professor.ts` (o `use` é exigência do
`react-hooks/rules-of-hooks`, não gosto); a lógica testável — leitor de SSE,
redutor, transporte — está em `lib/agente-professor/`, porque o Vitest do hub só
varre `lib/**`.

- **"Parar" aborta**: a resposta fica `pronta` com o que chegou, marcada
  "Resposta interrompida.".
- **Fechar o painel NÃO aborta** (decisão do dono do produto): o `ChatPanel`
  fica montado com `hidden`, o turno segue, e a resposta que termina com o
  painel fechado acende o `badge` do botão. A quota é debitada no abort também —
  abortar no fechar seria cobrar e jogar fora. O contrato fala em "fechar
  aborta a cadeia": vale para a ABA (o `request.signal` repassado), não para o
  painel.
- **Trocar de conversa ou começar outra aborta e DESCARTA** (`descartarTurno`):
  sem descartar, um evento atrasado da conversa antiga cairia na nova.
- **Desmontar aborta.** O layout monta o chat com `key` na escola ativa
  (ADR-85): trocar de escola remonta, e o turno da escola de antes morre junto.

## O caminho até a api

- **O turno NÃO passa pelo BFF genérico.** Ele vai por
  `app/api/plataforma/agente-professor/conversas/[id]/mensagens/route.ts`, rota
  estática que vence o catch-all: o BFF tem teto de 180 s e devolve o corpo sem
  os cabeçalhos de stream. O teto do turno é **250 s** (a api corta em 240 com o
  evento `erro`; o Cloud Run do hub, em 300). Sessão, token curto e cabeçalhos
  são os MESMOS do BFF — `lib/bff.ts`, usado pelas duas rotas; não copie.
- **`cache-control: no-transform` é o que desliga a compressão** do servidor do
  Next para esta resposta (o `compression` que ele usa pula `no-transform`);
  sem ele o texto chega todo de uma vez no fim. Não ponha `compress: false` no
  hub inteiro por causa disto.
- Listar, criar, ler e apagar vão pelo BFF (`agente-professor` na allowlist).
  **Prefixo novo no BFF exige reiniciar o hub em dev** — o `next dev` segue com
  o route handler velho e responde 404 "rota não permitida" (README da e2e).
- Recusa ANTES do stream é JSON com status (400, 403, 404, 429, 503) e vira o
  estado `erro` da resposta, com a frase de `lib/agente-professor/transporte.ts`.
  `QUOTA` nunca oferece "Tentar de novo".

## Markdown: HTML cru vira TEXTO, não some

`skipHtml={false}` é de PROPÓSITO: sem `rehype-raw`, o react-markdown troca o
HTML cru por texto escapado; com `skipHtml` ele APAGARIA o trecho — e a resposta
a "como explico a tag `<p>`?" perderia o assunto. Links só `http`/`https`/
`mailto` absolutos (`lib/agente-professor/markdown-seguro.ts#urlSegura`, pelo
`URL` do navegador, não por regex), em nova guia com `noopener noreferrer`;
imagem vira o texto alternativo; tabela vai para o `RichContentTable`. Nunca
`dangerouslySetInnerHTML`. O teste (`lib/agente-professor/markdown.test.ts`)
cobra `<script>`, `javascript:`, `data:` e o markdown pela metade.

## Privacidade e preferência

- **`data-clarity-mask="true"` no painel INTEIRO** — o atributo que o Clarity
  respeita. O aviso "Não escreva nomes de estudantes." fica fixo junto do campo,
  mas aviso não é trava.
- **`localStorage` guarda só o tamanho** (`compacto`/`expandido`), lido depois
  de montar (no servidor não existe) e em `try/catch`. Conversa, título e texto
  nunca vão para lá.
- O botão carrega `data-agente-professor`: é o gancho da folga embaixo do `main`
  em janela estreita (`packages/ui/styles/plataforma.css`), para o botão não
  cobrir o fim da página nem das telas `.tela-cheia`.

Suíte: `node scripts/e2e/rodar.mjs professor/12`, com a api em
`AGENTE_PROFESSOR_MODO=mock`.
