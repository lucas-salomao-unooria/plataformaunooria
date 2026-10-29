-- O DOSSIÊ INVISÍVEL — a missão do 9º ano EF, unidade 1 (ADR-202).
--
-- Quatro tabelas: o pacote didático (a atividade da evidência), o gate da
-- turma (exploracao → revelacao → revoto → explicar: as três travas do
-- professor), o histórico dos botões e a sessão do estudante (os carimbos, os
-- dois latches, o protocolo e a thread do chat — o único texto livre de menor,
-- que nunca sai para painel, telemetria ou log). O DDL abaixo é o
-- `prisma migrate diff`; o bloco MANUAL do fim é o que o Prisma não gera.

-- CreateTable
CREATE TABLE "exp09ef1b_pacotes" (
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

    CONSTRAINT "exp09ef1b_pacotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp09ef1b_gates_turma" (
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "etapa" TEXT NOT NULL DEFAULT 'exploracao',
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp09ef1b_gates_turma_pkey" PRIMARY KEY ("escola_id","turma_id")
);

-- CreateTable
CREATE TABLE "exp09ef1b_gates_historico" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "pacote_id" UUID NOT NULL,
    "rodada" SMALLINT NOT NULL,
    "etapa" TEXT NOT NULL,
    "professor_id" UUID,
    "em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp09ef1b_gates_historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp09ef1b_sessoes" (
    "escola_id" TEXT NOT NULL,
    "estudante_id" UUID NOT NULL,
    "pacote_id" UUID NOT NULL,
    "rodada" SMALLINT NOT NULL,
    "turma_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entrou_em" TIMESTAMPTZ(6),
    "conversa" JSONB NOT NULL DEFAULT '[]',
    "consultas" SMALLINT NOT NULL DEFAULT 0,
    "enviadas" SMALLINT NOT NULL DEFAULT 0,
    "cadernos_oferecidos_em" TIMESTAMPTZ(6),
    "cadernos_em" TIMESTAMPTZ(6),
    "cadernos_na_etapa" TEXT,
    "ver_projetos_em" TIMESTAMPTZ(6),
    "decisao_em" TIMESTAMPTZ(6),
    "projeto_inicial" TEXT,
    "ranking_inicial" TEXT[],
    "caminho" TEXT,
    "pilulas" TEXT[],
    "revoto_em" TIMESTAMPTZ(6),
    "projeto_final" TEXT,
    "ranking_final" TEXT[],
    "ancoras" TEXT[],
    "protocolo_json" JSONB,
    "concluido_em" TIMESTAMPTZ(6),
    "versao_instrumento" TEXT NOT NULL DEFAULT '1.0.0',
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp09ef1b_sessoes_pkey" PRIMARY KEY ("escola_id","estudante_id","pacote_id","rodada")
);

-- CreateIndex
CREATE INDEX "exp09ef1b_pacotes_escola_id_turma_id_idx" ON "exp09ef1b_pacotes"("escola_id", "turma_id");

-- CreateIndex
CREATE UNIQUE INDEX "exp09ef1b_pacotes_escola_id_id_key" ON "exp09ef1b_pacotes"("escola_id", "id");

-- CreateIndex
CREATE INDEX "exp09ef1b_gates_historico_escola_id_turma_id_idx" ON "exp09ef1b_gates_historico"("escola_id", "turma_id");

-- CreateIndex
CREATE INDEX "exp09ef1b_sessoes_escola_id_turma_id_pacote_id_rodada_idx" ON "exp09ef1b_sessoes"("escola_id", "turma_id", "pacote_id", "rodada");

-- AddForeignKey
ALTER TABLE "exp09ef1b_pacotes" ADD CONSTRAINT "exp09ef1b_pacotes_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp09ef1b_gates_turma" ADD CONSTRAINT "exp09ef1b_gates_turma_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp09ef1b_gates_historico" ADD CONSTRAINT "exp09ef1b_gates_historico_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp09ef1b_gates_historico" ADD CONSTRAINT "exp09ef1b_gates_historico_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp09ef1b_sessoes" ADD CONSTRAINT "exp09ef1b_sessoes_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp09ef1b_sessoes" ADD CONSTRAINT "exp09ef1b_sessoes_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp09ef1b_sessoes" ADD CONSTRAINT "exp09ef1b_sessoes_escola_id_pacote_id_fkey" FOREIGN KEY ("escola_id", "pacote_id") REFERENCES "exp09ef1b_pacotes"("escola_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ---------------------------------------------------------------------------
-- Bloco MANUAL. O Prisma não gera CHECK, índice parcial, RLS nem GRANT.
-- Os vocabulários espelham `apps/api/src/dossie-invisivel/conteudo.ts`, e a
-- suíte `tests/dossie-invisivel-regras.spec.ts` compara os dois textos.
-- ---------------------------------------------------------------------------

ALTER TABLE "exp09ef1b_pacotes"
  ADD CONSTRAINT "exp09ef1b_pacotes_disciplina_check"
    CHECK ("disciplina" IN ('lingua-portuguesa', 'arte', 'educacao-fisica', 'lingua-inglesa', 'matematica', 'ciencias', 'geografia', 'historia', 'ensino-religioso', 'computacao', 'interdisciplinar')),
  ADD CONSTRAINT "exp09ef1b_pacotes_origem_check" CHECK ("origem" IN ('ia', 'padrao')),
  ADD CONSTRAINT "exp09ef1b_pacotes_conteudo_check" CHECK (jsonb_typeof("conteudo_json") = 'object'),
  ADD CONSTRAINT "exp09ef1b_pacotes_assuntos_check" CHECK (cardinality("assuntos") BETWEEN 3 AND 6),
  ADD CONSTRAINT "exp09ef1b_pacotes_aprovado_check" CHECK (("aprovado_em" IS NULL) = ("aprovado_por" IS NULL)),
  ADD CONSTRAINT "exp09ef1b_pacotes_ativo_check" CHECK (NOT "ativo" OR "aprovado_em" IS NOT NULL),
  ADD CONSTRAINT "exp09ef1b_pacotes_rodada_check" CHECK ("rodada_atual" >= 1),
  ADD CONSTRAINT "exp09ef1b_pacotes_contadores_check" CHECK ("ia_geracoes" >= 0 AND "ia_tokens" >= 0 AND "painel_vistas" >= 0);

-- Um em andamento por turma, e um rascunho por turma.
CREATE UNIQUE INDEX "exp09ef1b_pacotes_um_ativo_por_turma"
  ON "exp09ef1b_pacotes" ("escola_id", "turma_id") WHERE "ativo";
CREATE UNIQUE INDEX "exp09ef1b_pacotes_um_rascunho_por_turma"
  ON "exp09ef1b_pacotes" ("escola_id", "turma_id") WHERE "aprovado_em" IS NULL;

ALTER TABLE "exp09ef1b_gates_turma"
  ADD CONSTRAINT "exp09ef1b_gates_turma_etapa_check" CHECK ("etapa" IN ('exploracao', 'revelacao', 'revoto', 'explicar'));

-- O histórico guarda para ONDE a turma foi: nunca a etapa inicial (ela é o zerar, não um botão).
ALTER TABLE "exp09ef1b_gates_historico"
  ADD CONSTRAINT "exp09ef1b_gates_historico_etapa_check" CHECK ("etapa" IN ('revelacao', 'revoto', 'explicar')),
  ADD CONSTRAINT "exp09ef1b_gates_historico_rodada_check" CHECK ("rodada" >= 1);

ALTER TABLE "exp09ef1b_sessoes"
  ADD CONSTRAINT "exp09ef1b_sessoes_rodada_check" CHECK ("rodada" >= 1),
  ADD CONSTRAINT "exp09ef1b_sessoes_conversa_check" CHECK (jsonb_typeof("conversa") = 'array'),
  ADD CONSTRAINT "exp09ef1b_sessoes_contadores_check" CHECK ("consultas" BETWEEN 0 AND 5 AND "enviadas" BETWEEN 0 AND 5 AND "consultas" <= "enviadas"),
  -- Os cadernos: a etapa anda com o carimbo; só se digitaliza depois de entrar.
  ADD CONSTRAINT "exp09ef1b_sessoes_cadernos_check" CHECK (
    ("cadernos_em" IS NULL) = ("cadernos_na_etapa" IS NULL)
    AND ("cadernos_na_etapa" IS NULL OR "cadernos_na_etapa" IN ('E2', 'E4'))
  ),
  -- O LATCH 1: a escolha inicial, o ranking e o caminho entram juntos.
  ADD CONSTRAINT "exp09ef1b_sessoes_decisao_check" CHECK (
    ("decisao_em" IS NULL) = ("projeto_inicial" IS NULL)
    AND ("decisao_em" IS NULL) = ("caminho" IS NULL)
    AND ("decisao_em" IS NULL OR cardinality("ranking_inicial") = 3)
    AND ("decisao_em" IS NULL OR "entrou_em" IS NOT NULL)
  ),
  ADD CONSTRAINT "exp09ef1b_sessoes_projeto_check" CHECK (
    ("projeto_inicial" IS NULL OR "projeto_inicial" IN ('papel', 'parcial', 'nuvem'))
    AND ("projeto_final" IS NULL OR "projeto_final" IN ('papel', 'parcial', 'nuvem'))
  ),
  ADD CONSTRAINT "exp09ef1b_sessoes_caminho_check" CHECK ("caminho" IS NULL OR "caminho" IN ('A1', 'A2', 'B')),
  ADD CONSTRAINT "exp09ef1b_sessoes_ranking_check" CHECK (
    "ranking_inicial" <@ ARRAY['regularidade', 'urgencia', 'capacidade']::text[]
    AND "ranking_final" <@ ARRAY['regularidade', 'urgencia', 'capacidade']::text[]
  ),
  ADD CONSTRAINT "exp09ef1b_sessoes_pilulas_check" CHECK ("pilulas" <@ ARRAY['custo', 'assinaturas']::text[]),
  ADD CONSTRAINT "exp09ef1b_sessoes_ancoras_check" CHECK ("ancoras" <@ ARRAY['contraste', 'parecer-inicial', 'inversao']::text[]),
  -- O LATCH 2: só depois do 1, com os cadernos digitalizados; projeto e ranking juntos.
  ADD CONSTRAINT "exp09ef1b_sessoes_revoto_check" CHECK (
    ("revoto_em" IS NULL) = ("projeto_final" IS NULL)
    AND ("revoto_em" IS NULL OR cardinality("ranking_final") = 3)
    AND ("revoto_em" IS NULL OR ("decisao_em" IS NOT NULL AND "cadernos_em" IS NOT NULL))
  ),
  -- A conclusão é o protocolo enviado, depois do 2º voto.
  ADD CONSTRAINT "exp09ef1b_sessoes_conclusao_check" CHECK (
    ("concluido_em" IS NULL) = ("protocolo_json" IS NULL)
    AND ("concluido_em" IS NULL OR "revoto_em" IS NOT NULL)
  );

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['exp09ef1b_pacotes', 'exp09ef1b_gates_turma', 'exp09ef1b_gates_historico', 'exp09ef1b_sessoes'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (escola_id = current_setting(''app.escola_id'', true))', t || '_por_escola', t);
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_runtime', t);
    END IF;
  END LOOP;
END $$;
