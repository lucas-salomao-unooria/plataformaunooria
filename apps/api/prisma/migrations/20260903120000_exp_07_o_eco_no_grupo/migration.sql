-- exp-07-o-eco-no-grupo: as quatro tabelas da missão.
--
-- Molde: 20260827184956_exp_03_unoogpt. O Prisma gera as tabelas, os índices e
-- as FKs acima; CHECK, RLS e GRANT são o bloco MANUAL no fim — e é lá que a
-- regra inviolável nº 1 (todo dado de estudante escopado por escola) é aplicada.

-- CreateTable
CREATE TABLE "exp_07_sessoes" (
    "escola_id" TEXT NOT NULL,
    "estudante_id" UUID NOT NULL,
    "turma_id" UUID,
    "passo" TEXT NOT NULL DEFAULT 'chat_amara',
    "inspecionou_materia" BOOLEAN NOT NULL DEFAULT false,
    "ouviu_audio" BOOLEAN NOT NULL DEFAULT false,
    "ouviu_podcast" BOOLEAN NOT NULL DEFAULT false,
    "cards_lidos" SMALLINT NOT NULL DEFAULT 0,
    "opcao" TEXT,
    "latencia_seg" INTEGER,
    "desfazer_usado" SMALLINT NOT NULL DEFAULT 0,
    "score" INTEGER,
    "reacoes" JSONB,
    "turnos_amara" SMALLINT NOT NULL DEFAULT 0,
    "tokens_gastos" INTEGER NOT NULL DEFAULT 0,
    "chamadas_ia" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluido_em" TIMESTAMPTZ(6),

    CONSTRAINT "exp_07_sessoes_pkey" PRIMARY KEY ("escola_id","estudante_id")
);

-- CreateTable
CREATE TABLE "exp_07_mensagens" (
    "id" BIGSERIAL NOT NULL,
    "escola_id" TEXT NOT NULL,
    "estudante_id" UUID NOT NULL,
    "papel" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp_07_mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp_07_reflexoes" (
    "escola_id" TEXT NOT NULL,
    "estudante_id" UUID NOT NULL,
    "estrategias" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "justificativa" TEXT NOT NULL,
    "devolutiva" TEXT,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp_07_reflexoes_pkey" PRIMARY KEY ("escola_id","estudante_id")
);

-- CreateTable
CREATE TABLE "exp_07_gates_turma" (
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "etapa" TEXT NOT NULL DEFAULT 'investigacao',
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp_07_gates_turma_pkey" PRIMARY KEY ("escola_id","turma_id")
);

-- CreateIndex
CREATE INDEX "exp_07_sessoes_escola_id_idx" ON "exp_07_sessoes"("escola_id");

-- CreateIndex
CREATE INDEX "exp_07_sessoes_escola_id_turma_id_idx" ON "exp_07_sessoes"("escola_id", "turma_id");

-- CreateIndex
CREATE INDEX "exp_07_mensagens_escola_id_estudante_id_id_idx" ON "exp_07_mensagens"("escola_id", "estudante_id", "id");

-- CreateIndex
CREATE INDEX "exp_07_reflexoes_escola_id_idx" ON "exp_07_reflexoes"("escola_id");

-- CreateIndex
CREATE INDEX "exp_07_gates_turma_escola_id_idx" ON "exp_07_gates_turma"("escola_id");

