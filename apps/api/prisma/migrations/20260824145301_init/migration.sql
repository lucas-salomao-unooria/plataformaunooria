-- CreateTable
CREATE TABLE "escolas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escolas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turmas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "serie" TEXT NOT NULL,

    CONSTRAINT "turmas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role" TEXT NOT NULL,
    "escola_id" TEXT,
    "turma_id" UUID,
    "username" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "avatar" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "professor_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "disciplina" TEXT NOT NULL,
    "tema_geral" TEXT NOT NULL,
    "recorte" TEXT NOT NULL,
    "contexto_aula" TEXT,
    "pergunta_chave" TEXT NOT NULL,
    "pergunta_origem" TEXT NOT NULL DEFAULT 'ia',
    "etapa" TEXT NOT NULL DEFAULT 'investigacao',
    "ia_ao_vivo" BOOLEAN NOT NULL DEFAULT true,
    "antagonismo" JSONB,
    "categorias_neutras" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "neutros_no_tema" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "estilo_visual" TEXT NOT NULL,
    "qtd_posts_tese" INTEGER NOT NULL DEFAULT 400,
    "proporcoes" JSONB NOT NULL,
    "engine_config" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "activity_id" UUID NOT NULL,
    "handle" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "lado" TEXT NOT NULL,
    "perfil_afim" TEXT,
    "verificado" BOOLEAN NOT NULL DEFAULT false,
    "bio" TEXT,
    "voz" TEXT,

    CONSTRAINT "authors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "activity_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "lado" TEXT NOT NULL,
    "perfil" TEXT NOT NULL,
    "intensidade" SMALLINT NOT NULL,
    "categoria" TEXT NOT NULL,
    "formato" TEXT NOT NULL DEFAULT 'feed',
    "caption" TEXT NOT NULL,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "emotional_hook" TEXT,
    "image_brief" TEXT NOT NULL,
    "image_url" TEXT,
    "image_status" TEXT NOT NULL DEFAULT 'pendente',
    "likes_count" INTEGER NOT NULL,
    "timestamp_label" TEXT NOT NULL,
    "aprovado" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "post_id" UUID NOT NULL,
    "author_id" UUID,
    "handle" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "likes_count" INTEGER NOT NULL DEFAULT 0,
    "ordem" SMALLINT NOT NULL,
    "timestamp_label" TEXT NOT NULL,

    CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "activity_id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "tentativa" SMALLINT NOT NULL DEFAULT 0,
    "erro" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "activity_id" UUID NOT NULL,
    "aluno_id" UUID NOT NULL,
    "fase" TEXT NOT NULL DEFAULT 'onboarding',
    "lado_inicial" TEXT NOT NULL,
    "lado_origem" TEXT NOT NULL DEFAULT 'sorteio',
    "perfil_jogo" JSONB,
    "perfil_origem" TEXT NOT NULL DEFAULT 'ausente',
    "engine_state" JSONB NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),
    "nome_no_app" TEXT,
    "avatar_escolhido" TEXT,

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" BIGSERIAL NOT NULL,
    "escola_id" TEXT NOT NULL,
    "run_id" UUID NOT NULL,
    "post_id" UUID,
    "tipo" TEXT NOT NULL,
    "payload" JSONB,
    "client_ts" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_posts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "run_id" UUID NOT NULL,
    "texto" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "lado_inferido" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfis_importados" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "activity_id" UUID NOT NULL,
    "aluno_id" UUID NOT NULL,
    "escores" JSONB NOT NULL,
    "dominante" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "lado_forcado" TEXT,
    "medido_em" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "perfis_importados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conclusoes" (
    "run_id" UUID NOT NULL,
    "escola_id" TEXT NOT NULL,
    "inclinacao" TEXT NOT NULL,
    "texto" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conclusoes_pkey" PRIMARY KEY ("run_id")
);

-- CreateTable
CREATE TABLE "dossiers" (
    "run_id" UUID NOT NULL,
    "escola_id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dossiers_pkey" PRIMARY KEY ("run_id")
);

-- CreateTable
CREATE TABLE "reflexoes" (
    "run_id" UUID NOT NULL,
    "escola_id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reflexoes_pkey" PRIMARY KEY ("run_id")
);

-- CreateTable
CREATE TABLE "comentarios_da_sessao" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "run_id" UUID NOT NULL,
    "post_id" UUID,
    "student_post_id" UUID,
    "handle" TEXT,
    "de_ia" BOOLEAN NOT NULL DEFAULT false,
    "texto" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comentarios_da_sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progresso" (
    "escola_id" TEXT NOT NULL,
    "aluno_id" TEXT NOT NULL,
    "exp_id" TEXT NOT NULL,
    "dados" JSONB NOT NULL DEFAULT '{}',
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progresso_pkey" PRIMARY KEY ("escola_id","aluno_id","exp_id")
);

