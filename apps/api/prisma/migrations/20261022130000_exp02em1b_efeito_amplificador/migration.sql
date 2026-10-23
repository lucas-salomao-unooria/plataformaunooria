-- O EFEITO AMPLIFICADOR — a missão da 2ª série do EM, unidade 1 (ADR-180).
--
-- Roda DEPOIS de `20261022120000_exp02em1b_versao_anterior`, que levou a
-- Missão Tempestade para `exp02em1b-v0` e as tabelas dela para `exp02em1b_v0_*`:
-- é por isso que o prefixo `exp02em1b_` está livre aqui.
--
-- Quatro tabelas: o pacote (a atividade da evidência), a fase da turma, o
-- histórico dos botões do professor e a sessão do estudante. O DDL abaixo é o
-- `prisma migrate diff`; o bloco MANUAL do fim é o que o Prisma não gera.

-- CreateTable
CREATE TABLE "exp02em1b_pacotes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "disciplina" TEXT NOT NULL,
    "tema" TEXT NOT NULL,
    "assuntos" TEXT[],
    "contexto" TEXT,
    "conteudo_json" JSONB NOT NULL,
    "origem" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "rodada_atual" SMALLINT NOT NULL DEFAULT 1,
    "aprovado_em" TIMESTAMPTZ(6),
    "aprovado_por" UUID,
    "ia_geracoes" INTEGER NOT NULL DEFAULT 0,
    "ia_tokens" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp02em1b_pacotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp02em1b_gates_turma" (
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "fase" TEXT NOT NULL DEFAULT 'aberta',
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp02em1b_gates_turma_pkey" PRIMARY KEY ("escola_id","turma_id")
);

-- CreateTable
CREATE TABLE "exp02em1b_gates_historico" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "pacote_id" UUID NOT NULL,
    "rodada" SMALLINT NOT NULL,
    "fase" TEXT NOT NULL,
    "professor_id" UUID,
    "em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp02em1b_gates_historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp02em1b_sessoes" (
    "escola_id" TEXT NOT NULL,
    "estudante_id" UUID NOT NULL,
    "pacote_id" UUID NOT NULL,
    "rodada" SMALLINT NOT NULL,
    "turma_id" UUID NOT NULL,
    "entrou_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversa" JSONB NOT NULL DEFAULT '[]',
    "mensagens_enviadas" SMALLINT NOT NULL DEFAULT 0,
    "previa" JSONB NOT NULL DEFAULT '{}',
    "manchete" TEXT,
    "texto_publicado" TEXT,
    "trecho_pincado" TEXT,
    "publicada_em" TIMESTAMPTZ(6),
    "feed" JSONB NOT NULL DEFAULT '{}',
    "explicar_em" TIMESTAMPTZ(6),
    "indicadores" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ultimo_nao_comprova" BOOLEAN NOT NULL DEFAULT false,
    "concluido_em" TIMESTAMPTZ(6),
    "versao_instrumento" TEXT NOT NULL DEFAULT '1.0.0',
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp02em1b_sessoes_pkey" PRIMARY KEY ("escola_id","estudante_id","pacote_id","rodada")
);

-- CreateIndex
CREATE INDEX "exp02em1b_pacotes_escola_id_turma_id_idx" ON "exp02em1b_pacotes"("escola_id", "turma_id");

-- CreateIndex
CREATE UNIQUE INDEX "exp02em1b_pacotes_escola_id_id_key" ON "exp02em1b_pacotes"("escola_id", "id");

-- CreateIndex
CREATE INDEX "exp02em1b_gates_historico_escola_id_turma_id_idx" ON "exp02em1b_gates_historico"("escola_id", "turma_id");

-- CreateIndex
CREATE INDEX "exp02em1b_sessoes_escola_id_turma_id_pacote_id_rodada_idx" ON "exp02em1b_sessoes"("escola_id", "turma_id", "pacote_id", "rodada");

