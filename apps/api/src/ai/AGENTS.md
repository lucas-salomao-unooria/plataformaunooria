# apps/api/src/ai — o provider de IA

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito. **Nenhuma
chamada a provedor de IA acontece fora desta pasta.**

## A quota diária é DADO, não env (ADR-105, 2026-09-15)

`QuotaService.limite(perfil)` lê `ia_quotas` a cada `temSaldo` — uma linha por
perfil (`PERFIS_COM_QUOTA = ["estudante", "professor"]`, CHECK espelhando a
tupla), escopo do contrato, **sem cache** de propósito: a tela promete "vale na
próxima chamada", e com `min-instances: 3` um cache faria cada instância mudar
em hora diferente. Todo perfil que não é `estudante` cai em `professor`
(`perfilDaQuota`), que é o que já valia com as envs.

- **`AI_DAILY_TOKEN_QUOTA_PER_*` não existe mais.** Não a recrie como fallback:
  seria a segunda fonte de verdade, e a tela diria uma coisa enquanto o processo
  aplica outra. Sem linha, vale `QUOTA_PADRAO` e sai `codigo: "ia-quota-sem-linha"`
  (um aviso por perfil por processo) — falhar fechado derrubaria toda a IA de
  uma stack antes da migration.
- **Quem escreve a linha é o módulo `recursos`** (`quotas-de-ia.controller.ts`,
  `@Roles("admin")`), não este: `src/ai` não conhece papel de tela (ADR-23). O
  histórico da mudança vai para `recursos_auditoria` (`quota-alterada`).
- **Teste que precisa de teto apertado usa SUBCLASSE** (`override limite()`),
  como `planos.spec.ts` e `quotas-de-ia-postgres.spec.ts` fazem. Escrever um
  valor baixo em `ia_quotas` recusaria a IA de toda suíte que rodasse junto — é
  tabela de contrato, sem `escola_id`.
- **Perfil novo com IA** (gestor, admin) entra em TRÊS lugares no mesmo commit:
  a tupla, o CHECK da migration e a semente. Um só é o modo de falhar mudo.
- Continuam FORA do funil, e são cartão à parte: o motor da exp08ef1b (`geracao/`)
  e as reações ao vivo dele (`motor/runs.controller.ts`), já apontados na
  ADR-74. Quota configurável só vale para quem chama `temSaldo`.

## Provider de IA (`apps/api/src/ai/provider.ts`)
Interface única `AiProvider` (`generate`, `generateJson`, `conversar`,
`generateImage`, `generateSpeech`). Implementações: `vertex.provider.ts`
(default), `mock.provider.ts` (testes); `medidor.provider.ts` é o decorator que
mede latência e tokens e embrulha o real na factory do `AiModule`. Para trocar de
provedor, cria-se novo arquivo — nada fora de `src/ai` conhece o vendor.

**O mock falha FECHADO em `generateJson` e `generateImage`** (lançam sempre) e
NÃO falha em `conversar` — conversa não tem fallback autorado, e falhar ali
deixaria a exp02em1b sem abrir em dev. Quem chama `generateJson` precisa decidir o
que fazer com isso: reações ao vivo caem em lista vazia, geração de posts vira
job falho que o painel mostra, e **`/destilar` devolve 503 com a causa** (ADR-52)
— sem esse tratamento, em `AI_PROVIDER=mock` criar atividade responderia 500
opaco. Consumidor novo de `generateJson` decide isso explicitamente.
`AiRequest.modelo: "padrao" | "longo"` escolhe a família (o `longo` mapeia para
`VERTEX_MODEL_LONGO`, hoje o mesmo modelo do `padrao`; existe para saída longa —
planos anuais); quem gera texto longo checa `AiResult.finishReason` (`MAX_TOKENS` = conteúdo cortado, é erro).

**Credencial: ADC, nunca chave de API.** O provider pega o token com
`google-auth-library`, que resolve na mesma ordem nos três ambientes:
`GOOGLE_APPLICATION_CREDENTIALS` → arquivo do `gcloud auth application-default
login` → metadata server (Cloud Run). Só o metadata server não serviria: fora do
Cloud Run — no host e no container, onde `metadata.google.internal` não
resolve — nenhuma chamada de IA funcionaria, a api ficaria presa no
`AI_PROVIDER=mock` em dev e a app-90 devolveria um plano falso. Os dois compose montam
o ADC do host em `/adc` (só leitura); em Cloud Run a service account do serviço
já é a credencial, e ela precisa de `roles/aiplatform.user`.

