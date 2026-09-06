-- exp-06-rastro-boato: as quatro tabelas da missão.
--
-- Molde: 20260903120000_exp_07_o_eco_no_grupo. O Prisma gera as tabelas, os
-- índices e as FKs acima; CHECK, RLS e GRANT são o bloco MANUAL no fim — e é lá
-- que a regra inviolável nº 1 (todo dado de estudante escopado por escola) é
-- aplicada.

-- CreateTable
CREATE TABLE "exp_06_sessoes" (
    "escola_id" TEXT NOT NULL,
    "estudante_id" UUID NOT NULL,
    "turma_id" UUID,
    "passo" TEXT NOT NULL DEFAULT 'contexto',
    "opcao" TEXT,
    "latencia_seg" INTEGER,
    "houve_inacao_90s" BOOLEAN NOT NULL DEFAULT false,
    "ordem_blocos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "coerente" BOOLEAN,
    "score" INTEGER,
    "versao_instrumento" TEXT NOT NULL DEFAULT '1.0.0',
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluido_em" TIMESTAMPTZ(6),

    CONSTRAINT "exp_06_sessoes_pkey" PRIMARY KEY ("escola_id","estudante_id")
);

-- CreateTable
CREATE TABLE "exp_06_auditorias" (
    "id" BIGSERIAL NOT NULL,
    "escola_id" TEXT NOT NULL,
    "estudante_id" UUID NOT NULL,
    "mensagem_id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "tempo_leitura_s" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp_06_auditorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp_06_reflexoes" (
    "escola_id" TEXT NOT NULL,
    "estudante_id" UUID NOT NULL,
    "texto" VARCHAR(280) NOT NULL,
    "chars_count" INTEGER NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp_06_reflexoes_pkey" PRIMARY KEY ("escola_id","estudante_id")
);

-- CreateTable
CREATE TABLE "exp_06_gates_turma" (
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "etapa" TEXT NOT NULL DEFAULT 'aula1',
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp_06_gates_turma_pkey" PRIMARY KEY ("escola_id","turma_id")
);

-- CreateIndex
CREATE INDEX "exp_06_sessoes_escola_id_idx" ON "exp_06_sessoes"("escola_id");

-- CreateIndex
CREATE INDEX "exp_06_sessoes_escola_id_turma_id_idx" ON "exp_06_sessoes"("escola_id", "turma_id");

-- CreateIndex
CREATE INDEX "exp_06_auditorias_escola_id_estudante_id_idx" ON "exp_06_auditorias"("escola_id", "estudante_id");

-- CreateIndex
CREATE UNIQUE INDEX "exp_06_auditorias_escola_id_estudante_id_mensagem_id_key" ON "exp_06_auditorias"("escola_id", "estudante_id", "mensagem_id");

-- CreateIndex
CREATE INDEX "exp_06_reflexoes_escola_id_idx" ON "exp_06_reflexoes"("escola_id");

-- CreateIndex
CREATE INDEX "exp_06_gates_turma_escola_id_idx" ON "exp_06_gates_turma"("escola_id");

-- AddForeignKey
ALTER TABLE "exp_06_sessoes" ADD CONSTRAINT "exp_06_sessoes_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp_06_auditorias" ADD CONSTRAINT "exp_06_auditorias_escola_id_estudante_id_fkey" FOREIGN KEY ("escola_id", "estudante_id") REFERENCES "exp_06_sessoes"("escola_id", "estudante_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp_06_reflexoes" ADD CONSTRAINT "exp_06_reflexoes_escola_id_estudante_id_fkey" FOREIGN KEY ("escola_id", "estudante_id") REFERENCES "exp_06_sessoes"("escola_id", "estudante_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp_06_gates_turma" ADD CONSTRAINT "exp_06_gates_turma_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ===========================================================================
-- Bloco MANUAL. O Prisma não gera CHECK, RLS nem GRANT.
-- ===========================================================================

-- Os enums do domínio moram aqui como CHECK, não como type: a ordem dos passos
-- é regra (`src/rastro-boato/regras/passos.ts`), e um `enum` do Postgres
-- amarraria toda mudança de roteiro a uma migration de `ALTER TYPE`.
ALTER TABLE "exp_06_sessoes"
  ADD CONSTRAINT "exp_06_sessoes_passo_check"
    CHECK ("passo" IN ('contexto', 'chats', 'decisao', 'breakpoint',
                       'resultado', 'ciclo', 'percurso', 'fim')),
  ADD CONSTRAINT "exp_06_sessoes_opcao_check"
    CHECK ("opcao" IS NULL OR "opcao" IN ('A', 'B', 'C')),
  -- Teto de 2h na latência: acima disso é aba esquecida aberta, não tempo de
  -- decisão, e a média do painel mentiria sobre o pico da missão.
  ADD CONSTRAINT "exp_06_sessoes_latencia_check"
    CHECK ("latencia_seg" IS NULL OR ("latencia_seg" >= 0 AND "latencia_seg" <= 7200)),
  -- O modelo do ciclo tem 4 blocos ou nenhum: 1, 2 ou 3 é slot vazio, e a
  -- regra pura já recusa. Aqui é a rede, para um caminho novo que esqueça.
  ADD CONSTRAINT "exp_06_sessoes_ordem_blocos_check"
    CHECK (cardinality("ordem_blocos") IN (0, 4)),
  ADD CONSTRAINT "exp_06_sessoes_coerente_check"
    CHECK (("coerente" IS NULL) = (cardinality("ordem_blocos") = 0)),
  -- 0 / 70 / 100 são os três valores que `regras/pontuacao.ts` produz. Qualquer
  -- outro número aqui seria pontuação vinda do cliente (regra inviolável nº 3).
  ADD CONSTRAINT "exp_06_sessoes_score_check"
    CHECK ("score" IS NULL OR "score" IN (0, 70, 100)),
  -- Conclusão e carimbo não podem divergir: o hub lê o `concluido_em` e a
  -- experiência lê o `passo`, e uma tela dizendo "missão cumprida" sobre uma
  -- linha sem carimbo é um relatório que mente.
  ADD CONSTRAINT "exp_06_sessoes_fim_check"
    CHECK (("passo" = 'fim') = ("concluido_em" IS NOT NULL));

ALTER TABLE "exp_06_auditorias"
  ADD CONSTRAINT "exp_06_auditorias_tempo_check"
    CHECK ("tempo_leitura_s" >= 0 AND "tempo_leitura_s" <= 3600);

-- 280 é o teto do campo na tela, e a coluna é VARCHAR(280): o CHECK cobre o
-- piso, que o tipo não cobre. Reflexão vazia salva seria um percurso em branco
-- contando como entregue no painel.
ALTER TABLE "exp_06_reflexoes"
  ADD CONSTRAINT "exp_06_reflexoes_texto_check"
    CHECK (char_length(btrim("texto")) BETWEEN 1 AND 280),
  ADD CONSTRAINT "exp_06_reflexoes_chars_check"
    CHECK ("chars_count" BETWEEN 1 AND 280);

ALTER TABLE "exp_06_gates_turma"
  ADD CONSTRAINT "exp_06_gates_turma_etapa_check"
    CHECK ("etapa" IN ('aula1', 'aula2'));

-- RLS (regra inviolável nº 1) — mesma expressão das outras tabelas de estudante.
-- O gate da turma entra junto: uma rede vizinha não vê a aula da outra.
ALTER TABLE "exp_06_sessoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp_06_sessoes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp_06_sessoes_por_escola" ON "exp_06_sessoes"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp_06_auditorias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp_06_auditorias" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp_06_auditorias_por_escola" ON "exp_06_auditorias"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp_06_reflexoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp_06_reflexoes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp_06_reflexoes_por_escola" ON "exp_06_reflexoes"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp_06_gates_turma" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp_06_gates_turma" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp_06_gates_turma_por_escola" ON "exp_06_gates_turma"
  USING (escola_id = current_setting('app.escola_id', true));

-- A role de runtime (docs/INFRA.md) conecta sem ownership e precisa de
-- privilégio nas tabelas novas. Guardado: em dev/CI a role não existe.
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    FOREACH t IN ARRAY ARRAY['exp_06_sessoes', 'exp_06_auditorias',
                             'exp_06_reflexoes', 'exp_06_gates_turma']
    LOOP
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_runtime', t);
    END LOOP;
    -- `exp_06_auditorias` tem id BIGSERIAL: sem USAGE na sequência o INSERT
    -- falha para a role de runtime mesmo com o GRANT acima — e falha só em
    -- produção, que é onde a role existe.
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE exp_06_auditorias_id_seq TO app_runtime';
  END IF;
END $$;
