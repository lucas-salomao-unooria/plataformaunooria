# packages/sdk — `@edu/sdk`, a única porta da experiência para fora

Complementa o `AGENTS.md` da raiz. O **contrato** `postMessage` (quem manda o
quê, em que ordem) está em `apps/experiencias/AGENTS.md`; aqui está o que vale
ao mexer na implementação dele.

Ponto de entrada único: `createExperiencia({ expId, expVersion })`. Uma
experiência não faz `fetch` para a api por conta própria e não guarda token —
quem tem os dois é o handle.

## `hubOrigin` vem da query string, e query string é do atacante

O bundle é PÚBLICO: quem abrir `…/index.html?hubOrigin=https://evil.tld` dentro
de um iframe próprio escolhe, com essa string, de quem a experiência aceita
`hub:init` e para onde vai tudo que ela envia depois. `normalizarHubOrigin`
(`src/bridge.ts`) é a política de confiança da regra 4, em três travas — origem
canônica, https exige https, e `ancestorOrigins` vence a query quando o
navegador publica. **Mexeu ali: `bridge.test.ts` antes de qualquer outra coisa.**

Mensagem pós-`init` que não passa no schema Zod é DESCARTADA com aviso, nunca
despachada crua aos listeners.

## Evento de telemetria (inspirado em xAPI, simplificado)

```json
{ "eventId": "uuid", "ts": "ISO", "estudanteId": "...", "escolaId": "...",
  "expId": "exp-01", "expVersion": "1.2.0", "sessaoId": "uuid",
  "verbo": "completed|attempted|interacted|scored|...",
  "objeto": "fase-3", "resultado": { }, "contexto": { } }
```

A SDK preenche tudo exceto `verbo`, `objeto`, `resultado`. Batch de até 50,
flush a cada 10s, `sendBeacon` no `pagehide`. Offline a fila é em memória — some
com a aba, e é decisão consciente (IndexedDB é o próximo passo).

**Nada de PII no evento** (regra 6): `estudanteId` é opaco, e nem nome, nem
e-mail, nem o texto que o estudante escreveu entram em `resultado`/`contexto`.
A exp-03 é o exemplo do corte certo: registra *quantas* fontes foram carregadas,
nunca as palavras com que o estudante pediu.

## Timeout: 10s é o default, e ele está errado para IA

`OpcoesDeChamada.timeoutMs` existe porque o default serve para ler catálogo e
não para uma volta de IA com ferramentas (10 a 30s na exp-03). Chamada de IA
declara o próprio teto; sem isso o estudante vê "não deu certo" no meio de uma
resposta que estava vindo.

## Falso positivo registrado do Snyk

`createExperiencia` carrega um comentário explicando o "Code Injection"
(CWE-94) que a varredura aponta no `setInterval` da bridge: ele recebe uma
*referência de função*, não string, e `hubOrigin` termina como `targetOrigin` de
um `postMessage`. Está ignorado com motivo em `.snyk` e tem ADR. **Não refaça a
varredura para "conferir"** — ver "Ferramentas externas" no `AGENTS.md` da raiz.

## Clarity: a fonte única, e o custo de mexer aqui

`src/clarity.ts` é o **único** lugar do monorepo onde o snippet do Microsoft
Clarity existe (ADR-60). O hub o consome por `snippetClarity()` (monta com
`next/script`); as experiências, por `carregarClarity()`, chamado dentro de
`createExperiencia()` depois do handshake. Colar o `<script>` num `index.html`
ou num layout cria a segunda cópia que ninguém atualiza junto.

**O id vem pelo `config` do `hub:init`, não por `import.meta.env`.** Dois
motivos, os dois já custaram tempo em outros pontos deste repo: (1) o hub
transpila este pacote (`transpilePackages`), e `import.meta.env` aqui quebra o
build dele; (2) por `config`, uma env só do hub liga as duas superfícies e
desligar não exige republicar as seis experiências. O `config` é
`Record<string, unknown>` e aditivo — campo novo ali **não** sobe
`PROTOCOL_VERSION`.

**`track()` alimenta dois destinos.** A telemetria própria recebe a carga útil
inteira; o Clarity recebe só `verbo:objeto`. `resultado` e `contexto` carregam
resposta de estudante, e resposta de estudante não sai do contrato — se você
acrescentar um destino, mantenha essa separação.

**Não mande nome.** O `identify` leva o UUID opaco. O quarto parâmetro do
Clarity (`friendlyName`) fica de fora de propósito: é dado de menor indo para
processador de terceiro.

### Mexeu aqui? Suba a versão das SEIS experiências

O filtro de mudanças do `deploy.yml` inclui `packages/sdk`, então **qualquer**
alteração neste pacote republica todas as experiências. O `rsync` do deploy roda
com `--delete-unmatched-destination-objects` sobre um caminho que carrega a
versão e é tratado como imutável: publicar sem subir a versão apaga os assets
que uma sessão em andamento vai pedir. Suba o `versao` do
`public/experiencia.json` **e** o `version` do `package.json` de cada uma — o CI
lê do manifesto, e a divergência entre os dois já causou bug.


## Observabilidade do navegador (2026-09-02, cap. 17)

Quatro coisas que a SDK faz depois do handshake, todas com o token do
`hub:init` e nenhuma com SDK de terceiro no bundle (ADR-58):

