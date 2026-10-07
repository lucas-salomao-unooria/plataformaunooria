-- podcast-roteiros: as falas do tema do podcast de recapitulação, por
-- atividade (ADR-150). Tabela da PLATAFORMA (sem prefixo de experiência): o
-- podcast virou um recurso com rotas únicas (`/podcast/:expId/...`), e cada
-- missão só declara o roteiro dela.
--
-- O Prisma gera a tabela e o índice único (`migrate diff`); CHECK, RLS e GRANT
-- são o bloco MANUAL no fim, como em toda tabela com `escola_id` (regra 1).

-- CreateTable
CREATE TABLE "podcast_roteiros" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "exp_id" TEXT NOT NULL,
    "atividade_id" UUID NOT NULL,
    "falas" JSONB NOT NULL,
    "aprovado_por" UUID,
    "aprovado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "podcast_roteiros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "podcast_roteiros_um_por_atividade" ON "podcast_roteiros"("escola_id", "exp_id", "atividade_id");

-- ─────────────────────────────────────────────────────────────────────────
-- Bloco MANUAL. O Prisma não gera CHECK, RLS nem GRANT.

-- O código da experiência no formato da ADR-110.
ALTER TABLE "podcast_roteiros" ADD CONSTRAINT "podcast_roteiros_exp_id_formato"
  CHECK (exp_id ~ '^exp[0-9]{2}(ef|em)[0-9][a-z]$');
-- As falas são um OBJETO (`{ vaga: fala }`); a forma de cada vaga é da missão.
ALTER TABLE "podcast_roteiros" ADD CONSTRAINT "podcast_roteiros_falas_objeto"
  CHECK (jsonb_typeof(falas) = 'object');

ALTER TABLE "podcast_roteiros" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "podcast_roteiros" FORCE ROW LEVEL SECURITY;
CREATE POLICY "podcast_roteiros_por_escola" ON "podcast_roteiros"
  USING (escola_id = current_setting('app.escola_id', true));

-- A role de runtime (docs/INFRA.md) conecta sem ownership. Guardado: em dev/CI
-- a role não existe. O id é `gen_random_uuid()`: não há sequência.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "podcast_roteiros" TO app_runtime;
  END IF;
END $$;
