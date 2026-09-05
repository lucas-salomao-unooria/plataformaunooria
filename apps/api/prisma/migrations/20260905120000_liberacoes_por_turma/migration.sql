-- A SALA DE AULA: a missão passa a existir DENTRO de uma turma (ADR-69).
--
-- Até aqui não havia nada ligando `turmas` a `experiencias`. O hub do estudante
-- listava as missões de uma constante compilada no bundle, igual para todo
-- mundo, e "liberar" só existia DENTRO de três experiências, com um mecanismo
-- diferente em cada uma (o `status` da atividade da exp-01, o relógio da exp-03,
-- os gates da exp-07). Nenhum deles responde "esta missão pertence a esta sala".
--
-- Esta tabela responde. Ela é PRÉ-CONDIÇÃO dos relógios e gates, não substituta:
-- eles continuam dizendo "a aula começou", e continuam morando na experiência
-- (ADR-25).
--
-- Molde do bloco manual: 20260903120000_exp_07_o_eco_no_grupo.

-- CreateTable
CREATE TABLE "liberacoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "exp_id" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'liberada',
    "liberada_por" UUID NOT NULL,
    "liberada_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encerrada_em" TIMESTAMPTZ(6),
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liberacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "liberacoes_escola_id_turma_id_exp_id_key"
  ON "liberacoes"("escola_id", "turma_id", "exp_id");

-- CreateIndex
CREATE INDEX "liberacoes_escola_id_turma_id_idx" ON "liberacoes"("escola_id", "turma_id");

-- AddForeignKey
ALTER TABLE "liberacoes" ADD CONSTRAINT "liberacoes_turma_id_fkey"
  FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liberacoes" ADD CONSTRAINT "liberacoes_liberada_por_fkey"
  FOREIGN KEY ("liberada_por") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------- bloco MANUAL

-- Dois estados, e nenhum deles é "bloqueada": a AUSÊNCIA de linha é o bloqueio.
-- Guardar bloqueio como linha obrigaria a criar uma por turma × experiência só
-- para o mundo nascer fechado — e ele nasce fechado de graça.
ALTER TABLE "liberacoes"
  ADD CONSTRAINT "liberacoes_estado_check"
    CHECK ("estado" IN ('liberada', 'encerrada'));

-- `encerrada_em` acompanha o estado. Sem isto, "encerrada" sem data (ou data com
-- estado "liberada") vira a linha que faz o painel mentir sobre quando a aula
-- fechou — a mesma armadilha do `expires_at` que ninguém cumpria.
ALTER TABLE "liberacoes"
  ADD CONSTRAINT "liberacoes_encerrada_em_check"
    CHECK (("estado" = 'encerrada') = ("encerrada_em" IS NOT NULL));

-- **NÃO há FK de `exp_id` para `experiencias`**, e é deliberado: aquele catálogo
-- é escrito pelo CI ao publicar o bundle, e numa stack de dev (ou num ambiente
-- novo, antes do primeiro publish) ele está VAZIO. Com FK, liberar dependeria de
-- um deploy que não aconteceu. É a mesma escolha de `progresso.exp_id`.

-- RLS (regra inviolável nº 1). `liberacoes` carrega `escola_id` e entra na
-- política como qualquer tabela de dado de escola — diferente de `turmas` e
-- `users`, que ficam fora por serem lidas no login, antes de haver escola.
ALTER TABLE "liberacoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "liberacoes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "liberacoes_por_escola" ON "liberacoes"
  USING (escola_id = current_setting('app.escola_id', true));

-- A role de runtime (docs/INFRA.md) conecta sem ownership e precisa de
-- privilégio na tabela nova. Guardado: em dev/CI a role não existe.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON liberacoes TO app_runtime';
  END IF;
END $$;
