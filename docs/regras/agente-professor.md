---
paths:
  - "apps/agente-professor/**"
  - "apps/api/src/agente-professor/**"
  - "apps/api/src/ai/agent-engine*"
  - "apps/hub/components/agente-professor/**"
  - "apps/hub/app/api/plataforma/agente-professor/**"
---

# O agente de IA do professor — o contrato entre as quatro pontas

Regra transversal: o agente (`apps/agente-professor`, Python/ADK no Vertex AI
Agent Engine), a api (`src/agente-professor` + `src/ai/agent-engine.client.ts`),
o hub (o chat flutuante) e a infra (repo de fundação). Complementa o
`AGENTS.md` da raiz, que vence em conflito. **É "agente de IA do professor",
não "guia", "assistente" nem "chatbot"** — em rótulo, slug e texto.

## Quem fala com quem (e quem nunca fala)

```
navegador ──fetch POST + leitura do stream──▶ hub /api/plataforma/agente-professor/**
hub ──token curto (o mesmo do BFF)──▶ api /agente-professor/**
api ──ADC da SA da api──▶ Agent Engine  (:query | :streamQuery?alt=sse)
agente ──SA do agente──▶ Gemini (global → us) e dois data stores (global)
```

- **O navegador nunca fala com o Agent Engine nem com o data store.** A api é
  a única porta: papel, disponibilidade, rate limit, quota e posse da conversa
  moram nela (regras 2 e 5 da raiz).
- **Só `professor`.** `@Roles("professor")`, e o chat só é montado no layout de
  `/professor`. Coordenação ficou fora por decisão do dono do produto.
- **Só a api conhece o Agent Engine**: `src/ai/agent-engine.client.ts`. O
  resto da api fala com a interface `AgenteProfessorPort`.

## Identidade e posse

- `user_id` no Agent Engine = `users.id` (UUID) do usuário da api — nunca um
  valor vindo do cliente.
- **A posse mora no Postgres**: `agente_professor_conversas (id, escola_id,
  usuario_id, sessao_id, titulo, criada_em, atualizada_em)`, com RLS por
  `escola_id`. Os endpoints de sessão do Agent Engine por nome de recurso NÃO
  conferem o usuário, e a SA da api enxerga todas as sessões do engine; a
  checagem do ADK (≥ 2.2, "does not belong to user") é defesa em profundidade.
  Toda rota confere `usuario_id` E `escola_id` antes de tocar a sessão.
- A conversa pertence a (professor, escola ativa): trocar de escola troca a
  lista.
- **Histórico sem limite, com exclusão.** A sessão nasce com `expire_time`
  distante; toda mensagem nova renova. Apagar = `async_delete_session` + apagar
  a linha, e a rota de apagar escapa do interruptor (`@SemDisponibilidade`).

## O estado da sessão — as chaves são contrato

| Chave | Quem escreve | Quem lê |
|---|---|---|
| `nome_professor` | api, na criação (primeiro nome de `users.display_name`) | a instrução do agente (`{nome_professor?}`) |
| `titulo_conversa` | **o agente**, com o próprio LLM, depois do 1º turno | a api (espelha em `titulo`) e o hub (título da conversa) |

A api capta `titulo_conversa` no `actions.state_delta` do stream; se o stream
terminar sem ele, lê a sessão (`async_get_session`) e espelha. A coluna
`titulo` é CACHE do estado, não fonte.

## Ferramentas do agente — só data store, e nunca `VertexAiSearchTool`

| Ferramenta | Data store | Uso |
|---|---|---|
| `buscar_habilidades` | `agente-professor-habilidades` (ESTRUTURADO, 1 doc por habilidade) | query vazia + filtro exato (`codigo`, `anos`, `componente_slug`, `etapa`), paginando até o fim; com `texto`, busca semântica sob o mesmo filtro |
| `buscar_acervo` | `agente-professor-acervo` (PDFs, chunking por layout) | trechos com `pageSpan`, filtro por `tipo` (`bncc_documento` / `livro_didatico`), `componente_slug`, `anos` |

`VertexAiSearchTool` tem teto de 10 resultados, não pagina e — com outra
ferramenta no agente — é trocado em silêncio por um substituto que descarta a
página. "Todas as habilidades de Matemática do 6º ano" que volta com 10 é um
plano que descumpre o currículo. Os dois data stores são SEPARADOS: uma engine
com data store estruturado é forçada a `DOCUMENTS` e perde os trechos.

**Escopo fechado**: só BNCC e o acervo da Unooria. Pergunta fora disso recebe
recusa educada pelo nome, sem chamar o modelo principal. Resposta sobre
habilidade sem ter chamado `buscar_habilidades` é defeito.

## O stream — eventos que a api emite ao navegador (SSE)

