-- exp05ef1b v2.2 — "Quem Mandou Isso?" (5º ano, unidade 1): as quatro tabelas da missão.
--
-- A v1 saiu na 20260925190000_retira_exp05ef1b_v1 (ADR-114); esta é a v2.2, com
-- o mesmo código e outra mecânica: a matriz 2x2 (verdadeira/falsa x
-- emocional/neutra), EXATAMENTE três encaminhamentos, a enquete de motivo, a
-- regra Se/Então, a evidência (E14) e as equipes (E13). O carimbo é posterior às
-- duas retiradas do dia (a do Eco, 20260925180000, corre em paralelo).
--
--   exp05ef1b_pacotes      as 8 mensagens COM gabarito; o ativo é a ATIVIDADE da
--                          evidência, e "zerar a turma" é rodada_atual + 1
--   exp05ef1b_gates_turma  a fase da turma (os três botões do professor)
--   exp05ef1b_sessoes      a sessão por (estudante, pacote, rodada), com os latches
--   exp05ef1b_reflexoes    a regra Se/Então — TEXTO LIVRE DE MENOR, confinado
--
-- O Prisma gera as tabelas, os índices e as FKs abaixo (`migrate diff`); CHECK,
-- índices parciais, RLS e GRANT são o bloco MANUAL no fim.

-- CreateTable
CREATE TABLE "exp05ef1b_pacotes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "disciplina" TEXT NOT NULL,
    "tema" TEXT NOT NULL,
    "assuntos" TEXT[],
    "contexto" TEXT,
    "mensagens_json" JSONB NOT NULL,
    "origem" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "rodada_atual" SMALLINT NOT NULL DEFAULT 1,
    "aprovado_em" TIMESTAMPTZ(6),
    "aprovado_por" UUID,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp05ef1b_pacotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp05ef1b_gates_turma" (
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "fase" TEXT NOT NULL DEFAULT 'triagem',
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp05ef1b_gates_turma_pkey" PRIMARY KEY ("escola_id","turma_id")
);

-- CreateTable
CREATE TABLE "exp05ef1b_sessoes" (
    "escola_id" TEXT NOT NULL,
    "estudante_id" UUID NOT NULL,
    "pacote_id" UUID NOT NULL,
    "rodada" SMALLINT NOT NULL,
    "turma_id" UUID NOT NULL,
    "entrou_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "selecao" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confirmado_em" TIMESTAMPTZ(6),
    "tempo_feed_segundos" INTEGER,
    "motivo" TEXT,
    "votou_em" TIMESTAMPTZ(6),
    "reflexao_em" TIMESTAMPTZ(6),
    "concluido_em" TIMESTAMPTZ(6),
    "versao_instrumento" TEXT NOT NULL DEFAULT '2.2.0',
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp05ef1b_sessoes_pkey" PRIMARY KEY ("escola_id","estudante_id","pacote_id","rodada")
);

-- CreateTable
CREATE TABLE "exp05ef1b_reflexoes" (
    "escola_id" TEXT NOT NULL,
    "estudante_id" UUID NOT NULL,
    "pacote_id" UUID NOT NULL,
    "rodada" SMALLINT NOT NULL,
    "condicional_se" TEXT NOT NULL,
    "acao_entao" VARCHAR(240) NOT NULL,
    "chars_count" INTEGER NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp05ef1b_reflexoes_pkey" PRIMARY KEY ("escola_id","estudante_id","pacote_id","rodada")
);

-- CreateIndex
CREATE INDEX "exp05ef1b_pacotes_escola_id_turma_id_idx" ON "exp05ef1b_pacotes"("escola_id", "turma_id");

-- CreateIndex
CREATE UNIQUE INDEX "exp05ef1b_pacotes_escola_id_id_key" ON "exp05ef1b_pacotes"("escola_id", "id");

-- CreateIndex
CREATE INDEX "exp05ef1b_sessoes_escola_id_turma_id_pacote_id_rodada_idx" ON "exp05ef1b_sessoes"("escola_id", "turma_id", "pacote_id", "rodada");

