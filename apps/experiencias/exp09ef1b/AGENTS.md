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
| `src/app/clone/` | SÓ `@edu/ui/ds-unooriaai` | o cromo do workspace, a thread (`ChatBubble`), o composer e as sugestões (`PromptSuggestion`), os cartões da abertura (`AssistantCard`), os chips de anexo (`Tag`) e o modal de metadados (`Modal`), as pílulas dirigidas, os botões do app |
| `src/app/mecanica/` | SÓ `@edu/ui/ds` | Amara (`SpeechBubble`), o painel de deliberação e o ranking (`Card`, `PuzzleBlock`), o OCR (`ProgressBar`), a tabela de confronto (`Table`), a revisão do voto, a espera (`AlertBox`), os conceitos, o Editor de Protocolo (`PuzzleTrack` de uma vaga por verificação) e o fim |
| `src/app/telas/` | NENHUMA | compõe as duas |

`src/contrato.test.ts` cobra a separação. Tokens: `--uai-*` no clone,
`--unooria-*` na mecânica (`estilos/globals.css`, seções separadas).

## O que não é óbvio

- **O passo é do servidor** (`abertura → conversa → espera1 → revelacao →
  espera2 → explicar → concluida`). O polling de 3 s só corre nas esperas (as
  travas do professor) e sem pacote no ar.
- **Arrastar é o gesto do PO**, com a mesma ação em botões (Subir/Descer,
  Mover para Lixeira) e no toque (toca o bloco, toca a vaga). (b) COMPENSAÇÃO —
  sem par no DS: o arrasto nativo em volta do `PuzzleBlock` (pedido:
  `draggable` no PuzzleBlock); e o `Card` da `unooria` sem o `max-width` de
  celular dentro da coluna do chat.
- **O ranking da E3 nasce na ordem do servidor** (embaralhada por sessão) e o
  "Registrar Decisão" só acende com o projeto marcado e o ranking tocado. No 2º
  voto o ranking vem com a ordem da E3 e mexer é opcional.
- **O Editor de Protocolo abre limpo** (sem demonstração nem dica de descarte)
  e o "Enviar Proposta" acende com ≥ 1 bloco — sem trava no cliente; a régua é
  do servidor (correção do PO de 29/10). O banco desce embaralhado.
- **O gabarito não desce** (`contrato.test.ts`): o certo do protocolo, a régua
  e os cadernos antes da digitalização são da api.
- **O OCR são 2 s** (0,8 + 1,2) na tela; o servidor grava ao fim.
- **A IA da aula** (o classificador do chat) corre no servidor contra 5 s; a
  tela usa o timeout padrão do SDK.
- **A versão vive em três lugares** (`versao.test.ts`).
