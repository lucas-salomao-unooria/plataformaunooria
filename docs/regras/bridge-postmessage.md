---
paths:
  - "packages/sdk/**/*.ts"
  - "apps/experiencias/**/*.{ts,tsx}"
  - "apps/hub/**/exp*/**"
---

# O contrato `postMessage` entre hub e experiência

Contrato entre três consumidores (hub, sdk, experiência), por isso não mora na
pasta de nenhum. Complementa o `AGENTS.md` da raiz, que vence em conflito.

## postMessage hub ⇄ experiência (`packages/sdk/src/bridge.ts`)
```
exp → hub : { type: "exp:ready", protocolVersion: 2 }
hub → exp : { type: "hub:init", token, estudante:{id,nome,serie,turmaId,escolaId}, config, apiUrl }
exp → hub : { type: "exp:concluir", payload:{ score?, dados? } }
exp → hub : { type: "exp:token-expirando" }   → hub responde { type:"hub:token", token }
exp → hub : { type: "exp:estado", estado:{...} }   → p/ "chrome" opcional do hub (aditivo)
                                                       (`instrucao: {antes, destaque, depois}` = o texto AO LADO do aparelho; exp02em1b, ADR-191)
exp → hub : { type: "exp:erro", mensagem, hash }    → a exp quebrou; o hub troca a tela (aditivo; o registro vai SDK → api)
hub → exp : { type: "hub:pause" | "hub:resume" }   → emitidos por visibilidade/foco da página
```
`config` do `hub:init` carrega hoje `clarityProjectId`, `expId`,
`obs: { traceRatio }` (a fração de sessões com spans do OpenTelemetry Web —
env de runtime do hub, `OBS_TRACE_RATIO_CLIENTE`) e **`fuso`** (o fuso da
plataforma, `FUSO_DA_PLATAFORMA` — ADR-99). Campo novo em `config` é
aditivo e não sobe `PROTOCOL_VERSION`.

**O `fuso` é o terceiro do mesmo tipo, e a razão de ele estar em `config` e não
como campo de topo é esta regra, não conveniência**: o bundle é estático, foi
construído uma vez e não conhece contrato, então o valor tem de chegar em
runtime — e campo de topo mudaria a FORMA do `hub:init`, obrigando a subir o
major. Bundle já publicado passaria a recusar o handshake com "protocolo
incompatível", que é tela de erro para a criança. Quem o aplica é o
`createExperiencia`, ANTES da primeira tela: `data(iso)` e as outras cinco
funções do `@edu/sdk` continuam com a assinatura de sempre, e a experiência não
precisa saber que existe fuso. Até o `hub:init` chegar vale o padrão.
O `?hubOrigin=` que o hub põe na URL do iframe é ENTRADA NÃO CONFIÁVEL: o bundle
é público, então quem embeda a experiência num iframe próprio escolheria, por
aquele parâmetro, de quem ela aceita o `hub:init` e para onde vai tudo o que sai
depois. `normalizarHubOrigin()` (bridge.ts) reduz a origem canônica, recusa
esquema fora de http(s), credencial e origem opaca, exige hub em https quando a
experiência está em https, e confere contra `location.ancestorOrigins[0]` — a
origem REAL de quem embedou, que VENCE a query string (ADR-46). Sintoma novo:
"hubOrigin não é quem embedou" onde antes o handshake só expirava em 8s.

O `blur` da janela do hub NÃO é sempre o estudante saindo: clicar dentro do iframe
move o foco para a experiência e dispara `blur` no documento de cima — e o
`focus` correspondente não volta enquanto ele continuar ali, então um
`hub:pause` ali é DEFINITIVO (o vídeo do UnooTube, hoje `backup-exp04ef1b`, parava no 1º toque em "Salvar").
Quando o foco foi para a nossa experiência, `document.activeElement` é o próprio
`<iframe>`; o `ExpFrame` não emite nada nesse caso.
Versione com `protocolVersion` (hoje **2**; o major é verificado nos DOIS lados
e incompatível falha alto). Toda mensagem pós-init é validada com Zod nos dois
lados; inválida é descartada com aviso. Mudança ADITIVA de mensagem pós-init não
pede bump; mudar a FORMA do `hub:init` pede. **Rollback só funciona entre versões
do mesmo major** — bundle atrás do protocolo tem de ser republicado, não
revertido.

## Clarity dentro do iframe

Toda experiência carrega o Microsoft Clarity (ADR-60), e **nenhuma precisa
fazer nada para isso**: quem carrega é o `createExperiencia()` da `@edu/sdk`,
com o id que chega no `config` do `hub:init`. Não cole o `<script>` no
`index.html` — a fonte única é `packages/sdk/src/clarity.ts`.

O que a experiência ganha de graça: os `track()` que ela já emite viram também
evento de funil no Clarity (`verbo:objeto`), e `concluir()` marca a sessão como
prioritária para gravação.

Três coisas que valem saber:

- **O iframe é cross-origin, então a sessão do iframe é OUTRA sessão** do ponto
  de vista do navegador (cookie particionado). O que costura as duas é o
  `identify` com o mesmo UUID do estudante, chamado dos dois lados.
- **O disfarce vaza no DevTools.** `exp08ef1b`, `exp02em1b` e `backup-exp04ef1b`, entre outras, têm no
  `index.html` o aviso de que nada ali pode denunciar o exercício; requisições
  para `clarity.ms` aparecem na aba de rede. Consequência aceita e registrada na
  ADR-60 — mas não acrescente nada que piore isso (um nome de tag visível, por
  exemplo).
- **Sem `NEXT_PUBLIC_CLARITY_PROJECT_ID` no hub, nada disso acontece.** Em dev o
  normal é o Clarity desligado; se você está procurando a requisição e ela não
  vem, é a variável, não o código.

**Mexeu na `@edu/sdk`? Sobe a versão de TODAS as experiências.** O filtro de
mudanças do `deploy.yml` inclui o pacote, então uma alteração lá republica
toda experiência publicável (toda pasta menos `_template` e `backup-*`) — e publicar sem subir a versão sobrescreve um caminho imutável no bucket.
