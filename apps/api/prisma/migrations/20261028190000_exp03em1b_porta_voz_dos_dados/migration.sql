-- O PORTA-VOZ DOS DADOS — a missão da 3ª série EM, unidade 1 (ADR-198).
--
-- Cinco tabelas: o pacote didático (a atividade da evidência), o gate da turma
-- (exploracao → pausa → liberada), o histórico dos botões (EVT-P05), a sessão
-- do estudante (só carimbos, a cota e a perícia em colunas: NENHUM texto livre)
-- e as publicações (uma linha por publicação confirmada — a 1ª e a errata; o
-- original fica no histórico, a diretriz do PO). O DDL abaixo é o
-- `prisma migrate diff`; o bloco MANUAL do fim é o que o Prisma não gera.

-- CreateTable
CREATE TABLE "exp03em1b_pacotes" (
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
    "preparo_iniciado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ia_geracoes" INTEGER NOT NULL DEFAULT 0,
    "ia_tokens" INTEGER NOT NULL DEFAULT 0,
    "painel_visto_em" TIMESTAMPTZ(6),
    "painel_vistas" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp03em1b_pacotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp03em1b_gates_turma" (
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "etapa" TEXT NOT NULL DEFAULT 'exploracao',
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp03em1b_gates_turma_pkey" PRIMARY KEY ("escola_id","turma_id")
);

-- CreateTable
CREATE TABLE "exp03em1b_gates_historico" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "pacote_id" UUID NOT NULL,
    "rodada" SMALLINT NOT NULL,
    "etapa" TEXT NOT NULL,
    "professor_id" UUID,
    "em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp03em1b_gates_historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp03em1b_sessoes" (
    "escola_id" TEXT NOT NULL,
    "estudante_id" UUID NOT NULL,
    "pacote_id" UUID NOT NULL,
    "rodada" SMALLINT NOT NULL,
    "turma_id" UUID NOT NULL,
    "entrou_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chat_aberto_em" TIMESTAMPTZ(6),
    "anexo_aberto_em" TIMESTAMPTZ(6),
    "nudge_e2_em" TIMESTAMPTZ(6),
    "compositor_aberto_em" TIMESTAMPTZ(6),
    "slots_restantes" SMALLINT NOT NULL DEFAULT 3,
    "publicada_em" TIMESTAMPTZ(6),
    "errata_em" TIMESTAMPTZ(6),
    "errata_pulada" BOOLEAN NOT NULL DEFAULT false,
    "pericia_aberta_em" TIMESTAMPTZ(6),
    "sinalizou_a" BOOLEAN,
    "motivo_a" TEXT,
    "sinalizou_b" BOOLEAN,
    "motivo_b" TEXT,
    "parecer_em" TIMESTAMPTZ(6),
    "pulou_pericia" BOOLEAN NOT NULL DEFAULT false,
    "concluido_em" TIMESTAMPTZ(6),
    "versao_instrumento" TEXT NOT NULL DEFAULT '1.0.0',
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp03em1b_sessoes_pkey" PRIMARY KEY ("escola_id","estudante_id","pacote_id","rodada")
);

-- CreateTable
CREATE TABLE "exp03em1b_publicacoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "estudante_id" UUID NOT NULL,
    "pacote_id" UUID NOT NULL,
    "rodada" SMALLINT NOT NULL,
    "turma_id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "escala" SMALLINT NOT NULL,
    "explicacao" BOOLEAN NOT NULL,
    "fonte" BOOLEAN NOT NULL,
    "contexto" BOOLEAN NOT NULL,
    "publicada_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp03em1b_publicacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exp03em1b_pacotes_escola_id_turma_id_idx" ON "exp03em1b_pacotes"("escola_id", "turma_id");

-- CreateIndex
CREATE UNIQUE INDEX "exp03em1b_pacotes_escola_id_id_key" ON "exp03em1b_pacotes"("escola_id", "id");

-- CreateIndex
CREATE INDEX "exp03em1b_gates_historico_escola_id_turma_id_idx" ON "exp03em1b_gates_historico"("escola_id", "turma_id");

-- CreateIndex
CREATE INDEX "exp03em1b_sessoes_escola_id_turma_id_pacote_id_rodada_idx" ON "exp03em1b_sessoes"("escola_id", "turma_id", "pacote_id", "rodada");

-- CreateIndex
CREATE INDEX "exp03em1b_publicacoes_escola_id_turma_id_pacote_id_rodada_idx" ON "exp03em1b_publicacoes"("escola_id", "turma_id", "pacote_id", "rodada");

