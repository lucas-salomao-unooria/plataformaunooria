-- exp-92 — PLANO DE ENSINO dirigido pela BNCC.
--
-- Três tabelas para dois níveis de planejamento: a REGÊNCIA (o que o professor
-- leciona e quantas aulas tem), o plano ANUAL (macro, por período de avaliação)
-- e os planos de PERÍODO (granular, aula a aula, semanal ou quinzenal).
--
-- Por que não alargou `exp_90_planos`: a exp-90 sabe do plano apenas "de que
-- disciplina e série ele é", porque gera prosa a partir de texto de currículo
-- importado. Aqui o plano precisa de carga horária, grade de horários, divisão
-- do ano e a distribuição de habilidades por período. Alargar as colunas de lá
-- quebraria a exp-90, que está em uso.
--
-- Molde do bloco manual: 20260903120000_exp_07_o_eco_no_grupo.

-- CreateTable
CREATE TABLE "exp_92_configuracoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "professor_id" UUID NOT NULL,
    "ano_letivo" SMALLINT NOT NULL,
    "serie" TEXT NOT NULL,
    "componente" TEXT NOT NULL,
    "turma_id" UUID,
    "divisao_do_ano" TEXT NOT NULL DEFAULT 'bimestral',
    "periodicidade" TEXT NOT NULL DEFAULT 'semanal',
    "minutos_por_aula" SMALLINT NOT NULL DEFAULT 50,
    "aulas_semanais" SMALLINT NOT NULL,
    "grade" JSONB NOT NULL DEFAULT '[]',
    "incluir_computacao" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp_92_configuracoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp_92_planos_anuais" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "professor_id" UUID NOT NULL,
    "configuracao_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "tentativas" SMALLINT NOT NULL DEFAULT 0,
    "iniciado_em" TIMESTAMPTZ(6),
    "erro" TEXT,
    "tokens_usados" INTEGER NOT NULL DEFAULT 0,
    "distribuicao" JSONB NOT NULL DEFAULT '{}',
    "distribuicao_computacao" JSONB NOT NULL DEFAULT '{}',
    "caminho_gerado_md" TEXT,
    "caminho_html" TEXT,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp_92_planos_anuais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp_92_planos_de_periodo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "professor_id" UUID NOT NULL,
    "plano_anual_id" UUID NOT NULL,
    "ordem" SMALLINT NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE NOT NULL,
    "periodo_de_avaliacao" SMALLINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "tentativas" SMALLINT NOT NULL DEFAULT 0,
    "iniciado_em" TIMESTAMPTZ(6),
    "erro" TEXT,
    "tokens_usados" INTEGER NOT NULL DEFAULT 0,
    "aulas" JSONB NOT NULL DEFAULT '[]',
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp_92_planos_de_periodo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exp_92_configuracao_unica"
  ON "exp_92_configuracoes"("escola_id", "professor_id", "ano_letivo", "serie", "componente");
CREATE INDEX "exp_92_configuracoes_escola_id_professor_id_idx"
  ON "exp_92_configuracoes"("escola_id", "professor_id");

CREATE INDEX "exp_92_planos_anuais_escola_id_professor_id_idx"
  ON "exp_92_planos_anuais"("escola_id", "professor_id");
CREATE INDEX "exp_92_planos_anuais_escola_id_configuracao_id_idx"
  ON "exp_92_planos_anuais"("escola_id", "configuracao_id");

CREATE UNIQUE INDEX "exp_92_periodo_unico"
  ON "exp_92_planos_de_periodo"("escola_id", "plano_anual_id", "ordem");
CREATE INDEX "exp_92_planos_de_periodo_escola_id_professor_id_idx"
  ON "exp_92_planos_de_periodo"("escola_id", "professor_id");