-- CreateTable
CREATE TABLE "telemetria_eventos" (
    "event_id" UUID NOT NULL,
    "ts" TIMESTAMPTZ(6) NOT NULL,
    "escola_id" TEXT NOT NULL,
    "aluno_id" TEXT NOT NULL,
    "exp_id" TEXT NOT NULL,
    "exp_version" TEXT NOT NULL,
    "sessao_id" UUID NOT NULL,
    "verbo" TEXT NOT NULL,
    "objeto" TEXT NOT NULL,
    "resultado" JSONB,
    "contexto" JSONB,

    CONSTRAINT "telemetria_eventos_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "experiencias" (
    "exp_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "versao_ativa" TEXT NOT NULL,
    "series" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "viewport" JSONB,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "experiencias_pkey" PRIMARY KEY ("exp_id")
);

-- CreateTable
CREATE TABLE "ia_uso_diario" (
    "escola_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "dia" TEXT NOT NULL,
    "tokens_usados" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ia_uso_diario_pkey" PRIMARY KEY ("escola_id","usuario_id","dia")
);

-- CreateIndex
CREATE INDEX "turmas_escola_id_idx" ON "turmas"("escola_id");

-- CreateIndex
CREATE UNIQUE INDEX "turmas_escola_id_nome_key" ON "turmas"("escola_id", "nome");

