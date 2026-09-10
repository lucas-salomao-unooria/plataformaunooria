-- exp-08-manifesto-ia: as cinco tabelas da missão.
--
-- Molde: 20260906170000_exp_06_rastro_boato. O Prisma gera as tabelas, os
-- índices e as FKs acima; CHECK, RLS e GRANT são o bloco MANUAL no fim — e é lá
-- que a regra inviolável nº 1 (todo dado de estudante escopado por escola) é
-- aplicada.
--
-- A tabela a mais em relação à exp-06 é `exp_08_conteudo_turma`: o pacote
-- curado que a professora homologa antes da aula. Ela é a única aqui que NÃO é
-- apagada pelo "Zerar turma".

-- CreateTable
CREATE TABLE "exp_08_conteudo_turma" (
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "caso_contextual" TEXT NOT NULL,
    "foco_prioritario" TEXT NOT NULL,
    "contexto" JSONB NOT NULL,
    "prompts_json" JSONB NOT NULL,
    "clausulas_json" JSONB NOT NULL,
    "aprovado_por_professor" BOOLEAN NOT NULL DEFAULT false,
    "usou_banco_default" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp_08_conteudo_turma_pkey" PRIMARY KEY ("escola_id","turma_id")
);

-- CreateTable
CREATE TABLE "exp_08_sessoes" (
    "escola_id" TEXT NOT NULL,
    "estudante_id" UUID NOT NULL,
    "turma_id" UUID,
    "passo" TEXT NOT NULL DEFAULT 'briefing',
    "clausula_id" TEXT,
    "latencia_clausula_seg" INTEGER,
    "confirmou_provocacao" BOOLEAN NOT NULL DEFAULT false,
    "manifesto_markdown" TEXT,
    "versao_instrumento" TEXT NOT NULL DEFAULT '1.0.0',
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluido_em" TIMESTAMPTZ(6),

    CONSTRAINT "exp_08_sessoes_pkey" PRIMARY KEY ("escola_id","estudante_id")
);

-- CreateTable
CREATE TABLE "exp_08_auditorias" (
    "id" BIGSERIAL NOT NULL,
    "escola_id" TEXT NOT NULL,
    "estudante_id" UUID NOT NULL,
    "prompt_id" TEXT NOT NULL,
    "iteracao" INTEGER NOT NULL,
    "latencia_seg" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp_08_auditorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp_08_respostas_percurso" (
    "escola_id" TEXT NOT NULL,
    "estudante_id" UUID NOT NULL,
    "palavras_chave_tags" TEXT[],
    "justificativa_texto" TEXT NOT NULL,
    "chars_count" INTEGER NOT NULL,
    "versao_instrumento" TEXT NOT NULL DEFAULT '1.0.0',
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp_08_respostas_percurso_pkey" PRIMARY KEY ("escola_id","estudante_id")
);

-- CreateTable
CREATE TABLE "exp_08_gates_turma" (
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "etapa" TEXT NOT NULL DEFAULT 'missao',
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp_08_gates_turma_pkey" PRIMARY KEY ("escola_id","turma_id")
);

-- CreateIndex
CREATE INDEX "exp_08_conteudo_turma_escola_id_idx" ON "exp_08_conteudo_turma"("escola_id");

-- CreateIndex
CREATE INDEX "exp_08_sessoes_escola_id_idx" ON "exp_08_sessoes"("escola_id");

-- CreateIndex
CREATE INDEX "exp_08_sessoes_escola_id_turma_id_idx" ON "exp_08_sessoes"("escola_id", "turma_id");

-- CreateIndex
CREATE INDEX "exp_08_auditorias_escola_id_estudante_id_idx" ON "exp_08_auditorias"("escola_id", "estudante_id");

-- CreateIndex
CREATE UNIQUE INDEX "exp_08_auditorias_escola_id_estudante_id_prompt_id_key" ON "exp_08_auditorias"("escola_id", "estudante_id", "prompt_id");

-- CreateIndex
CREATE INDEX "exp_08_respostas_percurso_escola_id_idx" ON "exp_08_respostas_percurso"("escola_id");

-- CreateIndex
CREATE INDEX "exp_08_gates_turma_escola_id_idx" ON "exp_08_gates_turma"("escola_id");