`POST /agente-professor/conversas/:id/mensagens` `{ texto }` responde
`text/event-stream`:

| `event:` | `data:` |
|---|---|
| `delta` | `{ "texto": "<pedaço>" }` — dos eventos `partial=true` do ADK, e do final agregado SÓ no que os parciais não cobriram (a recusa de escopo chega num evento final sem parcial nenhum antes, com `custom_metadata.fora_do_escopo=true`) |
| `fontes` | `{ "fontes": [{ "titulo", "paginaInicio", "paginaFim" }] }` — dos retornos de `buscar_acervo` |
| `titulo` | `{ "titulo": "<titulo_conversa>" }` |
| `aviso` | `{ "codigo": "habilidade-inexistente", "mensagem": "…" }` — conferência dos códigos citados, no fim |
| `fim` | `{}` |
| `erro` | `{ "codigo": "QUOTA" \| "RATE_LIMIT" \| "AGENTE_INDISPONIVEL" \| "TEMPO_ESGOTADO", "mensagem": "…" }` |

Mais `: ping` a cada 15 s. Três armadilhas que já estão medidas:

- **O ADK em modo SSE emite os parciais E um evento final agregado que REPETE
  o texto inteiro.** Repassar os dois duplica a resposta na tela.
- **`:streamQuery?alt=sse` pode responder `application/json` com linhas
  `data: {...}`, ou NDJSON puro** (issue aberta no python-aiplatform). O parser
  aceita os dois.
- **Tokens só dos eventos NÃO parciais** (`usage_metadata.total_token_count`),
  somados — um turno com ferramenta faz mais de uma chamada ao modelo.
  `temSaldo` antes, `consumir` num `finally` (o professor pode fechar o painel).

Teto do stream: 240 s na api, 250 s na rota do hub (o Cloud Run do hub corta
em 300 s). **Fechar a ABA, "Parar", trocar de conversa ou de escola aborta a
cadeia até o Vertex** (`request.signal` repassado em cada salto). **Fechar o
PAINEL não aborta**: ele só se esconde, a resposta continua chegando e o selo
do botão avisa — o professor que fecha para olhar a tela de baixo não perde a
resposta que já pagou.

## O markdown vira HTML no NAVEGADOR

Exceção declarada ao precedente de `planos` (que converte na api): com stream,
o texto chega em pedaços. `react-markdown` + `remark-gfm`, **HTML cru
desligado**, links só `http`/`https` com `rel="noopener noreferrer"`. Nunca
`dangerouslySetInnerHTML`. O painel leva `data-clarity-mask`: o professor pode
escrever o nome de um estudante, e o Clarity grava a tela.

## Recursos na GCP (Terraform no repo de fundação)

| Recurso | Nome |
|---|---|
| Bucket | `${project_id}-agente-professor` — pastas `bncc/`, `livros/`, `habilidades/`, `metadados/`, `import-erros/` |
| Data stores (`global`) | `agente-professor-habilidades`, `agente-professor-acervo` |
| Agent Engine | `us-east1` em dev e hml; produção a decidir. Nasce só quando o CI publicou a imagem (`count` sobre `agente_professor_imagem`) |
| SA do agente | `${prefix}-agente` (o id de SA tem teto de 30 caracteres): `aiplatform.user` + `discoveryengine.viewer` |
| SA da api | papel custom no engine: `reasoningEngines.get/query` + `sessions.get/update` (a renovação do `expireTime`) |
| Cloud Armor | exclusão da 921150 (CR/LF) em `/agente-professor/` e `/api/plataforma/agente-professor/` |

Envs da api: `AGENTE_PROFESSOR_MODO` (`agent-engine` \| `local` \| `mock` \|
`desligado`; **ausente = `desligado`**, e `mock`/`local` são recusados em
produção), `AGENTE_PROFESSOR_ENGINE` (resource name completo),
`AGENTE_PROFESSOR_URL_LOCAL`. O Terraform põe `desligado` enquanto o engine não
existe: a api sobe e o chat responde `AGENTE_INDISPONIVEL`, em vez de derrubar
todos os produtos por falta de um.
O modo `local` fala com o shim de `apps/agente-professor`, que expõe O MESMO
contrato do Agent Engine (`/api/reasoning_engine`, `/api/stream_reasoning_engine`)
— um cliente só na api. `mock` é o da suíte e2e.

## Produto

`agente-professor` em `PRODUTOS` (`src/recursos/catalogo.ts`, o CHECK da
migração, `RecursosEfetivosSchema`, `apps/hub/lib/produtos.ts`), **sem card** na
home: a superfície é o botão flutuante, que não é montado com o produto
desligado. A guarda da api é por PRODUTO (não há experiência): `@Produto(...)`.
