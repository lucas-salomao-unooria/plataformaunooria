-- CreateTable
CREATE TABLE "exp_03_sessoes" (
    "escola_id" TEXT NOT NULL,
    "aluno_id" UUID NOT NULL,
    "turma_id" UUID,
    "passo" TEXT NOT NULL DEFAULT 'abertura',
    "tentativa" SMALLINT NOT NULL DEFAULT 1,
    "minutos_gastos" INTEGER NOT NULL DEFAULT 0,
    "conjuntos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rodadas" INTEGER NOT NULL DEFAULT 0,
    "perguntas_gastas" INTEGER NOT NULL DEFAULT 0,
    "alocacao_alfa" TEXT,
    "alocacao_bravo" TEXT,
    "justificativa_alfa" TEXT,
    "justificativa_bravo" TEXT,
    "tokens_gastos" INTEGER NOT NULL DEFAULT 0,
    "chamadas_ia" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluido_em" TIMESTAMPTZ(6),

    CONSTRAINT "exp_03_sessoes_pkey" PRIMARY KEY ("escola_id","aluno_id")
);

-- CreateTable
CREATE TABLE "exp_03_mensagens" (
    "id" BIGSERIAL NOT NULL,
    "escola_id" TEXT NOT NULL,
    "aluno_id" UUID NOT NULL,
    "papel" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "passo" TEXT NOT NULL,
    "anexo" JSONB,
    "debitou" BOOLEAN NOT NULL DEFAULT false,
    "tentativa" SMALLINT NOT NULL DEFAULT 1,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp_03_mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp_03_marcos" (
    "id" BIGSERIAL NOT NULL,
    "escola_id" TEXT NOT NULL,
    "aluno_id" UUID NOT NULL,
    "tentativa" SMALLINT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "minuto" INTEGER NOT NULL,
    "dados" JSONB NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp_03_marcos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp_03_simulacoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "aluno_id" UUID NOT NULL,
    "ordem" INTEGER NOT NULL,
    "alocacao" JSONB NOT NULL,
    "desfecho" JSONB NOT NULL,
    "minuto_da_saida" INTEGER NOT NULL,
    "versao_prompt" INTEGER NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp_03_simulacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp_03_relogio_turma" (
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "modo" TEXT NOT NULL DEFAULT 'cronometrado',
    "iniciado_em" TIMESTAMPTZ(6),
    "duracao_seg" INTEGER NOT NULL DEFAULT 300,
    "encerrado_em" TIMESTAMPTZ(6),
    "pivo_seg" INTEGER NOT NULL DEFAULT 0,
    "pivo_min" INTEGER NOT NULL DEFAULT 0,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp_03_relogio_turma_pkey" PRIMARY KEY ("escola_id","turma_id")
);

-- CreateIndex
CREATE INDEX "exp_03_sessoes_escola_id_idx" ON "exp_03_sessoes"("escola_id");

-- CreateIndex
CREATE INDEX "exp_03_sessoes_escola_id_turma_id_idx" ON "exp_03_sessoes"("escola_id", "turma_id");

-- CreateIndex
CREATE INDEX "exp_03_mensagens_escola_id_aluno_id_id_idx" ON "exp_03_mensagens"("escola_id", "aluno_id", "id");

-- CreateIndex
CREATE INDEX "exp_03_marcos_escola_id_aluno_id_idx" ON "exp_03_marcos"("escola_id", "aluno_id");

-- CreateIndex
CREATE UNIQUE INDEX "exp_03_marcos_escola_id_aluno_id_tentativa_ordem_key" ON "exp_03_marcos"("escola_id", "aluno_id", "tentativa", "ordem");

-- CreateIndex
CREATE INDEX "exp_03_simulacoes_escola_id_aluno_id_idx" ON "exp_03_simulacoes"("escola_id", "aluno_id");

-- CreateIndex
CREATE UNIQUE INDEX "exp_03_simulacoes_escola_id_aluno_id_ordem_key" ON "exp_03_simulacoes"("escola_id", "aluno_id", "ordem");

-- CreateIndex
CREATE INDEX "exp_03_relogio_turma_escola_id_idx" ON "exp_03_relogio_turma"("escola_id");

