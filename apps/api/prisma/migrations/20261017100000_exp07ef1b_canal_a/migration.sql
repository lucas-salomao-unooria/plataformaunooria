-- O CANAL A OBRIGATÓRIO NA A SELEÇÃO (ADR-170): as duas habilidades medidas
-- só por AÇÃO do estudante. O Canal B (as enquetes P1/P2 da Amara) saiu por
-- completo: a reflexão encerra a missão, e o passo `enquetes` fica no
-- vocabulário só para as sessões de antes.
--
-- 1. A LEGENDA (EF07CO11) é lida DEPOIS do latch, sem a criança esperar: a IA
--    devolve INDICADORES (razão, conteúdo, sem relação) e o servidor os
--    converte em nível. Falhando a IA (depois de até três tentativas), a regra
--    de palavras grava uma SUGESTÃO, sem marca, e a professora confirma.
-- 2. A MARCAÇÃO (EF07CO08) é uma etapa nova da turma, entre o Mural e as
--    fichas: o estudante aponta o post do colega que a publicação dele deixou
--    de fora — ou "Nada que mude a história". O nível congela na abertura das
--    fichas.

-- ============================================================ a etapa nova

ALTER TABLE "exp07ef1b_gates_turma" DROP CONSTRAINT "exp07ef1b_gates_turma_etapa_check";
ALTER TABLE "exp07ef1b_gates_turma"
  ADD CONSTRAINT "exp07ef1b_gates_turma_etapa_check"
    CHECK ("etapa" IN ('exploracao', 'mural', 'marcacao', 'fichas', 'explicacao'));

ALTER TABLE "exp07ef1b_sessoes" DROP CONSTRAINT "exp07ef1b_sessoes_passo_check";
ALTER TABLE "exp07ef1b_sessoes"
  ADD CONSTRAINT "exp07ef1b_sessoes_passo_check"
    CHECK ("passo" IN ('desafio', 'feed', 'salvos', 'publicado', 'mural', 'marcacao', 'fichas',
                       'explicacao', 'reflexao', 'enquetes', 'fim'));

-- ============================================================ as colunas

ALTER TABLE "exp07ef1b_sessoes"
  ADD COLUMN "n_podados" SMALLINT,
  ADD COLUMN "legenda_leitura" TEXT,
  ADD COLUMN "legenda_razao" BOOLEAN,
  ADD COLUMN "legenda_conteudo" BOOLEAN,
  ADD COLUMN "legenda_sem_relacao" BOOLEAN,
  ADD COLUMN "legenda_nivel" TEXT,
  ADD COLUMN "legenda_leitura_meta" JSONB,
  ADD COLUMN "marcacao_post_id" TEXT,
  ADD COLUMN "marcacao_nenhum" BOOLEAN,
  ADD COLUMN "marcacao_em" TIMESTAMPTZ(6),
  ADD COLUMN "marcacao_porque" VARCHAR(140);

-- A versão do instrumento sobe: a sessão nova é medida pela régua desta versão,
-- e a antiga fica com a dela (DAD-06) — nada é recalculado para trás.
ALTER TABLE "exp07ef1b_sessoes" ALTER COLUMN "versao_instrumento" SET DEFAULT '1.1.0';

-- ---------------------------------------------------------------- bloco MANUAL

ALTER TABLE "exp07ef1b_sessoes"
  -- `pendente` nasce no latch; `ia` e `reserva` são o fim da leitura. Nulo =
  -- sessão de antes desta versão (sem recálculo retroativo).
  ADD CONSTRAINT "exp07ef1b_sessoes_legenda_leitura_check"
    CHECK ("legenda_leitura" IS NULL OR "legenda_leitura" IN ('pendente', 'ia', 'reserva')),
  -- Na IA é o nível marcado; na reserva, a SUGESTÃO que a professora confirma.
  -- A reserva nunca sugere "não atingiu": a regra de palavras não enxerga texto
  -- sem relação.
  ADD CONSTRAINT "exp07ef1b_sessoes_legenda_nivel_check"
    CHECK ("legenda_nivel" IS NULL
           OR ("legenda_nivel" IN ('atingiu', 'em_processo', 'nao_atingiu')
               AND NOT ("legenda_leitura" = 'reserva' AND "legenda_nivel" = 'nao_atingiu'))),
  -- Só lê quem publicou.
  ADD CONSTRAINT "exp07ef1b_sessoes_legenda_leitura_publicada_check"
    CHECK ("legenda_leitura" IS NULL OR "publicada_em" IS NOT NULL),
  ADD CONSTRAINT "exp07ef1b_sessoes_n_podados_check"
    CHECK ("n_podados" IS NULL OR "n_podados" BETWEEN 0 AND 9),
  -- A marcação: um post OU "nada", nunca os dois; o post é um dos doze ids; e só
  -- quem publicou marca (não há colega sem tríade).
  ADD CONSTRAINT "exp07ef1b_sessoes_marcacao_check"
    CHECK (NOT ("marcacao_post_id" IS NOT NULL AND "marcacao_nenhum" IS TRUE)
           AND ("marcacao_post_id" IS NULL
                OR "marcacao_post_id" IN ('post_a_1', 'post_a_2', 'post_a_3', 'post_a_4',
                                          'post_b_1', 'post_b_2', 'post_b_3', 'post_b_4',
                                          'post_c_1', 'post_c_2', 'post_c_3', 'post_c_4'))
           AND (("marcacao_em" IS NOT NULL) = ("marcacao_post_id" IS NOT NULL OR "marcacao_nenhum" IS TRUE))
           AND ("marcacao_em" IS NULL OR "publicada_em" IS NOT NULL)),
  -- O "por quê?" é texto livre de menor: 1 a 140 code points, só depois de marcar.
  ADD CONSTRAINT "exp07ef1b_sessoes_marcacao_porque_check"
    CHECK ("marcacao_porque" IS NULL
           OR (char_length(btrim("marcacao_porque")) BETWEEN 1 AND 140 AND "marcacao_em" IS NOT NULL));
