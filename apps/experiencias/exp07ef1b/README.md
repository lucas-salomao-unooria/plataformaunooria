# exp07ef1b — A Seleção

Missão do **7º ano do Fundamental**, unidade 1, no clone do Instagram. A Amara,
do grêmio, pede uma força: no feed da cobertura de um evento da comunidade há 12
posts de três veículos locais, e a criança salva, poda até exatamente 3 e publica
nos Stories do grêmio com uma legenda — e não dá para desfazer. A professora abre
o Mural: a publicação da criança aparece pareada com a de um colega que partiu do
MESMO feed e contou outra história. Depois, as fichas técnicas acendem (quem cada
post ouviu, o ângulo da imagem, o equilíbrio editorial das duas seleções), três
cards explicam a descoberta, e vêm a reflexão e duas enquetes na DM da Amara.

A descoberta: *ninguém mentiu — escolher o que mostrar já é contar a história de um jeito.*

Uma aula de ~50 min conduzida pelo relógio da turma: um botão da professora que
anda uma etapa por vez (Mural → fichas → conclusão).

## Rodar

```bash
pnpm --filter @edu/exp07ef1b dev     # :5179 (strictPort)
```

O hub embeda em `/exp/exp07ef1b`; sem passar pela trilha, `/dev-embed?src=http://localhost:5179`.

A porta entra em `apps/hub/lib/experiencias-dev.ts` e no `CORS_ORIGINS` da api
(`apps/api/.env`, `docker-compose.yml`, `docker-compose.dev.yml`). Sem ela o boot
morre com "Failed to fetch", e o erro não diz por quê.

Precisa de: a api no ar (`/a-selecao/*` e `/evidencias/*`), a missão **liberada**
na turma do estudante (ADR-69) e o produto `entre-redes` ligado no painel da
Unooria (ADR-87). Sem cobertura homologada pela professora, a turma roda o banco
curado (a Praça Central). Sem imagens geradas, os posts saem como cards com a
descrição da imagem — de propósito, e iguais em forma.

## Verificar

```bash
pnpm --filter @edu/exp07ef1b typecheck
pnpm --filter @edu/exp07ef1b lint
pnpm --filter @edu/exp07ef1b test
pnpm --filter @edu/exp07ef1b build
```

Depois do build, o grep do `AGENTS.md` ("O que o bundle NÃO sabe") prova que o
gabarito, a matriz e os prompts não estão em `dist/`.

## Onde as coisas estão

| O quê | Onde |
|---|---|
| Handshake e primeira leitura | `src/bootstrap.tsx` |
| A máquina de telas, o polling do gate, as ações | `src/app/selecao-app.tsx` |
| Rede, sessão e a repetição das chamadas | `src/app/conexao.ts`, `src/lib/api.ts` |
| Os avisos globais (sem conexão, sessão) | `src/app/avisos.tsx` |
| As telas do clone | `src/app/clone/` (`dm-da-amara`, `feed`, `salvos`, `espera`, `mural`, `ficha-tecnica`, `explicar`, `enquetes`, `barra-de-abas`) |
| As telas da escola | `src/app/escola/telas-da-escola.tsx` |
| A mídia dos posts (foto, gráfico, card) | `src/app/componentes/midia.tsx`, `src/lib/graficos.ts` |
| Regras do cliente (tela do passo, code points, poda, toque no Story) | `src/lib/regras.ts` |
| A memória de F5 (`sessionStorage`, só ids) | `src/lib/memoria.ts` |
| O contrato que a tela vê, `EXP_ID`, `EXP_VERSION` | `src/lib/tipos.ts` |
| A copy (a do mecanismo em arquivos à parte, carregados sob demanda) | `src/lib/textos.ts`, `textos-da-ficha.ts`, `textos-da-explicacao.ts` |
| O vocabulário de telemetria | `src/lib/telemetria.ts` |
| Gabarito, pareamento, relógio da turma, visão da professora | `apps/api/src/a-selecao/` |
| As enquetes e o nível das habilidades | `apps/api/src/evidencias/` (ficha `fichas/exp07ef1b.ts`) |

## As rotas que esta experiência chama

