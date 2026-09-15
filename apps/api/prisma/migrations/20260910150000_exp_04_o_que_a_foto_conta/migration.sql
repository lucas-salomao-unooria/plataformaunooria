-- exp-04-o-que-a-foto-conta: as três tabelas da missão do 1º ano.
--
-- Molde: 20260906170000_exp_06_rastro_boato. O Prisma gera tabelas, índices e
-- FKs; CHECK, RLS e GRANT são o bloco MANUAL no fim — é lá que a regra
-- inviolável nº 1 (todo dado de estudante escopado por escola) é aplicada.

-- CreateTable
CREATE TABLE "exp_04_turma_config" (
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "tema" TEXT NOT NULL DEFAULT 'recreio',
    "complexidade" TEXT NOT NULL DEFAULT 'nivel_1',
    "status_pacote" TEXT NOT NULL DEFAULT 'pendente',
    "pacote" JSONB,
    "pacote_da_ia" BOOLEAN NOT NULL DEFAULT false,
    "latch_liberado" BOOLEAN NOT NULL DEFAULT false,
    "tentativa" SMALLINT NOT NULL DEFAULT 1,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp_04_turma_config_pkey" PRIMARY KEY ("escola_id","turma_id")
);

-- CreateTable
CREATE TABLE "exp_04_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "estudante_id" UUID NOT NULL,
    "tentativa" SMALLINT NOT NULL DEFAULT 1,
    "etapa" TEXT NOT NULL DEFAULT 'desafiar',
    "marca_id" TEXT,
    "foto_escolhida_id" VARCHAR(30),
    "legenda_escolhida_id" VARCHAR(30),
    "latencia_decisao_ms" INTEGER,
    "curtidas_feed" SMALLINT NOT NULL DEFAULT 0,
    "permanencia_feed_ms" INTEGER NOT NULL DEFAULT 0,
    "reflexao_final" TEXT,
    "tentativas_reflexao" SMALLINT NOT NULL DEFAULT 0,
    "versao_instrumento" TEXT NOT NULL DEFAULT '1.0.0',
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluido_em" TIMESTAMPTZ(6),

    CONSTRAINT "exp_04_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp_04_posts_turma" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "run_id" UUID NOT NULL,
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "tentativa" SMALLINT NOT NULL DEFAULT 1,
    "marca_id" TEXT NOT NULL,
    "foto_id" VARCHAR(30) NOT NULL,
    "legenda_texto" VARCHAR(100) NOT NULL,
    "curtidas_simuladas" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp_04_posts_turma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exp_04_turma_config_escola_id_idx" ON "exp_04_turma_config"("escola_id");

-- CreateIndex
CREATE UNIQUE INDEX "exp_04_run_unica_por_tentativa" ON "exp_04_runs"("escola_id", "turma_id", "estudante_id", "tentativa");

-- CreateIndex
CREATE INDEX "exp_04_runs_escola_id_turma_id_tentativa_idx" ON "exp_04_runs"("escola_id", "turma_id", "tentativa");

-- CreateIndex
CREATE UNIQUE INDEX "exp_04_posts_turma_run_id_key" ON "exp_04_posts_turma"("run_id");

-- CreateIndex
CREATE INDEX "exp_04_posts_turma_escola_id_turma_id_tentativa_idx" ON "exp_04_posts_turma"("escola_id", "turma_id", "tentativa");

-- AddForeignKey
ALTER TABLE "exp_04_turma_config" ADD CONSTRAINT "exp_04_turma_config_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp_04_runs" ADD CONSTRAINT "exp_04_runs_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp_04_posts_turma" ADD CONSTRAINT "exp_04_posts_turma_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "exp_04_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===========================================================================
-- Bloco MANUAL. O Prisma não gera CHECK, RLS nem GRANT.
-- ===========================================================================

