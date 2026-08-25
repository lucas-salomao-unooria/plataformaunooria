-- CreateTable
CREATE TABLE "unootube_sessoes" (
    "escola_id" TEXT NOT NULL,
    "aluno_id" UUID NOT NULL,
    "salvos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "curtidos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ranking_desbloqueado" BOOLEAN NOT NULL DEFAULT false,
    "credibilidade_adicionada" BOOLEAN NOT NULL DEFAULT false,
    "concluido_em" TIMESTAMPTZ(6),
    "reinicios" SMALLINT NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unootube_sessoes_pkey" PRIMARY KEY ("escola_id","aluno_id")
);

-- CreateIndex
CREATE INDEX "unootube_sessoes_escola_id_idx" ON "unootube_sessoes"("escola_id");

-- AddForeignKey
ALTER TABLE "unootube_sessoes" ADD CONSTRAINT "unootube_sessoes_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- exp-02-unootube — o que o Prisma não modela (mesmo padrão da init).
-- ============================================================================

-- CHECKs: o limite de 3 salvos é regra de jogo aplicada no service sob lock de
-- linha; o banco é a rede final. Conclusão sem instante é estado impossível.
ALTER TABLE "unootube_sessoes"
  ADD CONSTRAINT "unootube_sessoes_limite_salvos_check"
    CHECK (cardinality("salvos") <= 3),
  ADD CONSTRAINT "unootube_sessoes_conclusao_check"
    CHECK ("credibilidade_adicionada" = false OR "concluido_em" IS NOT NULL);

-- RLS (regra inviolável nº 1) — mesma expressão das outras tabelas de aluno.
ALTER TABLE "unootube_sessoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "unootube_sessoes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "unootube_sessoes_por_escola" ON "unootube_sessoes"
  USING (escola_id = current_setting('app.escola_id', true));

-- A role de runtime (docs/INFRA.md) conecta sem ownership e precisa de
-- privilégio na tabela nova. Guardado: em dev/CI a role não existe.
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "unootube_sessoes" TO app_runtime;
  END IF;
END $$;
