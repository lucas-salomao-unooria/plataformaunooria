# apps/api/src/juri-estadual — O Júri Estadual de Projetos (exp06ef1b)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

## A missão (exp06ef1b 0.7.0 — instrumento 5.0.0 —, PRD v2, Canal A da ADR-174, ajustes do time da ADR-176, rotas `/juri-estadual/*`)

Missão de 6º ano, unidade 1, no Unoovista. A criança é jurada de uma mostra
estadual: rola um feed de dez posts (ou 8 minutos) que as curtidas dela
AFUNILAM em silêncio, guardando cada estande na PASTA da área dele (EF06CO01),
vota numa cédula lacrada (LATCH 1) e espera a turma (o PICO: o professor
projeta a dispersão de votos). Passos: `feed → lacrada → galeria → revisada →
cadeia → fim`. O professor clica "Liberar Auditoria": ela vê a Galeria Oculta
("30 de 40"), busca por hashtag e MANTÉM ou TROCA o voto (LATCH 2). Depois
avança sozinha para a REGRA SE … ENTÃO (EF06CO03, passo `cadeia`), que CONCLUI.
Quatro tabelas: `exp06ef1b_pacotes`,
`exp06ef1b_gates_turma`, `exp06ef1b_gates_historico`, `exp06ef1b_sessoes`.

**Segue o PRD v2 com as 9 melhorias do dono (2026-10-10), a ADR-174 e a 176.** O
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
  (`compararIdsDeProjeto`: `proj-a9` antes de `proj-a10`). **Compatibilidade**: o pacote de 16 e a sessão 2.0.0 continuam
  LEGÍVEIS (a leitura aceita 16 ou 40 e os ids de post legados;
  `invisibilidade` usa o total DO PACOTE); só a ESCRITA
  (`ConteudoDoPacoteSchema`: homologar, preparo, banco padrão, podcast) exige
  40, e descarta `prototipo`/`depoimento`. Na troca e no "abrir" da galeria, id
  que o pacote não tem é 400 (a regex aceita `proj-a10`; o pacote de 16 não).
- **O BANCO PADRÃO** (`banco-padrao.ts`): QUARENTA projetos. Os 1–4 de cada
  área são os 16 do 01e, LITERAIS, com o mesmo id (o podcast padrão os cita, e
  `ehConteudoDoBancoPadrao` reconhece também o pacote `padrao` antigo de 16 —
  `conteudoDoBancoPadraoLegado`); os 5–10 foram escritos no molde deles (o
  teste prova o sha256 dos 16). Três entradas: `POST turmas/:t/banco-padrao`
  (atalho sem IA, `porNoAr` põe em andamento); o FALLBACK
  do `gerar-conteudo` (sem cota OU IA fora → 200 `usouIa: false`, `origem:
  "padrao"`, `motivo`, `imagens`); e homologar o conteúdo intocado. O 01e não
  tem perfil nem imagem: perfil sai da escola, imagem descreve o título.
- **QUATRO imagens por estande** (ADR-178, `regras/laminas.ts`): `capa` (chave =
  id, arquivo de sempre), `detalhe`, `equipe`, `bastidor` (`proj-a1:detalhe`,
  `promptDaLamina`). Conta por CHAVE; a desconhecida some.
- **As IMAGENS DO BANCO PADRÃO** (`banco-padrao-imagens.service.ts`): o MESMO
  nome da customização; o storage É o registro (sem tabela). `GET`/`POST
  /juri-estadual/banco-padrao/imagens` só do `admin`, até oito por chamada,
  idempotente, SEM quota de professor, rate limit, medido no
  painel de custos com atribuição EXPLÍCITA (`juri-estadual-banco-padrao`,
  `admin`, sem escola). O controller lê as que existem (`existentes`) e `usarBancoPadrao`, fallback e `homologar` do banco intocado as põem
  na `midia`; sem imagem, a arte procedural. O pacote reaproveitado FORA do ar
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
  0.4.x SAIU; o `bastidor` continua como texto (do post, a última lâmina do
  carrossel, e o `resumo` da galeria). Uma sessão 2.0.0 continua de onde
  parou, só com apresentações de projetos novos.
