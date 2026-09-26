-- exp07ef1b-a-selecao: as quatro tabelas da missão A Seleção.
--
-- Molde: 20260917120000_exp_05_quem_mandou_isso. O Prisma gera as tabelas, os
-- índices e as FKs abaixo; CHECK, o índice único PARCIAL, RLS e GRANT são o
-- bloco MANUAL no fim — e é lá que a regra inviolável nº 1 (todo dado de
-- estudante escopado por escola) é aplicada.
--
-- A diferença de desenho em relação à exp05ef1b é a ATIVIDADE × RODADA da
-- evidência pedagógica (ADR-112): a sessão é por (cobertura, rodada), e zerar a
-- turma abre outra rodada sem apagar a anterior. A cobertura homologada é a
-- atividade; o gate diz qual está em andamento.
--
-- Os nomes de índice e de UNIQUE são DADOS À MÃO no schema (`map:`): o nome
-- que o Prisma inventaria para o UNIQUE de cinco colunas passa de 63
-- caracteres, o Postgres o corta em silêncio, e o próximo `migrate diff` acusa
-- drift (a ADR-110 pagou isso).

-- CreateTable
CREATE TABLE "exp07ef1b_coberturas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "tema" TEXT NOT NULL,
    "foco" TEXT,
    "origem" TEXT NOT NULL,
    "posts" JSONB NOT NULL,
    "midia" JSONB NOT NULL DEFAULT '{}',
    "aprovada_por" UUID,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criada_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizada_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp07ef1b_coberturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp07ef1b_gates_turma" (
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "cobertura_id" UUID NOT NULL,
    "rodada" INTEGER NOT NULL DEFAULT 1,
    "etapa" TEXT NOT NULL DEFAULT 'exploracao',
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp07ef1b_gates_turma_pkey" PRIMARY KEY ("escola_id","turma_id")
);

-- CreateTable
CREATE TABLE "exp07ef1b_sessoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "estudante_id" UUID NOT NULL,
    "cobertura_id" UUID NOT NULL,
    "rodada" INTEGER NOT NULL,
    "passo" TEXT NOT NULL DEFAULT 'desafio',
    "selecao" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "legenda" VARCHAR(140),
    "matriz" JSONB,
    "publicada_em" TIMESTAMPTZ(6),
    "concluida_em" TIMESTAMPTZ(6),
    "tempo_feed_s" INTEGER,
    "par_sessao_id" UUID,
    "par_virtual" TEXT,
    "par_rotulo" TEXT,
    "versao_instrumento" TEXT NOT NULL DEFAULT '1.0.0',
    "criada_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizada_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp07ef1b_sessoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp07ef1b_reflexoes" (
    "sessao_id" UUID NOT NULL,
    "escola_id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "chars" INTEGER NOT NULL,
    "criada_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp07ef1b_reflexoes_pkey" PRIMARY KEY ("sessao_id")
);

-- CreateIndex
CREATE INDEX "exp07ef1b_coberturas_escola_turma_idx" ON "exp07ef1b_coberturas"("escola_id", "turma_id");

-- CreateIndex
CREATE INDEX "exp07ef1b_gates_turma_cobertura_idx" ON "exp07ef1b_gates_turma"("cobertura_id");

-- CreateIndex
CREATE INDEX "exp07ef1b_sessoes_rodada_idx" ON "exp07ef1b_sessoes"("escola_id", "turma_id", "cobertura_id", "rodada");

-- CreateIndex
CREATE INDEX "exp07ef1b_sessoes_estudante_idx" ON "exp07ef1b_sessoes"("escola_id", "estudante_id");

-- CreateIndex
CREATE UNIQUE INDEX "exp07ef1b_sessao_unica_por_rodada" ON "exp07ef1b_sessoes"("escola_id", "turma_id", "estudante_id", "cobertura_id", "rodada");

-- CreateIndex
CREATE INDEX "exp07ef1b_reflexoes_escola_idx" ON "exp07ef1b_reflexoes"("escola_id");

