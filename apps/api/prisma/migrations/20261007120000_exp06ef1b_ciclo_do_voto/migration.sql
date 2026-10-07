-- exp06ef1b-ciclo-do-voto: o Júri Estadual com o ciclo do voto que o PO pediu
-- e a spec perdeu (2026-10-07).
--
-- 1. O SALVAR pesa no feed (curtir 3, salvar 2, ficar 1): a coluna `salvos`,
--    uma lista como `curtidos`.
--
-- 2. A JUSTIFICATIVA antes e depois — "Antes eu pensava… Agora eu percebo…":
--    na cédula, um cartão de motivo (`voto_motivo`, v1–v3) e o índice da frase
--    grifada da legenda do estande (`voto_trecho`); na revisão, o mesmo par
--    (`revisao_motivo`, r1–r3; `revisao_trecho`). Índice, nunca texto: a legenda
--    é do professor, e texto livre de menor não entra. As sessões que JÁ votaram
--    ficam com os campos nulos (votaram antes dos cartões); a equivalência só
--    vale de lá para cá: motivo e trecho andam JUNTOS, e só existem com o voto
--    (ou com a revisão).
--
-- 3. O COMPLEMENTAR na revisão: manter o voto e indicar TAMBÉM outro estande
--    (`complemento_projeto`). O voto final continua o inicial.
--
-- 4. A RODADA DE DESVIO: a etapa `desvio` da turma (o professor a libera depois
--    da galeria, com o carimbo `desvio_liberado_em`), o passo `revisada` (a
--    espera dela, gravado pela revisão), o passo efetivo `desvio` (nunca gravado,
--    como a `galeria`), as quatro listas do feed de seis e o carimbo
--    `desvio_concluido_em`, que leva o passo de `revisada` a `cadeia`.
--
--    As sessões que JÁ passaram da revisão (`cadeia` em diante) entram com o
--    desvio concluído no carimbo da revisão: elas rodaram antes de a rodada de
--    desvio existir, e a equivalência nova ("passou da espera ⇔ concluiu o
--    desvio") vale para elas sem mudar o passo de ninguém.
--
-- Os CHECKs que citavam o vocabulário antigo são recriados com o novo — o mesmo
-- texto de `src/juri-estadual/regras/passos.ts` e de `vocabulario.ts`, que
-- `tests/juri-estadual-postgres.spec.ts` compara. Sem RLS nova: as duas tabelas
-- já têm RLS FORCE e a política por escola, e coluna nova herda as duas.

-- ── as colunas ──────────────────────────────────────────────────────────────

ALTER TABLE "exp06ef1b_gates_turma" ADD COLUMN "desvio_liberado_em" TIMESTAMPTZ(6);

ALTER TABLE "exp06ef1b_sessoes"
  ADD COLUMN "salvos"              JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "voto_motivo"         TEXT,
  ADD COLUMN "voto_trecho"         INTEGER,
  ADD COLUMN "complemento_projeto" TEXT,
  ADD COLUMN "revisao_motivo"      TEXT,
  ADD COLUMN "revisao_trecho"      INTEGER,
  ADD COLUMN "desvio_servidos"     JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "desvio_curtidos"     JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "desvio_salvos"       JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "desvio_permanencias" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "desvio_concluido_em" TIMESTAMPTZ(6);

-- ── as sessões que já passaram da revisão ───────────────────────────────────

UPDATE "exp06ef1b_sessoes"
   SET "desvio_concluido_em" = "revisado_em", "atualizado_em" = now()
 WHERE "passo" IN ('cadeia', 'mariana', 'enquetes', 'fim');

-- ── a turma: a etapa nova ───────────────────────────────────────────────────

ALTER TABLE "exp06ef1b_gates_turma"
  DROP CONSTRAINT "exp06ef1b_gates_turma_etapa_check",
  DROP CONSTRAINT "exp06ef1b_gates_turma_portao_check";

ALTER TABLE "exp06ef1b_gates_turma"
  ADD CONSTRAINT "exp06ef1b_gates_turma_etapa_check"
    CHECK ("etapa" IN ('exploracao', 'galeria', 'desvio')),
  -- Os dois portões são DA RODADA em andamento e andam com a etapa: o da
  -- galeria fica aberto quando o desvio abre. Zerar e pôr outra atividade no ar
  -- limpam os dois no mesmo UPDATE que volta a etapa.
  ADD CONSTRAINT "exp06ef1b_gates_turma_portao_check"
    CHECK (("galeria_liberada_em" IS NOT NULL) = ("etapa" IN ('galeria', 'desvio'))
           AND ("desvio_liberado_em" IS NOT NULL) = ("etapa" = 'desvio'));

-- ── a sessão: os passos, as listas, o vocabulário e os latches ──────────────

ALTER TABLE "exp06ef1b_sessoes"
  DROP CONSTRAINT "exp06ef1b_sessoes_passo_check",
  DROP CONSTRAINT "exp06ef1b_sessoes_passo_gravado_check",
  DROP CONSTRAINT "exp06ef1b_sessoes_feed_check",
  DROP CONSTRAINT "exp06ef1b_sessoes_vocabulario_check",
  DROP CONSTRAINT "exp06ef1b_sessoes_revisao_check",
  DROP CONSTRAINT "exp06ef1b_sessoes_latch2_check";

ALTER TABLE "exp06ef1b_sessoes"
  ADD CONSTRAINT "exp06ef1b_sessoes_passo_check"
    CHECK ("passo" IN ('credencial', 'feed', 'lacrada', 'galeria', 'revisada', 'desvio', 'cadeia',
                       'mariana', 'enquetes', 'fim')),
  -- `galeria` e `desvio` são impostos pela etapa da turma a quem está em
  -- `lacrada` e em `revisada` (`regras/passos.ts#passoEfetivo`) — nunca
  -- gravados. Gravá-los faria o F5 de uma rodada zerada abrir a porta sem o
  -- professor ter liberado.
  ADD CONSTRAINT "exp06ef1b_sessoes_passo_gravado_check"
    CHECK ("passo" NOT IN ('galeria', 'desvio')),
  ADD CONSTRAINT "exp06ef1b_sessoes_feed_check"
    CHECK (jsonb_typeof("posts_servidos") = 'array' AND jsonb_array_length("posts_servidos") <= 10
           AND jsonb_typeof("curtidos") = 'array'
           AND jsonb_typeof("salvos") = 'array'
           AND jsonb_typeof("permanencias") = 'array'
           AND jsonb_typeof("desvio_servidos") = 'array' AND jsonb_array_length("desvio_servidos") <= 6
           AND jsonb_typeof("desvio_curtidos") = 'array'
           AND jsonb_typeof("desvio_salvos") = 'array'
           AND jsonb_typeof("desvio_permanencias") = 'array'),
  ADD CONSTRAINT "exp06ef1b_sessoes_vocabulario_check"
    CHECK (("conviccao" IS NULL OR "conviccao" IN ('examinei_bem', 'vi_tudo'))
           AND ("revisao_acao" IS NULL OR "revisao_acao" IN ('manter', 'trocar', 'complementar'))
           AND ("voto_motivo" IS NULL OR "voto_motivo" IN ('v1', 'v2', 'v3'))
           AND ("revisao_motivo" IS NULL OR "revisao_motivo" IN ('r1', 'r2', 'r3'))
           AND ("voto_trecho" IS NULL OR "voto_trecho" BETWEEN 0 AND 11)
           AND ("revisao_trecho" IS NULL OR "revisao_trecho" BETWEEN 0 AND 11)
           AND ("voto_projeto" IS NULL OR "voto_projeto" ~ '^proj-[a-d][1-4]$')
           AND ("voto_revisado" IS NULL OR "voto_revisado" ~ '^proj-[a-d][1-4]$')
           AND ("complemento_projeto" IS NULL OR "complemento_projeto" ~ '^proj-[a-d][1-4]$')
           AND ("mecanismo" IS NULL OR "mecanismo" IN ('m1', 'm2', 'm3'))
           AND ("atitude" IS NULL OR "atitude" IN ('t1', 't2'))),
  -- A justificativa é um par: cartão e trecho juntos, e só com o gesto dela.
  ADD CONSTRAINT "exp06ef1b_sessoes_justificativa_check"
    CHECK (("voto_motivo" IS NULL) = ("voto_trecho" IS NULL)
           AND ("voto_motivo" IS NULL OR "votado_em" IS NOT NULL)
           AND ("revisao_motivo" IS NULL) = ("revisao_trecho" IS NULL)
           AND ("revisao_motivo" IS NULL OR "revisado_em" IS NOT NULL)),
  -- O LATCH 2: ação, voto final e carimbo juntos; manter e complementar
  -- repetem o voto, trocar escolhe outro; o complemento só existe no
  -- complementar, e é outro estande.
  ADD CONSTRAINT "exp06ef1b_sessoes_revisao_check"
    CHECK (("revisado_em" IS NOT NULL) = ("revisao_acao" IS NOT NULL)
           AND ("revisado_em" IS NOT NULL) = ("voto_revisado" IS NOT NULL)
           AND ("revisado_em" IS NULL OR "votado_em" IS NOT NULL)
           AND ("revisao_acao" IS DISTINCT FROM 'manter' OR "voto_revisado" = "voto_projeto")
           AND ("revisao_acao" IS DISTINCT FROM 'trocar' OR "voto_revisado" <> "voto_projeto")
           AND ("revisao_acao" IS DISTINCT FROM 'complementar' OR "voto_revisado" = "voto_projeto")
           AND (("complemento_projeto" IS NOT NULL) = ("revisao_acao" IS NOT DISTINCT FROM 'complementar'))
           AND ("complemento_projeto" IS NULL OR "complemento_projeto" <> "voto_projeto")),
  -- A revisão tira o passo gravado de `lacrada` — agora para a espera do desvio.
  ADD CONSTRAINT "exp06ef1b_sessoes_latch2_check"
    CHECK (("revisado_em" IS NOT NULL) = ("passo" IN ('revisada', 'cadeia', 'mariana', 'enquetes', 'fim'))),
  -- E o desvio concluído tira de `revisada`, para a cadeia.
  ADD CONSTRAINT "exp06ef1b_sessoes_desvio_check"
    CHECK (("desvio_concluido_em" IS NOT NULL) = ("passo" IN ('cadeia', 'mariana', 'enquetes', 'fim'))
           AND ("desvio_concluido_em" IS NULL OR "revisado_em" IS NOT NULL));