-- AddForeignKey
ALTER TABLE "exp02em1b_pacotes" ADD CONSTRAINT "exp02em1b_pacotes_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp02em1b_gates_turma" ADD CONSTRAINT "exp02em1b_gates_turma_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp02em1b_gates_historico" ADD CONSTRAINT "exp02em1b_gates_historico_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp02em1b_gates_historico" ADD CONSTRAINT "exp02em1b_gates_historico_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp02em1b_sessoes" ADD CONSTRAINT "exp02em1b_sessoes_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp02em1b_sessoes" ADD CONSTRAINT "exp02em1b_sessoes_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp02em1b_sessoes" ADD CONSTRAINT "exp02em1b_sessoes_escola_id_pacote_id_fkey" FOREIGN KEY ("escola_id", "pacote_id") REFERENCES "exp02em1b_pacotes"("escola_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Bloco MANUAL. O Prisma não gera CHECK, índice parcial, RLS nem GRANT.
-- Os vocabulários espelham `apps/api/src/efeito-amplificador/conteudo.ts`, e a
-- suíte de Postgres compara os dois textos.
-- ---------------------------------------------------------------------------

ALTER TABLE "exp02em1b_pacotes"
  ADD CONSTRAINT "exp02em1b_pacotes_disciplina_check"
    CHECK ("disciplina" IN ('lingua-portuguesa', 'biologia', 'historia', 'interdisciplinar')),
  ADD CONSTRAINT "exp02em1b_pacotes_origem_check" CHECK ("origem" IN ('ia', 'padrao')),
  ADD CONSTRAINT "exp02em1b_pacotes_conteudo_check" CHECK (jsonb_typeof("conteudo_json") = 'object'),
  -- Carimbo e autor andam juntos; só o homologado vai ao ar.
  ADD CONSTRAINT "exp02em1b_pacotes_aprovado_check" CHECK (("aprovado_em" IS NULL) = ("aprovado_por" IS NULL)),
  ADD CONSTRAINT "exp02em1b_pacotes_ativo_check" CHECK (NOT "ativo" OR "aprovado_em" IS NOT NULL),
  ADD CONSTRAINT "exp02em1b_pacotes_rodada_check" CHECK ("rodada_atual" >= 1);

-- Um em andamento por turma, e um rascunho por turma (o preparo custou saldo:
-- um F5 não pode jogá-lo fora, e dois rascunhos seriam dois "o último").
CREATE UNIQUE INDEX "exp02em1b_pacotes_um_ativo_por_turma"
  ON "exp02em1b_pacotes" ("escola_id", "turma_id") WHERE "ativo";
CREATE UNIQUE INDEX "exp02em1b_pacotes_um_rascunho_por_turma"
  ON "exp02em1b_pacotes" ("escola_id", "turma_id") WHERE "aprovado_em" IS NULL;

ALTER TABLE "exp02em1b_gates_turma"
  ADD CONSTRAINT "exp02em1b_gates_turma_fase_check" CHECK ("fase" IN ('aberta', 'debate', 'explicar'));

ALTER TABLE "exp02em1b_gates_historico"
  ADD CONSTRAINT "exp02em1b_gates_historico_fase_check" CHECK ("fase" IN ('debate', 'explicar')),
  ADD CONSTRAINT "exp02em1b_gates_historico_rodada_check" CHECK ("rodada" >= 1);

ALTER TABLE "exp02em1b_sessoes"
  ADD CONSTRAINT "exp02em1b_sessoes_rodada_check" CHECK ("rodada" >= 1),
  ADD CONSTRAINT "exp02em1b_sessoes_conversa_check" CHECK (jsonb_typeof("conversa") = 'array'),
  ADD CONSTRAINT "exp02em1b_sessoes_previa_check" CHECK (jsonb_typeof("previa") = 'object'),
  ADD CONSTRAINT "exp02em1b_sessoes_feed_check" CHECK (jsonb_typeof("feed") = 'object'),
  -- O teto do chat (`MENSAGENS_NO_CHAT`).
  ADD CONSTRAINT "exp02em1b_sessoes_mensagens_check" CHECK ("mensagens_enviadas" BETWEEN 0 AND 5),
  ADD CONSTRAINT "exp02em1b_sessoes_manchete_check"
    CHECK ("manchete" IS NULL OR "manchete" IN ('neutra', 'construtiva', 'sensacionalista')),
  -- O LATCH é um só: manchete, texto, trecho pinçado e carimbo no MESMO UPDATE.
  ADD CONSTRAINT "exp02em1b_sessoes_publicacao_check" CHECK (
    ("publicada_em" IS NULL) = ("manchete" IS NULL)
    AND ("publicada_em" IS NULL) = ("texto_publicado" IS NULL)
    AND ("publicada_em" IS NULL) = ("trecho_pincado" IS NULL)
  ),
  -- O Explicar só depois de publicar; concluir só depois do Explicar.
  ADD CONSTRAINT "exp02em1b_sessoes_explicar_check" CHECK ("explicar_em" IS NULL OR "publicada_em" IS NOT NULL),
  ADD CONSTRAINT "exp02em1b_sessoes_concluido_check" CHECK ("concluido_em" IS NULL OR "explicar_em" IS NOT NULL),
  ADD CONSTRAINT "exp02em1b_sessoes_indicadores_check"
    CHECK ("indicadores" <@ ARRAY['pico-madrugada', 'retencao']::TEXT[]);

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['exp02em1b_pacotes', 'exp02em1b_gates_turma', 'exp02em1b_gates_historico', 'exp02em1b_sessoes'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (escola_id = current_setting(''app.escola_id'', true))', t || '_por_escola', t);
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_runtime', t);
    END IF;
  END LOOP;
END $$;
