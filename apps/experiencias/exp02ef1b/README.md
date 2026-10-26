# exp02ef1b — O Enigma da Capa da Rádio

2º ano EF, unidade 1, no clone Unoovista. A criança (7–8 anos) investiga as
duas fotos da @radio_escola com uma lupa, publica uma capa com foto e selo,
vê o que a visitante entendeu e, na virada liberada pelo professor, descobre
que as duas fotos eram o mesmo lugar. ~20 min, 6 etapas (one-pager do PO v1.1;
ADR-184).

## Rodar

```bash
pnpm --filter @edu/exp02ef1b dev     # :5187 (strictPort)
# no hub: /exp/exp02ef1b  (ou /dev-embed?src=http://localhost:5187)
```

A porta está em `apps/hub/lib/experiencias-dev.ts` e precisa estar no
`CORS_ORIGINS` da api (`apps/api/.env`, `docker-compose.yml`,
`docker-compose.dev.yml`). Sem ela o boot morre com "Failed to fetch".

Precisa de: a missão LIBERADA na turma (`liberacoes`, ADR-69), o produto
`entre-redes` ligado no painel da Unooria (ADR-87) e um pacote no ar (o
professor escolhe o banco padrão, um pacote pronto ou a cena da IA).

## Onde as coisas estão

| O quê | Onde |
|---|---|
| Handshake e primeira leitura (`GET /enigma-capa/sessao`) | `src/bootstrap.tsx` |
| O despachante (passo → tela, gate, fila, 409) | `src/App.tsx` |
| As telas por etapa | `src/telas/` (Mural, Bancada, Decidir, Feed, Virada, Explicar, Transferencia, Espera) |
| Geometria, lupa e fila (puros, testados) | `src/lib/geometria.ts`, `src/lib/lupa.ts`, `src/lib/fila.ts` |
| Contrato espelhado da api | `src/lib/tipos.ts` |
| Copy da tela | `src/lib/textos.ts` |
| Regras e rotas do servidor | `apps/api/src/enigma-capa/` |

## Como cada tela chama a api

| Tela | Rota | Corpo |
|---|---|---|
| boot / F5 / gate mudou | `GET /enigma-capa/sessao` | — |
| polling 3 s | `GET /enigma-capa/gate` | — |
| E1 crachá | `POST /enigma-capa/cracha` | `{ cracha }` |
| E2 lupa (a cada 4 s e no AVANÇAR) | `POST /enigma-capa/lupa` | `{ foto1Ms, foto2Ms, fundo1, fundo2, avancar }` |
| E3 PUBLICAR CAPA | `POST /enigma-capa/publicar` | `{ fotoId, seloId, deslocamento }` |
| E4 toque nos objetos | `POST /enigma-capa/invariantes` | `{ fotoId, x, y }` (panorâmica) |
| E4 fim do slider | `POST /enigma-capa/slider` | — |
| E4 Pronto | `POST /enigma-capa/fora` | `{ toques: [{x,y}] }` |
| E5 motivo do par | `POST /enigma-capa/pares` | `{ cartas: [id,id], motivo }` |
| E5 Colocar no álbum | `POST /enigma-capa/segunda-foto` | `{ elemento, deslocamento }` |
| E6 voto | `POST /enigma-capa/transferencia` | `{ opcao }` |

## Telemetria

`verbo:objeto` via `@edu/sdk` (`src/lib/telemetria.ts`) — nunca o gabarito,
nome ou e-mail.

| Verbo | Objeto | Quando | `resultado` / `contexto` |
|---|---|---|---|
| `attempted` | `missao:iniciar` | depois do handshake | `resultado: { retomada }` |
| `progressed` | `etapa:entrar` | a cada passo | `contexto: { passo }` |
| `interacted` | `lupa:alerta` | AVANÇAR antes do piso | — |
| `interacted` | `aviso:inatividade` | 45 s sem gesto (E2/E3) | `contexto: { passo }` |
| `interacted` | `capa:publicar` | PUBLICAR CAPA | `resultado: { fotoId }` |
| `interacted` | `invariante:tocar` | cada toque na busca | `resultado: { ajuda }` |
| `interacted` | `panoramica:revelar` | o slider no fim | — |
| `interacted` | `fora:marcar` | Pronto | `resultado: { marcas }` |
| `interacted` | `par:formar` / `album:colocar` | E5 | — |
| `attempted` | `erro:exibir` | sem sinal / imagem que não carregou | `resultado: { codigo }` |
| `completed` | `missao:concluida` | o voto da E6 (LATCH 2) | — |

Onde cada medida é LIDA: `exp02ef1b_sessoes` e a rota
`GET /enigma-capa/turmas/:turmaId/painel` (o painel do professor).
