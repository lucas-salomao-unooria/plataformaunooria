# exp03em1b — O Porta-Voz dos Dados

3ª série do EM, unidade 1 (ADR-198). Dentro do Unoochat, o estudante é o
Porta-Voz Oficial de Dados da escola: escolhe a escala de um gráfico (eixo em 0%
ou recortado em 80%) e as camadas que o acompanham, publica no grupo da cidade,
vê o efeito, pode publicar uma errata, entende o Fator de Mentira no laudo da
escola e faz a perícia de dois cartões eleitorais. Detalhe em `AGENTS.md`.

## Rodar

```bash
pnpm --filter @edu/exp03em1b dev     # :5190
# no hub: /exp/exp03em1b
# sem hub nem api: http://localhost:5190/?fixture=compositor  (só em dev)
```

A porta entra em `apps/hub/lib/experiencias-dev.ts` e no `CORS_ORIGINS` da api.
Precisa de: a missão LIBERADA na turma (`liberacoes`, ADR-69), o produto
`entre-redes` ligado (ADR-87) e um pacote posto no ar pelo professor.

## Onde as coisas estão

| O quê | Onde |
|---|---|
| Handshake e primeira leitura | `src/bootstrap.tsx` |
| O despachante (passo, conversa aberta, pausa, polling) | `src/App.tsx` |
| As telas | `src/telas/` |
| Regras puras (compositor, feed, régua, parecer, hub) | `src/lib/regras.ts` |
| Contrato que a tela vê, `EXP_ID`, `EXP_VERSION` | `src/lib/tipos.ts` |
| Chamadas à api | `src/lib/api.ts` |
| Copy | `src/lib/textos.ts` |
| Regras e rotas do servidor | `apps/api/src/porta-voz-dos-dados/` |

## Telemetria

`verbo:objeto` via `@edu/sdk` (PRD §13.1), sem PII e sem texto livre.

| Evento | Verbo | Objeto | `resultado` |
|---|---|---|---|
| EVT-U01 | `attempted` | `missao:iniciar` | `{ retomada }` |
| EVT-U02 | `progressed` | `etapa:entrar` | `{ etapa }` |
| EVT-U03 | `completed` | `exp03em1b` | `{ sucesso: true }` |
| EVT-U04 | `interacted` | `aviso:inatividade` | `{ segundos_sem_acao: 90 }` |
| EVT-U05 | `attempted` | `erro:exibir` | `{ codigo }` |
| EVT-001 | `interacted` | `anexo:nota_metodologica` | `{ abriu: true }` |
| EVT-002 | `configured` | `escala:origem_y` | `{ eixo_origem }` |
| EVT-003 | `scored` | `decisao:publicar_boletim` | escala, camadas, `is_errata: false` |
| EVT-005 | `submitted` | `errata:segunda_chance` | escala, camadas, `is_errata: true` |
| EVT-006 | `skipped` | `errata:pular` | `{ pulou: true }` |
| EVT-007 | `configured` | `pericia:motivo` | `{ cartao, motivo }` |
| EVT-008 | `submitted` | `pericia:parecer_tecnico` | sinalizou/motivo A e B |
| EVT-009 | `skipped` | `pericia:refletir` | `{ pulou: true }` |

O EVT-004 (o gate) é do professor e sai da api. Onde cada medida é LIDA:
`exp03em1b_sessoes`, `exp03em1b_publicacoes` e a ficha
`evidencias/fichas/exp03em1b.ts` (painel e Resultados do professor).
