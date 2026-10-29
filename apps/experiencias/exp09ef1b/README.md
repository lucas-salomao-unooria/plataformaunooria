# exp09ef1b — O Dossiê Invisível

Missão do 9º ano do EF, unidade 1 (EF09CO07 e EF09CO08). A doutrina está no
`AGENTS.md` desta pasta; o servidor, em `apps/api/src/dossie-invisivel/`.

## Rodar

```bash
pnpm --filter @edu/exp09ef1b dev      # :5191
# no hub: /exp/exp09ef1b (estudante de turma 9A/9B com a missão liberada)
pnpm --filter @edu/exp09ef1b typecheck lint test
```

## Telemetria (`lib/telemetria.ts`)

| verbo | objeto | quando | dados |
|---|---|---|---|
| attempted | `missao:iniciar` | depois do handshake | — |
| progressed | `etapa:entrar` | a cada passo novo | `contexto.etapa` |
| interacted | `chat:consultar` | uma pergunta ao assistente | `resultado.tamanho` (só o tamanho) |
| interacted | `lacuna:investigar` | os cadernos digitalizados | `contexto.etapa` (E2 ou E4) |
| scored | `delibera:projeto` | o "Registrar Decisão" | `contexto.projeto`, `contexto.caminho_tomado` (A1, A2 ou B) |
| interacted | `revisao:pilula` | uma pílula dirigida da E4 | `contexto.pilula` |
| scored | `revisao:projeto` | o "Confirmar Decisão Final" | `contexto.projeto`, `resultado.manteve` |
| scored | `protocolo:assistente` | o "Enviar Proposta" | `resultado.blocos_adicionados`, `resultado.descartados` |
| completed | `exp09ef1b` | o fim | — |
| attempted | `erro:exibir` | a faixa de conexão | `contexto.tipo` |
