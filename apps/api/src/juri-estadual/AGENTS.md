# apps/api/src/juri-estadual — O Júri Estadual de Projetos (exp06ef1b)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

## A missão (exp06ef1b 0.4.0, PRD v2 de 2026-10-10, rotas `/juri-estadual/*`)

Missão de 6º ano, unidade 1, no Unoovista. A criança é jurada de uma mostra
estadual: rola um feed de dez posts (ou 8 minutos) que as curtidas dela
AFUNILAM em silêncio, vota numa cédula lacrada (LATCH 1) e espera a turma (o
PICO: o professor projeta a dispersão de votos). O professor clica "Liberar
Auditoria": ela vê a Galeria Oculta com a taxa REAL de invisibilidade, busca
por hashtag e MANTÉM ou TROCA o voto (LATCH 2). Depois avança sozinha para a
cadeia (EF06CO03, com o par simulado ao lado), o caso Mariana e as enquetes
(P1–P3, pelas rotas de `/evidencias`). Quatro tabelas: `exp06ef1b_pacotes`,
`exp06ef1b_gates_turma`, `exp06ef1b_gates_historico`, `exp06ef1b_sessoes`.

**A implementação segue o PRD v2; os únicos desvios são as 9 melhorias
aprovadas pelo dono (2026-10-10).** O ciclo do voto da 0.3.0 SAIU (melhoria 6):
justificativa (cartões `v*`/`r*`, frase grifada), complementar e a RODADA DE
DESVIO (etapa, passo, rotas). As colunas ficam sem uso — migração
`20261010120000` não apaga nada; os CHECKs antigos seguem valendo para as
linhas antigas, e `complementar` continua aceito no CHECK e lido como manter.

**A espinha é contrato com a experiência e o hub**: `vocabulario.ts`,
`conteudo.ts`, `banco-padrao.ts`, `invariantes.ts`, `erros.ts`,
`contrato-de-rotas.ts`, `regras/passos.ts` e `regras/afunilamento.ts`. Os dois
lados têm espelhos dessas listas; mudar a forma aqui sem avisar quebra os dois.

- **Áreas são FORMATO, não lista** (melhoria 2): o slug é `area_a`…`area_d` e o
  nome/hashtag vem do pacote. O banco padrão usa as 4 do PRD (Tecnologia
  `#robotica`, Meio Ambiente `#meioambiente`, Cultura `#artes`, Saúde `#saude`).
- **O BANCO PADRÃO voltou** (`banco-padrao.ts`, 01e literal): origem `padrao`.
  Três entradas: `POST turmas/:t/banco-padrao` (o atalho, sem IA, imagens já
  aprovadas — arte procedural —, `porNoAr` põe em andamento); o FALLBACK do
  `gerar-conteudo` (sem cota OU IA fora → 200 `usouIa: false`, `origem:
  "padrao"`, `motivo`); e homologar o conteúdo intocado
  (`ehConteudoDoBancoPadrao`). O 01e não tem perfil, imagem nem os formatos
  protótipo/depoimento: perfil sai da escola, imagem descreve o título, e os
  formatos caem no bastidor (= resumo técnico) e na legenda.
- **Atividade = o PACOTE; rodada = o "Zerar"** (ADR-130/155): igual à 0.3.0 —
  gate PK `turma_id`, sessão por (pacote, rodada), um ativo por turma (índice
  parcial), zerar apaga a evidência do pacote. Duas fases de aprovação
  (ADR-146): `homologar` (textos) e `aprovar-imagens`.
- **O motor roda no SERVIDOR** (`regras/afunilamento.ts`, puro). Curtir 3,
  ficar > 5 s 1, **salvar 0** (grava, não pesa). Abertura: um post de cada área.
  `areaLider`: ≥ 6 pontos; **sem curtida nenhuma, a permanência sozinha elege**.
  `areaEmFoco`: a líder, ou (com alguma curtida) a de maior peso. **Saturação
  (melhoria 1)**: com foco, os posts 5..10 são SÓ dela — um projeto novo dela no
  máximo, depois os formatos que faltam (`apresentacao`, `bastidor`,
  `prototipo`, `depoimento`; id `proj-xN:formato`). Quem curte na abertura fica
  com 5 projetos vistos, 11 de 16 fora (69%); sem interação, feed variado (38%).
  Primeira curtida tardia dá taxa menor — o número é REAL, não cravado.
- **8 minutos do servidor** (melhoria 9): o 1º `proximo: true` grava
  `feed_iniciado_em`; esgotado, o feed não serve mais e `cedulaLiberada` vira
  `true` (voto aceito com < 10). F5 não zera.
- **Ociosos** (melhoria 8): `POST cedula/batimento` a cada 15 s com a cédula
  aberta (`segundosSemToque`) grava `cedula_batimento_em`/`cedula_inativa_desde`;
  o painel acende `ocioso` com > 60 s e batimento de até 40 s
  (`regras/painel.ts#ociosoNaCedula`). O voto apaga o par (CHECK: só antes do voto).
