-- Identidade unificada e enturmamento.
--
-- O QUE ESTA MIGRATION CONSERTA
--
-- 1. A conta era de ASSENTO, não de pessoa. Está escrito no schema desde o
--    port: `exp_01_runs.nome_no_app` existe "porque a conta é do APARELHO:
--    outra turma reusa o mesmo login". Consequência: o nome real do estudante vivia
--    dentro de UMA experiência, e nenhuma das outras o enxergava. Entram
--    `users.matricula_externa` (o RA da rede) como chave de PESSOA, `fonte_id`
--    para reconciliar com o SIS, `email` e `ativo`.
--
-- 2. Não existia enturmamento. O vínculo era a coluna `users.turma_id`: um
--    estudante cabia em uma turma só, o PROFESSOR não tinha turma nenhuma (e por
--    isso todo professor enxergava todas as turmas da escola), e não havia ano
--    letivo — em fevereiro o 8A vira 9A e todo o acumulado do ano anterior
--    passaria a ser lido pela turma nova, em silêncio. Entram
--    `periodos_letivos` e `matriculas`.
--
-- 3. Não havia caminho de troca de senha. Entram `senha_provisoria` e
--    `senha_definida_em`: a importação cria a senha, o primeiro login troca.
--
-- MODELO: isomórfico ao OneRoster 1.2 (orgs / academicSessions / classes /
-- enrollments / users), com nomes em pt-BR. O padrão só aparece na fronteira de
-- importação (`apps/api/src/rostering/`); nada do domínio conhece `sourcedId`.
--
-- `users.turma_id` SOBREVIVE, com novo significado: cache da matrícula
-- principal. O login e o claim `turma_id` do token (contrato congelado) o leem
-- ANTES de haver escola no contexto, onde `matriculas` — que tem RLS — não é
-- alcançável.

-- ============================================================================
-- 1. PERÍODOS LETIVOS (≈ academicSessions)
-- ============================================================================
-- Catálogo do CONTRATO: sem escola_id e sem RLS, mesmo precedente de
-- `planos_referencias`. Uma rede compartilha o calendário; duplicá-lo por
-- escola só criaria 100 linhas divergentes.

CREATE TABLE "periodos_letivos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tipo" TEXT NOT NULL DEFAULT 'ano_letivo',
    "titulo" TEXT NOT NULL,
    "ano" SMALLINT NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE NOT NULL,
    "pai_id" UUID,
    "fonte_id" TEXT,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "periodos_letivos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "periodos_letivos_tipo_titulo_key"
  ON "periodos_letivos"("tipo", "titulo");

ALTER TABLE "periodos_letivos"
  ADD CONSTRAINT "periodos_letivos_tipo_check"
    CHECK ("tipo" IN ('ano_letivo','semestre','bimestre','trimestre')),
  ADD CONSTRAINT "periodos_letivos_intervalo_check" CHECK ("fim" >= "inicio"),
  ADD CONSTRAINT "periodos_letivos_pai_id_fkey"
    FOREIGN KEY ("pai_id") REFERENCES "periodos_letivos"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- O ano letivo corrente, para as turmas que já existem terem onde morar. As
-- datas são o padrão do calendário civil e o gestor edita na área admin — o que
-- não pode é turma sem período, que seria a coluna `users.turma_id` de novo com
-- outro nome.
INSERT INTO "periodos_letivos" ("tipo", "titulo", "ano", "inicio", "fim")
VALUES ('ano_letivo', 'Ano letivo 2026', 2026, DATE '2026-01-01', DATE '2026-12-31')
ON CONFLICT ("tipo", "titulo") DO NOTHING;

-- ============================================================================
-- 2. ESCOLAS (≈ orgs)
-- ============================================================================

ALTER TABLE "escolas"
  ADD COLUMN "codigo_inep" TEXT,
  ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'escola',
  ADD COLUMN "pai_id" TEXT,
  ADD COLUMN "fonte_id" TEXT,
  ADD COLUMN "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT now();

ALTER TABLE "escolas"
  ADD CONSTRAINT "escolas_tipo_check"
    CHECK ("tipo" IN ('escola','rede','distrito')),
  ADD CONSTRAINT "escolas_pai_id_fkey"
    FOREIGN KEY ("pai_id") REFERENCES "escolas"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- 3. TURMAS (≈ classes)
-- ============================================================================

ALTER TABLE "turmas"
  ADD COLUMN "periodo_letivo_id" UUID,
  ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'regular',
  ADD COLUMN "turno" TEXT,
  ADD COLUMN "codigo" TEXT,
  ADD COLUMN "fonte_id" TEXT,
  ADD COLUMN "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT now();

-- Backfill antes do NOT NULL: toda turma existente é do ano letivo corrente.
UPDATE "turmas"
   SET "periodo_letivo_id" = (
     SELECT "id" FROM "periodos_letivos"
      WHERE "tipo" = 'ano_letivo' AND "titulo" = 'Ano letivo 2026'
   )
 WHERE "periodo_letivo_id" IS NULL;