-- AddForeignKey
ALTER TABLE "exp_08_conteudo_turma" ADD CONSTRAINT "exp_08_conteudo_turma_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp_08_sessoes" ADD CONSTRAINT "exp_08_sessoes_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp_08_auditorias" ADD CONSTRAINT "exp_08_auditorias_escola_id_estudante_id_fkey" FOREIGN KEY ("escola_id", "estudante_id") REFERENCES "exp_08_sessoes"("escola_id", "estudante_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp_08_respostas_percurso" ADD CONSTRAINT "exp_08_respostas_percurso_escola_id_estudante_id_fkey" FOREIGN KEY ("escola_id", "estudante_id") REFERENCES "exp_08_sessoes"("escola_id", "estudante_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp_08_gates_turma" ADD CONSTRAINT "exp_08_gates_turma_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ===========================================================================
-- Bloco MANUAL. O Prisma não gera CHECK, RLS nem GRANT.
-- ===========================================================================

-- Os enums do domínio moram aqui como CHECK, não como type: a ordem dos passos
-- é regra (`src/manifesto-ia/regras/passos.ts`), e um `enum` do Postgres
-- amarraria toda mudança de roteiro a uma migration de `ALTER TYPE`.
ALTER TABLE "exp_08_sessoes"
  ADD CONSTRAINT "exp_08_sessoes_passo_check"
    CHECK ("passo" IN ('briefing', 'chat', 'decisao', 'manifesto',
                       'percurso', 'podcast', 'fim')),
  -- Os quatro ids do catálogo. NÃO é gabarito: as quatro cláusulas são
  -- salvaguardas válidas, e a lista de métricas proibidas do handoff veda
  -- calcular acerto entre elas. O CHECK existe para o id inventado — que
  -- produziria uma tela mostrando uma cláusula que o servidor não reconhece.
  ADD CONSTRAINT "exp_08_sessoes_clausula_check"
    CHECK ("clausula_id" IS NULL OR "clausula_id" IN (
      'clausula_transparencia', 'clausula_auditoria_vies',
      'clausula_veto_humano', 'clausula_anonimizacao')),
  -- Teto de 2h na latência: acima disso é aba esquecida aberta, não tempo de
  -- deliberação, e a leitura do pico mentiria.
  ADD CONSTRAINT "exp_08_sessoes_latencia_check"
    CHECK ("latencia_clausula_seg" IS NULL
           OR ("latencia_clausula_seg" >= 0 AND "latencia_clausula_seg" <= 7200)),
  -- O manifesto EXISTE se e somente se a cláusula foi fixada. Um documento sem
  -- cláusula seria um manifesto com o artigo em branco; uma cláusula sem
  -- documento seria a Etapa 4 sem o artefato que ela promulga.
  ADD CONSTRAINT "exp_08_sessoes_manifesto_check"
    CHECK (("clausula_id" IS NULL) = ("manifesto_markdown" IS NULL)),
  -- Conclusão e carimbo não podem divergir: o hub lê o `concluido_em` e a
  -- experiência lê o `passo`, e uma tela dizendo "missão cumprida" sobre uma
  -- linha sem carimbo é um relatório que mente.
  ADD CONSTRAINT "exp_08_sessoes_fim_check"
    CHECK (("passo" = 'fim') = ("concluido_em" IS NOT NULL));

ALTER TABLE "exp_08_auditorias"
  -- A iteração é a ordem do disparo na conversa. Zero ou negativo seria uma
  -- fala fora da linha do tempo, e é por ela que a conversa é reconstituída
  -- depois do F5.
  ADD CONSTRAINT "exp_08_auditorias_iteracao_check"
    CHECK ("iteracao" >= 1),
  ADD CONSTRAINT "exp_08_auditorias_latencia_check"
    CHECK ("latencia_seg" >= 0 AND "latencia_seg" <= 3600);

-- O percurso: exatamente 2 tags DISTINTAS do vocabulário, e o parágrafo entre
-- 20 e 800 caracteres.
--
-- As duas tags distintas não são preciosismo: marcar "Justiça" duas vezes
-- deixaria um slot logicamente vazio dentro de um array cheio, e a nuvem
-- agregada da turma contaria a mesma criança duas vezes na mesma palavra.
--
-- O piso de 20 no `btrim` cobre o que o tipo não cobre: vinte espaços passariam
-- o comprimento e contariam como percurso entregue no painel da professora.
ALTER TABLE "exp_08_respostas_percurso"
  ADD CONSTRAINT "exp_08_percurso_tags_cardinalidade_check"
    CHECK (cardinality("palavras_chave_tags") = 2),
  ADD CONSTRAINT "exp_08_percurso_tags_distintas_check"
    CHECK ("palavras_chave_tags"[1] <> "palavras_chave_tags"[2]),
  ADD CONSTRAINT "exp_08_percurso_tags_vocabulario_check"
    CHECK ("palavras_chave_tags" <@ ARRAY['autonomia', 'transparencia',
                                          'justica', 'privacidade']::text[]),
  ADD CONSTRAINT "exp_08_percurso_texto_check"
    CHECK (char_length(btrim("justificativa_texto")) BETWEEN 20 AND 800),
  ADD CONSTRAINT "exp_08_percurso_chars_check"
    CHECK ("chars_count" BETWEEN 20 AND 800);

-- O pacote da turma tem 3 questionamentos e 4 cláusulas, sempre. A leitura do
-- service confere a mesma coisa em TypeScript, e a razão de o CHECK existir é
-- a linha escrita por um caminho que ainda não existe: um pacote com 2
-- cláusulas faria a tela do PICO renderizar meio grid, e o sintoma apareceria
-- na aula, não no deploy.
ALTER TABLE "exp_08_conteudo_turma"
  ADD CONSTRAINT "exp_08_conteudo_prompts_check"
    CHECK (jsonb_typeof("prompts_json") = 'array'
           AND jsonb_array_length("prompts_json") = 3),
  ADD CONSTRAINT "exp_08_conteudo_clausulas_check"
    CHECK (jsonb_typeof("clausulas_json") = 'array'
           AND jsonb_array_length("clausulas_json") = 4),
  ADD CONSTRAINT "exp_08_conteudo_contexto_check"
    CHECK (jsonb_typeof("contexto") = 'object');

ALTER TABLE "exp_08_gates_turma"
  ADD CONSTRAINT "exp_08_gates_turma_etapa_check"
    CHECK ("etapa" IN ('missao', 'debate'));

-- RLS (regra inviolável nº 1) — mesma expressão das outras tabelas de estudante.
-- O gate e o pacote da turma entram junto: uma rede vizinha não vê a aula da
-- outra, e o caso da escola que a professora escreveu no preparo é dela.
ALTER TABLE "exp_08_conteudo_turma" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp_08_conteudo_turma" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp_08_conteudo_turma_por_escola" ON "exp_08_conteudo_turma"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp_08_sessoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp_08_sessoes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp_08_sessoes_por_escola" ON "exp_08_sessoes"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp_08_auditorias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp_08_auditorias" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp_08_auditorias_por_escola" ON "exp_08_auditorias"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp_08_respostas_percurso" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp_08_respostas_percurso" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp_08_respostas_percurso_por_escola" ON "exp_08_respostas_percurso"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp_08_gates_turma" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp_08_gates_turma" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp_08_gates_turma_por_escola" ON "exp_08_gates_turma"
  USING (escola_id = current_setting('app.escola_id', true));

-- A role de runtime (docs/INFRA.md) conecta sem ownership e precisa de
-- privilégio nas tabelas novas. Guardado: em dev/CI a role não existe.
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    FOREACH t IN ARRAY ARRAY['exp_08_conteudo_turma', 'exp_08_sessoes',
                             'exp_08_auditorias', 'exp_08_respostas_percurso',
                             'exp_08_gates_turma']
    LOOP
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_runtime', t);
    END LOOP;
    -- `exp_08_auditorias` tem id BIGSERIAL: sem USAGE na sequência o INSERT
    -- falha para a role de runtime mesmo com o GRANT acima — e falha só em
    -- produção, que é onde a role existe.
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE exp_08_auditorias_id_seq TO app_runtime';
  END IF;
END $$;
