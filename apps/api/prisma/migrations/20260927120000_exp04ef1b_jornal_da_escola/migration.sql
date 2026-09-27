-- exp04ef1b-jornal-da-escola: as quatro tabelas da missão Jornal da Escola:
-- A Edição de Bento (4º ano EF, unidade 1).
--
-- Molde: 20260926140000_exp07ef1b_a_selecao (e, antes dela,
-- 20260917120000_exp_05_quem_mandou_isso). O Prisma gera as tabelas, os
-- índices e as FKs abaixo (`migrate diff`); CHECK, o índice único PARCIAL, RLS
-- e GRANT são o bloco MANUAL no fim — e é lá que a regra inviolável nº 1 (todo
-- dado de estudante escopado por escola) é aplicada.
--
-- O prefixo é `exp04ef1b_` porque o código passou do UnooTube para o Jornal
-- (ADR-110/116). A tabela do UnooTube arquivado se chama
-- `backup_exp04ef1b_sessoes` e NÃO colide com nenhuma destas.
--
-- A ATIVIDADE da evidência pedagógica (ADR-112) é o PACOTE homologado, e a
-- RODADA é o "Zerar": a sessão é por (pacote, rodada), e zerar a turma abre
-- outra rodada sem apagar a anterior.
--
-- Os nomes de índice e de UNIQUE são DADOS À MÃO no schema (`map:`): o nome
-- que o Prisma inventaria para o UNIQUE de cinco colunas passa de 63
-- caracteres, o Postgres o corta em silêncio, e o próximo `migrate diff`
-- acusaria drift (a ADR-110 pagou isso).

-- CreateTable
CREATE TABLE "exp04ef1b_pacotes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "disciplina" TEXT NOT NULL,
    "tema" TEXT NOT NULL,
    "topicos" TEXT,
    "origem" TEXT NOT NULL,
    "noticias" JSONB NOT NULL,
    "midia" JSONB NOT NULL DEFAULT '{}',
    "aprovado_por" UUID,
    "aprovado_em" TIMESTAMPTZ(6),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "geracoes" INTEGER NOT NULL DEFAULT 0,
    "tokens_usados" INTEGER NOT NULL DEFAULT 0,
    "painel_visto_em" TIMESTAMPTZ(6),
    "painel_vistas" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp04ef1b_pacotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp04ef1b_gates_turma" (
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "pacote_id" UUID NOT NULL,
    "rodada" INTEGER NOT NULL DEFAULT 1,
    "etapa" TEXT NOT NULL DEFAULT 'exploracao',
    "resultado_liberado_em" TIMESTAMPTZ(6),
    "revisao_liberada_em" TIMESTAMPTZ(6),
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp04ef1b_gates_turma_pkey" PRIMARY KEY ("escola_id","turma_id")
);

-- CreateTable
CREATE TABLE "exp04ef1b_sessoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "estudante_id" UUID NOT NULL,
    "pacote_id" UUID NOT NULL,
    "rodada" INTEGER NOT NULL,
    "passo" TEXT NOT NULL DEFAULT 'desafio',
    "pistas" JSONB NOT NULL DEFAULT '[]',
    "slots_ed1" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "layout_ed1" TEXT,
    "origem_layout_ed1" TEXT,
    "verificadas_ed1" INTEGER,
    "motivo_ed1" TEXT,
    "publicada1_em" TIMESTAMPTZ(6),
    "chave_tentativas" INTEGER NOT NULL DEFAULT 0,
    "chave_formada_em" TIMESTAMPTZ(6),
    "slots_ed2" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "layout_ed2" TEXT,
    "origem_layout_ed2" TEXT,
    "verificadas_ed2" INTEGER,
    "publicada2_em" TIMESTAMPTZ(6),
    "concluida_em" TIMESTAMPTZ(6),
    "versao_instrumento" TEXT NOT NULL DEFAULT '1.0.0',
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp04ef1b_sessoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp04ef1b_diagramacoes" (
    "escola_id" TEXT NOT NULL,
    "pacote_id" UUID NOT NULL,
    "chave" TEXT NOT NULL,
    "layout" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp04ef1b_diagramacoes_pkey" PRIMARY KEY ("escola_id","pacote_id","chave")
);