**Modelo × região.** O modelo é `gemini-3.6-flash` e a localização é `global` —
para texto E para o plano de aula. Medido no projeto do contrato: o 3.6-flash dá
404 em `southamerica-east1`, `us-east1` e `us-central1`; só o endpoint `global`
(sem host regional) o serve. A consequência é explícita e aceita: o tráfego de
IA sai de São Paulo, inclusive o do estudante. Voltar para
`VERTEX_LOCATION=southamerica-east1` é possível a qualquer momento, mas exige
trocar TAMBÉM o modelo pelo que a região publica (família 2.5 — a 2.0 saiu do
catálogo e a 3.x nunca esteve lá). A arte da exp08ef1b usa `gemini-3.1-flash-image`
(o `gemini-2.0-flash-exp` não existe mais em lugar nenhum: usá-lo faz toda
geração de imagem cair no fallback procedural), e PEDE a proporção
`4:5` no `imageConfig`: sem isso o 3.1 devolve 1408×768 e o `cover` do
`AssetsService` (1080×1350) descarta mais da metade da largura. O modelo aceita
1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9 e 21:9 pelo MESMO custo em tokens —
experiência com outro formato deve pedir o formato, não recortar depois.

**Raciocínio conta como saída.** Nos modelos 2.5 e 3.x os tokens de pensamento saem do
`maxOutputTokens`: com pensamento livre o plano anual volta VAZIO com
`finishReason: MAX_TOKENS`. `VERTEX_THINKING_BUDGET` (default `0`, desligado)
evita isso; `-1` volta ao dinâmico.

**Voz (`generateSpeech`) não é o aiplatform** — é a **Cloud Text-to-Speech**
(`texttospeech.googleapis.com/v1/text:synthesize`), com os mesmos modelos Gemini
por trás e o MESMO ADC, mas host, caminho e corpo próprios (por isso não passa
por `endpointVertex`). `VERTEX_TTS_MODEL`, default `gemini-2.5-flash-tts`. Saída
em **MP3**, decidida na origem: não há ffmpeg neste repositório, e um WAV de
3m30 passaria de 10 MB.

Três coisas que custaram tempo e não se descobrem por typecheck:
- **A API precisa estar habilitada** (`gcloud services enable
  texttospeech.googleapis.com`), e sem isso a resposta é 403.
- **Com ADC de USUÁRIO ela exige um "quota project"**, que a credencial de quem
  fez `gcloud auth application-default login` não carrega — e o aiplatform NÃO
  exige. O sintoma engana: no mesmo preparo, imagem funciona e voz responde 403
  `PERMISSION_DENIED`, com uma mensagem que não fala de voz. O provider manda
  `x-goog-user-project: $VERTEX_PROJECT_ID` para resolver sem mexer no ADC de
  ninguém; em Cloud Run a SA já traz o projeto.
- **Os tetos são em BYTES** (4.000 para o texto, 4.000 para a direção de
  atuação): em pt-BR cada acento conta 2, e medir por `length` deixa passar um
  roteiro que a API recusa com 400. `generateSpeech` valida antes de chamar.

**Diálogo é UMA chamada**, com `turnos` e `multiSpeakerMarkup`: o modelo ajusta
pausa e entonação entre as vozes. Sintetizar cada fala à parte e concatenar
devolveria duas leituras em voz alta, não uma conversa — e a concatenação exigiria
o ffmpeg que não existe aqui. `AiTimbre` é neutro de vendor (`jovem-feminino`,
`idoso-feminino`…) pelo mesmo motivo de `AiRequest.modelo`: quem escreve o
roteiro descreve QUEM fala, não o nome de catálogo de uma voz do Google. O mapa
timbre → voz é a única tradução, e vive no `vertex.provider.ts`.

**O mock falha fechado em `generateSpeech`**, como em `generateJson` e
`generateImage`: um MP3 de silêncio seria pior que a ausência (o estudante
apertaria o play e concluiria que o áudio quebrou). Quem chama cai na
transcrição, que já está na tela por acessibilidade.

## O fluxo (`conversarEmFluxo`) e o terceiro vendor: o avatar da Ajuda (ADR-132)

