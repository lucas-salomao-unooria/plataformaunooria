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
