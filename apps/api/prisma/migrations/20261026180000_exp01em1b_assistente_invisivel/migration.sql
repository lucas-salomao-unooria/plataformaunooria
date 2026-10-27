-- O ASSISTENTE INVISÍVEL: Dados que viram decisões — a missão da 1ª série EM,
-- unidade 1 (ADR-185).
--
-- Quatro tabelas: o pacote didático (a atividade da evidência), a fase da
-- turma (as cinco liberações e as duas pausas do professor), o histórico dos
-- botões e a sessão da unidade (o estudante, ou o computador da equipe). O DDL
-- abaixo é o `prisma migrate diff`; o bloco MANUAL do fim é o que o Prisma não
-- gera.

-- CreateTable
CREATE TABLE "exp01em1b_pacotes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "disciplina" TEXT NOT NULL,
    "tema" TEXT NOT NULL,
    "topicos" TEXT[],
    "contexto" TEXT,
    "conteudo_json" JSONB NOT NULL,
    "origem" TEXT NOT NULL,
    "editados" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contingencia" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "rodada_atual" SMALLINT NOT NULL DEFAULT 1,
    "aprovado_em" TIMESTAMPTZ(6),
    "aprovado_por" UUID,
    "ia_geracoes" INTEGER NOT NULL DEFAULT 0,
    "ia_tokens" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp01em1b_pacotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp01em1b_gates_turma" (
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "fase" TEXT NOT NULL DEFAULT 'aguardando-inicio',
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp01em1b_gates_turma_pkey" PRIMARY KEY ("escola_id","turma_id")
);

-- CreateTable
CREATE TABLE "exp01em1b_gates_historico" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "pacote_id" UUID NOT NULL,
    "rodada" SMALLINT NOT NULL,
    "fase" TEXT NOT NULL,
    "professor_id" UUID,
    "em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp01em1b_gates_historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp01em1b_sessoes" (
    "escola_id" TEXT NOT NULL,
    "estudante_id" UUID NOT NULL,
    "pacote_id" UUID NOT NULL,
    "rodada" SMALLINT NOT NULL,
    "turma_id" UUID NOT NULL,
    "entrou_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "iniciado_em" TIMESTAMPTZ(6),
    "funcoes_abertas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "navegou_em" TIMESTAMPTZ(6),
    "aposta" TEXT,
    "apostada_em" TIMESTAMPTZ(6),
    "simulacao_concluida_em" TIMESTAMPTZ(6),
    "fichas_abertas_em" TIMESTAMPTZ(6),
    "inspecao_concluida_em" TIMESTAMPTZ(6),
    "cartoes" JSONB,
    "cartoes_acertos" SMALLINT,
    "cartoes_completa" BOOLEAN,
    "classificada_em" TIMESTAMPTZ(6),
    "painel_passos_aberto_em" TIMESTAMPTZ(6),
    "passos_marcados" SMALLINT[] DEFAULT ARRAY[]::SMALLINT[],
    "algoritmo_concluido_em" TIMESTAMPTZ(6),
    "criterios" JSONB,
    "retestes" SMALLINT NOT NULL DEFAULT 0,
    "equidade_no_1o_reteste" TEXT,
    "ultima_equidade" TEXT,
    "retestado_em" TIMESTAMPTZ(6),
    "revisando" BOOLEAN NOT NULL DEFAULT false,
    "avancou_em" TIMESTAMPTZ(6),
    "avancou_com_vies" BOOLEAN,
    "pagina_ativa" BOOLEAN,
    "comunicado" JSONB,
    "blocos_corretos" SMALLINT,
    "alinhamento" TEXT,
    "publicada_em" TIMESTAMPTZ(6),
    "versao_instrumento" TEXT NOT NULL DEFAULT '1.0.0',
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp01em1b_sessoes_pkey" PRIMARY KEY ("escola_id","estudante_id","pacote_id","rodada")
);

-- CreateIndex
CREATE INDEX "exp01em1b_pacotes_escola_id_turma_id_idx" ON "exp01em1b_pacotes"("escola_id", "turma_id");

