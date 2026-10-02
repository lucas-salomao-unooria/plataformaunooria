# exp05ef1b — Quem Mandou Isso? (v2.2)

5º ano EF, unidade 1, Entre Redes. Um grupo de WhatsApp simulado da "Turma 5ºB":
a Nina pede ajuda, o estudante lê oito mensagens (verdadeira/falsa ×
emocional/neutra) e encaminha EXATAMENTE três ao Mural da Turma, vota no motivo,
e só então o professor abre a revelação (crachás de veracidade e tom), a síntese
e a regra Se/Então. No fim, duas perguntas da Nina (evidência EF05CO03/EF05CO04).

## Rodar

```bash
pnpm --filter @edu/exp05ef1b dev     # :5184 (strictPort)
# no hub: /exp/exp05ef1b  (ou /dev-embed?src=http://localhost:5184)
```

A porta está no `CORS_ORIGINS` da api e no `docker-compose.dev.yml` (serviço
`exp05ef1b`, volume `nm-exp05ef1b`). Precisa de: a missão LIBERADA na turma
(ADR-69), o produto `entre-redes` ligado no painel da Unooria (ADR-87) e um
pacote APROVADO pelo professor para a turma — sem ele a lista de conversas fica
vazia, esperando.

## Onde as coisas estão

| O quê | Onde |
|---|---|
| Handshake, primeira leitura, falha de abertura | `src/bootstrap.tsx` |
| A máquina de telas, o polling, as ações e as falhas | `src/app/quem-mandou-app.tsx` |
| As telas do mensageiro (`@edu/ui/ds-unoochat`, tema claro) | `src/app/telas-do-clone.tsx` |
| As telas da casca (`@edu/ui/ds`) | `src/app/telas-da-escola.tsx` |
| O balão por formato e a mídia desenhada | `src/app/componentes/` |
| A tela da vez, o polling e a seleção (puro, testado) | `src/lib/regras.ts` |
| A copy da tela (literal do sheet) | `src/lib/textos.ts` |
| O contrato que a tela vê | `src/lib/tipos.ts` |
| Regras, gabarito e rotas | `apps/api/src/quem-mandou-isso/`, `apps/api/src/evidencias/` |

## Telemetria

`verbo:objeto` via `@edu/sdk`, com `resultado`/`contexto` como objetos — nunca
o `Então`, nome, e-mail ou o id de uma mensagem encaminhada.

| Verbo | Objeto | Quando | Carga |
|---|---|---|---|
| `attempted` | `missao:exp05ef1b` | tocou a conversa da Nina (uma vez) | — |
| `progressed` | `grupo:turma` | "Entrar no grupo" respondeu | — |
| `interacted` | `mensagem:encaminhar` | "Enviar" na folha "Encaminhar para..." | `contexto: { selecionadas }` |
| `scored` | `mural:selecao` | latch 1 ("Confirmar envio") | `resultado: { total }` |
| `scored` | `enquete:motivo` | latch 2 (o voto) | `resultado: { opcao }` (um dos 4 ids) |
| `progressed` | `gate:revelacao` · `gate:sintese` · `gate:reflexao` | a aba viu a fase aberta pelo professor | — |
| `completed` | `missao:exp05ef1b` | `POST /concluir` respondeu | `resultado: { chars }` |

E o `concluir()` do SDK, SEM `score`, com `dados: { chars }`. Onde cada medida é
LIDA: `exp05ef1b_sessoes` (tempo no feed, seleção, motivo), `exp05ef1b_reflexoes`
(a regra, só para o professor que leciona) e a evidência (E14) no painel do hub.
