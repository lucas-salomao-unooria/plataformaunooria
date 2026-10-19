# apps/api/src/juri-estadual — O Júri Estadual de Projetos (exp06ef1b)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

## A missão (exp06ef1b 0.6.0 — instrumento 4.0.0 —, PRD v2 com os 40 projetos e o Canal A puro da ADR-174, rotas `/juri-estadual/*`)

Missão de 6º ano, unidade 1, no Unoovista. A criança é jurada de uma mostra
estadual: rola um feed de dez posts (ou 8 minutos) que as curtidas dela
AFUNILAM em silêncio, vota numa cédula lacrada (LATCH 1), SEPARA os estandes
que viu nas 4 áreas (EF06CO01) e espera a turma (o PICO: o professor projeta a
dispersão de votos). Passos: `feed → classificacao → lacrada → galeria →
revisada → cadeia → mariana → fim`. O professor clica "Liberar Auditoria": ela
vê a Galeria Oculta — "30 de 40", o que ficou fora POR ÁREA e o CONTRAFACTUAL
"sem as suas curtidas" —, busca por hashtag e MANTÉM ou TROCA o voto (LATCH 2).
Depois avança sozinha para a REGRA SE … ENTÃO (EF06CO03, passo `cadeia`) e o
caso Mariana, cujos cartões concluem. Quatro tabelas: `exp06ef1b_pacotes`,
`exp06ef1b_gates_turma`, `exp06ef1b_gates_historico`, `exp06ef1b_sessoes`.

**Segue o PRD v2 com as 9 melhorias do dono (2026-10-10) e a ADR-174.** O
ciclo do voto da 0.3.0 SAIU (justificativa, complementar, RODADA DE DESVIO); as
colunas ficam sem uso, e `complementar` segue aceito no CHECK, lido como manter.
Nenhuma migração apaga coluna: linha antiga continua válida.

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
  `feed_iniciado_em`; esgotado, `cedulaLiberada` (voto com < 10). F5 não zera.
- **Ociosos** (melhoria 8): `POST cedula/batimento` a cada 15 s com a cédula
  aberta (`segundosSemToque`) grava `cedula_batimento_em`/`cedula_inativa_desde`;
  o painel acende `ocioso` com > 60 s e batimento de até 40 s
  (`regras/painel.ts#ociosoNaCedula`). O voto apaga o par (CHECK: só antes do voto).
- **A SEPARAÇÃO** (`regras/classificacao.ts`, `POST classificacao`): o voto
  leva ao passo `classificacao`; os estandes DISTINTOS vistos descem com id
  opaco `cl-xxx`, título e imagem — sem área, hashtag nem perfil (o perfil É a
  hashtag). Uma vez (409 `classificacao-ja-enviada`; corpo incompleto ou de
  outra sessão, 400); corrige no servidor, grava `classificacao_*` +
  `classificacao_status` e leva a `lacrada`. Responde SÓ o estado. Galeria
  liberada antes: ela termina a separação e cai na galeria. Não é segredo: o
  feed já deu a área (a hashtag vista); o id opaco tira a resposta da TELA.
- **A revisão tem dois botões** (melhoria 6): `manter` exige ≥ 1 oculto aberto
  (409 `galeria-sem-inspecao`); `trocar` aceita os do pacote menos o voto.
  **Não marca** desde a 0.6.0. Depois, `POST passo {para: "cadeia"}`.
- **A REGRA SE … ENTÃO** (`regras/regra.ts`, `POST regra`; o passo guarda o
  nome `cadeia`): `conteudo.ts#PECAS_DO_SE/PECAS_DO_ENTAO`, 3 de cada lado, uma
  certa, ids `rg-xxx`. Uma vez; grava `regra_se`/`regra_entao` e o carimbo da
  cadeia (`cadeia_montada_em`, `cadeia_tentativas = 1`) e responde a REVELAÇÃO
  (`motivo` `curtidas | permanencia | variado` + a área em foco, do feed DELA);
  reenviar devolve a mesma. "Ficar muito tempo" não é distrator: o motor pesa
  a permanência. A cadeia de 4 blocos, o `ordem-incorreta` e o par simulado
  SAÍRAM; `regras/ordem.ts` só sorteia ids opacos.
