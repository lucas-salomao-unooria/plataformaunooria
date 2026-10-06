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
  volta à exploração **sem apagar nada**. Um ativo (= EM ANDAMENTO) por turma:
  índice único PARCIAL (`exp04ef1b_pacotes_um_ativo`), que o Prisma não enxerga.
- **A plataforma NUNCA cria o pacote (ADR-130).** `homologar` cria a atividade
  PRONTA (`ativo: false`) — o em andamento continua —, e `colocarEmAndamento`
  (`POST :turmaId/pacotes/:pacoteId/em-andamento`) é o "Usar esta atividade
  agora": desliga o anterior, liga o escolhido e aponta o gate para a rodada
  SEGUINTE à última com sessão, com os portões fechados. Sem gate, `exigirPacote`
  responde 403 `atividade-nao-preparada` — a tela de "ainda não foi aberta" que
  a experiência já mostra. O banco da Unooria (`catalogo.ts`, "Feira de Ciências
  e Notícias da Cidade", em `GET professor/material`) virou o ponto de partida
  da CRIAÇÃO. `gerar-midia` aceita `?pacoteId=`: o professor prepara o pronto.
- **Criar o MESMO conteúdo do pacote mais recente é idempotente** (mesma origem,
  tema e notícias, comparadas com as chaves em ordem — o JSONB as reordena):
  devolve aquele pacote, sem criar outro. É o segundo clique em "Criar atividade".
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
  temperatura 0, uma tentativa, SEM teto de saída — com 32 tokens o raciocínio do Gemini 3 cortava o JSON e caía sempre no modelo, ADR-148) em `Promise.race` de ~6 s, débito no
  `aoUsarTokens`; falhou qualquer coisa, o modelo automático
  (`regras/layout.ts`), sem gravar cache. Fora da transação do funil. A e2e roda
  com a IA real e exige `origem: "ia"` na resposta do `POST diagramar`.
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
  gravadas com `midia || jsonb_build_object(...)`.
- **A imagem só chega à criança APROVADA, e a aprovação é POR IMAGEM**
  (ADR-147): `midia_aprovada` guarda a URL que o professor aprovou por notícia,
  e a allowlist do estudante recebe `midiaAprovada(pacote)` — só a URL atual
  que é igual à aprovada. "Gerar outra" (`POST …/imagens/:noticiaId/regerar`,
  arquivo NOVO com sal) troca `midia` e aquela notícia some da mesa até o novo
  `POST …/pacotes/:p/aprovar-imagens`, que aprova SÓ as URLs que vieram no
  corpo (as que estavam na tela) e ainda são as do pacote — a condição mora no
  UPDATE (`midia ->> id = url`). Não é o carimbo único da A Seleção (ADR-146)
  porque aqui se gera imagem também na atividade no ar: o carimbo apagado
  esconderia todas de uma vez.
- **Pôr no ar exige TODAS as que pedem imagem geradas E aprovadas**
  (`imagensProntasParaAula`; 409 `imagens-nao-aprovadas`), só na ENTRADA no ar
  — a que já está no ar não sai por um "Gerar outra". A imagem deixou de ser
  opcional (decisão do Lucas, 2026-10-05): sem a IA de imagem, a atividade não
  vai ao ar. A homologação herda as IMAGENS de mesma descrição, nunca a
  APROVAÇÃO. Os pacotes antigos entraram aprovados (migração
  `20261005190000`).
- **O podcast de recapitulação é da plataforma** (ADR-150, `src/podcast/`):
  aqui ficam o roteiro do one-pager (`podcast.ts`, Lucas e Clara, com a
  "oficina de robótica" no lugar da "gincana" — os artefatos davam os dois nomes
  à mesma notícia) e a fonte (`podcast-fonte.ts`). As três vagas (a notícia
  antiga, a reação a ela, o aviso sem assinatura) o professor revisa na
  criação, e `homologar` as grava em `podcast_roteiros` na MESMA transação —
  também no segundo clique, que devolve o pacote existente.

## A evidência (E14)

A ficha é `evidencias/fichas/exp04ef1b.ts`: EF15CO04 por `pistas` (no latch da
1ª, fase 1), EF15CO02 por `chave` (tentativas), EF04CO08 por `edicao-2` (no
latch da 2ª), `p1` e `p2` — vale o melhor, o que afrouxa o "E" do PRD. Toda
rodada mede as três AÇÕES de novo, também no mesmo pacote (ADR-145).
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