-- AddForeignKey
ALTER TABLE "exp_92_configuracoes" ADD CONSTRAINT "exp_92_configuracoes_professor_id_fkey"
  FOREIGN KEY ("professor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exp_92_configuracoes" ADD CONSTRAINT "exp_92_configuracoes_turma_id_fkey"
  FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "exp_92_planos_anuais" ADD CONSTRAINT "exp_92_planos_anuais_configuracao_id_fkey"
  FOREIGN KEY ("configuracao_id") REFERENCES "exp_92_configuracoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exp_92_planos_anuais" ADD CONSTRAINT "exp_92_planos_anuais_professor_id_fkey"
  FOREIGN KEY ("professor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "exp_92_planos_de_periodo" ADD CONSTRAINT "exp_92_planos_de_periodo_plano_anual_id_fkey"
  FOREIGN KEY ("plano_anual_id") REFERENCES "exp_92_planos_anuais"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exp_92_planos_de_periodo" ADD CONSTRAINT "exp_92_planos_de_periodo_professor_id_fkey"
  FOREIGN KEY ("professor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------- bloco MANUAL

-- A divisão do ano é escolha da escola (nenhuma norma nacional a fixa), mas o
-- conjunto é fechado: o gerador de plano de período conta semanas a partir dela.
ALTER TABLE "exp_92_configuracoes"
  ADD CONSTRAINT "exp_92_configuracoes_divisao_valida"
  CHECK ("divisao_do_ano" IN ('bimestral', 'trimestral', 'semestral'));

-- O passo do planejamento granular. Foi o pedido de origem do produto.
ALTER TABLE "exp_92_configuracoes"
  ADD CONSTRAINT "exp_92_configuracoes_periodicidade_valida"
  CHECK ("periodicidade" IN ('semanal', 'quinzenal'));

-- Aula de 30 a 60 minutos cobre tudo que as redes praticam (45, 50, 60) com
-- folga nas pontas. Fora disso é erro de digitação, e um erro aqui contamina a
-- conversão para hora-relógio do plano inteiro.
ALTER TABLE "exp_92_configuracoes"
  ADD CONSTRAINT "exp_92_configuracoes_minutos_plausiveis"
  CHECK ("minutos_por_aula" BETWEEN 30 AND 60);

-- Um componente com 0 aulas semanais não é planejável, e mais de 20 aulas
-- semanais de UM componente não existe em matriz nenhuma (o topo é Língua
-- Portuguesa dos anos iniciais de São Paulo, com 10).
ALTER TABLE "exp_92_configuracoes"
  ADD CONSTRAINT "exp_92_configuracoes_aulas_plausiveis"
  CHECK ("aulas_semanais" BETWEEN 1 AND 20);

-- Ano letivo: a plataforma entra em produção em 2026 e nenhum plano de ensino
-- se refere a antes disso.
ALTER TABLE "exp_92_configuracoes"
  ADD CONSTRAINT "exp_92_configuracoes_ano_plausivel"
  CHECK ("ano_letivo" BETWEEN 2025 AND 2100);

-- A mesma máquina de estados da exp-90. `erro` só faz sentido em 'erro', e
-- 'pronto' sem documento é um plano que a tela mostraria vazio.
ALTER TABLE "exp_92_planos_anuais"
  ADD CONSTRAINT "exp_92_planos_anuais_status_valido"
  CHECK ("status" IN ('pendente', 'gerando', 'pronto', 'erro'));

ALTER TABLE "exp_92_planos_de_periodo"
  ADD CONSTRAINT "exp_92_planos_de_periodo_status_valido"
  CHECK ("status" IN ('pendente', 'gerando', 'pronto', 'erro'));

-- Uma semana/quinzena não termina antes de começar. Parece óbvio, e é
-- exatamente o tipo de inversão que um fuso horário mal convertido produz.
ALTER TABLE "exp_92_planos_de_periodo"
  ADD CONSTRAINT "exp_92_planos_de_periodo_intervalo_valido"
  CHECK ("fim" >= "inicio");

-- No máximo 4 períodos de avaliação (bimestral); a divisão fica na configuração
-- e este CHECK só barra o absurdo.
ALTER TABLE "exp_92_planos_de_periodo"
  ADD CONSTRAINT "exp_92_planos_de_periodo_avaliacao_valida"
  CHECK ("periodo_de_avaliacao" BETWEEN 1 AND 4);

-- Regra 1 do AGENTS.md: dado de escola é isolado por `escola_id` com RLS.
--
-- O plano de ensino não é dado de estudante, mas é trabalho intelectual do
-- professor e carrega o nome dele — o vazamento entre escolas de um mesmo
-- contrato seria tão indefensável quanto o de uma nota.
ALTER TABLE "exp_92_configuracoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp_92_configuracoes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp_92_configuracoes_por_escola" ON "exp_92_configuracoes"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp_92_planos_anuais" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp_92_planos_anuais" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp_92_planos_anuais_por_escola" ON "exp_92_planos_anuais"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp_92_planos_de_periodo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp_92_planos_de_periodo" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp_92_planos_de_periodo_por_escola" ON "exp_92_planos_de_periodo"
  USING (escola_id = current_setting('app.escola_id', true));

-- A role de runtime (docs/INFRA.md) conecta sem ownership e precisa de
-- privilégio nas tabelas novas. Guardado: em dev/CI a role não existe.
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    FOREACH t IN ARRAY ARRAY['exp_92_configuracoes', 'exp_92_planos_anuais',
                             'exp_92_planos_de_periodo']
    LOOP
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_runtime', t);
    END LOOP;
  END IF;
END $$;
