-- NINA E A NOTÍCIA QUE DESAPARECEU: a missão do 3º ano EF, unidade 1 (ADR-197).
--
-- Quatro tabelas: o pacote da feira (a atividade da evidência), o relógio da
-- turma (os dois portões e a pausa), o histórico dos botões da professora e a
-- sessão do estudante. O DDL abaixo é o `prisma migrate diff`; o bloco MANUAL
-- do fim é o que o Prisma não gera.
-- CreateTable
CREATE TABLE "exp03ef1b_pacotes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "origem" TEXT NOT NULL,
    "disciplina" TEXT NOT NULL,
    "tema" TEXT NOT NULL,
    "assuntos" TEXT NOT NULL,
    "contexto" TEXT,
    "conteudo" JSONB NOT NULL,
    "midia" JSONB NOT NULL DEFAULT '{}',
    "imagens_aprovadas_em" TIMESTAMPTZ(6),
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "criado_por" UUID NOT NULL,
    "aprovado_em" TIMESTAMPTZ(6),
    "ia_geracoes" INTEGER NOT NULL DEFAULT 0,
    "ia_tokens" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp03ef1b_pacotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp03ef1b_gates_turma" (
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "pacote_id" UUID NOT NULL,
    "rodada" INTEGER NOT NULL DEFAULT 1,
    "etapa" TEXT NOT NULL DEFAULT 'aposta',
    "pausada" BOOLEAN NOT NULL DEFAULT false,
    "filtro_liberado_em" TIMESTAMPTZ(6),
    "inspecao_liberada_em" TIMESTAMPTZ(6),
    "pausada_em" TIMESTAMPTZ(6),
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp03ef1b_gates_turma_pkey" PRIMARY KEY ("escola_id","turma_id")
);

-- CreateTable
CREATE TABLE "exp03ef1b_gates_historico" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "pacote_id" UUID NOT NULL,
    "rodada" INTEGER NOT NULL,
    "acao" TEXT NOT NULL,
    "etapa" TEXT NOT NULL,
    "professor_id" UUID,
    "em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp03ef1b_gates_historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp03ef1b_sessoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "pacote_id" UUID NOT NULL,
    "rodada" INTEGER NOT NULL,
    "estudante_id" UUID NOT NULL,
    "passo" TEXT NOT NULL DEFAULT 'galeria',
    "selos_feira" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "previsao_itens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "previsao_travada_em" TIMESTAMPTZ(6),
    "filtro_tentativas" INTEGER NOT NULL DEFAULT 0,
    "filtro_acertou_em" TIMESTAMPTZ(6),
    "ficha_aberta_em" TIMESTAMPTZ(6),
    "dica_inspecao_usada" BOOLEAN NOT NULL DEFAULT false,
    "carimbos_e4" JSONB,
    "carimbos_e6" JSONB,
    "reparo_posicoes" JSONB,
    "reparo_valido" BOOLEAN,
    "reparo_em" TIMESTAMPTZ(6),
    "rotina_tentativas" INTEGER NOT NULL DEFAULT 0,
    "rotina_valida" BOOLEAN NOT NULL DEFAULT false,
    "rotina_valida_em" TIMESTAMPTZ(6),
    "rotina_ordem_bandeja" JSONB,
    "concluida_em" TIMESTAMPTZ(6),
    "versao_instrumento" TEXT NOT NULL DEFAULT '1.0.0',
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp03ef1b_sessoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exp03ef1b_pacotes_escola_id_turma_id_idx" ON "exp03ef1b_pacotes"("escola_id", "turma_id");

-- CreateIndex
CREATE UNIQUE INDEX "exp03ef1b_pacotes_escola_id_id_key" ON "exp03ef1b_pacotes"("escola_id", "id");

-- CreateIndex
CREATE INDEX "exp03ef1b_gates_turma_escola_id_pacote_id_idx" ON "exp03ef1b_gates_turma"("escola_id", "pacote_id");

