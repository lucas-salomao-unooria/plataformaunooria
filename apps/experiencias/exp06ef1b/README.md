# exp06ef1b — O Júri Estadual de Projetos

Missão do **6º ano do Fundamental**, unidade 1, no Unoovista (a rede social de
fotos que a missão imita). A criança recebe o crachá de jurada de uma mostra
científica estadual e avalia, num feed, os estandes das escolas concorrentes. As
curtidas dela afunilam o feed em silêncio: depois de dez posts, ela vota numa
cédula lacrada e espera a plenária (o professor projeta a dispersão de votos da
turma). Liberada a **Galeria Oculta**, ela vê os estandes que nunca chegaram ao
feed dela, com a taxa REAL da sessão, busca por hashtag e mantém ou revisa o voto.
Depois monta a cadeia Interações → Dados → Algoritmo → Bolha (EF06CO03), numa
tela que abre com a frase do Léo, resolve o caso Mariana e responde a três
enquetes nos Stories (a primeira é a da EF06CO10, o foco primário). A tela dos
pacotes da curtida (EF06CO07) saiu na 0.2.0, a pedido do PO.

A descoberta: *o feed que parecia a mostra inteira era a mostra que as minhas
curtidas escolheram.*

Uma aula conduzida pelo relógio da turma, com UM botão do professor: "Liberar a
Galeria Oculta".

## Rodar

```bash
pnpm --filter @edu/exp06ef1b dev     # :5185 (strictPort)
```

O hub embeda em `/exp/exp06ef1b`; sem passar pela trilha, `/dev-embed?src=http://localhost:5185`.

A porta entra em `apps/hub/lib/experiencias-dev.ts` e no `CORS_ORIGINS` da api
(`.env.example`, `docker-compose.yml`, `docker-compose.dev.yml`). Sem ela o boot
morre com "Failed to fetch", e o erro não diz por quê.

Precisa de: a api no ar (`/juri-estadual/*` e `/evidencias/*`), a missão
**liberada** na turma do estudante (ADR-69), uma atividade EM ANDAMENTO na turma
(sem ela, 403 `atividade-nao-preparada` — a missão não tem acervo padrão) e o
produto `entre-redes` ligado no painel da Unooria (ADR-87). Sem imagens geradas,
os estandes saem com a arte procedural (`src/lib/arte.ts`).

## Verificar

```bash
pnpm --filter @edu/exp06ef1b typecheck
pnpm --filter @edu/exp06ef1b lint
pnpm --filter @edu/exp06ef1b test
pnpm --filter @edu/exp06ef1b build
```

## Onde as coisas estão

| O quê | Onde |
|---|---|
| Handshake e primeira leitura | `src/bootstrap.tsx` |
| A máquina de telas, o polling do gate, as ações, a fila do feed | `src/app/juri-app.tsx` |
| Rede, sessão e a repetição das chamadas | `src/app/conexao.ts`, `src/lib/api.ts` |
| Os avisos globais (sem conexão, credencial) | `src/app/avisos.tsx` |
| As telas do clone | `src/app/clone/` (`credencial`, `feed`, `post-do-feed`, `cedula`, `espera`, `galeria`, `escolha`, `mariana`, `enquetes`, `fim`) |
| As telas da escola | `src/app/escola/telas-da-escola.tsx` (cadeia, missão fechada) |
| A imagem dos estandes (foto ou arte) | `src/app/componentes/midia.tsx`, `src/lib/arte.ts` |
| A permanência de 5 s num post | `src/lib/permanencia.ts` |
| O aviso de inatividade da cédula (60 s) | `src/app/inatividade.ts` |
| Regras do cliente (tela do passo, cédula, busca, calha) | `src/lib/regras.ts` |
| A memória de F5 (`sessionStorage`, só ids) | `src/lib/memoria.ts` |
| O contrato que a tela vê, `EXP_ID`, `EXP_VERSION` | `src/lib/tipos.ts` (espelho cobrado por `src/lib/espelho.test.ts`) |
| Vocabulário de telemetria | `src/lib/telemetria.ts` |
| Copy que a TELA escreve | `src/lib/textos.ts` |
| Regras, motor do feed e rotas do servidor | `apps/api/src/juri-estadual/` |