-- AddForeignKey
ALTER TABLE "exp07ef1b_coberturas" ADD CONSTRAINT "exp07ef1b_coberturas_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp07ef1b_gates_turma" ADD CONSTRAINT "exp07ef1b_gates_turma_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp07ef1b_gates_turma" ADD CONSTRAINT "exp07ef1b_gates_turma_cobertura_id_fkey" FOREIGN KEY ("cobertura_id") REFERENCES "exp07ef1b_coberturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp07ef1b_sessoes" ADD CONSTRAINT "exp07ef1b_sessoes_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp07ef1b_sessoes" ADD CONSTRAINT "exp07ef1b_sessoes_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp07ef1b_sessoes" ADD CONSTRAINT "exp07ef1b_sessoes_cobertura_id_fkey" FOREIGN KEY ("cobertura_id") REFERENCES "exp07ef1b_coberturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp07ef1b_reflexoes" ADD CONSTRAINT "exp07ef1b_reflexoes_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "exp07ef1b_sessoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ===========================================================================
-- Bloco MANUAL. O Prisma não gera CHECK, índice parcial, RLS nem GRANT.
-- ===========================================================================

-- UMA cobertura ATIVA por turma. Parcial, e não UNIQUE simples: as inativas
-- ficam (são as atividades passadas, com as sessões delas), e são várias. Sem
-- este índice, duas homologações simultâneas deixariam a turma com duas
-- atividades em andamento, e o gate apontaria para uma enquanto o painel de
-- habilidades mostraria a outra. O Prisma não enxerga índice parcial, e é por
-- isso que ele não aparece no schema nem no `migrate diff`.
CREATE UNIQUE INDEX "exp07ef1b_coberturas_uma_ativa"
  ON "exp07ef1b_coberturas" ("escola_id", "turma_id")
  WHERE "ativa";

-- Os vocabulários moram aqui como CHECK, não como `enum`: a ordem das etapas e
-- dos passos é regra (`src/a-selecao/regras/passos.ts`), e um `enum` do
-- Postgres amarraria toda mudança de roteiro a um `ALTER TYPE`. O mesmo texto
-- das constantes do código — `tests/a-selecao-postgres.spec.ts` compara.
ALTER TABLE "exp07ef1b_coberturas"
  ADD CONSTRAINT "exp07ef1b_coberturas_origem_check"
    CHECK ("origem" IN ('padrao', 'ia')),
  -- A IA só chega à turma HOMOLOGADA (ADR-66/67): a cobertura `ia` sem quem a
  -- aprovou é um rascunho que escapou do preparo. A `padrao` pode nascer
  -- sozinha, na primeira entrada da turma — é o banco curado da Unooria.
  ADD CONSTRAINT "exp07ef1b_coberturas_ia_homologada_check"
    CHECK ("origem" = 'padrao' OR "aprovada_por" IS NOT NULL),
  -- Doze posts, sempre. O 4:4:4 é conferido no Zod da homologação (e no
  -- `validar` do gerador); contá-lo aqui exigiria desmontar o JSONB dentro do
  -- CHECK, e duas gramáticas para a mesma regra é a divergência que o repo já
  -- pagou em `permissoes`. O que o CHECK garante é a forma que o feed lê.
  ADD CONSTRAINT "exp07ef1b_coberturas_posts_check"
    CHECK (jsonb_typeof("posts") = 'array' AND jsonb_array_length("posts") = 12),
  ADD CONSTRAINT "exp07ef1b_coberturas_midia_check"
    CHECK (jsonb_typeof("midia") = 'object'),
  ADD CONSTRAINT "exp07ef1b_coberturas_tema_check"
    CHECK (char_length(btrim("tema")) BETWEEN 5 AND 100),
  ADD CONSTRAINT "exp07ef1b_coberturas_foco_check"
    CHECK ("foco" IS NULL OR char_length("foco") <= 100);