-- CreateIndex
CREATE INDEX "exp04ef1b_pacotes_escola_turma_idx" ON "exp04ef1b_pacotes"("escola_id", "turma_id");

-- CreateIndex
CREATE INDEX "exp04ef1b_gates_turma_pacote_idx" ON "exp04ef1b_gates_turma"("pacote_id");

-- CreateIndex
CREATE INDEX "exp04ef1b_sessoes_rodada_idx" ON "exp04ef1b_sessoes"("escola_id", "turma_id", "pacote_id", "rodada");

-- CreateIndex
CREATE INDEX "exp04ef1b_sessoes_estudante_idx" ON "exp04ef1b_sessoes"("escola_id", "estudante_id");

-- CreateIndex
CREATE UNIQUE INDEX "exp04ef1b_sessao_unica_por_rodada" ON "exp04ef1b_sessoes"("escola_id", "turma_id", "estudante_id", "pacote_id", "rodada");

-- CreateIndex
CREATE INDEX "exp04ef1b_diagramacoes_pacote_idx" ON "exp04ef1b_diagramacoes"("pacote_id");

-- AddForeignKey
ALTER TABLE "exp04ef1b_pacotes" ADD CONSTRAINT "exp04ef1b_pacotes_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp04ef1b_gates_turma" ADD CONSTRAINT "exp04ef1b_gates_turma_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp04ef1b_gates_turma" ADD CONSTRAINT "exp04ef1b_gates_turma_pacote_id_fkey" FOREIGN KEY ("pacote_id") REFERENCES "exp04ef1b_pacotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp04ef1b_sessoes" ADD CONSTRAINT "exp04ef1b_sessoes_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp04ef1b_sessoes" ADD CONSTRAINT "exp04ef1b_sessoes_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp04ef1b_sessoes" ADD CONSTRAINT "exp04ef1b_sessoes_pacote_id_fkey" FOREIGN KEY ("pacote_id") REFERENCES "exp04ef1b_pacotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp04ef1b_diagramacoes" ADD CONSTRAINT "exp04ef1b_diagramacoes_pacote_id_fkey" FOREIGN KEY ("pacote_id") REFERENCES "exp04ef1b_pacotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ===========================================================================
-- Bloco MANUAL. O Prisma não gera CHECK, índice parcial, RLS nem GRANT.
-- ===========================================================================

-- UM pacote ATIVO por turma. Parcial, e não UNIQUE simples: os inativos ficam
-- (são as atividades passadas, com as sessões delas), e são vários. Sem este
-- índice, duas homologações simultâneas — ou duas primeiras entradas criando
-- o banco padrão — deixariam a turma com duas atividades em andamento. O
-- Prisma não enxerga índice parcial, e por isso ele não aparece no schema nem
-- no `migrate diff`.
CREATE UNIQUE INDEX "exp04ef1b_pacotes_um_ativo"
  ON "exp04ef1b_pacotes" ("escola_id", "turma_id")
  WHERE "ativo";