-- CreateIndex
CREATE UNIQUE INDEX "exp01em1b_pacotes_escola_id_id_key" ON "exp01em1b_pacotes"("escola_id", "id");

-- CreateIndex
CREATE INDEX "exp01em1b_gates_historico_escola_id_turma_id_idx" ON "exp01em1b_gates_historico"("escola_id", "turma_id");

-- CreateIndex
CREATE INDEX "exp01em1b_sessoes_escola_id_turma_id_pacote_id_rodada_idx" ON "exp01em1b_sessoes"("escola_id", "turma_id", "pacote_id", "rodada");

-- AddForeignKey
ALTER TABLE "exp01em1b_pacotes" ADD CONSTRAINT "exp01em1b_pacotes_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp01em1b_gates_turma" ADD CONSTRAINT "exp01em1b_gates_turma_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp01em1b_gates_historico" ADD CONSTRAINT "exp01em1b_gates_historico_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp01em1b_gates_historico" ADD CONSTRAINT "exp01em1b_gates_historico_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp01em1b_sessoes" ADD CONSTRAINT "exp01em1b_sessoes_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp01em1b_sessoes" ADD CONSTRAINT "exp01em1b_sessoes_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp01em1b_sessoes" ADD CONSTRAINT "exp01em1b_sessoes_escola_id_pacote_id_fkey" FOREIGN KEY ("escola_id", "pacote_id") REFERENCES "exp01em1b_pacotes"("escola_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ---------------------------------------------------------------------------
-- Bloco MANUAL. O Prisma não gera CHECK, índice parcial, RLS nem GRANT.
-- Os vocabulários espelham `apps/api/src/assistente-invisivel/conteudo.ts`, e a
-- suíte `tests/assistente-invisivel-regras.spec.ts` compara os dois textos.
-- ---------------------------------------------------------------------------

ALTER TABLE "exp01em1b_pacotes"
  ADD CONSTRAINT "exp01em1b_pacotes_disciplina_check"
    CHECK ("disciplina" IN ('lingua-portuguesa', 'matematica', 'biologia', 'quimica', 'fisica', 'historia', 'geografia', 'filosofia', 'sociologia', 'arte', 'lingua-inglesa', 'educacao-fisica', 'projeto-interdisciplinar')),
  ADD CONSTRAINT "exp01em1b_pacotes_origem_check" CHECK ("origem" IN ('padrao', 'ia')),
  ADD CONSTRAINT "exp01em1b_pacotes_conteudo_check" CHECK (jsonb_typeof("conteudo_json") = 'object'),
  ADD CONSTRAINT "exp01em1b_pacotes_topicos_check" CHECK (cardinality("topicos") BETWEEN 3 AND 5),
  ADD CONSTRAINT "exp01em1b_pacotes_editados_check"
    CHECK ("editados" <@ ARRAY['trilhaAvancada', 'reforcoBasico', 'duvidas.lucas', 'duvidas.beatriz', 'duvidas.thiago1', 'duvidas.thiago2', 'duvidas.thiago3', 'respostas.lucas', 'respostas.beatriz', 'respostas.thiago1', 'respostas.thiago2', 'respostas.thiago3', 'leitura']::TEXT[]),
  -- A contingência é o banco padrão que entrou no lugar da IA: nunca um pacote da IA.
  ADD CONSTRAINT "exp01em1b_pacotes_contingencia_check" CHECK (NOT "contingencia" OR "origem" = 'padrao'),
  -- Carimbo e autor andam juntos; só o homologado vai ao ar.
  ADD CONSTRAINT "exp01em1b_pacotes_aprovado_check" CHECK (("aprovado_em" IS NULL) = ("aprovado_por" IS NULL)),
  ADD CONSTRAINT "exp01em1b_pacotes_ativo_check" CHECK (NOT "ativo" OR "aprovado_em" IS NOT NULL),
  ADD CONSTRAINT "exp01em1b_pacotes_rodada_check" CHECK ("rodada_atual" >= 1);

-- Um em andamento por turma, e um rascunho por turma (o preparo custou saldo:
-- um F5 não pode jogá-lo fora, e dois rascunhos seriam dois "o último").
CREATE UNIQUE INDEX "exp01em1b_pacotes_um_ativo_por_turma"
  ON "exp01em1b_pacotes" ("escola_id", "turma_id") WHERE "ativo";
CREATE UNIQUE INDEX "exp01em1b_pacotes_um_rascunho_por_turma"
  ON "exp01em1b_pacotes" ("escola_id", "turma_id") WHERE "aprovado_em" IS NULL;

ALTER TABLE "exp01em1b_gates_turma"
  ADD CONSTRAINT "exp01em1b_gates_turma_fase_check"
    CHECK ("fase" IN ('aguardando-inicio', 'testes', 'simulacao', 'debate-1', 'explicar', 'debate-2', 'publicar'));

-- O histórico guarda para ONDE a turma foi: nunca a fase inicial (ela é o zerar, não um botão).
ALTER TABLE "exp01em1b_gates_historico"
  ADD CONSTRAINT "exp01em1b_gates_historico_fase_check"
    CHECK ("fase" IN ('testes', 'simulacao', 'debate-1', 'explicar', 'debate-2', 'publicar')),
  ADD CONSTRAINT "exp01em1b_gates_historico_rodada_check" CHECK ("rodada" >= 1);

ALTER TABLE "exp01em1b_sessoes"
  ADD CONSTRAINT "exp01em1b_sessoes_rodada_check" CHECK ("rodada" >= 1),
  -- E2: as funções do vocabulário; "Ir para Bateria de Testes" só com uma aberta, e só depois do E1.
  ADD CONSTRAINT "exp01em1b_sessoes_funcoes_check"
    CHECK ("funcoes_abertas" <@ ARRAY['exercicios', 'duvidas', 'sugestoes']::TEXT[]),
  ADD CONSTRAINT "exp01em1b_sessoes_navegou_ordem_check" CHECK (
    "navegou_em" IS NULL OR ("iniciado_em" IS NOT NULL AND cardinality("funcoes_abertas") >= 1)
  ),
  -- E3 é o LATCH 1: a aposta e o carimbo juntos, e só depois do E2.
  ADD CONSTRAINT "exp01em1b_sessoes_aposta_check" CHECK ("aposta" IS NULL OR "aposta" IN ('a', 'b', 'c')),
  ADD CONSTRAINT "exp01em1b_sessoes_aposta_latch_check" CHECK (("aposta" IS NULL) = ("apostada_em" IS NULL)),
  ADD CONSTRAINT "exp01em1b_sessoes_aposta_ordem_check" CHECK ("apostada_em" IS NULL OR "navegou_em" IS NOT NULL),
  -- E4: a simulação, as fichas e a inspeção, uma depois da outra.
  ADD CONSTRAINT "exp01em1b_sessoes_simulacao_ordem_check" CHECK ("simulacao_concluida_em" IS NULL OR "apostada_em" IS NOT NULL),
  ADD CONSTRAINT "exp01em1b_sessoes_fichas_ordem_check" CHECK ("fichas_abertas_em" IS NULL OR "simulacao_concluida_em" IS NOT NULL),
  ADD CONSTRAINT "exp01em1b_sessoes_inspecao_ordem_check" CHECK ("inspecao_concluida_em" IS NULL OR "fichas_abertas_em" IS NOT NULL),
  -- E5-ALU-01: os cartões, os acertos, o completo e o carimbo juntos; só depois da inspeção.
  ADD CONSTRAINT "exp01em1b_sessoes_cartoes_check" CHECK (
    ("classificada_em" IS NULL) = ("cartoes" IS NULL)
    AND ("classificada_em" IS NULL) = ("cartoes_acertos" IS NULL)
    AND ("classificada_em" IS NULL) = ("cartoes_completa" IS NULL)
    AND ("cartoes" IS NULL OR jsonb_typeof("cartoes") = 'object')
    AND ("cartoes_acertos" IS NULL OR "cartoes_acertos" BETWEEN 0 AND 6)
  ),
  ADD CONSTRAINT "exp01em1b_sessoes_cartoes_ordem_check" CHECK ("classificada_em" IS NULL OR "inspecao_concluida_em" IS NOT NULL),
  -- E5-ALU-02, o painel opcional: marcar só com ele aberto; abrir e pular só depois dos cartões.
  ADD CONSTRAINT "exp01em1b_sessoes_passos_check" CHECK (
    "passos_marcados" <@ ARRAY[1, 2, 3, 4, 5]::SMALLINT[]
    AND (cardinality("passos_marcados") = 0 OR "painel_passos_aberto_em" IS NOT NULL)
  ),
  ADD CONSTRAINT "exp01em1b_sessoes_painel_ordem_check" CHECK ("painel_passos_aberto_em" IS NULL OR "classificada_em" IS NOT NULL),
  ADD CONSTRAINT "exp01em1b_sessoes_algoritmo_ordem_check" CHECK ("algoritmo_concluido_em" IS NULL OR "classificada_em" IS NOT NULL),
  -- E5-ALU-03/04, o reteste: a configuração, as duas equidades e o carimbo andam com a contagem.
  ADD CONSTRAINT "exp01em1b_sessoes_reteste_check" CHECK (
    "retestes" >= 0
    AND ("retestes" = 0) = ("criterios" IS NULL)
    AND ("retestes" = 0) = ("ultima_equidade" IS NULL)
    AND ("retestes" = 0) = ("equidade_no_1o_reteste" IS NULL)
    AND ("retestes" = 0) = ("retestado_em" IS NULL)
    AND ("criterios" IS NULL OR jsonb_typeof("criterios") = 'object')
  ),
  ADD CONSTRAINT "exp01em1b_sessoes_equidade_check" CHECK (
    ("ultima_equidade" IS NULL OR "ultima_equidade" IN ('total', 'parcial', 'nenhuma'))
    AND ("equidade_no_1o_reteste" IS NULL OR "equidade_no_1o_reteste" IN ('total', 'parcial', 'nenhuma'))
  ),
  ADD CONSTRAINT "exp01em1b_sessoes_reteste_ordem_check" CHECK ("retestes" = 0 OR "algoritmo_concluido_em" IS NOT NULL),
  -- "Revisar Critérios" e "Avançar para …": só depois de um reteste, e nunca os dois.
  ADD CONSTRAINT "exp01em1b_sessoes_avanco_check" CHECK (
    ("avancou_em" IS NULL) = ("avancou_com_vies" IS NULL)
    AND ("avancou_em" IS NULL OR "retestes" > 0)
    AND (NOT "revisando" OR ("retestes" > 0 AND "avancou_em" IS NULL))
  ),
  -- E6 é o LATCH 2: a página, os blocos, os acertos, o alinhamento e o carimbo no MESMO UPDATE; só depois do avanço.
  ADD CONSTRAINT "exp01em1b_sessoes_publicacao_check" CHECK (
    ("publicada_em" IS NULL) = ("pagina_ativa" IS NULL)
    AND ("publicada_em" IS NULL) = ("comunicado" IS NULL)
    AND ("publicada_em" IS NULL) = ("blocos_corretos" IS NULL)
    AND ("publicada_em" IS NULL) = ("alinhamento" IS NULL)
    AND ("comunicado" IS NULL OR jsonb_typeof("comunicado") = 'object')
    AND ("blocos_corretos" IS NULL OR "blocos_corretos" BETWEEN 0 AND 4)
  ),
  ADD CONSTRAINT "exp01em1b_sessoes_alinhamento_check"
    CHECK ("alinhamento" IS NULL OR "alinhamento" IN ('pleno', 'incompleto', 'descaracterizado')),
  ADD CONSTRAINT "exp01em1b_sessoes_publicacao_ordem_check" CHECK ("publicada_em" IS NULL OR "avancou_em" IS NOT NULL);

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['exp01em1b_pacotes', 'exp01em1b_gates_turma', 'exp01em1b_gates_historico', 'exp01em1b_sessoes'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (escola_id = current_setting(''app.escola_id'', true))', t || '_por_escola', t);
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_runtime', t);
    END IF;
  END LOOP;
END $$;
