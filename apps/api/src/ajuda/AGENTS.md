# apps/api/src/ajuda — a Ajuda com avatar (ADR-132)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

O atendente em vídeo do menu "Ajuda" do hub, para todo papel menos o
estudante. **FULL Mode + Custom LLM do LiveAvatar (HeyGen)**: o vendor faz a
escuta, a voz e o vídeo; o LLM é o NOSSO — o vendor chama
`POST /ajuda/llm/chat/completions` desta api, que responde pelo `AiProvider`
(Gemini) com a base de conhecimento no prompt. O cliente do vendor é
`src/ai/liveavatar.client.ts` (a porta `AVATAR_AO_VIVO`); este módulo não
conhece o vendor.

## O que o vendor faz e a doc dele não diz (MEDIDO no spike, sandbox, 2026-10-02)

- O request ao nosso LLM é o do cliente OpenAI Python (`LiveKit Agents`):
  `Authorization: Bearer <segredo>`, `{ messages, model, stream: true,
  stream_options: { include_usage: true }, temperature: 0.5 }`. `messages[0]` é
  `system` = o prompt do CONTEXTO com as `dynamic_variables` já substituídas;
  depois vem o histórico inteiro, começando pelo `opening_text`.
- **Stream é obrigatório na prática**, e o primeiro byte tem 10 s
  (`x-stainless-read-timeout`). Daí o `conversarEmFluxo` no provider.
- **Erro do endpoint = avatar MUDO**: sem retry, sem evento para o navegador.
  Por isso, aceita a chamada, toda recusa de negócio (produto desligado, rate
  limit) e toda falha do modelo viram FALA, em 200. Só autenticação responde 401.
- Na abertura vem `GET {base_url}/models` (5 s); respondemos uma lista mínima.
- **O `gemini-3.7-flash` às vezes PENSA mesmo com `thinkingBudget: 0`** (~300–400
  tokens, medido em 2026-10-02), e o raciocínio sai do teto de saída: com 400 a
  resposta cortava em meia frase. Por isso o teto é 2.048 (a brevidade é do
  prompt). E a primeira chamada fria levou 10,9 s até o primeiro byte: sem
  pedaço em 7 s, sai `FALA_DE_ESPERA` e a resposta continua no mesmo turno.
- O segredo do LLM é `secret_type: OPENAI_API_KEY` no vendor (a skill da HeyGen
  diz `LLM_API_KEY`, que a api deles recusa).

## Identidade: o token da sessão viaja DENTRO do prompt

O vendor chama sem token de usuário. Ao abrir, a api assina um HS256 curto
(`token-da-sessao.ts`, `{ sub, escola, perfil, sid }`, vale o teto + 1 min) e o
entrega em `dynamic_variables.sessao`; o contexto do vendor tem só o marcador
`[sessao:${sessao}]`. O endpoint de LLM exige as DUAS trancas: o segredo do
cabeçalho (é o vendor) E o token no `system` (quem fala, e numa sessão que esta
api abriu e não fechou — `ajuda_sessoes.fim` nulo). Token na fala da pessoa não
vale: só o `system` é lido. **O prompt de verdade e a base nunca vão ao vendor**:
o `system` dele é descartado depois de lido.

## Custo: minutos, não tokens (exceção à regra 5)

Decisão do dono do produto: a Ajuda não passa pelo `QuotaService`. O que a
limita é o tempo de vídeo, que o vendor cobra (FULL = 2 créditos/min):
`ajuda_limites` (`minutos-por-dia`, `minutos-por-sessao`; semente 30/10, só o
`admin` edita em `/unooria/uso-de-ia`) e `ajuda_sessoes`, o medidor.

- **Sessão sem `fim` conta o teto INTEIRO** — falha para o lado do custo.
  Abrir fecha a anterior que ficou aberta; vendor fora do ar fecha a linha com
  duração zero.
- O dia é o do fuso da plataforma (`diaDaPlataforma`), não o UTC.
- `ajuda_sessoes` **sem `escola_id` NOT NULL e sem RLS**: `gestor_contrato` e
  `admin` não têm escola no token. Toda query é por `usuario_id` do TOKEN. Não é
  dado de estudante (CHECK do perfil) e não guarda conversa nenhuma.
- Os tokens continuam medidos pelo `MedidorDeProvider` (operação `conversarEmFluxo`).

## A base de conhecimento é GERADA

`base/base-da-ajuda.gerada.ts` sai de `scripts/gerar-base-da-ajuda.mjs`: mapa de
produto só com o que é PRONTO/PARCIAL, os guias da aula e os manifestos (~65 mil
tokens, inteira no prompt, sem RAG). **Nunca edite à mão.** Mudou o mapa de
produto ou um guia? Regere — `tests/ajuda-base.spec.ts` fica vermelho se não. O
gerador falha se a base vazar vocabulário técnico (`TERMOS_SENSIVEIS`): a
correção é no mapa, não na lista. O prefixo fixo do prompt (instruções + base)
vem ANTES do papel de quem pergunta, para o cache implícito do Gemini reaproveitar.

## O que não logar

Pergunta e resposta, nunca (a pessoa pode dizer o nome de um estudante em voz
alta). A linha por turno é `ajuda.turno` (`sid`, `perfil`, `resultado`,
`duracaoMs`, `tokens`, `caracteres`).

## Ambiente

A api precisa de URL PÚBLICA para o vendor alcançar o `/ajuda/llm`; em dev local
só com túnel. Os ids do vendor (contexto, configuração de LLM) saem de
`scripts/liveavatar-configurar.mjs`, um conjunto por contrato/ambiente. Sem o
conjunto completo de envs a Ajuda responde 503 — nunca derruba a subida.
