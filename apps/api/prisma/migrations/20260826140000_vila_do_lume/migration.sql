-- exp-70-vila-do-lume — as três tabelas do módulo `vila`.
--
-- Três, e não quatro: NÃO existe tabela de evento fino. O app de origem tinha
-- uma (`eventos`), e ela era redundante — os eventos vivem íntegros dentro de
-- `vila_sessoes.payload`, que é a fonte para recomputar o perfil, e o canal
-- analítico do SDK já grava em `telemetria_eventos`. Duas tabelas de log seriam
-- duas histórias de retenção para o mesmo dado.

-- CreateTable
-- CreateTable
CREATE TABLE "vila_sessoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "estudante_id" UUID NOT NULL,
    "turma_id" UUID,
    "exp_version" TEXT NOT NULL,
    "schema_version" SMALLINT NOT NULL,
    "bolha" TEXT NOT NULL,
    "cartoes_servidos" SMALLINT NOT NULL DEFAULT 0,
    "aberta_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluida_em" TIMESTAMPTZ(6),
    "duracao_seg" INTEGER,
    "duracao_total_seg" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'aberta',
    "fogueiras_acesas" SMALLINT NOT NULL DEFAULT 0,
    "pedras_quebradas" SMALLINT NOT NULL DEFAULT 0,
    "aldeoes_ajudados" SMALLINT NOT NULL DEFAULT 0,
    "lampioes_acesos" SMALLINT NOT NULL DEFAULT 0,
    "tochas_acesas" SMALLINT NOT NULL DEFAULT 0,
    "dilemas_vistos" SMALLINT NOT NULL DEFAULT 0,
    "dilemas_resolvidos" SMALLINT NOT NULL DEFAULT 0,
    "distancia_m" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB,
    "leitura_mensagens" JSONB,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vila_sessoes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vila_perfis" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "sessao_id" UUID NOT NULL,
    "estudante_id" UUID NOT NULL,
    "versao_mapeamento" SMALLINT NOT NULL,
    "valores" JSONB NOT NULL,
    "graus" JSONB NOT NULL,
    "abertura_vs_conservacao" DOUBLE PRECISION,
    "transcendencia_vs_autopromocao" DOUBLE PRECISION,
    "amostra_suficiente" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vila_perfis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vila_bolhas" (
    "escola_id" TEXT NOT NULL,
    "estudante_id" UUID NOT NULL,
    "bolha" TEXT NOT NULL,
    "atribuida_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vila_bolhas_pkey" PRIMARY KEY ("escola_id","estudante_id")
);

-- CreateIndex
CREATE INDEX "idx_vila_sessoes_consulta" ON "vila_sessoes"("escola_id", "turma_id", "aberta_em");
CREATE INDEX "idx_vila_sessoes_purga" ON "vila_sessoes"("expires_at");
CREATE INDEX "idx_vila_sessoes_estudante" ON "vila_sessoes"("escola_id", "estudante_id");
CREATE UNIQUE INDEX "vila_perfis_sessao_id_versao_mapeamento_key" ON "vila_perfis"("sessao_id", "versao_mapeamento");
CREATE INDEX "idx_vila_perfis_consulta" ON "vila_perfis"("escola_id", "estudante_id", "created_at");
CREATE INDEX "idx_vila_bolhas_escola" ON "vila_bolhas"("escola_id");