-- CreateIndex
CREATE INDEX "users_escola_id_role_idx" ON "users"("escola_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "users_escola_id_username_key" ON "users"("escola_id", "username");

-- CreateIndex
CREATE INDEX "activities_escola_id_idx" ON "activities"("escola_id");

-- CreateIndex
CREATE INDEX "authors_escola_id_idx" ON "authors"("escola_id");

-- CreateIndex
CREATE UNIQUE INDEX "authors_activity_id_handle_key" ON "authors"("activity_id", "handle");

-- CreateIndex
CREATE INDEX "idx_posts_curadoria" ON "posts"("activity_id", "lado", "perfil", "intensidade", "aprovado");

-- CreateIndex
CREATE INDEX "posts_escola_id_idx" ON "posts"("escola_id");

-- CreateIndex
CREATE INDEX "post_comments_escola_id_idx" ON "post_comments"("escola_id");

-- CreateIndex
CREATE INDEX "generation_jobs_escola_id_idx" ON "generation_jobs"("escola_id");

-- CreateIndex
CREATE INDEX "runs_escola_id_idx" ON "runs"("escola_id");

-- CreateIndex
CREATE UNIQUE INDEX "runs_activity_id_aluno_id_key" ON "runs"("activity_id", "aluno_id");

-- CreateIndex
CREATE INDEX "idx_events_run" ON "events"("run_id", "id");

-- CreateIndex
CREATE INDEX "events_escola_id_idx" ON "events"("escola_id");

-- CreateIndex
CREATE INDEX "student_posts_escola_id_idx" ON "student_posts"("escola_id");

-- CreateIndex
CREATE INDEX "perfis_importados_escola_id_idx" ON "perfis_importados"("escola_id");

-- CreateIndex
CREATE UNIQUE INDEX "perfis_importados_activity_id_aluno_id_key" ON "perfis_importados"("activity_id", "aluno_id");

-- CreateIndex
CREATE INDEX "conclusoes_escola_id_idx" ON "conclusoes"("escola_id");

-- CreateIndex
CREATE INDEX "dossiers_escola_id_idx" ON "dossiers"("escola_id");

-- CreateIndex
CREATE INDEX "reflexoes_escola_id_idx" ON "reflexoes"("escola_id");

-- CreateIndex
CREATE INDEX "idx_comentarios_sessao_run" ON "comentarios_da_sessao"("run_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_comentarios_sessao_post" ON "comentarios_da_sessao"("run_id", "post_id");

-- CreateIndex
CREATE INDEX "comentarios_da_sessao_escola_id_idx" ON "comentarios_da_sessao"("escola_id");

-- CreateIndex
CREATE INDEX "idx_tel_escola_exp_ts" ON "telemetria_eventos"("escola_id", "exp_id", "ts");

-- AddForeignKey
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "escolas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "escolas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authors" ADD CONSTRAINT "authors_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "authors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "authors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_posts" ADD CONSTRAINT "student_posts_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfis_importados" ADD CONSTRAINT "perfis_importados_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfis_importados" ADD CONSTRAINT "perfis_importados_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conclusoes" ADD CONSTRAINT "conclusoes_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reflexoes" ADD CONSTRAINT "reflexoes_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios_da_sessao" ADD CONSTRAINT "comentarios_da_sessao_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios_da_sessao" ADD CONSTRAINT "comentarios_da_sessao_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios_da_sessao" ADD CONSTRAINT "comentarios_da_sessao_student_post_id_fkey" FOREIGN KEY ("student_post_id") REFERENCES "student_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- TENANCY (regra inviolável nº 1 do CLAUDE.md)
--
-- RLS + FORCE em TODA tabela de dados de aluno/turma. A api conecta em
-- produção com uma role SEM ownership (`app_runtime`, criada pela infra — ver
-- docs/INFRA.md) e toda query roda dentro de transação com
-- `set_config('app.escola_id', <escola do token>, true)` (PrismaService.comTenancy).
--
-- Ficam FORA da RLS, de propósito:
--   * users/escolas/turmas — tabelas de IDENTIDADE: o login precisa achar o
--     usuário ANTES de saber a escola. Não carregam dado comportamental de
--     aluno; os services filtram escola_id explicitamente.
--   * experiencias — catálogo do contrato, global.
-- ============================================================================

-- CHECKs (o Prisma não os modela, mas o banco os garante — padrão do origem).
ALTER TABLE "users"
  ADD CONSTRAINT "users_role_check"
    CHECK ("role" IN ('aluno','professor','gestor','admin-contrato')),
  ADD CONSTRAINT "users_escola_check"
    CHECK ("role" = 'admin-contrato' OR "escola_id" IS NOT NULL);

ALTER TABLE "activities"
  ADD CONSTRAINT "activities_status_check"
    CHECK ("status" IN ('rascunho','antagonismo','gerando','revisao','ativa','encerrada')),
  ADD CONSTRAINT "activities_etapa_check"
    CHECK ("etapa" IN ('investigacao','conclusao','debate','explicabilidade','perdidos','reflexao','fim')),
  ADD CONSTRAINT "activities_pergunta_origem_check"
    CHECK ("pergunta_origem" IN ('ia','professor'));

ALTER TABLE "authors"
  ADD CONSTRAINT "authors_lado_check" CHECK ("lado" IN ('A','B','neutro')),
  ADD CONSTRAINT "authors_tipo_check"
    CHECK ("tipo" IN ('pagina_tema','fofoca_tema','checagem','humor','vida_escolar')),
  ADD CONSTRAINT "authors_perfil_afim_check"
    CHECK ("perfil_afim" IS NULL OR "perfil_afim" IN ('abertura','autotranscendencia','autopromocao','conservacao'));

ALTER TABLE "posts"
  ADD CONSTRAINT "posts_lado_check" CHECK ("lado" IN ('A','B','neutro')),
  ADD CONSTRAINT "posts_perfil_check"
    CHECK ("perfil" IN ('abertura','autotranscendencia','autopromocao','conservacao')),
  ADD CONSTRAINT "posts_intensidade_check" CHECK ("intensidade" IN (1,2,3)),
  ADD CONSTRAINT "posts_formato_check" CHECK ("formato" IN ('feed','story','enquete')),
  ADD CONSTRAINT "posts_image_status_check" CHECK ("image_status" IN ('pendente','ok','fallback'));

ALTER TABLE "generation_jobs"
  ADD CONSTRAINT "generation_jobs_tipo_check"
    CHECK ("tipo" IN ('personas','posts_lote','imagem','validacao')),
  ADD CONSTRAINT "generation_jobs_status_check"
    CHECK ("status" IN ('pendente','rodando','ok','erro'));

ALTER TABLE "runs"
  ADD CONSTRAINT "runs_fase_check"
    CHECK ("fase" IN ('onboarding','feed','encerramento','conclusao','debate',
                      'explicabilidade','perdidos','reflexao','fim',
                      -- mantidas por compatibilidade com runs antigas já congeladas
                      'revelacao','dossie')),
  ADD CONSTRAINT "runs_lado_inicial_check" CHECK ("lado_inicial" IN ('A','B')),
  ADD CONSTRAINT "runs_lado_origem_check" CHECK ("lado_origem" IN ('perfil','sorteio','redistribuido')),
  ADD CONSTRAINT "runs_perfil_origem_check" CHECK ("perfil_origem" IN ('jogo','professor','ausente'));

ALTER TABLE "perfis_importados"
  ADD CONSTRAINT "perfis_importados_dominante_check"
    CHECK ("dominante" IN ('abertura','autotranscendencia','autopromocao','conservacao','misto')),
  ADD CONSTRAINT "perfis_importados_origem_check" CHECK ("origem" IN ('jogo','professor')),
  ADD CONSTRAINT "perfis_importados_lado_forcado_check"
    CHECK ("lado_forcado" IS NULL OR "lado_forcado" IN ('A','B'));

ALTER TABLE "conclusoes"
  ADD CONSTRAINT "conclusoes_inclinacao_check" CHECK ("inclinacao" IN ('A','B','duvida'));

ALTER TABLE "comentarios_da_sessao"
  ADD CONSTRAINT "comentarios_ancoragem_check"
    CHECK (("post_id" IS NULL) <> ("student_post_id" IS NULL));

-- RLS: uma política por tabela de dados, sempre a mesma expressão.
-- FORCE faz até o owner obedecer — seed/manutenção precisam armar o
-- set_config também (o seed local roda como superuser, que sempre ignora RLS).
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'activities','authors','posts','post_comments','generation_jobs','runs',
    'events','student_posts','perfis_importados','conclusoes','dossiers',
    'reflexoes','comentarios_da_sessao','progresso','telemetria_eventos',
    'ia_uso_diario'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (escola_id = current_setting(''app.escola_id'', true))',
      t || '_por_escola', t
    );
  END LOOP;
END $$;
