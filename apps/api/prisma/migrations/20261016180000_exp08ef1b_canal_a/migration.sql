-- exp08ef1b-canal-a: o Canal A de "O Conteúdo que não chegou" (ADR-167).
--
-- 1. `exp08ef1b_tarefas` — as três tarefas por ação: 6a Raio-x (EF08CO11),
--    6b Termos (EF08CO09) e 6c Envio (EF08CO07). Uma linha por (sessão,
--    tarefa), criada na primeira leitura com a COMPOSIÇÃO mostrada e completada
--    no envio. É produção do estudante: sai no reinício (o controller apaga) e
--    em "Apagar as sessões" (a cascata da run).
-- 2. `exp08ef1b_leituras_da_reflexao` — a leitura da reflexão pela IA, UMA por
--    estudante na atividade, SEM texto. O reinício não a apaga (a run fica);
--    "Apagar as sessões" apaga a run e a cascata a leva.
-- 3. `exp08ef1b_reflexoes.primeiro_texto` — o texto que a IA leu; sai com a
--    reflexão.
-- 4. `exp08ef1b_runs.revelacao_concluida_em` — o fim da revelação registrado
--    no servidor: é a trava das tarefas 6b e 6c, e o fim do Raio-x.
--
-- As duas tabelas têm `escola_id NOT NULL` e RLS FORCE com a política por
-- escola, no padrão das `exp08ef1b_*`. As colunas novas herdam a RLS das
-- tabelas delas.

ALTER TABLE "exp08ef1b_runs" ADD COLUMN "revelacao_concluida_em" TIMESTAMPTZ(6);
ALTER TABLE "exp08ef1b_reflexoes" ADD COLUMN "primeiro_texto" TEXT;

-- CreateTable
CREATE TABLE "exp08ef1b_tarefas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "run_id" UUID NOT NULL,
    "tarefa" TEXT NOT NULL,
    "composicao" JSONB NOT NULL,
    "respostas" JSONB,
    "enviada_em" TIMESTAMPTZ(6),
    "refeita" BOOLEAN NOT NULL DEFAULT false,
    "frase" TEXT,
    "criada_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp08ef1b_tarefas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp08ef1b_leituras_da_reflexao" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "activity_id" UUID NOT NULL,
    "estudante_id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "resultado" TEXT,
    "nivel" TEXT,
    "motivo" TEXT,
    "criada_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lida_em" TIMESTAMPTZ(6),

    CONSTRAINT "exp08ef1b_leituras_da_reflexao_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "exp08ef1b_tarefas_escola_id_idx" ON "exp08ef1b_tarefas"("escola_id");
CREATE UNIQUE INDEX "exp08ef1b_tarefas_run_id_tarefa_key" ON "exp08ef1b_tarefas"("run_id", "tarefa");
CREATE INDEX "exp08ef1b_leituras_da_reflexao_escola_id_idx" ON "exp08ef1b_leituras_da_reflexao"("escola_id");
CREATE UNIQUE INDEX "exp08ef1b_leituras_da_reflexao_activity_id_estudante_id_key" ON "exp08ef1b_leituras_da_reflexao"("activity_id", "estudante_id");

ALTER TABLE "exp08ef1b_tarefas" ADD CONSTRAINT "exp08ef1b_tarefas_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "exp08ef1b_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exp08ef1b_leituras_da_reflexao" ADD CONSTRAINT "exp08ef1b_leituras_da_reflexao_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "exp08ef1b_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exp08ef1b_leituras_da_reflexao" ADD CONSTRAINT "exp08ef1b_leituras_da_reflexao_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
-- Bloco MANUAL. O Prisma não gera CHECK, RLS nem GRANT.

-- O vocabulário: o MESMO de `motor/canal-a/vocabulario.ts`, que
-- `tests/motor-evidencia-postgres.spec.ts` compara.
ALTER TABLE "exp08ef1b_tarefas" ADD CONSTRAINT "exp08ef1b_tarefas_tarefa_check"
  CHECK ("tarefa" IN ('raio-x', 'termos', 'envio'));
-- Respondida ⇔ com data de envio.
ALTER TABLE "exp08ef1b_tarefas" ADD CONSTRAINT "exp08ef1b_tarefas_envio_check"
  CHECK (("respostas" IS NULL) = ("enviada_em" IS NULL));
-- A frase é só do envio, e cabe nos 140 caracteres da tela.
ALTER TABLE "exp08ef1b_tarefas" ADD CONSTRAINT "exp08ef1b_tarefas_frase_check"
  CHECK ("frase" IS NULL OR ("tarefa" = 'envio' AND char_length("frase") BETWEEN 1 AND 140));

ALTER TABLE "exp08ef1b_leituras_da_reflexao" ADD CONSTRAINT "exp08ef1b_leituras_da_reflexao_resultado_check"
  CHECK ("resultado" IS NULL OR "resultado" IN ('nivel', 'sem_marca', 'falha'));
ALTER TABLE "exp08ef1b_leituras_da_reflexao" ADD CONSTRAINT "exp08ef1b_leituras_da_reflexao_nivel_check"
  CHECK ("nivel" IS NULL OR "nivel" IN ('atingiu', 'em_processo', 'nao_atingiu'));
-- Nível ⇔ resultado `nivel`; lida ⇔ com resultado.
ALTER TABLE "exp08ef1b_leituras_da_reflexao" ADD CONSTRAINT "exp08ef1b_leituras_da_reflexao_coerencia_check"
  CHECK (("nivel" IS NOT NULL) = ("resultado" IS NOT DISTINCT FROM 'nivel')
     AND ("lida_em" IS NOT NULL) = ("resultado" IS NOT NULL));

ALTER TABLE "exp08ef1b_tarefas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp08ef1b_tarefas" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp08ef1b_tarefas_por_escola" ON "exp08ef1b_tarefas"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp08ef1b_leituras_da_reflexao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp08ef1b_leituras_da_reflexao" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp08ef1b_leituras_da_reflexao_por_escola" ON "exp08ef1b_leituras_da_reflexao"
  USING (escola_id = current_setting('app.escola_id', true));

-- A role de runtime (docs/INFRA.md) conecta sem ownership. Guardado: em dev/CI
-- a role não existe. Os ids são `gen_random_uuid()`: não há sequência.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "exp08ef1b_tarefas" TO app_runtime;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "exp08ef1b_leituras_da_reflexao" TO app_runtime;
  END IF;
END $$;
