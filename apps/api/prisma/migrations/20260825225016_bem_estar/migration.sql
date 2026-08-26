-- CreateTable
CREATE TABLE "bem_estar_ciclos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "professor_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'aberto',
    "ordem_itens" INTEGER[],
    "iniciado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_em" TIMESTAMPTZ(6) NOT NULL,
    "concluido_em" TIMESTAMPTZ(6),
    "depressao" INTEGER,
    "ansiedade" INTEGER,
    "estresse" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bem_estar_ciclos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bem_estar_checkins" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "professor_id" UUID NOT NULL,
    "ciclo_id" UUID NOT NULL,
    "numero" SMALLINT NOT NULL,
    "dia" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "itens" INTEGER[],
    "respostas" JSONB,
    "texto_livre" TEXT,
    "abertura" TEXT NOT NULL,
    "pergunta" TEXT NOT NULL,
    "acolhimento" TEXT,
    "origem_texto" TEXT NOT NULL DEFAULT 'fallback',
    "sinal_de_apoio" BOOLEAN NOT NULL DEFAULT false,
    "tokens_ia" INTEGER NOT NULL DEFAULT 0,
    "respondido_em" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bem_estar_checkins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bem_estar_ciclos_escola_id_professor_id_status_idx" ON "bem_estar_ciclos"("escola_id", "professor_id", "status");

-- CreateIndex
CREATE INDEX "bem_estar_checkins_ciclo_id_idx" ON "bem_estar_checkins"("ciclo_id");

-- CreateIndex
CREATE UNIQUE INDEX "bem_estar_checkins_escola_id_professor_id_dia_key" ON "bem_estar_checkins"("escola_id", "professor_id", "dia");

-- AddForeignKey
ALTER TABLE "bem_estar_ciclos" ADD CONSTRAINT "bem_estar_ciclos_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bem_estar_checkins" ADD CONSTRAINT "bem_estar_checkins_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bem_estar_checkins" ADD CONSTRAINT "bem_estar_checkins_ciclo_id_fkey" FOREIGN KEY ("ciclo_id") REFERENCES "bem_estar_ciclos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- exp-91-bem-estar — o que o Prisma não modela (mesmo padrão da init/planos).
-- ============================================================================

ALTER TABLE "bem_estar_ciclos"
  ADD CONSTRAINT "bem_estar_ciclos_status_check"
    CHECK ("status" IN ('aberto','concluido','expirado'));

ALTER TABLE "bem_estar_checkins"
  ADD CONSTRAINT "bem_estar_checkins_status_check"
    CHECK ("status" IN ('pendente','respondido')),
  ADD CONSTRAINT "bem_estar_checkins_numero_check"
    CHECK ("numero" BETWEEN 1 AND 7),
  ADD CONSTRAINT "bem_estar_checkins_origem_texto_check"
    CHECK ("origem_texto" IN ('ia','fallback','seguranca'));

-- RLS (regra inviolável nº 1). Respostas do DASS-21 e texto livre são dado
-- SENSÍVEL de saúde do professor (LGPD art. 11): além da RLS por escola, o
-- service filtra professor_id em TODA query — nenhuma rota de gestor lê isto.
ALTER TABLE "bem_estar_ciclos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bem_estar_ciclos" FORCE ROW LEVEL SECURITY;
CREATE POLICY "bem_estar_ciclos_por_escola" ON "bem_estar_ciclos"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "bem_estar_checkins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bem_estar_checkins" FORCE ROW LEVEL SECURITY;
CREATE POLICY "bem_estar_checkins_por_escola" ON "bem_estar_checkins"
  USING (escola_id = current_setting('app.escola_id', true));

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "bem_estar_ciclos" TO app_runtime;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "bem_estar_checkins" TO app_runtime;
  END IF;
END $$;