## Telemetria

`verbo:objeto` via `@edu/sdk`, com `resultado` e `contexto` como objetos —
nunca texto de estudante (nem o texto buscado na galeria), nome, e-mail, o
projeto votado ou a alternativa de uma enquete.

| Verbo | Objeto | Quando | `resultado` / `contexto` |
|---|---|---|---|
| `progressed` | `missao:entrada` | depois da primeira leitura | `contexto: { passo }` |
| `progressed` | `credencial:acessar-feed` | "Acessar Feed da Mostra" | — |
| `interacted` | `feed:curtir` | curtiu/descurtiu | `resultado: { curtiu }`, `contexto: { postId, gesto }` |
| `interacted` | `feed:salvar` | salvou/tirou dos salvos (grava, não pesa) | `resultado: { salvou }`, `contexto: { postId }` |
| `interacted` | `feed:fechado` | tocou comentar, compartilhar ou a aba Busca (não pesa) | `contexto: { acao }` |
| `interacted` | `feed:aba` | trocou de aba (Início, Notificações, Jurado) | `contexto: { aba }` |
| `interacted` | `feed:carrossel` | deslizou a foto (1 a 3) | `contexto: { postId, lamina }` |
| `interacted` | `feed:legenda` | "...mais" | `contexto: { postId }` |
| `interacted` | `feed:post` | um post novo chegou | `contexto: { posicao }` |
| `progressed` | `feed:completo` | a cédula foi liberada (o décimo chegou ou os 8 min do servidor acabaram) | `contexto: { porTempo }` |
| `interacted` | `cedula:abrir` | abriu a cédula | — |
| `interacted` | `cedula:inatividade` | 60 s sem toque com a cédula ABERTA | — |
| `attempted` | `cedula:votar` | o LATCH 1, confirmado | `resultado: { estandes }`, `contexto: { conviccao }` |
| `progressed` | `plenaria:espera` | entrou na espera do voto lacrado | — |
| `progressed` | `galeria:abrir` | a galeria abriu | `resultado: { ocultos, percentual }` |
| `interacted` | `galeria:inspecionar` | abriu a ficha de um estande | `contexto: { projetoId, oculto }` |
| `interacted` | `galeria:buscar` | buscou (o TIPO, nunca o texto) | `contexto: { busca, area }` |
| `progressed` | `galeria:revisar` | o LATCH 2, confirmado (`manter` ou `trocar`) | `contexto: { acao }` |
| `attempted` | `cadeia:validar` | conferiu a cadeia (a errada é o 422) | `resultado: { correta, tentativas }` |
| `progressed` | `mariana:cartoes` | registrou os cartões (sem dizer quais) | — |
| `interacted` | `enquete:responder` | respondeu (a PERGUNTA) | `contexto: { perguntaId }` |
| `interacted` | `enquete:pulada` | a enquete falhou | `contexto: { perguntaId, status }` |
| `completed` | `missao:concluida` | depois do `POST concluir` | `resultado: { enquetes }` |
| `interacted` | `conexao:aviso` | aviso de rede ou de credencial | `contexto: { motivo }` |

Onde cada medida é LIDA: `exp06ef1b_sessoes` (curtidas, permanências, voto,
auditoria, revisão, tentativas, cartões) e a ficha de evidência
(`apps/api/src/evidencias/fichas/exp06ef1b.ts`), no painel do professor.

## A copy escrita aqui

O que o sheet da missão (`design/06-copy-strings-revisada.md`) não tinha e a tela
precisou está marcado `ESCRITA AQUI` em `src/lib/textos.ts` (0.4.0, PRD v2):
as setas do carrossel, a aba Busca fechada no julgamento, a notificação do
crachá na aba Notificações, a explicação de "Manter" travado, a contagem de
resultados da busca, os rótulos do par simulado ("Você" / "Outro jurado"), os
nomes dos grupos de cartões, o título da consulta nos Stories, os rótulos de
leitor de tela e os avisos da escola. Para o PO revisar.