-- AddForeignKey
ALTER TABLE "exp_03_sessoes" ADD CONSTRAINT "exp_03_sessoes_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp_03_mensagens" ADD CONSTRAINT "exp_03_mensagens_escola_id_aluno_id_fkey" FOREIGN KEY ("escola_id", "aluno_id") REFERENCES "exp_03_sessoes"("escola_id", "aluno_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp_03_marcos" ADD CONSTRAINT "exp_03_marcos_escola_id_aluno_id_fkey" FOREIGN KEY ("escola_id", "aluno_id") REFERENCES "exp_03_sessoes"("escola_id", "aluno_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp_03_simulacoes" ADD CONSTRAINT "exp_03_simulacoes_escola_id_aluno_id_fkey" FOREIGN KEY ("escola_id", "aluno_id") REFERENCES "exp_03_sessoes"("escola_id", "aluno_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp_03_relogio_turma" ADD CONSTRAINT "exp_03_relogio_turma_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===========================================================================
-- Bloco MANUAL (molde: 20260825011950_unootube_sessoes). O Prisma não gera
-- CHECK, RLS nem GRANT — e é aqui que a regra inviolável nº 1 é aplicada.
-- ===========================================================================

-- CHECKs de ESTADO IMPOSSÍVEL. As regras de jogo são aplicadas no service sob
-- lock de linha; o banco é a rede final, não a primeira.
ALTER TABLE "exp_03_sessoes"
  ADD CONSTRAINT "exp_03_sessoes_passo_check"
    CHECK ("passo" IN ('abertura', 'orientacao', 'investigacao', 'resultado')),
  -- Teto de perguntas (regras/orcamento.ts). Conta o gasto, não o resto.
  ADD CONSTRAINT "exp_03_sessoes_perguntas_check"
    CHECK ("perguntas_gastas" >= 0 AND "perguntas_gastas" <= 3),
  -- Minuto da cidade: 17h00 às 18h00. Fora disso o relógio rebobinou.
  ADD CONSTRAINT "exp_03_sessoes_minuto_check"
    CHECK ("minutos_gastos" >= 0 AND "minutos_gastos" <= 60),
  -- Sanidade: são 8 conjuntos no catálogo, e eles não se repetem.
  ADD CONSTRAINT "exp_03_sessoes_conjuntos_check"
    CHECK (cardinality("conjuntos") <= 8),
  ADD CONSTRAINT "exp_03_sessoes_tentativa_check"
    CHECK ("tentativa" >= 1),
  -- Custo nunca é negativo, e chamada sem token gasto é estado impossível.
  ADD CONSTRAINT "exp_03_sessoes_custo_check"
    CHECK ("tokens_gastos" >= 0 AND "chamadas_ia" >= 0),
  -- Justificar sem destino não existe: a pergunta é "por que ESTE bairro?".
  -- Destino sem justificativa é legítimo (o portão exige antes de ENVIAR).
  ADD CONSTRAINT "exp_03_sessoes_justificativa_alfa_check"
    CHECK ("justificativa_alfa" IS NULL OR "alocacao_alfa" IS NOT NULL),
  ADD CONSTRAINT "exp_03_sessoes_justificativa_bravo_check"
    CHECK ("justificativa_bravo" IS NULL OR "alocacao_bravo" IS NOT NULL);

ALTER TABLE "exp_03_mensagens"
  ADD CONSTRAINT "exp_03_mensagens_papel_check"
    CHECK ("papel" IN ('aluno', 'agente')),
  -- Só fala do ALUNO debita pergunta: a resposta do Cientista nunca custa.
  ADD CONSTRAINT "exp_03_mensagens_debito_check"
    CHECK ("debitou" = false OR "papel" = 'aluno');

ALTER TABLE "exp_03_marcos"
  ADD CONSTRAINT "exp_03_marcos_tipo_check"
    CHECK ("tipo" IN ('fontes', 'leitura', 'alocacao', 'envio')),
  ADD CONSTRAINT "exp_03_marcos_minuto_check"
    CHECK ("minuto" >= 0 AND "minuto" <= 60);

ALTER TABLE "exp_03_simulacoes"
  ADD CONSTRAINT "exp_03_simulacoes_minuto_check"
    CHECK ("minuto_da_saida" >= 0 AND "minuto_da_saida" <= 60),
  ADD CONSTRAINT "exp_03_simulacoes_ordem_check"
    CHECK ("ordem" >= 1);

ALTER TABLE "exp_03_relogio_turma"
  ADD CONSTRAINT "exp_03_relogio_turma_modo_check"
    CHECK ("modo" IN ('cronometrado', 'livre')),
  -- Duração de zero (ou negativa) faria o minuto narrativo dividir por zero.
  ADD CONSTRAINT "exp_03_relogio_turma_duracao_check"
    CHECK ("duracao_seg" > 0),
  -- Encerrar o que nunca começou é estado impossível.
  ADD CONSTRAINT "exp_03_relogio_turma_encerrado_check"
    CHECK ("encerrado_em" IS NULL OR "iniciado_em" IS NOT NULL),
  -- O pivô da extensão vive dentro do relógio e dentro da hora da cidade.
  ADD CONSTRAINT "exp_03_relogio_turma_pivo_check"
    CHECK ("pivo_seg" >= 0 AND "pivo_min" >= 0 AND "pivo_min" <= 60);

-- RLS (regra inviolável nº 1) — mesma expressão das outras tabelas de aluno.
-- As quatro tabelas de dado do aluno E o relógio: a folha do professor é por
-- turma da ESCOLA dele, e uma rede vizinha não vê a largada da outra.
ALTER TABLE "exp_03_sessoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp_03_sessoes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp_03_sessoes_por_escola" ON "exp_03_sessoes"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp_03_mensagens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp_03_mensagens" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp_03_mensagens_por_escola" ON "exp_03_mensagens"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp_03_marcos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp_03_marcos" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp_03_marcos_por_escola" ON "exp_03_marcos"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp_03_simulacoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp_03_simulacoes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp_03_simulacoes_por_escola" ON "exp_03_simulacoes"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp_03_relogio_turma" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp_03_relogio_turma" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp_03_relogio_turma_por_escola" ON "exp_03_relogio_turma"
  USING (escola_id = current_setting('app.escola_id', true));

-- A role de runtime (docs/INFRA.md) conecta sem ownership e precisa de
-- privilégio nas tabelas novas. Guardado: em dev/CI a role não existe.
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    FOREACH t IN ARRAY ARRAY['exp_03_sessoes', 'exp_03_mensagens', 'exp_03_marcos',
                             'exp_03_simulacoes', 'exp_03_relogio_turma']
    LOOP
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_runtime', t);
    END LOOP;
    -- `exp_03_mensagens` e `exp_03_marcos` têm id BIGSERIAL: sem USAGE na
    -- sequência o INSERT falha para a role de runtime mesmo com o GRANT acima.
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE exp_03_mensagens_id_seq TO app_runtime';
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE exp_03_marcos_id_seq TO app_runtime';
  END IF;
END $$;