ALTER TABLE "turmas"
  ALTER COLUMN "periodo_letivo_id" SET NOT NULL;

ALTER TABLE "turmas"
  ADD CONSTRAINT "turmas_tipo_check" CHECK ("tipo" IN ('regular','componente')),
  ADD CONSTRAINT "turmas_turno_check"
    CHECK ("turno" IS NULL OR "turno" IN ('manha','tarde','noite','integral')),
  ADD CONSTRAINT "turmas_periodo_letivo_id_fkey"
    FOREIGN KEY ("periodo_letivo_id") REFERENCES "periodos_letivos"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- A unicidade passa a incluir o período: "8A" de 2026 e "8A" de 2027 são turmas
-- DIFERENTES, e é essa diferença que preserva o histórico na virada do ano.
DROP INDEX IF EXISTS "turmas_escola_id_nome_key";
CREATE UNIQUE INDEX "turmas_escola_id_periodo_letivo_id_nome_key"
  ON "turmas"("escola_id", "periodo_letivo_id", "nome");

-- ============================================================================
-- 4. USERS — identidade da PESSOA
-- ============================================================================

ALTER TABLE "users"
  ADD COLUMN "matricula_externa" TEXT,
  ADD COLUMN "fonte_id" TEXT,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "senha_provisoria" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "senha_definida_em" TIMESTAMPTZ(6),
  ADD COLUMN "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT now();

-- Índice PARCIAL: duas pessoas sem RA não colidem entre si (NULL não é valor),
-- mas o mesmo RA não se repete dentro de uma escola. O Prisma não modela índice
-- parcial — por isso ele vive aqui, como os CHECKs e a RLS.
CREATE UNIQUE INDEX "users_escola_id_matricula_externa_key"
  ON "users"("escola_id", "matricula_externa")
  WHERE "matricula_externa" IS NOT NULL;

-- ============================================================================
-- 5. MATRÍCULAS (≈ enrollments) — o enturmamento
-- ============================================================================
-- `papel` só admite estudante e professor: gestor é papel no NÍVEL DA ESCOLA (o
-- `roles.csv` do padrão), não matrícula de turma — e é por isso que ele continua
-- enxergando a escola inteira enquanto o professor passa a ver só as turmas
-- dele.

CREATE TABLE "matriculas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "papel" TEXT NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "inicio" DATE NOT NULL,
    "fim" DATE,
    "fonte_id" TEXT,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "matriculas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "matriculas_escola_id_turma_id_usuario_id_papel_key"
  ON "matriculas"("escola_id", "turma_id", "usuario_id", "papel");
CREATE INDEX "matriculas_escola_id_usuario_id_idx"
  ON "matriculas"("escola_id", "usuario_id");
CREATE INDEX "matriculas_escola_id_turma_id_idx"
  ON "matriculas"("escola_id", "turma_id");

ALTER TABLE "matriculas"
  ADD CONSTRAINT "matriculas_papel_check" CHECK ("papel" IN ('estudante','professor')),
  ADD CONSTRAINT "matriculas_intervalo_check"
    CHECK ("fim" IS NULL OR "fim" >= "inicio"),
  ADD CONSTRAINT "matriculas_turma_id_fkey"
    FOREIGN KEY ("turma_id") REFERENCES "turmas"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "matriculas_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: cada `users.turma_id` vira UMA matrícula principal de estudante. É o
-- passo que faz o histórico de 2026 continuar apontando para a turma de 2026
-- depois que a de 2027 existir.
INSERT INTO "matriculas" ("escola_id", "turma_id", "usuario_id", "papel", "principal", "inicio")
SELECT u."escola_id", u."turma_id", u."id", 'estudante', true,
       (SELECT "inicio" FROM "periodos_letivos"
         WHERE "tipo" = 'ano_letivo' AND "titulo" = 'Ano letivo 2026')
  FROM "users" u
 WHERE u."turma_id" IS NOT NULL
   AND u."escola_id" IS NOT NULL
   AND u."role" = 'estudante'
ON CONFLICT DO NOTHING;

-- RLS. `matriculas` NÃO entra na exceção de identidade que vale para
-- users/escolas/turmas: aquela exceção existe porque o login precisa achar a
-- pessoa ANTES de saber a escola, e a matrícula nunca é lida nesse momento — o
-- cache `users.turma_id` cobre o login.
--
-- ARMADILHA, registrada aqui porque não dá erro: query que leia `matriculas`
-- FORA de `comTenancy` volta VAZIA, em silêncio. Se a lista de usuários do
-- gestor aparecer sem turma, é isso — não é dado faltando.
ALTER TABLE "matriculas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "matriculas" FORCE ROW LEVEL SECURITY;
CREATE POLICY "matriculas_por_escola" ON "matriculas"
  USING ("escola_id" = current_setting('app.escola_id', true));