-- AddForeignKey
ALTER TABLE "exp_07_sessoes" ADD CONSTRAINT "exp_07_sessoes_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp_07_mensagens" ADD CONSTRAINT "exp_07_mensagens_escola_id_estudante_id_fkey" FOREIGN KEY ("escola_id", "estudante_id") REFERENCES "exp_07_sessoes"("escola_id", "estudante_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp_07_reflexoes" ADD CONSTRAINT "exp_07_reflexoes_escola_id_estudante_id_fkey" FOREIGN KEY ("escola_id", "estudante_id") REFERENCES "exp_07_sessoes"("escola_id", "estudante_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp_07_gates_turma" ADD CONSTRAINT "exp_07_gates_turma_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ===========================================================================
-- Bloco MANUAL. O Prisma não gera CHECK, RLS nem GRANT.
-- ===========================================================================

-- Os enums do domínio moram aqui como CHECK, não como type: a ordem dos passos
-- é regra (`src/o-eco-no-grupo/regras/passos.ts`), e um `enum` do Postgres
-- amarraria toda mudança de roteiro a uma migration de `ALTER TYPE`.
ALTER TABLE "exp_07_sessoes"
  ADD CONSTRAINT "exp_07_sessoes_passo_check"
    CHECK ("passo" IN ('chat_amara', 'grupo', 'breakpoint', 'podcast',
                       'intervencao', 'desfecho', 'sintese', 'reflexao', 'fim')),
  ADD CONSTRAINT "exp_07_sessoes_opcao_check"
    CHECK ("opcao" IS NULL OR "opcao" IN ('A', 'B', 'C')),
  ADD CONSTRAINT "exp_07_sessoes_cards_check"
    CHECK ("cards_lidos" >= 0 AND "cards_lidos" <= 3),
  ADD CONSTRAINT "exp_07_sessoes_desfazer_check"
    CHECK ("desfazer_usado" >= 0),
  -- 3 turnos com Amara, e o teto está no banco também: um caminho novo que
  -- esqueça a checagem não pode transformar a conversa no centro da missão.
  ADD CONSTRAINT "exp_07_sessoes_turnos_amara_check"
    CHECK ("turnos_amara" >= 0 AND "turnos_amara" <= 3),
  -- 100 / 70 / 0 são os três valores que `regras/pontuacao.ts` produz. Qualquer
  -- outro número aqui seria pontuação vinda do cliente (regra inviolável nº 3).
  ADD CONSTRAINT "exp_07_sessoes_score_check"
    CHECK ("score" IS NULL OR "score" IN (0, 70, 100)),
  -- Conclusão e carimbo não podem divergir: o hub lê o `concluido_em` e a
  -- experiência lê o `passo`, e uma tela dizendo "missão cumprida" sobre uma
  -- linha sem carimbo é um relatório que mente.
  ADD CONSTRAINT "exp_07_sessoes_fim_check"
    CHECK (("passo" = 'fim') = ("concluido_em" IS NOT NULL));

ALTER TABLE "exp_07_mensagens"
  ADD CONSTRAINT "exp_07_mensagens_papel_check"
    CHECK ("papel" IN ('estudante', 'amara')),
  -- 600 é o teto do campo na tela (o mesmo da exp-03: é fala de estudante, não
  -- formulário); 2000 é a rede final, que também cabe a fala de Amara.
  ADD CONSTRAINT "exp_07_mensagens_texto_check"
    CHECK (char_length("texto") BETWEEN 1 AND 2000);

-- Exatamente 2 estratégias: a pergunta é "quais 2 ações são prioritárias", e
-- uma lista de 1 ou de 3 mediria outra coisa.
ALTER TABLE "exp_07_reflexoes"
  ADD CONSTRAINT "exp_07_reflexoes_estrategias_check"
    CHECK (cardinality("estrategias") = 2);

ALTER TABLE "exp_07_gates_turma"
  ADD CONSTRAINT "exp_07_gates_turma_etapa_check"
    CHECK ("etapa" IN ('investigacao', 'aula2', 'debate', 'reflexao'));

-- RLS (regra inviolável nº 1) — mesma expressão das outras tabelas de estudante.
-- O gate da turma entra junto: uma rede vizinha não vê a aula da outra.
ALTER TABLE "exp_07_sessoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp_07_sessoes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp_07_sessoes_por_escola" ON "exp_07_sessoes"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp_07_mensagens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp_07_mensagens" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp_07_mensagens_por_escola" ON "exp_07_mensagens"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp_07_reflexoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp_07_reflexoes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp_07_reflexoes_por_escola" ON "exp_07_reflexoes"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp_07_gates_turma" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp_07_gates_turma" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp_07_gates_turma_por_escola" ON "exp_07_gates_turma"
  USING (escola_id = current_setting('app.escola_id', true));

-- A role de runtime (docs/INFRA.md) conecta sem ownership e precisa de
-- privilégio nas tabelas novas. Guardado: em dev/CI a role não existe.
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    FOREACH t IN ARRAY ARRAY['exp_07_sessoes', 'exp_07_mensagens',
                             'exp_07_reflexoes', 'exp_07_gates_turma']
    LOOP
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_runtime', t);
    END LOOP;
    -- `exp_07_mensagens` tem id BIGSERIAL: sem USAGE na sequência o INSERT
    -- falha para a role de runtime mesmo com o GRANT acima — e falha só em
    -- produção, que é onde a role existe.
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE exp_07_mensagens_id_seq TO app_runtime';
  END IF;
END $$;