-- Os vocabulários moram aqui como CHECK, não como `enum`: a ordem das etapas e
-- dos passos é regra (`src/jornal-escola/regras/passos.ts`), e os meios, as
-- pistas e os layouts são `src/jornal-escola/vocabulario.ts`. O mesmo texto
-- das constantes do código — `tests/jornal-escola-postgres.spec.ts` compara.
ALTER TABLE "exp04ef1b_pacotes"
  ADD CONSTRAINT "exp04ef1b_pacotes_origem_check"
    CHECK ("origem" IN ('padrao', 'ia')),
  -- A IA só chega à turma HOMOLOGADA (ADR-66/67): o pacote `ia` sem quem o
  -- aprovou é um rascunho que escapou do preparo. O `padrao` pode nascer
  -- sozinho, na primeira entrada da turma — é o banco da Unooria.
  ADD CONSTRAINT "exp04ef1b_pacotes_ia_homologado_check"
    CHECK ("origem" = 'padrao' OR "aprovado_por" IS NOT NULL),
  ADD CONSTRAINT "exp04ef1b_pacotes_aprovacao_check"
    CHECK (("aprovado_por" IS NULL) = ("aprovado_em" IS NULL)),
  -- Oito notícias, sempre. As invariantes do conjunto (meios, composição,
  -- réguas) são conferidas no Zod da homologação (`invariantes.ts`); contá-las
  -- aqui exigiria desmontar o JSONB dentro do CHECK, e duas gramáticas para a
  -- mesma regra é a divergência que o repo já pagou em `permissoes`.
  ADD CONSTRAINT "exp04ef1b_pacotes_noticias_check"
    CHECK (jsonb_typeof("noticias") = 'array' AND jsonb_array_length("noticias") = 8),
  ADD CONSTRAINT "exp04ef1b_pacotes_midia_check"
    CHECK (jsonb_typeof("midia") = 'object'),
  ADD CONSTRAINT "exp04ef1b_pacotes_tema_check"
    CHECK (char_length(btrim("tema")) BETWEEN 5 AND 60),
  ADD CONSTRAINT "exp04ef1b_pacotes_disciplina_check"
    CHECK (char_length(btrim("disciplina")) BETWEEN 2 AND 60),
  ADD CONSTRAINT "exp04ef1b_pacotes_topicos_check"
    CHECK ("topicos" IS NULL OR char_length("topicos") <= 600),
  ADD CONSTRAINT "exp04ef1b_pacotes_contadores_check"
    CHECK ("geracoes" >= 0 AND "tokens_usados" >= 0 AND "painel_vistas" >= 0
           AND (("painel_visto_em" IS NULL) = ("painel_vistas" = 0)));

ALTER TABLE "exp04ef1b_gates_turma"
  ADD CONSTRAINT "exp04ef1b_gates_turma_etapa_check"
    CHECK ("etapa" IN ('exploracao', 'resultado', 'revisao')),
  ADD CONSTRAINT "exp04ef1b_gates_turma_rodada_check"
    CHECK ("rodada" >= 1),
  -- Os carimbos dos portões são DA RODADA em andamento e andam com a etapa: na
  -- exploração nenhum abriu, no resultado só o primeiro, na revisão os dois.
  -- Zerar e homologar os limpam no mesmo UPDATE que volta a etapa.
  ADD CONSTRAINT "exp04ef1b_gates_turma_portoes_check"
    CHECK (("resultado_liberado_em" IS NOT NULL) = ("etapa" IN ('resultado', 'revisao'))
           AND ("revisao_liberada_em" IS NOT NULL) = ("etapa" = 'revisao'));

