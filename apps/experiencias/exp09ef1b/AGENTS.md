# apps/experiencias/exp09ef1b — O Dossiê Invisível (9º ano EF, unidade 1)

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`.

| Manifesto | Dev | DS | api | e2e |
|---|---|---|---|---|
| `exp09ef1b` · 9EF · unidade 1 · `entre-redes` · `telemetria, progresso, ia, avaliacao` · SEM `viewport` (desktop 1024×768) | `:5191` (`strictPort`), hub `/exp/exp09ef1b` ou `/dev-embed?src=http://localhost:5191` | DS HÍBRIDO (ADR-202): `@edu/ui/ds-unooriaai` (o clone) + `@edu/ui/ds` (a mecânica) | `apps/api/src/dossie-invisivel` ↔ `/dossie-invisivel/*` | `scripts/e2e/estudante/19-dossie-invisivel.mjs` |

O estudante é o Conselheiro Relator no UnooriaAI do Conselho Municipal de
Apoio Social: conversa com o assistente sobre três projetos que disputam R$
12.000 indivisíveis, registra a escolha inicial com o ranking de critérios,
vê os cadernos do projeto em papel serem digitalizados e a recomendação se
inverter com os mesmos critérios, revisa a decisão depois do debate, lê Amara
e monta o protocolo do assistente, que conclui. **Fora desta versão** (decisão
do Lucas, 2026-10-29): a Etapa 6 (Lia, Davi, transporte) e o Canal B.

## O DS híbrido: a separação é POR PASTA (como a exp03ef1b)

| Pasta | Ponte | O que mora lá |
|---|---|---|
| `src/app/clone/` | SÓ `@edu/ui/ds-unooriaai` | o cromo do workspace, a thread (`ChatBubble` e o `TypingIndicator`), o composer e as sugestões (`PromptSuggestion`), os cartões da abertura (`AssistantCard`), os chips de anexo (`Tag`) e o modal de metadados (`Modal`), as pílulas dirigidas, os botões do app |
| `src/app/mecanica/` | SÓ `@edu/ui/ds` | Amara (`SpeechBubble`), o painel de deliberação e o ranking (`Card`, `PuzzleTrack` + `PuzzleBlock` arrastáveis), o OCR (`ProgressBar`), a tabela de confronto (`Table`), a revisão do voto, a espera (`AlertBox`), os conceitos, o Editor de Protocolo (`PuzzleTrack` de uma vaga por verificação) e o fim |
| `src/app/telas/` | NENHUMA | compõe as duas |

`src/contrato.test.ts` cobra a separação. Tokens: `--uai-*` no clone,
`--unooria-*` na mecânica (`estilos/globals.css`, seções separadas).

## O que não é óbvio

- **O passo é do servidor** (`abertura → conversa → espera1 → revelacao →
  espera2 → explicar → concluida`). O polling de 3 s só corre nas esperas (as
  travas do professor) e sem pacote no ar.
- **Arrastar é o gesto do PO, e é do DS desde a 0.2.26**: `dragData` no
  `PuzzleBlock` e `onSlotDrop` na `PuzzleTrack` (o ranking é uma calha de três
  vagas; o banco, as três verificações e o descarte são calhas que recebem).
  A mesma ação existe em botões (Subir/Descer, Mover para Lixeira) e no toque
  (toca o bloco, toca a vaga). (b) COMPENSAÇÕES — sem par no DS, todas em
  `estilos/globals.css` e todas de grade (ADR-205): o `Card` da `unooria` sem
  o `max-width` de celular na coluna do chat; o ranking com as vagas
  EMPILHADAS (a `PuzzleTrack` põe três lado a lado a partir de 672 px, e o
  bloco do ranking virava uma letra por linha); a descrição do
  `AssistantCard` e o `Tag` dos projetos em várias linhas (o DS corta com
  reticências). O protótipo (`design/08-prototipo.html`) é a régua visual.
- **O ranking da E3 nasce na ordem do servidor** (embaralhada por sessão) e o
  "Registrar Decisão" só acende com o projeto marcado e o ranking tocado —
  mover OU "Confirmar esta ordem" (ADR-205: concordar com a ordem sorteada é
  um gesto, nunca um subir-e-descer de mentira; tirar a trava deixaria o
  sorteio decidir a régua da EF09CO08). No 2º
  voto o ranking vem com a ordem da E3 e mexer é opcional.
- **O Editor de Protocolo abre limpo** (sem demonstração nem dica de descarte)
  e o "Enviar Proposta" acende com ≥ 1 bloco — sem trava no cliente; a régua é
  do servidor (correção do PO de 29/10). O banco desce embaralhado.
- **O gabarito não desce** (`contrato.test.ts`): o certo do protocolo, a régua
  e os cadernos antes da digitalização são da api.
- **As falas do assistente entram uma de cada vez** (ADR-206, ajuste do PO de
  30/10), com o `TypingIndicator` do `unooriaai` (DS 0.2.27) antes de cada uma
  (`lib/falas.ts`, 0,6 a 1,5 s pelo tamanho). A memória do que já foi visto é do
  MÓDULO, semeada pelo `App` com a sessão do handshake: o F5 mostra o histórico
  inteiro, e a tela que remonta ao trocar de passo não anima de novo. A tabela,
  as pílulas e os botões esperam a última fala. Com a oferta aberta,
  "Digitalizar cadernos" vem ANTES de "Ver Projetos", no rodapé.
- **Os textos são curtos de propósito** (ADR-206): o nome do projeto entra
  sempre como "o projeto {nome}" — o tema gerado por IA traz nomes femininos,
  e "do {papel}" virou "do Rede Crítica". As três âncoras da E5 (contraste,
  parecer inicial, inversão) continuam falas SEPARADAS.
- **O OCR são 2 s** (0,8 + 1,2) na tela; o servidor grava ao fim.
- **A IA da aula** (o classificador do chat) corre no servidor contra 5 s; a
  tela usa o timeout padrão do SDK.
- **A versão vive em três lugares** (`versao.test.ts`).