- **As PASTAS** (ADR-176, `regras/classificacao.ts`): `feed/eventos` aceita
  `salvamentos[].pasta`; pasta guarda ou MOVE, tirar dos salvos apaga
  (`aplicarPastas`); vai em `pastas` (JSONB). O `FeedSchema` traz `pastas` e
  `semPasta`. Salvar segue sem pesar no motor.
- **8 minutos do servidor** (melhoria 9): o 1º `proximo: true` grava
  `feed_iniciado_em`; esgotado, `cedulaLiberada` (voto com < 10). F5 não zera.
- **Ociosos** (melhoria 8): `POST cedula/batimento` a cada 15 s com a cédula
  aberta (`segundosSemToque`) grava `cedula_batimento_em`/`cedula_inativa_desde`;
  o painel acende `ocioso` com > 60 s e batimento de até 40 s
  (`regras/painel.ts#ociosoNaCedula`). O voto apaga o par (CHECK: só antes do voto).
- **O VOTO corrige a SEPARAÇÃO**: estande visto sem pasta = 409
  `estandes-sem-pasta`; no MESMO update, `respostasDasPastas` +
  `corrigirClassificacao` gravam `classificacao_*` (formato da 0.6.0), a marca
  entra na transação e o passo vai a `lacrada`. A tela "Organize o que você
  viu" (`POST classificacao`) SAIU. Sessão antiga em `classificacao`: `POST
  passo {para: "lacrada"}`, sem marca. Risco aceito (ADR-176): o post mostra
  perfil e hashtag, que a 0.6.0 escondia; a resposta segue fora da tela.
- **A revisão tem dois botões** (melhoria 6): `manter` exige ≥ 1 oculto aberto
  (409 `galeria-sem-inspecao`); `trocar` aceita os do pacote menos o voto.
  **Não marca** desde a 0.6.0. Depois, `POST passo {para: "cadeia"}`.
- **A REGRA SE … ENTÃO** (`regras/regra.ts`, `POST regra`; o passo guarda o
  nome `cadeia`): `conteudo.ts#PECAS_DO_SE/PECAS_DO_ENTAO`, 3 de cada lado, uma
  certa, ids `rg-xxx`. Uma vez, e CONCLUI (`fim` + `concluida_em`); grava
  `regra_se`/`regra_entao` e o carimbo da cadeia e responde a REVELAÇÃO
  (`motivo` `curtidas | permanencia | variado` + a área em foco, do feed DELA);
  reenviar devolve a mesma. "Ficar muito tempo" não é distrator: o motor pesa
  a permanência. `regras/ordem.ts` só sorteia ids opacos.
- **O caso Mariana SAIU** (ADR-176): `POST cartoes`, `CartoesSchema` e o bloco
  `mariana` do `MaterialSchema` foram embora; `mariana` fica no CHECK e no
  vocabulário, e `POST concluir` leva a `fim` quem parou nele ou em `enquetes`.
  `mecanismo`/`atitude`/`cartoes_em` ficam sem uso.
- **O acervo não desce antes da galeria** (allowlist `regras/publico.ts`); a
  galeria exige passo efetivo `galeria` (voto E etapa) e traz `invisibilidade`
  `{ocultos, total}`, `porArea` (`{area, vistos, total}`, projetos distintos;
  fora da tela desde a 0.7.0, mas escolhe a área inicial da grade),
  `semCurtidas` (o CONTRAFACTUAL, também fora da tela:
  `servirAte(projetos, FEED_VAZIO, semente, N)` com N = posts que a criança viu — cortado pelos 8 min, tem N —, por área, na
  ordem do pacote; calculado aqui, o motor nunca desce), `ocultosAbertos`,
  `podeManter` e `resumo` (o bastidor, a ficha de inspeção).
- **A disciplina do preparo cobre o 6º ano inteiro da BNCC, mais Computação**
  (`componentesDoAno("6EF")` + `computacao`, e `projeto-interdisciplinar` no
  fim; o banco padrão é `ciencias`). O CHECK foi recriado em
  `20261026230000_componentes_bncc_nas_missoes`; só se ACRESCENTA valor, e o
  espelho do hub (`lib/juri-estadual-tipos.ts`) acompanha.