- **A revisão tem dois botões** (melhoria 6): `manter` exige ≥ 1 oculto aberto
  (409 `galeria-sem-inspecao`); `trocar` aceita os 16 menos o voto. Grava
  `auditoria_status`/`classificacao_status` com as marcas. Depois, `POST passo
  {para: "cadeia"}` (de `revisada`).
- **A cadeia**: ids opacos (`regras/ordem.ts`), ordem de chegada nunca a certa.
  **Errada = 422 `ordem-incorreta` com `tentativas`** — a tentativa é gravada
  e a exceção é lançada FORA do `comTenancy` (senão o rollback a apagaria).
  Blocos e feedback literais do 01e, SEM o número da frente (seria gabarito).
  `cadeia.parSimulado` (melhoria 7, `regras/par.ts`): o espelho das áreas do
  feed DESTA criança, nunca dado de colega.
- **Mariana e os 5 cartões** literais do 01e (`m1`–`m3`, `t1`–`t2`), juntos e
  embaralhados por sessão. O `m1` (27 palavras) é exceção NOMEADA do teto de 25
  (`conteudo.ts#EXCECOES_DE_TETO`, melhoria 5); texto da IA segue barrado.
- **O acervo não desce antes da galeria** (allowlist `regras/publico.ts`); a
  galeria exige passo efetivo `galeria` (voto E etapa) e traz `ocultosAbertos`,
  `podeManter` e `resumo` (o bastidor, a ficha de inspeção).
- **Locks**: por estudante (funil `garantirSessao`) e da turma (exclusivo para
  botão/zerar/homologar/pôr no ar/banco padrão; compartilhado nas jogadas que
  marcam, com 409 `rodada-mudou`).
- **O painel** conta por COMPUTADOR e é projetado (PED-07): a linha diz só
  progresso + `ocioso` + `categoriasBuscadas` (a leitura da EF06CO01). Cada GET
  incrementa `painel_vistas` (EVT-P04). O botão grava uma linha em
  `exp06ef1b_gates_historico` (EVT-P05). `homologar` grava `aprovado_em/por` e
  `preparo_iniciado_em` (opcional no corpo, últimas 24 h).
- **A IA só existe do lado do professor**: preparo (agora com os 4 formatos),
  regeneração, imagens — quota do perfil (ADR-105). Sem acervo no runtime.
- **O podcast** (ADR-150/151, RF-008): o banco padrão intocado tem o roteiro do
  sheet LITERAL (aud-exp06ef1b-01, `ROTEIRO_DO_BANCO_PADRAO`: "os outros 12
  projetos", "três quartos" — coerentes com a saturação) e `padrao: true` sem
  linha na tabela; as falas do sheet ativam esse roteiro
  (`ehFalaDoBancoPadrao`). Mostra da IA: texto fixo corrigido + as três vagas
  revisadas na criação (`homologar`). Toca depois da Etapa 4 (o guia avisa).

## A evidência (E14)

Ficha `evidencias/fichas/exp06ef1b.ts` **versão 4** (`regras/evidencia.ts`),
com `ordemDasAlternativas: "por-estudante"` (melhoria 4: embaralhamento
determinístico por estudante, `evidencias/regras.ts#aleatorioDe`):

- **EF06CO10** `auditoria`: ≥ 2 ocultos abertos E ≥ 1 busca = atingiu; abriu
  algum = em processo; não abriu nada = SEM marca (`p1` decide).
- **EF06CO01** `classificacao` (melhoria 3): hashtag de uma categoria FORA da
  bolha (≠ `areaDominante`: a abertura mostra todas as áreas, então "não
  apareceu" é lido como "não dominou") E abriu um projeto dela = atingiu;
  buscou qualquer coisa ou abriu um oculto = em processo; nada = SEM marca.
- **EF06CO03** `cadeia`: 1 tentativa = atingiu; 2–3 = em processo; > 3 = não.
- `p1`/`p2`/`p3` verbatim do 01e (ids `D*`/`B*`/`C*` mantidos). Vale o melhor;
  toda rodada mede de novo (ADR-145). As colunas `enquete_*_alt` existem e não
  são escritas (a resposta mora em `evidencias_marcas`).

## As suítes

- `tests/juri-estadual-regras.spec.ts` — SEM banco: saturação (69–75% em 300
  sementes com curtidas), líder só por permanência, salvar sem peso, teto de 8
  min, passos sem desvio, réguas v4, embaralhamento determinístico, par
  simulado, ociosidade, banco padrão e o FALLBACK do controller, tetos e
  exceções nomeadas, e o 422 contando a tentativa (service com Prisma falso).
- `tests/juri-estadual-postgres.spec.ts` — RLS das 4 tabelas, CHECKs novos,
  feed saturado, relógio, batimento, latches, `galeria-sem-inspecao`, 422,
  banco padrão, painel (ocioso, `painel_vistas`, histórico). Precisa do banco
  com a migração `20261010120000` aplicada.
- `tests/podcast.spec.ts` — o roteiro do banco padrão literal e o da IA.
- A fixture (`tests/juri-estadual-fixture.ts`) é uma mostra da IA com os quatro formatos.