ALTER TABLE "exp07ef1b_gates_turma"
  ADD CONSTRAINT "exp07ef1b_gates_turma_etapa_check"
    CHECK ("etapa" IN ('exploracao', 'mural', 'fichas', 'explicacao')),
  ADD CONSTRAINT "exp07ef1b_gates_turma_rodada_check"
    CHECK ("rodada" >= 1);

ALTER TABLE "exp07ef1b_sessoes"
  ADD CONSTRAINT "exp07ef1b_sessoes_passo_check"
    CHECK ("passo" IN ('desafio', 'feed', 'salvos', 'publicado', 'mural', 'fichas',
                       'explicacao', 'reflexao', 'enquetes', 'fim')),
  ADD CONSTRAINT "exp07ef1b_sessoes_rodada_check"
    CHECK ("rodada" >= 1),
  -- A tríade: vazia antes do latch, três depois — e três DIFERENTES, dos doze
  -- ids do feed. Publicar o mesmo post três vezes seria um Stories com uma
  -- história só, e a matriz contaria três lentes onde há uma.
  ADD CONSTRAINT "exp07ef1b_sessoes_selecao_check"
    CHECK ("selecao" IS NOT NULL
           AND cardinality("selecao") IN (0, 3)
           AND "selecao" <@ ARRAY['post_a_1', 'post_a_2', 'post_a_3', 'post_a_4',
                                  'post_b_1', 'post_b_2', 'post_b_3', 'post_b_4',
                                  'post_c_1', 'post_c_2', 'post_c_3', 'post_c_4']::text[]
           AND (cardinality("selecao") = 0
                OR ("selecao"[1] <> "selecao"[2] AND "selecao"[1] <> "selecao"[3]
                    AND "selecao"[2] <> "selecao"[3]))),
  -- 10 a 140 CODE POINTS: `char_length` conta caracteres, como o
  -- `[...s].length` do Zod (`regras/sessao.ts`). O VARCHAR(140) já corta o
  -- teto; o CHECK cobre o piso, que o tipo não cobre.
  ADD CONSTRAINT "exp07ef1b_sessoes_legenda_check"
    CHECK ("legenda" IS NULL OR char_length("legenda") BETWEEN 10 AND 140),
  -- A matriz é a contagem das três lentes, e a soma é três.
  ADD CONSTRAINT "exp07ef1b_sessoes_matriz_check"
    CHECK ("matriz" IS NULL
           OR (jsonb_typeof("matriz") = 'object'
               AND "matriz" ?& ARRAY['institucional', 'comunitario', 'estatistico']
               AND ("matriz"->>'institucional')::int + ("matriz"->>'comunitario')::int
                   + ("matriz"->>'estatistico')::int = 3)),
  -- PUBLICADO ⇔ tríade + legenda + matriz. O latch é um gesto só: um carimbo
  -- sem a tríade é um Stories vazio no Mural do colega, e uma tríade sem
  -- carimbo é uma publicação que o painel não conta.
  ADD CONSTRAINT "exp07ef1b_sessoes_publicado_check"
    CHECK (("publicada_em" IS NOT NULL)
           = (cardinality("selecao") = 3 AND "legenda" IS NOT NULL AND "matriz" IS NOT NULL)),
  -- O latch e o passo andam juntos, e em mão dupla: quem publicou não está no
  -- feed nem nos salvos, e quem está além deles publicou. É uma EQUIVALÊNCIA
  -- porque a etapa da turma não empurra quem não publicou
  -- (`regras/passos.ts#passoEfetivo`) — então o passo GRAVADO só sai da zona
  -- de antes do latch pelo latch. Vale por STATEMENT: o service grava carimbo
  -- e passo no MESMO update.
  ADD CONSTRAINT "exp07ef1b_sessoes_latch_check"
    CHECK (("publicada_em" IS NOT NULL) = ("passo" NOT IN ('desafio', 'feed', 'salvos'))),
  -- Conclusão e carimbo não divergem: o hub lê `concluida_em`, a experiência lê
  -- `passo`, e uma tela dizendo "missão concluída" sobre uma linha sem carimbo
  -- é um relatório que mente.
  ADD CONSTRAINT "exp07ef1b_sessoes_fim_check"
    CHECK (("passo" = 'fim') = ("concluida_em" IS NOT NULL)),
  ADD CONSTRAINT "exp07ef1b_sessoes_tempo_feed_check"
    CHECK ("tempo_feed_s" IS NULL OR "tempo_feed_s" BETWEEN 0 AND 3600),
  -- O PAR: ou uma sessão da sala, ou um colega virtual — nunca os dois, nunca
  -- a própria sessão, e só depois da publicação (não há o que parear antes). O
  -- rótulo existe exatamente quando o par existe: é ele que a tela escreve.
  ADD CONSTRAINT "exp07ef1b_sessoes_par_virtual_check"
    CHECK ("par_virtual" IS NULL OR "par_virtual" IN ('tomas', 'malu')),
  ADD CONSTRAINT "exp07ef1b_sessoes_par_check"
    CHECK (NOT ("par_sessao_id" IS NOT NULL AND "par_virtual" IS NOT NULL)
           AND ("par_sessao_id" IS NULL OR "par_sessao_id" <> "id")
           AND (("par_sessao_id" IS NULL AND "par_virtual" IS NULL) OR "publicada_em" IS NOT NULL)
           AND (("par_rotulo" IS NOT NULL) = ("par_sessao_id" IS NOT NULL OR "par_virtual" IS NOT NULL))
           AND ("par_rotulo" IS NULL OR char_length("par_rotulo") BETWEEN 1 AND 80));