- **Locks**: por estudante (funil `garantirSessao`) e da turma (exclusivo para
  botão/zerar/homologar/pôr no ar/banco padrão; compartilhado nas jogadas que
  marcam, com 409 `rodada-mudou`).
- **O painel** conta por COMPUTADOR e é projetado (PED-07): a linha diz só
  progresso + `ocioso` + `separou` — NUNCA o acerto (é nível, vai ao painel de
  habilidades); o resumo conta `separaram`. A lousa
  do contraste é `resumo.concentracao` `{curtiram, naoCurtiram}`: entre quem
  votou, a média da fração do feed (0–100) na área mais vista, separando quem
  tem ≥ 1 curtida (≈ 70 × ≈ 30). Só agregado — `concentracao` está em
  `PROIBIDO_NA_LINHA_DO_PAINEL`. GET incrementa `painel_vistas` (EVT-P04); o botão grava uma linha em
  `exp06ef1b_gates_historico` (EVT-P05). `homologar` grava `aprovado_em/por` e
  `preparo_iniciado_em` (opcional no corpo, últimas 24 h).
- **A IA só existe fora da aula**: do professor, o preparo, a regeneração e
  as imagens — quota do perfil (ADR-105); do `admin`, as imagens do banco
  padrão (custo da plataforma, sem quota). Sem acervo no runtime. **O preparo
  são CINCO chamadas** (medido com IA real em 2026-10-14: os 40 numa chamada
  levaram 93 s e 9.900 tokens de saída — a 2ª tentativa estouraria os 180 s do
  BFF; por área, ~25 s e ~2.500): as categorias, depois as quatro áreas em
  PARALELO, e o estande que repetir título ou perfil de outra área é regerado
  sozinho (`promptDaRegeneracao`). Ponta a ponta: ~42 s. Área que falha derruba
  o rascunho (fallback da rota); toda tentativa é debitada. Imagens: 160, oito
  por chamada, quatro em paralelo.
- **O podcast** (ADR-150/151, RF-008): o banco padrão intocado tem o roteiro do
  sheet (aud-exp06ef1b-01, `ROTEIRO_DO_BANCO_PADRAO`) com os estandes DO BANCO
  nas três vagas (os 1–4, que ficaram) e sem número cravado ("mais da
  metade" — verdade com 30 de 40). Mudou o texto? Suba
  `VERSAO_DO_PEDIDO_DE_VOZ`, senão o áudio velho continua tocando. `padrao: true` sem
  linha na tabela; as falas do sheet ativam esse roteiro
  (`ehFalaDoBancoPadrao`). Mostra da IA: texto fixo corrigido + as três vagas
  revisadas na criação (`homologar`). Toca depois da Etapa 4 (o guia avisa).

## A evidência (E14)

Ficha `evidencias/fichas/exp06ef1b.ts` **versão 6** (ADR-176 sobre a 174, `regras/evidencia.ts`),
só ação, sem perguntas; marcado na transação de cada tarefa (porta `marcar`):

- **EF06CO01** (a principal) `classificacao` ("Pastas dos estandes",
  marcado no VOTO; régua da v5, mudou onde se separa): fração de acertos ≥ 0,9 = atingiu
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
  3/3/2/2; 30 de 40; contrafactual; concentração 70 × 30), os ids opacos, as
  pastas (guardar, mover, apagar; respostas no formato 0.6.0), a regra e a
  ficha 6, o banco de 40 (sha256 dos 16), o preparo por
  área e o FALLBACK.
- `tests/juri-estadual-midia.spec.ts` — refazer por lâmina, o lote de oito, as imagens
  do BANCO (guarda de admin, só as que faltam, atribuição no medidor real) e o
  preparo em cinco chamadas com IA falsa.
- `tests/juri-estadual-postgres.spec.ts` — RLS, CHECKs (16/40 sim, 15 não;
  `proj-d10` sim, `proj-e1`/`proj-a11` não; os da separação e da regra),
  galeria, as pastas que não pesam no feed, o voto sem pastas (409) e com 7
  de 10 (em processo), a regra que conclui, as sessões antigas em
  `classificacao`, `mariana` e `enquetes`, a `midia` do banco. Migração
  `20261020120000`.
- `tests/podcast.spec.ts` — os roteiros e o material de 40.