-- CreateIndex
CREATE UNIQUE INDEX "exp03em1b_publicacoes_escola_id_estudante_id_pacote_id_roda_key" ON "exp03em1b_publicacoes"("escola_id", "estudante_id", "pacote_id", "rodada", "tipo");

-- AddForeignKey
ALTER TABLE "exp03em1b_pacotes" ADD CONSTRAINT "exp03em1b_pacotes_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp03em1b_gates_turma" ADD CONSTRAINT "exp03em1b_gates_turma_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp03em1b_gates_historico" ADD CONSTRAINT "exp03em1b_gates_historico_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp03em1b_gates_historico" ADD CONSTRAINT "exp03em1b_gates_historico_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp03em1b_sessoes" ADD CONSTRAINT "exp03em1b_sessoes_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp03em1b_sessoes" ADD CONSTRAINT "exp03em1b_sessoes_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp03em1b_sessoes" ADD CONSTRAINT "exp03em1b_sessoes_escola_id_pacote_id_fkey" FOREIGN KEY ("escola_id", "pacote_id") REFERENCES "exp03em1b_pacotes"("escola_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp03em1b_publicacoes" ADD CONSTRAINT "exp03em1b_publicacoes_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp03em1b_publicacoes" ADD CONSTRAINT "exp03em1b_publicacoes_escola_id_estudante_id_pacote_id_rod_fkey" FOREIGN KEY ("escola_id", "estudante_id", "pacote_id", "rodada") REFERENCES "exp03em1b_sessoes"("escola_id", "estudante_id", "pacote_id", "rodada") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Bloco MANUAL. O Prisma não gera CHECK, índice parcial, RLS nem GRANT.
-- Os vocabulários espelham `apps/api/src/porta-voz-dos-dados/conteudo.ts`, e a
-- suíte `tests/porta-voz-dos-dados-regras.spec.ts` compara os dois textos.
-- ---------------------------------------------------------------------------

ALTER TABLE "exp03em1b_pacotes"
  ADD CONSTRAINT "exp03em1b_pacotes_disciplina_check"
    CHECK ("disciplina" IN ('lingua-portuguesa', 'lingua-inglesa', 'arte', 'educacao-fisica', 'matematica', 'biologia', 'fisica', 'quimica', 'filosofia', 'geografia', 'historia', 'sociologia', 'computacao', 'interdisciplinar')),
  ADD CONSTRAINT "exp03em1b_pacotes_origem_check" CHECK ("origem" IN ('ia', 'padrao')),
  ADD CONSTRAINT "exp03em1b_pacotes_conteudo_check" CHECK (jsonb_typeof("conteudo_json") = 'object'),
  ADD CONSTRAINT "exp03em1b_pacotes_assuntos_check" CHECK (cardinality("assuntos") BETWEEN 3 AND 6),
  -- Carimbo e autor andam juntos; só o homologado vai ao ar.
  ADD CONSTRAINT "exp03em1b_pacotes_aprovado_check" CHECK (("aprovado_em" IS NULL) = ("aprovado_por" IS NULL)),
  ADD CONSTRAINT "exp03em1b_pacotes_ativo_check" CHECK (NOT "ativo" OR "aprovado_em" IS NOT NULL),
  ADD CONSTRAINT "exp03em1b_pacotes_rodada_check" CHECK ("rodada_atual" >= 1),
  ADD CONSTRAINT "exp03em1b_pacotes_contadores_check" CHECK ("ia_geracoes" >= 0 AND "ia_tokens" >= 0 AND "painel_vistas" >= 0);

-- Um em andamento por turma, e um rascunho por turma (o preparo custou saldo:
-- um F5 não pode jogá-lo fora, e dois rascunhos seriam dois "o último").
CREATE UNIQUE INDEX "exp03em1b_pacotes_um_ativo_por_turma"
  ON "exp03em1b_pacotes" ("escola_id", "turma_id") WHERE "ativo";
CREATE UNIQUE INDEX "exp03em1b_pacotes_um_rascunho_por_turma"
  ON "exp03em1b_pacotes" ("escola_id", "turma_id") WHERE "aprovado_em" IS NULL;

ALTER TABLE "exp03em1b_gates_turma"
  ADD CONSTRAINT "exp03em1b_gates_turma_etapa_check" CHECK ("etapa" IN ('exploracao', 'pausa', 'liberada'));

-- O histórico guarda para ONDE a turma foi: nunca a etapa inicial (ela é o zerar, não um botão).
ALTER TABLE "exp03em1b_gates_historico"
  ADD CONSTRAINT "exp03em1b_gates_historico_etapa_check" CHECK ("etapa" IN ('pausa', 'liberada')),
  ADD CONSTRAINT "exp03em1b_gates_historico_rodada_check" CHECK ("rodada" >= 1);

ALTER TABLE "exp03em1b_sessoes"
  ADD CONSTRAINT "exp03em1b_sessoes_rodada_check" CHECK ("rodada" >= 1),
  -- O compositor só depois do chat; a 1ª publicação só com o compositor aberto.
  ADD CONSTRAINT "exp03em1b_sessoes_compositor_ordem_check" CHECK ("compositor_aberto_em" IS NULL OR "chat_aberto_em" IS NOT NULL),
  ADD CONSTRAINT "exp03em1b_sessoes_publicacao_ordem_check" CHECK ("publicada_em" IS NULL OR "compositor_aberto_em" IS NOT NULL),
  -- A COTA: 3 antes do latch 1, 2 depois dele, 1 depois da errata publicada. Não há 3ª publicação.
  ADD CONSTRAINT "exp03em1b_sessoes_slots_check" CHECK ("slots_restantes" BETWEEN 1 AND 3),
  ADD CONSTRAINT "exp03em1b_sessoes_latch1_check" CHECK (("publicada_em" IS NULL) = ("slots_restantes" = 3)),
  ADD CONSTRAINT "exp03em1b_sessoes_errata_check" CHECK (
    ("errata_em" IS NULL OR "publicada_em" IS NOT NULL)
    AND (NOT "errata_pulada" OR "errata_em" IS NOT NULL)
    AND (("slots_restantes" = 1) = ("errata_em" IS NOT NULL AND NOT "errata_pulada"))
  ),
  -- A perícia: só depois da errata decidida; o parecer em colunas, de vocabulário fechado.
  ADD CONSTRAINT "exp03em1b_sessoes_pericia_ordem_check" CHECK ("pericia_aberta_em" IS NULL OR "errata_em" IS NOT NULL),
  ADD CONSTRAINT "exp03em1b_sessoes_motivo_check" CHECK (
    ("motivo_a" IS NULL OR "motivo_a" IN ('escala', 'fonte', 'titulo'))
    AND ("motivo_b" IS NULL OR "motivo_b" IN ('escala', 'fonte', 'titulo'))
  ),
  ADD CONSTRAINT "exp03em1b_sessoes_parecer_check" CHECK (
    ("parecer_em" IS NULL) = ("sinalizou_a" IS NULL)
    AND ("parecer_em" IS NULL) = ("sinalizou_b" IS NULL)
    AND ("motivo_a" IS NULL OR "sinalizou_a")
    AND ("motivo_b" IS NULL OR "sinalizou_b")
    AND (NOT coalesce("sinalizou_a", false) OR "motivo_a" IS NOT NULL)
    AND (NOT coalesce("sinalizou_b", false) OR "motivo_b" IS NOT NULL)
    AND NOT ("pulou_pericia" AND "parecer_em" IS NOT NULL)
  ),
  -- O LATCH final: a conclusão é o parecer emitido OU a perícia pulada, depois da perícia aberta.
  ADD CONSTRAINT "exp03em1b_sessoes_conclusao_check" CHECK (
    ("concluido_em" IS NOT NULL) = ("parecer_em" IS NOT NULL OR "pulou_pericia")
    AND ("concluido_em" IS NULL OR "pericia_aberta_em" IS NOT NULL)
  );

ALTER TABLE "exp03em1b_publicacoes"
  ADD CONSTRAINT "exp03em1b_publicacoes_tipo_check" CHECK ("tipo" IN ('inicial', 'errata')),
  ADD CONSTRAINT "exp03em1b_publicacoes_escala_check" CHECK ("escala" IN (0, 80)),
  ADD CONSTRAINT "exp03em1b_publicacoes_rodada_check" CHECK ("rodada" >= 1);

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['exp03em1b_pacotes', 'exp03em1b_gates_turma', 'exp03em1b_gates_historico', 'exp03em1b_sessoes', 'exp03em1b_publicacoes'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (escola_id = current_setting(''app.escola_id'', true))', t || '_por_escola', t);
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_runtime', t);
    END IF;
  END LOOP;
END $$;
