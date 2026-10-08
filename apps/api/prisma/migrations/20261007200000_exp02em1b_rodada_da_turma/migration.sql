-- A RODADA DA TURMA na Missão Tempestade (exp02em1b, ADR-154).
--
-- A evidência pedagógica é por atividade + rodada, e a missão não tinha nem uma
-- nem outra: o "Tentar de novo" de cada estudante é livre, e o "Zerar a turma"
-- apaga as sessões e o relógio. A atividade é a sintética "turma" (a mesma das
-- equipes, sem tabela); a rodada mora aqui e só sobe quando o professor zera.
-- Ausência de linha = rodada 1, então nenhuma turma precisa de backfill.

-- AlterTable
ALTER TABLE "exp02em1b_sessoes" ADD COLUMN "rodada" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "exp02em1b_gate_turma" (
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "rodada" INTEGER NOT NULL DEFAULT 1,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp02em1b_gate_turma_pkey" PRIMARY KEY ("escola_id","turma_id")
);

-- AddForeignKey
ALTER TABLE "exp02em1b_gate_turma" ADD CONSTRAINT "exp02em1b_gate_turma_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bloco MANUAL. O Prisma não gera CHECK, RLS nem GRANT.

ALTER TABLE "exp02em1b_gate_turma"
  ADD CONSTRAINT "exp02em1b_gate_turma_rodada_check"
    CHECK ("rodada" >= 1);

ALTER TABLE "exp02em1b_sessoes"
  ADD CONSTRAINT "exp02em1b_sessoes_rodada_check"
    CHECK ("rodada" >= 1);

-- RLS (regra inviolável nº 1) — a mesma expressão das outras tabelas da missão.
ALTER TABLE "exp02em1b_gate_turma" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp02em1b_gate_turma" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp02em1b_gate_turma_por_escola" ON "exp02em1b_gate_turma"
  USING (escola_id = current_setting('app.escola_id', true));

-- A role de runtime (docs/INFRA.md) conecta sem ownership e precisa de
-- privilégio na tabela nova. Guardado: em dev/CI a role não existe. Sem
-- sequência (a chave é composta), então não há `GRANT USAGE` a esquecer.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "exp02em1b_gate_turma" TO app_runtime;
  END IF;
END $$;