-- AddForeignKey
ALTER TABLE "exp05ef1b_pacotes" ADD CONSTRAINT "exp05ef1b_pacotes_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp05ef1b_gates_turma" ADD CONSTRAINT "exp05ef1b_gates_turma_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp05ef1b_sessoes" ADD CONSTRAINT "exp05ef1b_sessoes_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp05ef1b_sessoes" ADD CONSTRAINT "exp05ef1b_sessoes_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp05ef1b_sessoes" ADD CONSTRAINT "exp05ef1b_sessoes_escola_id_pacote_id_fkey" FOREIGN KEY ("escola_id", "pacote_id") REFERENCES "exp05ef1b_pacotes"("escola_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp05ef1b_reflexoes" ADD CONSTRAINT "exp05ef1b_reflexoes_escola_id_estudante_id_pacote_id_rodad_fkey" FOREIGN KEY ("escola_id", "estudante_id", "pacote_id", "rodada") REFERENCES "exp05ef1b_sessoes"("escola_id", "estudante_id", "pacote_id", "rodada") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===========================================================================
-- Bloco MANUAL. O Prisma não gera CHECK, índice parcial, RLS nem GRANT.
-- ===========================================================================

-- UM pacote ATIVO e UM rascunho por turma. Índices únicos PARCIAIS: o
-- `@@unique` do Prisma não os expressa, e sem eles dois cliques em "Aprovar"
-- deixariam a turma com dois pacotes ativos — e o estudante, com o que o
-- `findFirst` achasse primeiro.
CREATE UNIQUE INDEX "exp05ef1b_pacotes_ativo_por_turma"
  ON "exp05ef1b_pacotes" ("escola_id", "turma_id") WHERE "ativo";
CREATE UNIQUE INDEX "exp05ef1b_pacotes_rascunho_por_turma"
  ON "exp05ef1b_pacotes" ("escola_id", "turma_id") WHERE "aprovado_em" IS NULL;

-- Os vocabulários moram aqui como CHECK, e em DOIS lugares — aqui e em
-- `src/quem-mandou-isso/catalogo.ts` / `regras/passos.ts`. É o par que já custou
-- um deploy em `permissoes` (o Zod aceitou, o banco recusou); a suíte de
-- Postgres compara os dois textos.
ALTER TABLE "exp05ef1b_pacotes"
  ADD CONSTRAINT "exp05ef1b_pacotes_disciplina_check"
    CHECK ("disciplina" IN ('letramento-digital', 'lingua-portuguesa', 'matematica', 'ciencias',
                            'historia', 'geografia', 'arte', 'educacao-fisica', 'lingua-inglesa',
                            'ensino-religioso')),
  -- O tema entra na fala da Nina: até 60 caracteres e até 8 palavras (o balão
  -- da Nina fica em ≤ 45). Cinco espaços não são um tema.
  ADD CONSTRAINT "exp05ef1b_pacotes_tema_check"
    CHECK (char_length(btrim("tema")) BETWEEN 3 AND 60
           AND cardinality(regexp_split_to_array(btrim("tema"), '\s+')) <= 8),
  -- `IS NOT NULL` explícito: lista do Prisma nasce `TEXT[]` anulável, e
  -- `cardinality(NULL)` é NULL — que um CHECK deixa passar.
  ADD CONSTRAINT "exp05ef1b_pacotes_assuntos_check"
    CHECK ("assuntos" IS NOT NULL AND cardinality("assuntos") BETWEEN 3 AND 6),
  ADD CONSTRAINT "exp05ef1b_pacotes_contexto_check"
    CHECK ("contexto" IS NULL OR char_length("contexto") <= 300),
  -- O pacote tem OITO mensagens, sempre. A matriz 2x2 NÃO entra aqui: contá-la
  -- em SQL exigiria desmontar o JSONB dentro do CHECK, e o gabarito só existe
  -- numa gramática — a do Zod (`regras/pacote.ts#validarPacote`).
  ADD CONSTRAINT "exp05ef1b_pacotes_mensagens_check"
    CHECK (jsonb_typeof("mensagens_json") = 'array' AND jsonb_array_length("mensagens_json") = 8),
  ADD CONSTRAINT "exp05ef1b_pacotes_origem_check"
    CHECK ("origem" IN ('ia', 'padrao')),
  ADD CONSTRAINT "exp05ef1b_pacotes_rodada_check"
    CHECK ("rodada_atual" >= 1),
  -- Só pacote APROVADO fica diante da turma; rascunho não passa da rodada 1.
  ADD CONSTRAINT "exp05ef1b_pacotes_ativo_check"
    CHECK (NOT "ativo" OR "aprovado_em" IS NOT NULL),
  ADD CONSTRAINT "exp05ef1b_pacotes_aprovacao_check"
    CHECK (("aprovado_em" IS NULL) = ("aprovado_por" IS NULL)),
  ADD CONSTRAINT "exp05ef1b_pacotes_rascunho_check"
    CHECK ("aprovado_em" IS NOT NULL OR "rodada_atual" = 1);

ALTER TABLE "exp05ef1b_gates_turma"
  ADD CONSTRAINT "exp05ef1b_gates_turma_fase_check"
    CHECK ("fase" IN ('triagem', 'revelacao', 'explicar', 'reflexao'));

-- Os LATCHES em ordem. Cada carimbo exige o anterior, e o CHECK vale por
-- STATEMENT: o service grava carimbo e dado no MESMO UPDATE (a seleção com o
-- `confirmado_em`, o motivo com o `votou_em`), senão o intermediário reprova.
ALTER TABLE "exp05ef1b_sessoes"
  ADD CONSTRAINT "exp05ef1b_sessoes_rodada_check"
    CHECK ("rodada" >= 1),
  -- Os oito ids do grupo, no máximo três. Um id fora da lista seria uma
  -- mensagem "encaminhada" que não existe em balão nenhum.
  ADD CONSTRAINT "exp05ef1b_sessoes_selecao_check"
    CHECK ("selecao" IS NOT NULL AND cardinality("selecao") <= 3
           AND "selecao" <@ ARRAY['msg_1', 'msg_2', 'msg_3', 'msg_4',
                                   'msg_5', 'msg_6', 'msg_7', 'msg_8']::text[]),
  -- O LATCH 1 fecha EXATAMENTE três — travado pelo briefing.
  ADD CONSTRAINT "exp05ef1b_sessoes_confirmado_check"
    CHECK ("confirmado_em" IS NULL OR cardinality("selecao") = 3),
  ADD CONSTRAINT "exp05ef1b_sessoes_tempo_feed_check"
    CHECK (("confirmado_em" IS NULL) = ("tempo_feed_segundos" IS NULL)
           AND ("tempo_feed_segundos" IS NULL OR "tempo_feed_segundos" >= 0)),
  ADD CONSTRAINT "exp05ef1b_sessoes_motivo_check"
    CHECK ("motivo" IS NULL OR "motivo" IN ('urgencia', 'confianca_remetente',
                                              'medo_indignacao', 'imagem_link_real')),
  ADD CONSTRAINT "exp05ef1b_sessoes_voto_check"
    CHECK (("motivo" IS NULL) = ("votou_em" IS NULL)
           AND ("votou_em" IS NULL OR "confirmado_em" IS NOT NULL)),
  ADD CONSTRAINT "exp05ef1b_sessoes_reflexao_check"
    CHECK ("reflexao_em" IS NULL OR "votou_em" IS NOT NULL),
  ADD CONSTRAINT "exp05ef1b_sessoes_concluido_check"
    CHECK ("concluido_em" IS NULL OR "reflexao_em" IS NOT NULL);

-- O `Então`: 15 a 240 caracteres DEPOIS do btrim — quinze espaços não são uma
-- regra, e contariam como entregue no painel do professor.
ALTER TABLE "exp05ef1b_reflexoes"
  ADD CONSTRAINT "exp05ef1b_reflexoes_condicional_check"
    CHECK ("condicional_se" IN ('urgente_alarmante', 'parente_proximo',
                                'link_nao_checado', 'promessa_incrivel')),
  ADD CONSTRAINT "exp05ef1b_reflexoes_entao_check"
    CHECK (char_length(btrim("acao_entao")) BETWEEN 15 AND 240),
  ADD CONSTRAINT "exp05ef1b_reflexoes_chars_check"
    CHECK ("chars_count" BETWEEN 15 AND 240);

-- RLS (regra inviolável nº 1) — a mesma expressão das outras tabelas de
-- estudante. No pacote ela pesa mais: ali mora o GABARITO. Na reflexão, o texto
-- livre de menor (RF-014).
ALTER TABLE "exp05ef1b_pacotes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp05ef1b_pacotes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp05ef1b_pacotes_por_escola" ON "exp05ef1b_pacotes"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp05ef1b_gates_turma" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp05ef1b_gates_turma" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp05ef1b_gates_turma_por_escola" ON "exp05ef1b_gates_turma"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp05ef1b_sessoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp05ef1b_sessoes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp05ef1b_sessoes_por_escola" ON "exp05ef1b_sessoes"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp05ef1b_reflexoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp05ef1b_reflexoes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp05ef1b_reflexoes_por_escola" ON "exp05ef1b_reflexoes"
  USING (escola_id = current_setting('app.escola_id', true));

-- A role de runtime (docs/INFRA.md) conecta sem ownership e precisa de
-- privilégio nas tabelas novas. Guardado: em dev/CI a role não existe. Sem
-- sequência: as quatro chaves são uuid ou compostas.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON exp05ef1b_pacotes, exp05ef1b_gates_turma, exp05ef1b_sessoes, exp05ef1b_reflexoes TO app_runtime';
  END IF;
END $$;
