# exp05ef1b — Quem mandou isso?

Missão do **5º ano do Fundamental**, unidade 1. Clone de mensageiro móvel: o
estudante entra num grupo da turma com oito mensagens sobre um acontecimento da
escola, encaminha para o "Mural da Turma" o que julga importante, confirma (e
não dá mais para desfazer) e espera. A professora acende a revelação coletiva: o
Mural ganha os selos de veracidade e a conta da sala inteira aparece.

A descoberta é sobre o próprio dedo: *eu encaminhei sem checar — e a mentira
chegou mais longe por minha causa.*

Uma aula de ~35 min, conduzida pelo relógio da turma: dois botões da professora
("Iniciar revelação coletiva" e "Liberar reflexão final") e o inverso deles.

## Rodar

```bash
pnpm --filter @edu/exp05ef1b dev     # :5184
```

O hub embeda em `/exp/exp05ef1b`. Para testar o embed sem passar
pela trilha: `/dev-embed?src=http://localhost:5184`.

A porta entra em `apps/hub/lib/experiencias-dev.ts` e no `CORS_ORIGINS` da api
(`apps/api/.env`, `docker-compose.yml`, `docker-compose.dev.yml`). Sem ela o boot
morre com "Failed to fetch", e o erro não diz por quê.

Precisa de: a api no ar (`/quem-mandou-isso/*`), a missão **liberada** na turma
do estudante (ADR-69 — o seed libera na `5A`), o produto `entre-redes` ligado no
painel da Unooria (ADR-87) e **um lote homologado pela professora**. Sem o lote,
a missão mostra a tela de espera do preparo, de propósito.

## Verificar

```bash
pnpm --filter @edu/exp05ef1b typecheck
pnpm --filter @edu/exp05ef1b lint
pnpm --filter @edu/exp05ef1b test
pnpm --filter @edu/exp05ef1b build
```

## Onde as coisas estão

| O quê | Onde |
|---|---|
| Handshake, primeira leitura, erro de abertura | `src/bootstrap.tsx` |
| A máquina de telas e o polling de 5 s do gate | `src/app/quem-mandou-app.tsx` |
| O grupo, o Mural, a espera e a revelação (clone) | `src/app/componentes/telas-do-clone.tsx` |
| A abertura, o dilema e a conclusão (escola) | `src/app/componentes/telas-da-escola.tsx` |
| Os quatro formatos de balão | `src/app/componentes/balao.tsx`, `voz.tsx`, `glifos.tsx` |
| Contrato que a tela vê, `EXP_ID`, `EXP_VERSION` | `src/lib/tipos.ts` |
| Regras do cliente (toque longo, telas, proporção) | `src/lib/regras.ts` + `regras.test.ts` |
| Vocabulário de telemetria | `src/lib/telemetria.ts` |
| Copy que a TELA escreve | `src/lib/textos.ts` |
| Gabarito, estado e visão do professor | `apps/api/src/quem-mandou-isso/` |

## As rotas que esta experiência chama

| Verbo | Rota | Quando |
|---|---|---|
| `GET` | `/quem-mandou-isso/sessao` | boot e sempre que o gate divergir |
| `GET` | `/quem-mandou-isso/gate?passo=` | polling de 5 s (ADR-93) |
| `POST` | `/quem-mandou-isso/entrar` | "Entrar no grupo" |
| `POST` | `/quem-mandou-isso/encaminhar` | uma por mensagem selecionada, em série |
| `DELETE` | `/quem-mandou-isso/encaminhar/:id` | "Apagar para todos" |
| `POST` | `/quem-mandou-isso/leitura-integral` | a 8ª mensagem entrou na tela |
| `POST` | `/quem-mandou-isso/midia` | tocou o áudio ou abriu a matéria do link |
| `POST` | `/quem-mandou-isso/confirmar` | "Confirmar envio" (latch) |
| `POST` | `/quem-mandou-isso/avancar` | saiu do Mural revelado para o dilema |
| `POST` | `/quem-mandou-isso/reflexao` | "Concluir Missão" (latch) |

## Telemetria

`verbo:objeto` via `@edu/sdk`. **O payload nunca leva texto de estudante, nome,
e-mail — nem os ids das mensagens encaminhadas** (o porquê está no cabeçalho de
`src/lib/telemetria.ts`).

| Verbo | Objeto | Quando | `contexto` |
|---|---|---|---|
| `attempted` | `grupo:entrada` | tocou "Entrar no grupo" | — |
| `interacted` | `mural:primeiro-encaminhamento` | o 1º envio ao Mural | `{ segundos }` |
| `interacted` | `midia:audio`, `midia:link` | abriu a mídia | — |
| `progressed` | `grupo:leitura-integral` | rolou até a 8ª mensagem | — |
| `interacted` | `aviso:piso`, `aviso:rolagem` | o botão do Mural recusou | `{ faltam }` |
| `interacted` | `aviso:inacao` | 4 min sem encaminhar nada | — |
| `interacted` | `mural:remocao` | tirou uma mensagem do Mural | `{ restantes }` |
| `attempted` | `mural:confirmado` | o latch da curadoria | `{ total }` |
| `interacted` | `mural:atrito-oito-de-oito` | encaminhou as oito | — |
| `progressed` | `gate:espera`, `mural:revelado` | espera e telão | — |
| `completed` | `missao:reflexao` | entregou a resposta ao dilema | `{ chars }` |

Onde cada medida é LIDA: `exp05ef1b_sessoes` e `exp05ef1b_encaminhamentos`, pelo painel
da professora (`GET /quem-mandou-isso/turmas/:id/painel`).

## Onde está o resto

- As regras que valem (gabarito, piso, histograma): `apps/api/src/quem-mandou-isso/`.
- O que quebra se você não souber: `AGENTS.md` desta pasta.