-- AddForeignKey
ALTER TABLE "vila_sessoes" ADD CONSTRAINT "vila_sessoes_estudante_id_fkey"
  FOREIGN KEY ("estudante_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vila_perfis" ADD CONSTRAINT "vila_perfis_sessao_id_fkey"
  FOREIGN KEY ("sessao_id") REFERENCES "vila_sessoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vila_perfis" ADD CONSTRAINT "vila_perfis_estudante_id_fkey"
  FOREIGN KEY ("estudante_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vila_bolhas" ADD CONSTRAINT "vila_bolhas_estudante_id_fkey"
  FOREIGN KEY ("estudante_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- O que o Prisma não modela.
-- ============================================================================

-- A bolha é do conjunto fechado das três. Um valor fora dele não é dado ruim:
-- é uma criança que recebeu cartão nenhum e um relatório que abre pelo nível
-- errado.
ALTER TABLE "vila_sessoes"
  ADD CONSTRAINT "ck_vila_sessoes_bolha" CHECK ("bolha" IN ('A', 'B', 'C')),
  ADD CONSTRAINT "ck_vila_sessoes_status" CHECK ("status" IN ('aberta', 'completa', 'abandonada')),
  -- O contrato do payload já limita a 7200s/14400s; aqui é a rede final.
  ADD CONSTRAINT "ck_vila_sessoes_duracao"
    CHECK ("duracao_seg" IS NULL OR "duracao_seg" BETWEEN 0 AND 7200),
  ADD CONSTRAINT "ck_vila_sessoes_duracao_total"
    CHECK ("duracao_total_seg" IS NULL OR "duracao_total_seg" >= "duracao_seg"),
  -- Partida `aberta` não tem fim; partida fechada tem. Estado impossível fora
  -- disso: uma linha `completa` sem `concluida_em` faria a purga e o relatório
  -- discordarem sobre se a partida existiu.
  ADD CONSTRAINT "ck_vila_sessoes_fim"
    CHECK (("status" = 'aberta') = ("concluida_em" IS NULL)),
  ADD CONSTRAINT "ck_vila_sessoes_expira" CHECK ("expires_at" > "created_at"),
  ADD CONSTRAINT "ck_vila_sessoes_fogueiras" CHECK ("fogueiras_acesas" BETWEEN 0 AND 8),
  ADD CONSTRAINT "ck_vila_sessoes_dilemas"
    CHECK ("dilemas_resolvidos" <= "dilemas_vistos");

ALTER TABLE "vila_bolhas"
  ADD CONSTRAINT "ck_vila_bolhas_bolha" CHECK ("bolha" IN ('A', 'B', 'C'));

-- `versao_mapeamento` é o que permite comparar duas gerações do mesmo perfil.
-- Zero ou negativo significaria perfil sem geração — incomparável com tudo.
ALTER TABLE "vila_perfis"
  ADD CONSTRAINT "ck_vila_perfis_versao" CHECK ("versao_mapeamento" > 0),
  -- Eixo do circumplexo vai de -1 a +1, e NULO quando um polo não foi
  -- observado. Fora da faixa é bug de fórmula, e o relatório desenharia a barra
  -- divergente estourando a escala fixa sem nada avisar.
  ADD CONSTRAINT "ck_vila_perfis_eixo_ac"
    CHECK ("abertura_vs_conservacao" IS NULL OR "abertura_vs_conservacao" BETWEEN -1 AND 1),
  ADD CONSTRAINT "ck_vila_perfis_eixo_ta"
    CHECK ("transcendencia_vs_autopromocao" IS NULL OR "transcendencia_vs_autopromocao" BETWEEN -1 AND 1);

-- RLS (regra inviolável nº 1) — mesma expressão das outras tabelas de estudante.
-- O que estas guardam é retrato comportamental de criança com a palavra "Poder"
-- numa das linhas; travessia entre escolas aqui não é vazamento de contagem.
ALTER TABLE "vila_sessoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vila_sessoes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "vila_sessoes_por_escola" ON "vila_sessoes"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "vila_perfis" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vila_perfis" FORCE ROW LEVEL SECURITY;
CREATE POLICY "vila_perfis_por_escola" ON "vila_perfis"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "vila_bolhas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vila_bolhas" FORCE ROW LEVEL SECURITY;
CREATE POLICY "vila_bolhas_por_escola" ON "vila_bolhas"
  USING (escola_id = current_setting('app.escola_id', true));

-- A role de runtime (docs/INFRA.md) conecta sem ownership. Guardado: em dev/CI
-- a role não existe.
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "vila_sessoes" TO app_runtime;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "vila_perfis" TO app_runtime;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "vila_bolhas" TO app_runtime;
  END IF;
END $$;
