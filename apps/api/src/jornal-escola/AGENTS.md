# apps/api/src/jornal-escola — Jornal da Escola: A Edição de Bento (exp04ef1b)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

## A missão (exp04ef1b, rotas `/jornal-escola/*`)

Missão de 4º ano, unidade 1, numa redação da Unooria (não é clone de rede
social). A criança recebe oito notícias de oito meios, abre as pistas (fonte,
data, autoria), põe três na primeira página e publica (o LATCH da 1ª); depois
responde como escolheu (o motivo), o professor libera o RESULTADO — as reações
dos leitores às notícias escolhidas —, depois a REVISÃO: a Chave do Editor, a
mesa com os marcadores e a 2ª edição (o LATCH da 2ª), o comparativo e o Desafio
Final (P1/P2 pelas rotas de `/evidencias`). Quatro tabelas:
`exp04ef1b_pacotes`, `exp04ef1b_gates_turma`, `exp04ef1b_sessoes`,
`exp04ef1b_diagramacoes`. O código era do UnooTube, ARQUIVADO como
`backup-exp04ef1b` (ADR-116): nada daqui colide com `backup_exp04ef1b_sessoes`
nem com `experiencias/exp04ef1b/videos/` no bucket.

**A espinha é contrato com a experiência e o hub**: `vocabulario.ts`,
`invariantes.ts`, `contrato-de-rotas.ts` e `regras/passos.ts`. Os dois lados têm
espelhos declarados dessas listas; mudar a forma aqui sem avisar quebra os dois
em silêncio.

- **Atividade = o PACOTE; rodada = o "Zerar".** O gate diz qual (pacote,
  rodada) está em andamento, e a sessão é por essa dupla. Zerar sobe a rodada e
  volta à exploração **sem apagar nada**; homologar outro pacote desativa o
  anterior (fica) e abre a rodada 1. Um ativo por turma: índice único PARCIAL
  (`exp04ef1b_pacotes_um_ativo`), que o Prisma não enxerga.
- **A missão NÃO nasce vazia.** Sem homologação, a turma roda o banco padrão
  (`catalogo.ts`, "Feira de Ciências e Notícias da Cidade"): `garantirPacote`
  cria o pacote `padrao` e o gate na primeira leitura — de estudante OU do
  painel/pacotes do professor —, com o lock exclusivo da turma só quando falta o
  gate, e RELÊ depois do lock (nasce um só sob concorrência).
- **Homologar o MESMO conteúdo do ativo é idempotente** (mesma origem, tema e
  notícias, comparadas com as chaves em ordem — o JSONB as reordena): devolve o
  ativo, só carimba `aprovado_por` se estava nulo, não zera a aula nem cria
  histórico. É o "Usar Banco Padrão" apertado com o padrão já em sala.
- **O gabarito desce em portões, nunca antes.** A notícia do estudante é uma
  ALLOWLIST (`noticiaPublica`); o texto da pista desce no `POST pista` (é o
  REGISTRO da EF15CO04, e uma pista lida sem registro seria evidência
  invisível); a consequência, no `GET resultado` com a etapa `resultado`; o
  pilar em falta, no `GET revisao` depois da Chave; o conjunto certo da Chave,
  nunca (`regras/chave.ts`). As verificadas são calculadas no latch, NO SERVIDOR.
- **Os CHECKs dos latches são equivalências com o passo gravado**: `publicada1_em
  ⇔ passo ∉ {desafio, mesa}`, motivo ⇔ passo além de `motivo`, Chave ⇔ passo ≥
  `revisao`, `publicada2_em` ⇔ passo ≥ `comparativo`, `fim ⇔ concluida_em` — e
  `resultado`/`chave` nunca são GRAVADOS (a etapa os impõe a quem está em
  `publicada`, `regras/passos.ts#passoEfetivo`). O service grava carimbo e passo
  no MESMO update.
- **Os locks**: por estudante (o funil `garantirSessao`) e da TURMA —
  exclusivo para o botão, zerar e homologar; compartilhado para as três jogadas
  que MARCAM evidência (publicar, Chave, republicar), que relêem o gate depois
  dele e respondem 409 `rodada-mudou` se o professor zerou no meio. Sem isso, a
  marca atrasada cairia numa rodada que acabou e enganaria o recálculo das
  equipes.
