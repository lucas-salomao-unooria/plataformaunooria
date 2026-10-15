# apps/api/src/ajuda — a Ajuda: o avatar (ADR-132) e o mascote (ADR-158)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

O atendente em vídeo do menu "Ajuda" do hub, para todo papel menos o
estudante. **FULL Mode + Custom LLM do LiveAvatar (HeyGen)**: o vendor faz a
escuta, a voz e o vídeo; o LLM é o NOSSO — o vendor chama
`POST /ajuda/llm/chat/completions` desta api, que responde pelo `AiProvider`
(Gemini) com a base de conhecimento no prompt. O cliente do vendor é
`src/ai/liveavatar.client.ts` (a porta `AVATAR_AO_VIVO`); este módulo não
conhece o vendor.

**Dois atendentes desde a ADR-158**: o avatar acima e o MASCOTE da Unooria
(seção própria, embaixo). Quem abre é o padrão da rede em `ajuda_configuracao`
(`atendenteEfetivo`: o pedido da pessoa só se a troca é permitida; o escolhido
fora do ar cede ao outro). Os minutos (`ajuda_limites`) valem para os dois.

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

## Nasce DESLIGADA (teste interno)

O produto `ajuda` está em `PRODUTOS_DESLIGADOS_POR_PADRAO` (`recursos/catalogo.ts`):
sem linha em `disponibilidades`, ele fica fora do ar e o item some do menu. O
`admin` liga no painel da Unooria (escola ou rede). Lançar é tirar da lista.

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

## O mascote (ADR-158): Gemini Live por um proxy WebSocket NESTA api

O rosto é do hub (three.js + lip sync por áudio); a voz é o Gemini Live na
Vertex, pela porta `VOZ_AO_VIVO` (`src/ai/gemini-live.client.ts`, ADC). O
navegador fala com `WS /ajuda/mascote/ao-vivo` (`mascote-ao-vivo.ts`, `ws`
pendurado no servidor HTTP do Nest — não há `@nestjs/websockets`).

- **A instrução do sistema é montada AQUI** (`promptDoAtendente(perfil,
  "mascote")`, a mesma base com outra apresentação). O navegador manda só
  `MensagemDoNavegadorSchema` (`.strict()`): `entrar`, `texto` (500),
  `audio` (base64 de 100 ms de PCM 16 kHz) e `fim-do-audio`. Um `setup` vindo
  do navegador fecha a conexão com 4429 — é o teste que prova a regra 2.
- **O bilhete vai na PRIMEIRA mensagem, nunca na URL** (log de balanceador).
  HS256 com `AJUDA_SESSAO_CHAVE`, audiência `ajuda-mascote` — o token do LLM
  do avatar (`ajuda-llm`) não abre esta porta, nem o contrário. Vale 2 min
  para ENTRAR e entra UMA vez: `entrarNoMascote` marca
  `avatar_sessao_id = 'ao-vivo:<uuid>'` com `updateMany` condicionado à coluna
  nula. Por isso `pararNoVendor` ignora esse prefixo.
- **O `Origin` é conferido contra `config/origens.ts`** (a mesma lista do
  CORS, que não alcança WebSocket). Origem nova do hub = `CORS_ORIGINS`.
- **Teto**: a conexão cai no prazo da sessão (início + teto), e a cada 30 s
  confere a linha (`sessaoValida`) e o produto (`produtoLigado`). Encerrar em
  outra aba ou desligar a Ajuda derruba a conversa no ar.
- **Fechamentos** (`FECHAMENTOS_DO_MASCOTE`, espelhados em
  `apps/hub/lib/ajuda/mascote/conexao.ts`): 4401 bilhete, 4403 produto
  desligado, 4408 tempo, 4429 abuso/ritmo (30 msg/s), 4502 vendor, 4503
  indisponível. O motivo do vendor vai só ao log.
- **Log**: `ajuda.mascote` (sid, perfil, duracaoMs, turnos, motivo) — nunca o
  que foi dito. A voz não passa pelo `MedidorDeProvider` (não é `AiProvider`).
- **Medido em 2026-10-12** (dev, ADC): `gemini-3.8-live` em `us-central1`
  (`AJUDA_MASCOTE_REGIAO`; o `global` do texto não serve o Live), base inteira
  na instrução: setup 2,5 s, primeira fala 1,2 s; pelo proxy, 3 s até `pronto`.
  Na Vertex o texto vai em `realtimeInput.text` e o modelo com o caminho
  `projects/.../publishers/google/models/...`.
- **O modelo 3D** (`CAMINHO_DO_MODELO_DO_MASCOTE`, `ajuda/mascote/mascote-v1.glb`)
  mora no bucket de assets; `GET /ajuda/configuracao` devolve a URL. Em dev,
  copie o GLB para `apps/api/storage/ajuda/mascote/` (gitignorado). Mascote
  novo = `-v2` e trocar a constante: o caminho publicado é imutável.
- **A configuração** (`ajuda_configuracao`, linha única) é escrita só por
  `recursos/configuracao-da-ajuda.controller.ts` (`admin`, motivo obrigatório,
  `configuracao-alterada` no histórico). Voz é lista fechada
  (`VOZES_DO_MASCOTE`); o CHECK do banco cobra o formato da voz e do modelo.

## As instruções no painel (ADR-165)

`ajuda_configuracao.instrucoes_mascote` / `instrucoes_avatar`: o "como
responder" de cada atendente, editado pelo `admin` em `/unooria/uso-de-ia`. NULO =
`instrucoesPadrao(atendente)` de `prompt.ts`; texto igual ao padrão é gravado
NULO (a melhoria do código chega a quem nunca personalizou). **Só essa parte é
editável**: `prefixoDoPrompt` acrescenta SEMPRE `CONHECIMENTO` + a base gerada,
e `promptDoAtendente`, quem está falando — uma edição não tira a base. O avatar
relê a configuração a cada turno (`responder`); o mascote, a cada sessão
(`abrirVozDoMascote`). O texto nunca sai da api (regra 2): o hub do admin o lê
pela rota de `recursos`, só `admin`.