ALTER TABLE "exp04ef1b_sessoes"
  ADD CONSTRAINT "exp04ef1b_sessoes_passo_check"
    CHECK ("passo" IN ('desafio', 'mesa', 'motivo', 'publicada', 'resultado', 'chave',
                       'revisao', 'comparativo', 'transferencia', 'fim')),
  -- `resultado` e `chave` são impostos pela etapa da turma a quem está em
  -- `publicada` (`regras/passos.ts#passoEfetivo`) — nunca gravados. Gravá-los
  -- faria o F5 de uma rodada zerada abrir a Chave sem a revisão liberada.
  ADD CONSTRAINT "exp04ef1b_sessoes_passo_gravado_check"
    CHECK ("passo" NOT IN ('resultado', 'chave')),
  ADD CONSTRAINT "exp04ef1b_sessoes_rodada_check"
    CHECK ("rodada" >= 1),
  ADD CONSTRAINT "exp04ef1b_sessoes_pistas_check"
    CHECK (jsonb_typeof("pistas") = 'array'),
  -- As vagas: vazias antes do latch, três depois — e três DIFERENTES, dos oito
  -- ids da mesa. A primeira página com a mesma notícia duas vezes contaria a
  -- mesma verificada duas vezes.
  ADD CONSTRAINT "exp04ef1b_sessoes_slots_ed1_check"
    CHECK ("slots_ed1" IS NOT NULL
           AND cardinality("slots_ed1") IN (0, 3)
           AND "slots_ed1" <@ ARRAY['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8']::text[]
           AND (cardinality("slots_ed1") = 0
                OR ("slots_ed1"[1] <> "slots_ed1"[2] AND "slots_ed1"[1] <> "slots_ed1"[3]
                    AND "slots_ed1"[2] <> "slots_ed1"[3]))),
  ADD CONSTRAINT "exp04ef1b_sessoes_slots_ed2_check"
    CHECK ("slots_ed2" IS NOT NULL
           AND cardinality("slots_ed2") IN (0, 3)
           AND "slots_ed2" <@ ARRAY['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8']::text[]
           AND (cardinality("slots_ed2") = 0
                OR ("slots_ed2"[1] <> "slots_ed2"[2] AND "slots_ed2"[1] <> "slots_ed2"[3]
                    AND "slots_ed2"[2] <> "slots_ed2"[3]))),
  ADD CONSTRAINT "exp04ef1b_sessoes_layouts_check"
    CHECK (("layout_ed1" IS NULL OR "layout_ed1" IN ('classic', 'hero-image', 'columns'))
           AND ("layout_ed2" IS NULL OR "layout_ed2" IN ('classic', 'hero-image', 'columns'))
           AND ("origem_layout_ed1" IS NULL OR "origem_layout_ed1" IN ('ia', 'modelo'))
           AND ("origem_layout_ed2" IS NULL OR "origem_layout_ed2" IN ('ia', 'modelo'))),
  ADD CONSTRAINT "exp04ef1b_sessoes_verificadas_check"
    CHECK (("verificadas_ed1" IS NULL OR "verificadas_ed1" BETWEEN 0 AND 3)
           AND ("verificadas_ed2" IS NULL OR "verificadas_ed2" BETWEEN 0 AND 3)),
  ADD CONSTRAINT "exp04ef1b_sessoes_motivo_check"
    CHECK ("motivo_ed1" IS NULL OR "motivo_ed1" IN ('visual', 'checagem')),
  -- PUBLICADA ⇔ três vagas + layout + verificadas. O latch é um gesto só: um
  -- carimbo sem vagas é uma edição vazia no painel, e vagas sem carimbo são
  -- uma edição que o painel não conta.
  ADD CONSTRAINT "exp04ef1b_sessoes_edicao1_check"
    CHECK (("publicada1_em" IS NOT NULL)
           = (cardinality("slots_ed1") = 3 AND "layout_ed1" IS NOT NULL
              AND "origem_layout_ed1" IS NOT NULL AND "verificadas_ed1" IS NOT NULL)),
  ADD CONSTRAINT "exp04ef1b_sessoes_edicao2_check"
    CHECK (("publicada2_em" IS NOT NULL)
           = (cardinality("slots_ed2") = 3 AND "layout_ed2" IS NOT NULL
              AND "origem_layout_ed2" IS NOT NULL AND "verificadas_ed2" IS NOT NULL)),
  -- O latch da 1ª e o passo andam juntos, e em mão dupla: quem publicou não
  -- está no desafio nem na mesa, e quem está além deles publicou. É uma
  -- EQUIVALÊNCIA porque a etapa da turma não empurra quem não publicou — o
  -- passo GRAVADO só sai da zona de antes pelo latch. Vale por STATEMENT: o
  -- service grava carimbo e passo no MESMO update.
  ADD CONSTRAINT "exp04ef1b_sessoes_latch1_check"
    CHECK (("publicada1_em" IS NOT NULL) = ("passo" NOT IN ('desafio', 'mesa'))),
  -- A pergunta de motivo vem logo depois do latch, uma vez: respondida ⇔ o
  -- passo saiu de `motivo` (e já tinha saído da mesa).
  ADD CONSTRAINT "exp04ef1b_sessoes_motivo_respondido_check"
    CHECK (("motivo_ed1" IS NOT NULL) = ("passo" NOT IN ('desafio', 'mesa', 'motivo'))),
  -- A Chave formada é o que tira o passo gravado de `publicada`.
  ADD CONSTRAINT "exp04ef1b_sessoes_chave_check"
    CHECK ("chave_tentativas" >= 0
           AND (("chave_formada_em" IS NOT NULL) = ("passo" IN ('revisao', 'comparativo', 'transferencia', 'fim')))
           AND ("chave_formada_em" IS NULL OR "chave_tentativas" >= 1)),
  -- O latch da 2ª, do mesmo jeito.
  ADD CONSTRAINT "exp04ef1b_sessoes_latch2_check"
    CHECK (("publicada2_em" IS NOT NULL) = ("passo" IN ('comparativo', 'transferencia', 'fim'))),
  -- Conclusão e carimbo não divergem: o hub lê `concluida_em`, a experiência lê
  -- `passo`, e uma tela dizendo "missão concluída" sobre uma linha sem carimbo
  -- é um relatório que mente.
  ADD CONSTRAINT "exp04ef1b_sessoes_fim_check"
    CHECK (("passo" = 'fim') = ("concluida_em" IS NOT NULL));

