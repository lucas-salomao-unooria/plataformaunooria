# apps/api/src/agente-professor — o agente de IA do professor

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito. **O contrato
das quatro pontas (eventos do SSE, chaves de estado, ferramentas, envs, GCP)
está em `docs/regras/agente-professor.md` — não o repita aqui.** O cliente do
Agent Engine é `src/ai/agent-engine.client.ts`; este módulo só fala com a
`AgenteProfessorPort`.

## A posse é do Postgres, e confere DOIS campos

- **Toda rota passa por `daPosse` (usuario_id E escola_id) antes de tocar a
  sessão.** O engine não confere o usuário numa sessão pedida por nome, e a SA da
  api enxerga todas. Sem a linha de `agente_professor_conversas`, quem soubesse
  um `sessao_id` leria a conversa de outro professor.
- **Outro dono = 404, nunca 403** (403 confirmaria que o id existe). Id que não
  é UUID também é 404 — sem 500 do Prisma, sem distinguir.
- **Sessão que sumiu do engine** (expirou) apaga a linha no `GET` e responde
  404: senão a lista carregaria uma conversa que não abre.
- `user_id` no engine é o `usuarioId` do TOKEN; `nome_professor` é o primeiro
  nome de `users.display_name`, lido do banco. Nada disso vem do corpo.

## O turno (SSE): o que quebra se você não souber

- **Tudo o que recusa responde JSON ANTES de abrir o stream** — corpo (400),
  posse (404), `RATE_LIMIT` (429, 10/min por professor), `QUOTA` (429). Aberto o
  `text/event-stream`, o status já foi 200; daí em diante só `erro`. O stream
  termina em `fim` OU em `erro`, nunca nos dois.
- **`res.on("close")`, não `req.on("close")`.** No Node ≥ 16 o `close` da
  REQUISIÇÃO dispara assim que o corpo foi lido — antes do stream — e abortaria
  todo turno. O da resposta com `!writableEnded` é o professor fechando o painel.
- **Nenhuma transação `comTenancy` aberta durante o stream**: posse antes,
  atualização depois, cada uma curta. Um turno dura dezenas de segundos.
- **`consumir` no `finally`, com a soma dos NÃO parciais** (`regras.ts#somarTokens`)
  — também no abort, no teto e no erro: o que o modelo gerou foi pago.
- **O dedupe é por segmento** (`DeduplicadorDeTexto`): o final agregado do ADK
  só passa o que os parciais não cobriram. Mudar isso duplica a resposta na tela.
- **Fontes, título, avisos e `fim` saem DEPOIS do último evento do agente**, nessa
  ordem. `titulo` só quando muda; sem `state_delta`, uma leitura da sessão.
- **Não logue texto** (pergunta, resposta, título, corpo de erro do engine):
  só ids, contagens, códigos, duração, tokens. A linha por turno é
  `agente-professor.turno` (com `resultado`: `fim` | `erro` | `abortado` | `tempo`).
- **O `ContratoInterceptor` não confere o SSE** (`@Res()` cru, `tipoDaResposta`
  `text/event-stream`). Quem confere cada `data:` é o teste, contra
  `DADOS_POR_EVENTO` de `contrato-de-rotas.ts` — evento novo entra lá.
- **Teto de 240 s aqui** exige o timeout do Cloud Run da api ≥ 240 s (Terraform).

## Contrato com o agente que este módulo assume

- **`buscar_acervo` devolve `{ "trechos": [{ "titulo", "pagina_inicio",
  "pagina_fim", … }] }`** — a forma do mock. A leitura é tolerante (`result`,
  `resultados`, `pageSpan`, camelCase), mas item sem título não vira fonte.
- **Tokens que não vêm no `usage_metadata` de um evento não são cobrados.** Se o
  agente gerar o `titulo_conversa` com uma chamada própria ao modelo, o uso dela
  precisa sair num evento — senão fica fora da quota.

## Apagar e o interruptor

- Classe com `@Produto("agente-professor")`; **o único escape é o `DELETE`**
  (`@SemDisponibilidade`). Engine fora do ar no apagar = 503 e a linha FICA:
  apagar só a linha deixaria a conversa guardada no engine, sem dono alcançável.
- **Modo `mock` para a e2e**: turno determinístico (`TEXTO_DO_MOCK`, uma fonte,
  título no 1º turno). Mensagem com `EF99ZZ99` faz o mock citá-lo e sair um
  `aviso` — é o gancho para a suíte provar a conferência de códigos.
