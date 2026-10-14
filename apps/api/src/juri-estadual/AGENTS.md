# apps/api/src/juri-estadual — O Júri Estadual de Projetos (exp06ef1b)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

## A missão (exp06ef1b 0.5.0 na api — instrumento 3.0.0 —, PRD v2 de 2026-10-10 com os 40 projetos de 2026-10-14, rotas `/juri-estadual/*`)

Missão de 6º ano, unidade 1, no Unoovista. A criança é jurada de uma mostra
estadual: rola um feed de dez posts (ou 8 minutos) que as curtidas dela
AFUNILAM em silêncio, vota numa cédula lacrada (LATCH 1) e espera a turma (o
PICO: o professor projeta a dispersão de votos). O professor clica "Liberar
Auditoria": ela vê a Galeria Oculta — "30 de 40", o que ficou fora POR ÁREA e
o CONTRAFACTUAL "sem as suas curtidas" —, busca por hashtag e MANTÉM ou TROCA
o voto (LATCH 2). Depois avança sozinha para a
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
- **QUARENTA projetos, dez por área** (aprovado pelo PO em 2026-10-14; até a
  0.4.x eram 16). Ids `proj-[a-d](10|[1-9])`, ordem NUMÉRICA onde houver ordem
  (`compararIdsDeProjeto`: `proj-a9` antes de `proj-a10`; `charAt(6)` não lê o
  número). **Compatibilidade**: o pacote de 16 e a sessão 2.0.0 (posts de
  quatro formatos) continuam LEGÍVEIS — `LeituraDoConteudoSchema`/
  `ConteudoDoPacoteLidoSchema` aceitam 16 ou 40, `ID_DE_POST_RE` aceita os
  formatos legados, `invisibilidade` usa o total DO PACOTE; só a ESCRITA
  (`ConteudoDoPacoteSchema`: homologar, preparo, banco padrão, podcast) exige
  40, e descarta `prototipo`/`depoimento`. Na troca e no "abrir" da galeria, id
  que o pacote não tem é 400 (a regex aceita `proj-a10`; o pacote de 16 não).
- **O BANCO PADRÃO** (`banco-padrao.ts`): QUARENTA projetos. Os 1–4 de cada
  área são os 16 do 01e, LITERAIS, com o mesmo id (o podcast padrão os cita, e
  `ehConteudoDoBancoPadrao` reconhece também o pacote `padrao` antigo de 16 —
  `conteudoDoBancoPadraoLegado`); os 5–10 foram escritos no molde deles (o
  teste prova o sha256 dos 16). Três entradas: `POST turmas/:t/banco-padrao`
  (o atalho, sem IA, imagens aprovadas, `porNoAr` põe em andamento); o FALLBACK
  do `gerar-conteudo` (sem cota OU IA fora → 200 `usouIa: false`, `origem:
  "padrao"`, `motivo`, `imagens`); e homologar o conteúdo intocado. O 01e não
  tem perfil nem imagem: perfil sai da escola, imagem descreve o título.
- **As IMAGENS DO BANCO PADRÃO** (`banco-padrao-imagens.service.ts`): uma por
  projeto, com o MESMO nome da customização (`nomeDaImagem(descricao)`); o
  storage É o registro (sem tabela). `GET`/`POST /juri-estadual/banco-padrao/imagens`
  só do `admin` (403 para os outros), até quatro por chamada, idempotente,
  SEM quota de professor, rate limit por usuário, e medido no painel de custos
  com atribuição EXPLÍCITA (`AiImagemOpcoes.atribuicao`: recurso
  `juri-estadual-banco-padrao`, perfil `admin`, sem escola). A ligação: o
  controller lê as que existem (`existentes`, que nunca lança) e o
  `usarBancoPadrao`, o fallback e o `homologar` do banco intocado as põem na
  `midia`; sem imagem, a arte procedural. O pacote reaproveitado FORA do ar
  ganha as que faltavam; no ar, não muda.
- **Atividade = o PACOTE; rodada = o "Zerar"** (ADR-130/155): igual à 0.3.0 —
  gate PK `turma_id`, sessão por (pacote, rodada), um ativo por turma (índice
  parcial), zerar apaga a evidência do pacote. Duas fases de aprovação
  (ADR-146): `homologar` (textos) e `aprovar-imagens`.
- **O motor roda no SERVIDOR** (`regras/afunilamento.ts`, puro). Curtir 3,
  ficar > 5 s 1, **salvar 0** (grava, não pesa). Abertura: um post de cada área.
  `areaLider`: ≥ 6 pontos; **sem curtida nenhuma, a permanência sozinha elege**.
  `areaEmFoco`: a líder, ou (com alguma curtida) a de maior peso. **Nenhum post
  se repete**: o motor serve SÓ `apresentacao` (`TIPOS_DE_POST`); com foco, os
  posts 5..10 são projetos NOVOS da área (o da abertura + até 6; ela tem 10).
  Quem curte cedo: 7/1/1/1; quem não interage: 3/3/2/2 (a menos vista). Os dois
  ficam com 30 de 40 fora — o que muda é QUAIS. A saturação por formatos da
  0.4.x (`formatoQueFalta`, `PROJETOS_DA_AREA_EM_FOCO`) SAIU; o `bastidor`
  continua como texto (o `bastidor` do post, a última lâmina do carrossel, e o
  `resumo` da galeria). Uma sessão 2.0.0 continua de onde parou, só com
  apresentações de projetos novos.