- **OpenTelemetry Web** (`src/otel-web.ts`): spans de `document-load` e de
  todo `fetch`, exportados para `POST /observabilidade/v1/traces` da api pelo
  `ExportadorOtlpDaApi` (OTLP/JSON escrito à mão, ~60 linhas — o
  `exporter-trace-otlp-http` recebe cabeçalhos ESTÁTICOS e o token roda a cada
  15 min). O ratio vem de **`config.obs.traceRatio` do `hub:init`** (env de
  runtime do hub), nunca de `import.meta.env`; com 0 (dev) os pacotes nem são
  baixados — entram por `import()` dinâmico, em chunks à parte (~17 KB gz
  medidos na exp-02). `resourceFetch` (um span por asset) é descartado antes de
  sair. Sem `context-zone` (zone.js), de propósito. **O `traceparent` só vai
  para a api** (`propagateTraceHeaderCorsUrls`); o export a cada **30 s**, não
  10 — uma escola sai por um NAT e o rate limit do WAF é por IP.
- **Erros não tratados** (`src/erros.ts`): `error` + `unhandledrejection` →
  `POST /observabilidade/erros-cliente`, com dedupe por hash, **5 por sessão**,
  stack em 8 KB, `url` sem query; `exp:erro` avisa o hub para trocar a tela
  (o registro não depende dele). `handle.reportarErro(err)` é o mesmo caminho
  para o `catch` de domínio. Erro **antes** do handshake não tem token e fica no
  console — o sinal dele é a métrica de handshake do hub.
- **Web Vitals** (`src/vitals.ts`): 10% das sessões, decidido uma vez;
  `web-vitals` por `import()` dinâmico; `rota` = `expId`, perfil vem do token.
- **Telemetria resiliente** (`src/telemetry.ts`): teto de 500 eventos (o mais
  antigo sai), backoff 1 s → 60 s zerado no sucesso, uma tentativa em voo,
  `visibilitychange=hidden` também dispara o beacon, e `sendBeacon === false`
  devolve o lote ao buffer. Sem OTel, toda chamada leva um `traceparent` novo
  (`src/trace.ts`) para a api ter `traceId` em 100% dos logs.

Deps novas: `@opentelemetry/*` (só carregadas com ratio > 0) e `web-vitals`.
`packages/AGENTS.md` continua valendo: nada pesado no caminho síncrono.

## O fuso da plataforma (ADR-98 e ADR-99)

`src/fuso.ts` guarda o fuso da plataforma e as funções que formatam data para
gente ler. **Não é utilitário de conveniência: é a correção de um defeito que
passou meses invisível.** Sem `timeZone`, `Intl` usa o fuso de quem executa — e
no hub a mesma linha roda no contêiner (UTC) e no navegador
(`America/Sao_Paulo`). Entre 21h e a meia-noite os dois rendem DIAS diferentes,
o React acusa "hydration failed", regenera a árvore e o clique da pessoa cai no
vazio. Foi assim que a suíte e2e da exp-08 morreu com um timeout de clique.

- **Formato novo entra AQUI**, como função nomeada pela intenção. Um formatador
  escrito na tela é o começo do décimo segundo lugar que formata data sozinho.
- **`apps/api/src/comum/fuso.ts` é a cópia gêmea** — a api não consome pacote de
  workspace. As duas são amarradas por `apps/api/tests/fuso-da-plataforma.spec.ts`,
  que lê este arquivo e compara **o valor padrão E o nome da variável de
  ambiente**. Mudou aqui, muda lá, no mesmo commit. Nomes de env diferentes são
  o pior dos dois erros: configurar a plataforma acertaria uma superfície e
  deixaria a outra no padrão, e o sintoma é api e hub discordando do dia.
- **Número não tem fuso.** `n.toLocaleString("pt-BR")` para separar milhar não
  tem nada a ver com isto e continua livre.

### O valor vem do AMBIENTE, e a cascata é o que faz isso funcionar (ADR-99)

`FUSO_DA_PLATAFORMA` é env de deploy (1 contrato = 1 stack). Este módulo roda em
três lugares e a env só existe em um, então `fusoDaPlataforma()` resolve por
cascata: **runtime** (`definirFusoDaPlataforma`, o `hub:init`) → **`process.env`**
(servidor do Next, api, Node) → **`<meta name="unooria-fuso">`** (navegador do
hub, escrito pelo `generateMetadata` do layout raiz) → **`FUSO_PADRAO`**.

- **As seis funções NÃO ganham um parâmetro de fuso.** `data(iso)` continua
  `data(iso)`: passar o fuso em cada chamada espalharia pelos onze sítios o
  problema que a ADR-98 juntou num lugar só. É o MÓDULO que sabe o fuso.
- **O valor é memorizado**, porque as funções são chamadas por linha de tabela.
  `esquecerFusoDaPlataforma()` existe **para teste** — é o que permite provar,
  no mesmo processo, que trocar a variável muda o texto. Em produção ninguém
  chama.
- **O fuso entra na CHAVE do cache de formatadores.** Sem isso, trocar o fuso
  devolve o formatador antigo e a tela continua na hora anterior, sem erro
  nenhum apontando a causa.
- **Valor inválido cai no padrão com `console.error`, não lança.** Quem falha
  alto é a api, no boot (Zod). Derrubar a subida de um processo é barato;
  derrubar a tela de uma rede inteira por causa de uma string não é.
- **Para a experiência o canal é o `config` do `hub:init`** (chave
  `CHAVE_DO_FUSO`), aplicado por `createExperiencia` antes da primeira tela.
  Campo de TOPO mudaria a forma do handshake e obrigaria a subir
  `PROTOCOL_VERSION` — ver `apps/experiencias/AGENTS.md`.