- **O painel conta por COMPUTADOR** (`colapsarEmUnidades`, o candidato é quem
  ENTROU e o peso põe quem PUBLICOU na frente); "X de Y" tira o Y de
  `computadoresDaMontagem`. Na linha, `entrou` = tem sessão e `iniciou` = publicou
  a 1ª. **Sem verificadas nem nível por linha** (`PROIBIDO_NA_LINHA_DO_PAINEL`,
  com teste): elas vivem no histograma anônimo; o radar é do OBJETO editorial.
  Sem texto livre de menor, não há recorte de gestor; a leitura do PROFESSOR
  conta o EVT-P04.
- **A IA em sala só DIAGRAMA** (`diagramacao.service.ts`): cache → rate limit →
  `temSaldo(estudante)` → `generateJson` (schema SÓ com o enum de layout,
  temperatura 0, uma tentativa, 32 tokens) em `Promise.race` de ~6 s, débito no
  `aoUsarTokens`; falhou qualquer coisa, o modelo automático
  (`regras/layout.ts`), sem gravar cache. Fora da transação do funil. Em dev e
  na e2e é sempre o modelo.
- **O preparo não esconde a falha** (`preparo.service.ts`): o molde (meio e
  papel de cada id) é SORTEADO no servidor (`regras/molde.ts`) — fixo, a turma
  que jogou um pacote saberia "a n2 é a antiga" em todos —, a IA escreve o
  conteúdo, e o `validar` recusa o que mexeu no molde ou fere `invariantes.ts`.
  `gerar-conteudo` sem saldo = 429, falha = 503, e o hub oferece o banco padrão.
  `regenerar-noticia` sem saldo = 429; falha = 200 com `usouIa: false` e a
  notícia COMO ESTAVA (a do pacote ativo ou a do padrão, pelo id). Toda chamada
  que usou IA conta o EVT-P02 no pacote em sala.
- **As imagens** (`midia.service.ts`) são do professor, INCREMENTAIS (duas por
  chamada), 640×360, nome = hash da descrição em `experiencias/exp04ef1b/jornal/`,
  gravadas com `midia || jsonb_build_object(...)`. Sem imagem, o cartão se
  desenha pelo meio.

## A evidência (E14)

A ficha é `evidencias/fichas/exp04ef1b.ts`: EF15CO04 por `pistas` (no latch da
1ª, fase 1), EF15CO02 por `chave` (tentativas), EF04CO08 por `edicao-2` (no
latch da 2ª), `p1` e `p2` — vale o melhor, o que afrouxa o "E" do PRD. As três
AÇÕES perguntam antes `jaAvaliadaAntes` (ADR-120): na rodada nova do mesmo
pacote, quem já foi avaliada viu o resultado e a Chave, e não é marcada de novo.
A cópia para os colegas de computador é da porta `marcar`. O resolvedor
(`contextoDaAtividade`) devolve `null` antes de `transferencia` e fora do
(pacote, rodada) do gate. O `gabarito`, a `consequencia` e o `pilarEmFalta` estão
em `observabilidade/redaction.ts` (o teste da missão cobra).

## As suítes

- `tests/jornal-escola-regras.spec.ts` — SEM banco: o banco padrão contra a
  régua e casos ruins, resultado e reações, Chave, bandeja, as três réguas,
  `passoEfetivo` × etapa, layout, o molde e o Zod da IA, a allowlist e o painel
  sem campo proibido.
- `tests/jornal-escola-postgres.spec.ts` — o que só o banco responde: RLS
  ISOLANDO (role sem `BYPASSRLS`), CHECKs, latches concorrentes, portões, a
  Chave, zerar e pacote novo, `garantirPacote` concorrente, painel por
  computador, resolvedor, a diagramação com IA falsa e o cache, o preparo.

Armadilha: **o rate limit da diagramação é em memória e por estudante** (doze por
janela). Um estudante que diagrama em vários blocos da suíte esgota o limite e
cai no modelo em silêncio — daí os estudantes próprios do bloco da IA.