- **`conversarEmFluxo` é a única geração em stream do `AiProvider`**:
  `streamGenerateContent?alt=sse`, sem ferramentas e sem `validar` (num stream o
  texto já saiu quando a validação poderia recusá-lo). Existe porque o avatar da
  Ajuda pede `stream: true` e desiste se o primeiro byte passar de 10 s. Os
  tokens saem do ÚLTIMO pedaço (`usageMetadata` acumulado — o maior, não a soma).
  Consumidor novo que queira stream pede ADR: é a segunda rota com stream (ADR-128).
- **`avatar-ao-vivo.port.ts` + `liveavatar.client.ts`**: a porta do LiveAvatar
  (HeyGen). Só abre e fecha a sala de vídeo — não gera texto; o LLM do avatar é o
  nosso endpoint `/ajuda/llm`. Porta própria e não método do `AiProvider` porque
  é reserva de recurso cobrado por minuto, com ciclo de vida. **Sem o conjunto
  completo de envs a porta nasce `AvatarDesligado`** e a Ajuda responde 503 —
  nunca derruba a subida. O sandbox (`LIVEAVATAR_SANDBOX=1`) troca o avatar pelo
  de testes do vendor (~1 min, sem crédito) e é recusado em produção.

## A voz ao vivo: o mascote da Ajuda (ADR-158)

`voz-ao-vivo.port.ts` + `gemini-live.client.ts`: o Gemini Live da Vertex
(`BidiGenerateContent` por WebSocket), com o MESMO ADC. A porta fala um
protocolo NEUTRO (`EntradaDaVoz`/`EventoDaVoz`); o setup (modelo com o caminho
`projects/<p>/locations/<r>/...`, `generationConfig` com `responseModalities`
e `speechConfig`, `systemInstruction` como Content, as duas transcrições) é
montado aqui e conferido em `tests/ajuda-mascote.spec.ts`. Região própria
(`AJUDA_MASCOTE_REGIAO`, padrão `us-central1`): o Live não está no `global`.
Sem `VERTEX_PROJECT_ID` (ou com `AI_PROVIDER=mock`) a porta nasce desligada e
o mascote some da Ajuda. Não é método do `AiProvider` pela razão do avatar:
é uma sessão com ciclo de vida, não uma chamada.

## O segundo vendor: o Agent Engine (agente de IA do professor)

`agent-engine.client.ts` é a ÚNICA peça da api que conhece o Vertex AI Agent
Engine; o resto fala com `AgenteProfessorPort` (`agente-professor.port.ts`,
token `AGENTE_PROFESSOR`). Contrato das quatro pontas:
`docs/regras/agente-professor.md`. **Fica aqui, e não no módulo, pela mesma
regra do `AiProvider`**: nenhum vendor de IA fora de `src/ai`. É porta própria,
e não método no `AiProvider`, porque o modelo, as ferramentas e a instrução
moram NO AGENTE (Python/ADK); a api só conduz a sessão. Por isso o
`MedidorDeProvider` não o mede — a métrica dele é o log `agente-professor.turno`.

- **Um cliente, dois alvos**: `agent-engine` (`:query` / `:streamQuery?alt=sse`,
  ADC) e `local` (o shim, mesmo corpo, sem token). `mock` é o da suíte e2e
  (turno enlatado; os parciais trazem `tokens: 999` de propósito, para provar que
  não entram na soma). `desligado` é o PADRÃO, em qualquer `NODE_ENV` — ao
  contrário do `AI_PROVIDER`: o engine é provisionado por contrato em momentos
  diferentes, e derrubar a api inteira por falta dele tiraria todos os produtos
  do ar para proteger um. `mock`/`local` não sobem em produção (Zod).
- **`fetch` e `Agent` do MESMO pacote `undici`** (ver `vertex.provider.ts`).
- **O parser decide por LINHA, não pelo `content-type`**: NDJSON e `data:`
  convivem no mesmo corpo. Linha que não é JSON é contada e vira log, nunca
  derruba o turno.
- **Renovar a sessão exige a API NATIVA** (`PATCH v1beta1/.../sessions/{id}?updateMask=expireTime`):
  o `:query` do ADK não tem método de atualizar. Isso pede à SA da api mais que
  `reasoningEngines.query` — sem a permissão, a renovação falha em log
  (`agente-professor.renovacao-falhou`) e a sessão vive o `expire_time` da
  criação. `expire_time` vai pelos `**kwargs` do `async_create_session`; se o
  engine o recusar, a criação repete SEM ele (TTL padrão de 365 dias).