-- 100 a 500 CODE POINTS, e a coluna `chars` é o MESMO número. Sem a igualdade,
-- um Zod que contasse `length` (UTF-16) gravaria 101 para um texto de 100
-- caracteres com um emoji, e o CHECK de tamanho responderia 500 na mão da
-- criança — o defeito que a exp05ef1b ainda tem.
ALTER TABLE "exp07ef1b_reflexoes"
  ADD CONSTRAINT "exp07ef1b_reflexoes_texto_check"
    CHECK (char_length("texto") BETWEEN 100 AND 500),
  ADD CONSTRAINT "exp07ef1b_reflexoes_chars_check"
    CHECK ("chars" = char_length("texto"));

-- RLS (regra inviolável nº 1) — a mesma expressão das outras tabelas de
-- estudante. A cobertura entra junto e é a que mais pesa: ali mora o GABARITO
-- (o enquadramento de cada post), que a missão inteira existe para não
-- entregar cedo demais — e o tema que uma professora escreveu é da escola dela.
ALTER TABLE "exp07ef1b_coberturas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp07ef1b_coberturas" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp07ef1b_coberturas_por_escola" ON "exp07ef1b_coberturas"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp07ef1b_gates_turma" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp07ef1b_gates_turma" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp07ef1b_gates_turma_por_escola" ON "exp07ef1b_gates_turma"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp07ef1b_sessoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp07ef1b_sessoes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp07ef1b_sessoes_por_escola" ON "exp07ef1b_sessoes"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp07ef1b_reflexoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp07ef1b_reflexoes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp07ef1b_reflexoes_por_escola" ON "exp07ef1b_reflexoes"
  USING (escola_id = current_setting('app.escola_id', true));

-- A role de runtime (docs/INFRA.md) conecta sem ownership e precisa de
-- privilégio nas tabelas novas. Guardado: em dev/CI a role não existe. Nenhuma
-- das quatro tem sequência (os ids são `gen_random_uuid()`), então não há
-- `GRANT USAGE` de sequência a esquecer — a armadilha do BIGSERIAL da exp05ef1b.
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    FOREACH t IN ARRAY ARRAY['exp07ef1b_coberturas', 'exp07ef1b_gates_turma',
                             'exp07ef1b_sessoes', 'exp07ef1b_reflexoes']
    LOOP
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_runtime', t);
    END LOOP;
  END IF;
END $$;