| Verbo | Rota | Quando |
|---|---|---|
| `GET` | `/a-selecao/sessao` | boot, e sempre que o gate mudou ou uma ação deu 409/400 |
| `GET` | `/a-selecao/gate` | polling de 5 s, só enquanto espera a professora (ADR-93) |
| `POST` | `/a-selecao/passo` | "Abrir Feed" (`feed`), ir e voltar da aba Salvos (`salvos` com `tempoFeedS`, `feed`), "Ir para a Reflexão" (`reflexao`) |
| `POST` | `/a-selecao/decisao` | "Confirmar publicação" — o LATCH |
| `GET` | `/a-selecao/mural` | ao abrir o Mural e quando as fichas acendem |
| `POST` | `/a-selecao/reflexao` | "Enviar Reflexão ao Professor" |
| `GET` | `/evidencias/exp07ef1b/perguntas/p1` e `/p2` | as enquetes da DM |
| `POST` | `/evidencias/exp07ef1b/perguntas/:id/resposta` | o voto (`{ alternativaId }`) |
| `POST` | `/a-selecao/concluir` | "Fechar conversa" → "Missão concluída!" |

## Telemetria

Verbo xAPI + objeto `dominio:acao`, via `@edu/sdk`, com `resultado`/`contexto`
como objetos de números, booleanos e vocabulário fechado. **Nunca** texto da
criança (da legenda e da reflexão sai só o tamanho, em code points), nome ou
e-mail — e, da enquete, a PERGUNTA respondida, nunca a alternativa.

| Verbo | Objeto | Quando | `resultado` / `contexto` |
|---|---|---|---|
| `attempted` | `missao:entrada` | depois da primeira leitura | `contexto: { passo }` |
| `progressed` | `desafio:abrir-feed` | "Abrir Feed da Cobertura" | — |
| `interacted` | `feed:salvar` / `feed:remover` | marcou / desmarcou no feed | `resultado: { salvos }`, `contexto: { postId }` |
| `interacted` | `feed:curtir` | curtiu (cosmético) | `contexto: { semSalvar }` |
| `interacted` | `feed:recarregar-midia` | "Tentar novamente" na imagem | `contexto: { postId }` |
| `interacted` | `feed:andaime` | a demonstração ou uma das dicas apareceu | `contexto: { motivo: demonstracao \| inatividade \| curtidas }` |
| `progressed` | `feed:ir-salvos` | saiu do feed para a aba Salvos | `resultado: { salvos }`, `contexto: { tempoFeedS }` |
| `interacted` | `salvos:remover` / `salvos:selecionar` | desmarcou / remarcou na grade | `resultado: { selecionados }`, `contexto: { postId }` |
| `interacted` | `salvos:voltar-feed` | voltou para garimpar | — |
| `interacted` | `stories:confirmar` / `stories:cancelar` | abriu / cancelou o alerta | — |
| `attempted` | `stories:publicar` | o latch, confirmado pela api | `resultado: { itens: 3 }`, `contexto: { chars }` |
| `interacted` | `stories:recusada` | o sanitizador recusou a legenda (422) | — |
| `progressed` | `gate:espera` | entrou na espera | — |
| `progressed` | `mural:abrir` | o Mural abriu | `contexto: { virtual }` |
| `interacted` | `mural:alternar` | trocou entre a própria e a do colega | `contexto: { para: minha \| par }` |
| `progressed` | `mural:fichas` | as fichas acenderam | — |
| `interacted` | `mural:ficha` | abriu / recolheu a ficha | `contexto: { aberta }` |
| `progressed` | `explicar:card` | leu um card até o fim da trava | `contexto: { card, segundos }` |
| `progressed` | `explicar:ir-reflexao` | "Ir para a Reflexão" | — |
| `completed` | `reflexao:enviar` | entregou a reflexão | `contexto: { chars }` |
| `interacted` | `enquete:responder` | votou | `contexto: { perguntaId }` |
| `interacted` | `enquete:pulada` | a enquete falhou e pulou para o fim | `contexto: { perguntaId, status }` |
| `completed` | `missao:concluida` | "Missão concluída!" | `resultado: { enquetes }` |
| `interacted` | `conexao:aviso` | o aviso de rede ou de sessão acendeu | `contexto: { motivo: rede \| sessao }` |

O `concluir()` do SDK leva `{ publicou, reflexao, enquetes }` — sem `score`: a
missão não pontua criança, e o nível das habilidades é do servidor.

Onde cada medida é LIDA: `exp07ef1b_sessoes` e `exp07ef1b_reflexoes`, pelo painel
da professora (`GET /a-selecao/turmas/:id/painel`); as enquetes e o Canal A da
legenda, pelo painel de habilidades (`/evidencias`).