- **8 minutos do servidor** (melhoria 9): o 1º `proximo: true` grava
  `feed_iniciado_em`; esgotado, o feed não serve mais e `cedulaLiberada` vira
  `true` (voto aceito com < 10). F5 não zera.
- **Ociosos** (melhoria 8): `POST cedula/batimento` a cada 15 s com a cédula
  aberta (`segundosSemToque`) grava `cedula_batimento_em`/`cedula_inativa_desde`;
  o painel acende `ocioso` com > 60 s e batimento de até 40 s
  (`regras/painel.ts#ociosoNaCedula`). O voto apaga o par (CHECK: só antes do voto).
- **A revisão tem dois botões** (melhoria 6): `manter` exige ≥ 1 oculto aberto
  (409 `galeria-sem-inspecao`); `trocar` aceita os do pacote menos o voto. Grava
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
  galeria exige passo efetivo `galeria` (voto E etapa) e traz `invisibilidade`
  `{ocultos, total}`, `porArea` (`{area, vistos, total}`, projetos distintos),
  `semCurtidas` (o CONTRAFACTUAL: `servirAte(projetos, FEED_VAZIO, semente, N)`
  com N = posts que a criança viu — cortado pelos 8 min, tem N —, por área, na
  ordem do pacote; calculado aqui, o motor nunca desce), `ocultosAbertos`,
  `podeManter` e `resumo` (o bastidor, a ficha de inspeção).
- **Locks**: por estudante (funil `garantirSessao`) e da turma (exclusivo para
  botão/zerar/homologar/pôr no ar/banco padrão; compartilhado nas jogadas que
  marcam, com 409 `rodada-mudou`).
- **O painel** conta por COMPUTADOR e é projetado (PED-07): a linha diz só
  progresso + `ocioso` + `categoriasBuscadas` (a leitura da EF06CO01). A lousa
  do contraste é `resumo.concentracao` `{curtiram, naoCurtiram}`: entre quem
  votou, a média da fração do feed (0–100) na área mais vista, separando quem
  tem ≥ 1 curtida (≈ 70 × ≈ 30). Só agregado — `concentracao` está em
  `PROIBIDO_NA_LINHA_DO_PAINEL`. A `invisibilidadeMedia` saiu (com 40 seria
  sempre a mesma). Cada GET
  incrementa `painel_vistas` (EVT-P04). O botão grava uma linha em
  `exp06ef1b_gates_historico` (EVT-P05). `homologar` grava `aprovado_em/por` e
  `preparo_iniciado_em` (opcional no corpo, últimas 24 h).
- **A IA só existe fora da aula**: do professor, o preparo, a regeneração e
  as imagens — quota do perfil (ADR-105); do `admin`, as imagens do banco
  padrão (custo da plataforma, sem quota). Sem acervo no runtime. **O preparo
  são CINCO chamadas** (medido com IA real em 2026-10-14: os 40 numa chamada
  levaram 93 s e 9.900 tokens de saída — a 2ª tentativa estouraria os 180 s do
  BFF; por área, ~25 s e ~2.500): as categorias, depois as quatro áreas em
  PARALELO (`promptDaArea`, `schemaDaArea`, `projetosDaAreaDaIa`), e o estande
  que repetir título ou perfil de outra área é regerado sozinho
  (`montarConteudo` → `promptDaRegeneracao`, que lista os outros 39). Ponta a
  ponta: ~42 s. Área que falha derruba o rascunho (o fallback é da rota);
  todas as tentativas são debitadas. A customização gera as 40 imagens quatro
  por chamada (`IMAGENS_POR_CHAMADA`).
- **O podcast** (ADR-150/151, RF-008): o banco padrão intocado tem o roteiro do
  sheet (aud-exp06ef1b-01, `ROTEIRO_DO_BANCO_PADRAO`) com os estandes DO BANCO
  nas três vagas (o sheet citava robô dos bueiros, hortas e drones, que não
  existem nele) e sem número cravado ("os projetos das outras áreas", "mais da
  metade" — verdade com 30 de 40). Os estandes citados são os 1–4 do banco, que
  ficaram. Mudou o texto? Suba
  `VERSAO_DO_PEDIDO_DE_VOZ`, senão o áudio velho continua tocando. `padrao: true` sem
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

- `tests/juri-estadual-regras.spec.ts` — SEM banco: as PROVAS dos 40 em
  centenas de sementes (curtiu cedo: 10 distintos, 7/1/1/1; sem toque:
  3/3/2/2; 30 de 40; contrafactual; concentração 70 × 30), a 0.4.x continuada,
  o banco de 40 (sha256 dos 16 de antes), o preparo por área e o FALLBACK.
- `tests/juri-estadual-midia.spec.ts` — refazer, o lote de quatro, as imagens
  do BANCO (guarda de admin, só as que faltam, atribuição no medidor real) e o
  preparo em cinco chamadas com IA falsa.
- `tests/juri-estadual-postgres.spec.ts` — RLS, CHECKs (16/40 sim, 15 não;
  `proj-d10` sim, `proj-e1`/`proj-a11` não), galeria, concentração fora da
  linha, a 0.4.x legível, a `midia` do banco. Migração `20261014120000`.
- `tests/podcast.spec.ts` — os roteiros e o material de 40.