ALTER TABLE "exp04ef1b_diagramacoes"
  ADD CONSTRAINT "exp04ef1b_diagramacoes_chave_check"
    CHECK ("chave" ~ '^n[1-8],n[1-8],n[1-8]$'),
  ADD CONSTRAINT "exp04ef1b_diagramacoes_layout_check"
    CHECK ("layout" IN ('classic', 'hero-image', 'columns')),
  ADD CONSTRAINT "exp04ef1b_diagramacoes_tokens_check"
    CHECK ("tokens" >= 0);

-- RLS (regra inviolável nº 1) — a mesma expressão das outras tabelas de
-- estudante. O pacote entra junto e é o que mais pesa: ali mora o GABARITO (o
-- que é publicável e o pilar que falta), que a missão inteira existe para não
-- entregar cedo demais — e o tema que uma professora escreveu é da escola dela.
-- O cache da diagramação também: a chave diz quais três notícias uma turma
-- escolheu.
ALTER TABLE "exp04ef1b_pacotes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp04ef1b_pacotes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp04ef1b_pacotes_por_escola" ON "exp04ef1b_pacotes"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp04ef1b_gates_turma" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp04ef1b_gates_turma" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp04ef1b_gates_turma_por_escola" ON "exp04ef1b_gates_turma"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp04ef1b_sessoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp04ef1b_sessoes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp04ef1b_sessoes_por_escola" ON "exp04ef1b_sessoes"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp04ef1b_diagramacoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp04ef1b_diagramacoes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp04ef1b_diagramacoes_por_escola" ON "exp04ef1b_diagramacoes"
  USING (escola_id = current_setting('app.escola_id', true));

-- A role de runtime (docs/INFRA.md) conecta sem ownership e precisa de
-- privilégio nas tabelas novas. Guardado: em dev/CI a role não existe. Nenhuma
-- das quatro tem sequência (os ids são `gen_random_uuid()` ou compostos),
-- então não há `GRANT USAGE` de sequência a esquecer.
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    FOREACH t IN ARRAY ARRAY['exp04ef1b_pacotes', 'exp04ef1b_gates_turma',
                             'exp04ef1b_sessoes', 'exp04ef1b_diagramacoes']
    LOOP
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_runtime', t);
    END LOOP;
  END IF;
END $$;
