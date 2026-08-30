-- AlterTable: manifesto ganha o público-alvo (estudante | professor).
ALTER TABLE "experiencias" ADD COLUMN "publico" TEXT NOT NULL DEFAULT 'estudante';

-- CreateTable
CREATE TABLE "planos_de_aula" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "professor_id" UUID NOT NULL,
    "serie" TEXT NOT NULL,
    "disciplina" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "tentativas" SMALLINT NOT NULL DEFAULT 0,
    "iniciado_em" TIMESTAMPTZ(6),
    "erro" TEXT,
    "tokens_usados" INTEGER NOT NULL DEFAULT 0,
    "caminho_gerado_md" TEXT,
    "caminho_html" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planos_de_aula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planos_referencias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "disciplina" TEXT NOT NULL,
    "serie" TEXT,
    "nome" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planos_referencias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "planos_de_aula_escola_id_professor_id_idx" ON "planos_de_aula"("escola_id", "professor_id");

-- CreateIndex
CREATE UNIQUE INDEX "planos_referencias_disciplina_serie_nome_key" ON "planos_referencias"("disciplina", "serie", "nome");

-- CreateIndex
CREATE INDEX "planos_referencias_disciplina_serie_idx" ON "planos_referencias"("disciplina", "serie");

-- AddForeignKey
ALTER TABLE "planos_de_aula" ADD CONSTRAINT "planos_de_aula_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- exp-90-plano-de-aula — o que o Prisma não modela (mesmo padrão da init).
-- ============================================================================

ALTER TABLE "experiencias"
  ADD CONSTRAINT "experiencias_publico_check" CHECK ("publico" IN ('estudante','professor'));

ALTER TABLE "planos_de_aula"
  ADD CONSTRAINT "planos_de_aula_status_check"
    CHECK ("status" IN ('pendente','gerando','pronto','erro'));

-- RLS (regra inviolável nº 1): plano de aula é dado da escola do professor.
-- `planos_referencias` fica FORA da RLS de propósito: é catálogo do CONTRATO
-- (currículo da rede vale para as 100+ escolas), como `experiencias`.
ALTER TABLE "planos_de_aula" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "planos_de_aula" FORCE ROW LEVEL SECURITY;
CREATE POLICY "planos_de_aula_por_escola" ON "planos_de_aula"
  USING (escola_id = current_setting('app.escola_id', true));

-- A role de runtime (docs/INFRA.md) conecta sem ownership e precisa de
-- privilégio nas tabelas novas. Guardado: em dev/CI a role não existe.
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "planos_de_aula" TO app_runtime;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "planos_referencias" TO app_runtime;
  END IF;
END $$;