-- Enums do domínio como CHECK, não como type (a ordem das etapas é regra em
-- `src/foto-conta/regras.ts`, e um enum do Postgres amarraria mudança de
-- roteiro a `ALTER TYPE`).
ALTER TABLE "exp_04_turma_config"
  ADD CONSTRAINT "exp_04_turma_config_tema_check"
    CHECK ("tema" IN ('recreio', 'nossa_horta', 'sala_de_aula', 'parquinho')),
  ADD CONSTRAINT "exp_04_turma_config_complexidade_check"
    CHECK ("complexidade" IN ('nivel_1', 'nivel_2')),
  ADD CONSTRAINT "exp_04_turma_config_status_check"
    CHECK ("status_pacote" IN ('pendente', 'pronto')),
  ADD CONSTRAINT "exp_04_turma_config_tentativa_check"
    CHECK ("tentativa" >= 1),
  -- `pronto` sem pacote seria uma aprovação de coisa nenhuma: o professor só
  -- aprova o que conferiu no preview.
  ADD CONSTRAINT "exp_04_turma_config_pacote_check"
    CHECK ("status_pacote" = 'pendente' OR "pacote" IS NOT NULL);

ALTER TABLE "exp_04_runs"
  ADD CONSTRAINT "exp_04_runs_etapa_check"
    CHECK ("etapa" IN ('desafiar', 'feed', 'decidir', 'aha', 'roda', 'refletir', 'concluida')),
  ADD CONSTRAINT "exp_04_runs_marca_check"
    CHECK ("marca_id" IS NULL OR "marca_id" IN ('coruja', 'estrela', 'sol')),
  -- Teto de 2h: acima disso é aba esquecida aberta, não tempo de decisão, e a
  -- média do painel mentiria sobre a hesitação da turma.
  ADD CONSTRAINT "exp_04_runs_latencia_check"
    CHECK ("latencia_decisao_ms" IS NULL OR ("latencia_decisao_ms" >= 0 AND "latencia_decisao_ms" <= 7200000)),
  ADD CONSTRAINT "exp_04_runs_permanencia_check"
    CHECK ("permanencia_feed_ms" >= 0 AND "permanencia_feed_ms" <= 7200000),
  ADD CONSTRAINT "exp_04_runs_curtidas_check"
    CHECK ("curtidas_feed" >= 0),
  -- Só a resposta que CONCLUI (`lupa`) é gravada como final: o Globo é retry
  -- formativo e vive no contador, nunca como resposta (missão sem nota).
  ADD CONSTRAINT "exp_04_runs_reflexao_check"
    CHECK ("reflexao_final" IS NULL OR "reflexao_final" = 'lupa'),
  ADD CONSTRAINT "exp_04_runs_tentativas_reflexao_check"
    CHECK ("tentativas_reflexao" >= 0),
  -- Conclusão e carimbo não podem divergir: o hub lê `concluido_em` e a
  -- experiência lê `etapa` — uma tela dizendo "missão cumprida" sobre linha
  -- sem carimbo é relatório que mente.
  ADD CONSTRAINT "exp_04_runs_fim_check"
    CHECK (("etapa" = 'concluida') = ("concluido_em" IS NOT NULL)),
  ADD CONSTRAINT "exp_04_runs_tentativa_check"
    CHECK ("tentativa" >= 1);

ALTER TABLE "exp_04_posts_turma"
  ADD CONSTRAINT "exp_04_posts_turma_marca_check"
    CHECK ("marca_id" IN ('coruja', 'estrela', 'sol')),
  ADD CONSTRAINT "exp_04_posts_turma_legenda_check"
    CHECK (char_length(btrim("legenda_texto")) BETWEEN 1 AND 100),
  ADD CONSTRAINT "exp_04_posts_turma_curtidas_check"
    CHECK ("curtidas_simuladas" >= 0);

-- RLS (regra inviolável nº 1) — mesma expressão das outras tabelas de
-- estudante. A config da turma entra junto: uma rede vizinha não vê a aula da
-- outra.
ALTER TABLE "exp_04_turma_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp_04_turma_config" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp_04_turma_config_por_escola" ON "exp_04_turma_config"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp_04_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp_04_runs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp_04_runs_por_escola" ON "exp_04_runs"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp_04_posts_turma" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp_04_posts_turma" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp_04_posts_turma_por_escola" ON "exp_04_posts_turma"
  USING (escola_id = current_setting('app.escola_id', true));

-- A role de runtime (docs/INFRA.md) conecta sem ownership e precisa de
-- privilégio nas tabelas novas. Guardado: em dev/CI a role não existe.
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    FOREACH t IN ARRAY ARRAY['exp_04_turma_config', 'exp_04_runs',
                             'exp_04_posts_turma']
    LOOP
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_runtime', t);
    END LOOP;
  END IF;
END $$;