- **Mariana e os 5 cartões** literais do 01e (`m1`–`m3`, `t1`–`t2`), juntos e
  embaralhados por sessão. Os cartões CONCLUEM (`fim` + `concluida_em` no mesmo
  update); `POST concluir` só serve às sessões antigas em `enquetes`. O `m1`
  (27 palavras) é exceção NOMEADA do teto de 25 (`conteudo.ts#EXCECOES_DE_TETO`).
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
  progresso + `ocioso` + `separou` — NUNCA o acerto (é nível, vai ao painel de
  habilidades); o resumo conta `separaram`. A lousa
  do contraste é `resumo.concentracao` `{curtiram, naoCurtiram}`: entre quem
  votou, a média da fração do feed (0–100) na área mais vista, separando quem
  tem ≥ 1 curtida (≈ 70 × ≈ 30). Só agregado — `concentracao` está em
  `PROIBIDO_NA_LINHA_DO_PAINEL`. Cada GET incrementa `painel_vistas` (EVT-P04). O botão grava uma linha em
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
  ponta: ~42 s. Área que falha derruba o rascunho (fallback da rota); toda
  tentativa é debitada. A customização gera as 40 imagens quatro
  por chamada (`IMAGENS_POR_CHAMADA`).
- **O podcast** (ADR-150/151, RF-008): o banco padrão intocado tem o roteiro do
  sheet (aud-exp06ef1b-01, `ROTEIRO_DO_BANCO_PADRAO`) com os estandes DO BANCO
  nas três vagas (os 1–4, que ficaram) e sem número cravado ("mais da
  metade" — verdade com 30 de 40). Mudou o texto? Suba
  `VERSAO_DO_PEDIDO_DE_VOZ`, senão o áudio velho continua tocando. `padrao: true` sem
  linha na tabela; as falas do sheet ativam esse roteiro
  (`ehFalaDoBancoPadrao`). Mostra da IA: texto fixo corrigido + as três vagas
  revisadas na criação (`homologar`). Toca depois da Etapa 4 (o guia avisa).

## A evidência (E14)

Ficha `evidencias/fichas/exp06ef1b.ts` **versão 5** (ADR-174, `regras/evidencia.ts`),
só ação, sem perguntas; marcado na transação de cada tarefa (porta `marcar`):

- **EF06CO01** (a principal) `classificacao`: fração de acertos ≥ 0,9 = atingiu
  (9–10 de 10); ≥ 0,5 = em processo; menos = não; < 4 estandes vistos = SEM
  marca (`MINIMO_PARA_CLASSIFICAR`).
- **EF06CO03** `regra` (id NOVO): 2 peças certas = atingiu; 1 = em processo; 0
  = não (chute: 1 em 9 atinge).
- **A EF06CO10 saiu**, com as enquetes P1–P3 e o `registrarContexto`; a galeria
  não marca. `auditoria`, `cadeia` e `p1`–`p3` ficam no histórico (versão 4).
  Toda rodada mede de novo (ADR-145). `enquete_*_alt` nunca foram escritas.

## As suítes

- `tests/juri-estadual-regras.spec.ts` — SEM banco: as PROVAS dos 40 em
  centenas de sementes (curtiu cedo: 10 distintos, 7/1/1/1; sem toque:
  3/3/2/2; 30 de 40; contrafactual; concentração 70 × 30), os ids opacos, a
  separação, a regra e a ficha 5, o banco de 40 (sha256 dos 16), o preparo por
  área e o FALLBACK.
- `tests/juri-estadual-midia.spec.ts` — refazer, o lote de quatro, as imagens
  do BANCO (guarda de admin, só as que faltam, atribuição no medidor real) e o
  preparo em cinco chamadas com IA falsa.
- `tests/juri-estadual-postgres.spec.ts` — RLS, CHECKs (16/40 sim, 15 não;
  `proj-d10` sim, `proj-e1`/`proj-a11` não; os da separação e da regra),
  galeria, a separação, a regra, Mariana que conclui, a sessão antiga em
  `enquetes`, a `midia` do banco. Migração `20261018090000`.
- `tests/podcast.spec.ts` — os roteiros e o material de 40.