-- CreateIndex
CREATE INDEX "exp03ef1b_gates_historico_escola_id_turma_id_idx" ON "exp03ef1b_gates_historico"("escola_id", "turma_id");

-- CreateIndex
CREATE INDEX "exp03ef1b_sessoes_escola_id_turma_id_pacote_id_rodada_idx" ON "exp03ef1b_sessoes"("escola_id", "turma_id", "pacote_id", "rodada");

-- CreateIndex
CREATE INDEX "exp03ef1b_sessoes_escola_id_estudante_id_idx" ON "exp03ef1b_sessoes"("escola_id", "estudante_id");

-- CreateIndex
CREATE UNIQUE INDEX "exp03ef1b_sessao_unica_por_rodada" ON "exp03ef1b_sessoes"("pacote_id", "rodada", "estudante_id");

-- AddForeignKey
ALTER TABLE "exp03ef1b_pacotes" ADD CONSTRAINT "exp03ef1b_pacotes_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp03ef1b_gates_turma" ADD CONSTRAINT "exp03ef1b_gates_turma_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp03ef1b_gates_turma" ADD CONSTRAINT "exp03ef1b_gates_turma_escola_id_pacote_id_fkey" FOREIGN KEY ("escola_id", "pacote_id") REFERENCES "exp03ef1b_pacotes"("escola_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp03ef1b_gates_historico" ADD CONSTRAINT "exp03ef1b_gates_historico_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp03ef1b_gates_historico" ADD CONSTRAINT "exp03ef1b_gates_historico_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp03ef1b_sessoes" ADD CONSTRAINT "exp03ef1b_sessoes_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp03ef1b_sessoes" ADD CONSTRAINT "exp03ef1b_sessoes_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp03ef1b_sessoes" ADD CONSTRAINT "exp03ef1b_sessoes_escola_id_pacote_id_fkey" FOREIGN KEY ("escola_id", "pacote_id") REFERENCES "exp03ef1b_pacotes"("escola_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ---------------------------------------------------------------------------
-- Bloco MANUAL. O Prisma não gera CHECK, índice parcial, RLS nem GRANT.
-- Os vocabulários espelham `apps/api/src/nina-noticia/vocabulario.ts`, e a
-- suíte `tests/nina-noticia-postgres.spec.ts` compara os dois textos.
-- ---------------------------------------------------------------------------

ALTER TABLE "exp03ef1b_pacotes"
  ADD CONSTRAINT "exp03ef1b_pacotes_disciplina_check"
    CHECK ("disciplina" IN ('lingua-portuguesa', 'arte', 'educacao-fisica', 'matematica', 'ciencias', 'geografia', 'historia', 'ensino-religioso', 'computacao', 'projeto-interdisciplinar')),
  ADD CONSTRAINT "exp03ef1b_pacotes_origem_check" CHECK ("origem" IN ('padrao', 'ia')),
  -- A forma mínima: um objeto com as TRÊS reportagens (a régua inteira é o Zod da homologação).
  ADD CONSTRAINT "exp03ef1b_pacotes_conteudo_check" CHECK (
    jsonb_typeof("conteudo") = 'object'
    AND CASE WHEN jsonb_typeof("conteudo" -> 'reportagens') = 'array'
             THEN jsonb_array_length("conteudo" -> 'reportagens') = 3
             ELSE false END
  ),
  ADD CONSTRAINT "exp03ef1b_pacotes_midia_check" CHECK (jsonb_typeof("midia") = 'object'),
  -- Só vai ao ar com a segunda fase da aprovação (as imagens vistas).
  ADD CONSTRAINT "exp03ef1b_pacotes_ativo_check" CHECK (NOT "ativo" OR "imagens_aprovadas_em" IS NOT NULL),
  ADD CONSTRAINT "exp03ef1b_pacotes_ia_check" CHECK ("ia_geracoes" >= 0 AND "ia_tokens" >= 0);

-- Uma atividade EM ANDAMENTO por turma.
CREATE UNIQUE INDEX "exp03ef1b_pacotes_um_ativo_por_turma"
  ON "exp03ef1b_pacotes" ("escola_id", "turma_id") WHERE "ativo";

ALTER TABLE "exp03ef1b_gates_turma"
  ADD CONSTRAINT "exp03ef1b_gates_turma_etapa_check" CHECK ("etapa" IN ('aposta', 'filtro', 'inspecao')),
  ADD CONSTRAINT "exp03ef1b_gates_turma_rodada_check" CHECK ("rodada" >= 1),
  ADD CONSTRAINT "exp03ef1b_gates_turma_pausa_check" CHECK ("pausada" = ("pausada_em" IS NOT NULL)),
  -- Cada portão tem o seu carimbo, e o carimbo existe só da etapa dele em diante.
  ADD CONSTRAINT "exp03ef1b_gates_turma_portoes_check" CHECK (
    ("etapa" = 'aposta') = ("filtro_liberado_em" IS NULL)
    AND ("etapa" = 'inspecao') = ("inspecao_liberada_em" IS NOT NULL)
  );

ALTER TABLE "exp03ef1b_gates_historico"
  ADD CONSTRAINT "exp03ef1b_gates_historico_acao_check" CHECK ("acao" IN ('liberar', 'pausar', 'retomar', 'zerar')),
  ADD CONSTRAINT "exp03ef1b_gates_historico_etapa_check" CHECK ("etapa" IN ('aposta', 'filtro', 'inspecao')),
  ADD CONSTRAINT "exp03ef1b_gates_historico_rodada_check" CHECK ("rodada" >= 1);

ALTER TABLE "exp03ef1b_sessoes"
  ADD CONSTRAINT "exp03ef1b_sessoes_rodada_check" CHECK ("rodada" >= 1),
  ADD CONSTRAINT "exp03ef1b_sessoes_passo_check"
    CHECK ("passo" IN ('galeria', 'aposta', 'filtro', 'omissao', 'ficha', 'carimbos', 'reparo', 'desfecho', 'ponte', 'rotina', 'caso', 'fim')),
  -- E1: os suportes; sair da galeria exige os três selos.
  ADD CONSTRAINT "exp03ef1b_sessoes_selos_check" CHECK (
    "selos_feira" <@ ARRAY['mural', 'portal', 'telao']::TEXT[]
    AND ("passo" = 'galeria' OR "selos_feira" @> ARRAY['mural', 'portal', 'telao']::TEXT[])
  ),
  -- E2 é o LATCH da escolha: os itens e o carimbo juntos; do filtro em diante, travada.
  ADD CONSTRAINT "exp03ef1b_sessoes_previsao_check" CHECK (
    "previsao_itens" <@ ARRAY['mural', 'portal', 'telao']::TEXT[]
    AND ("previsao_travada_em" IS NULL) = (cardinality("previsao_itens") = 0)
    AND ("passo" IN ('galeria', 'aposta') OR "previsao_travada_em" IS NOT NULL)
  ),
  -- E3: as tentativas contam só antes da certa; da omissão em diante, a certa aconteceu.
  ADD CONSTRAINT "exp03ef1b_sessoes_filtro_check" CHECK (
    "filtro_tentativas" >= 0
    AND ("filtro_acertou_em" IS NULL OR "previsao_travada_em" IS NOT NULL)
    AND ("passo" IN ('galeria', 'aposta', 'filtro') OR "filtro_acertou_em" IS NOT NULL)
  ),
  -- E4-01: a ficha só abre depois do filtro; os carimbos da E4 só depois da ficha.
  ADD CONSTRAINT "exp03ef1b_sessoes_ficha_check" CHECK (
    ("ficha_aberta_em" IS NULL OR "filtro_acertou_em" IS NOT NULL)
    AND (NOT "dica_inspecao_usada" OR "ficha_aberta_em" IS NOT NULL)
    AND ("passo" IN ('galeria', 'aposta', 'filtro', 'omissao', 'ficha') OR "ficha_aberta_em" IS NOT NULL)
  ),
  ADD CONSTRAINT "exp03ef1b_sessoes_carimbos_e4_check" CHECK (
    "carimbos_e4" IS NULL OR (
      jsonb_typeof("carimbos_e4") = 'object'
      AND COALESCE("carimbos_e4" ->> 'k1', '') IN ('v', 'x', 'duvida')
      AND COALESCE("carimbos_e4" ->> 'k2', '') IN ('v', 'x', 'duvida')
      AND COALESCE("carimbos_e4" ->> 'k3', '') IN ('v', 'x', 'duvida')
      AND "ficha_aberta_em" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "exp03ef1b_sessoes_carimbos_e6_check" CHECK (
    "carimbos_e6" IS NULL OR (
      jsonb_typeof("carimbos_e6") = 'object'
      AND COALESCE("carimbos_e6" ->> 'k4', '') IN ('v', 'x', 'duvida')
      AND COALESCE("carimbos_e6" ->> 'k5', '') IN ('v', 'x', 'duvida')
      AND COALESCE("carimbos_e6" ->> 'k6', '') IN ('v', 'x', 'duvida')
      AND "rotina_valida"
    )
  ),
  -- E4-03: a ficha montada, a validade (Pátio em Onde) e o carimbo no MESMO update.
  ADD CONSTRAINT "exp03ef1b_sessoes_reparo_check" CHECK (
    ("reparo_em" IS NULL) = ("reparo_posicoes" IS NULL)
    AND ("reparo_em" IS NULL) = ("reparo_valido" IS NULL)
    AND (
      "reparo_posicoes" IS NULL OR (
        jsonb_typeof("reparo_posicoes") = 'object'
        AND COALESCE("reparo_posicoes" ->> 'quem', '') IN ('patio', 'estudantes', 'sexta')
        AND COALESCE("reparo_posicoes" ->> 'onde', '') IN ('patio', 'estudantes', 'sexta')
        AND COALESCE("reparo_posicoes" ->> 'quando', '') IN ('patio', 'estudantes', 'sexta')
        AND "reparo_valido" = ("reparo_posicoes" ->> 'onde' = 'patio')
        AND "carimbos_e4" IS NOT NULL
      )
    )
    AND ("passo" IN ('galeria', 'aposta', 'filtro', 'omissao', 'ficha', 'carimbos', 'reparo') OR "reparo_em" IS NOT NULL)
  ),
  -- E5-01: a válida carimba e conta como tentativa; só depois do reparo.
  ADD CONSTRAINT "exp03ef1b_sessoes_rotina_check" CHECK (
    "rotina_tentativas" >= 0
    AND "rotina_valida" = ("rotina_valida_em" IS NOT NULL)
    AND (NOT "rotina_valida" OR "rotina_tentativas" >= 1)
    AND ("rotina_tentativas" = 0 OR "reparo_em" IS NOT NULL)
    AND ("rotina_ordem_bandeja" IS NULL OR jsonb_typeof("rotina_ordem_bandeja") = 'array')
    AND ("passo" NOT IN ('caso', 'fim') OR "rotina_valida")
  ),
  -- E6-03: `fim` e o carimbo juntos, e só com os carimbos do caso novo.
  ADD CONSTRAINT "exp03ef1b_sessoes_conclusao_check" CHECK (
    ("passo" = 'fim') = ("concluida_em" IS NOT NULL)
    AND ("concluida_em" IS NULL OR "carimbos_e6" IS NOT NULL)
  );

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['exp03ef1b_pacotes', 'exp03ef1b_gates_turma', 'exp03ef1b_gates_historico', 'exp03ef1b_sessoes'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (escola_id = current_setting(''app.escola_id'', true))', t || '_por_escola', t);
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_runtime', t);
    END IF;
  END LOOP;
END $$;
