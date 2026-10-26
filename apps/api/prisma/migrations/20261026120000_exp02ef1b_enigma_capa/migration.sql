-- O ENIGMA DA CAPA DA RÁDIO — a missão do 2º ano EF, unidade 1 (ADR-184).
--
-- Quatro tabelas: o pacote (a cena; a atividade da evidência), a fase da
-- turma, o histórico do botão LIBERAR VIRADA e a sessão do estudante. O DDL
-- abaixo é o `prisma migrate diff`; o bloco MANUAL do fim é o que o Prisma não
-- gera.

-- CreateTable
CREATE TABLE "exp02ef1b_pacotes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "disciplina" TEXT NOT NULL,
    "tema" TEXT NOT NULL,
    "palavras" TEXT[],
    "nota" TEXT,
    "chave_cena" TEXT NOT NULL,
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

    CONSTRAINT "exp02ef1b_pacotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp02ef1b_gates_turma" (
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "fase" TEXT NOT NULL DEFAULT 'aberta',
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp02ef1b_gates_turma_pkey" PRIMARY KEY ("escola_id","turma_id")
);

-- CreateTable
CREATE TABLE "exp02ef1b_gates_historico" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "pacote_id" UUID NOT NULL,
    "rodada" SMALLINT NOT NULL,
    "fase" TEXT NOT NULL,
    "professor_id" UUID,
    "em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp02ef1b_gates_historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp02ef1b_sessoes" (
    "escola_id" TEXT NOT NULL,
    "estudante_id" UUID NOT NULL,
    "pacote_id" UUID NOT NULL,
    "rodada" SMALLINT NOT NULL,
    "turma_id" UUID NOT NULL,
    "entrou_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cracha" TEXT NOT NULL,
    "lupa_foto1_ms" INTEGER NOT NULL DEFAULT 0,
    "lupa_foto2_ms" INTEGER NOT NULL DEFAULT 0,
    "lupa_fundo1" BOOLEAN NOT NULL DEFAULT false,
    "lupa_fundo2" BOOLEAN NOT NULL DEFAULT false,
    "lupa_alertas" SMALLINT NOT NULL DEFAULT 0,
    "lupa_liberada_em" TIMESTAMPTZ(6),
    "capa_foto_id" TEXT,
    "capa_selo_id" TEXT,
    "capa_deslocamento" JSONB,
    "capa_selo_coerente" BOOLEAN,
    "visitante_fala" TEXT,
    "capa_nucleo_visivel" BOOLEAN,
    "capa_publicada_em" TIMESTAMPTZ(6),
    "invariantes_encontrados" JSONB NOT NULL DEFAULT '[]',
    "invariantes_erros" SMALLINT NOT NULL DEFAULT 0,
    "invariantes_ajuda_em" TIMESTAMPTZ(6),
    "invariantes_erros_pos_ajuda" SMALLINT NOT NULL DEFAULT 0,
    "invariantes_concluido_em" TIMESTAMPTZ(6),
    "panoramica_aberta_em" TIMESTAMPTZ(6),
    "fora_toques" JSONB,
    "fora_itens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fora_em" TIMESTAMPTZ(6),
    "par_cartas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "par_motivo" TEXT,
    "par_correto" BOOLEAN,
    "par_em" TIMESTAMPTZ(6),
    "segunda_elemento" TEXT,
    "segunda_deslocamento" JSONB,
    "segunda_essencial_visivel" BOOLEAN,
    "segunda_em" TIMESTAMPTZ(6),
    "transferencia_voto" TEXT,
    "concluido_em" TIMESTAMPTZ(6),
    "versao_instrumento" TEXT NOT NULL DEFAULT '1.0.0',
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp02ef1b_sessoes_pkey" PRIMARY KEY ("escola_id","estudante_id","pacote_id","rodada")
);

-- CreateIndex
CREATE INDEX "exp02ef1b_pacotes_escola_id_turma_id_idx" ON "exp02ef1b_pacotes"("escola_id", "turma_id");

-- CreateIndex
CREATE UNIQUE INDEX "exp02ef1b_pacotes_escola_id_id_key" ON "exp02ef1b_pacotes"("escola_id", "id");

-- CreateIndex
CREATE INDEX "exp02ef1b_gates_historico_escola_id_turma_id_idx" ON "exp02ef1b_gates_historico"("escola_id", "turma_id");

-- CreateIndex
CREATE INDEX "exp02ef1b_sessoes_escola_id_turma_id_pacote_id_rodada_idx" ON "exp02ef1b_sessoes"("escola_id", "turma_id", "pacote_id", "rodada");

-- AddForeignKey
ALTER TABLE "exp02ef1b_pacotes" ADD CONSTRAINT "exp02ef1b_pacotes_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp02ef1b_gates_turma" ADD CONSTRAINT "exp02ef1b_gates_turma_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp02ef1b_gates_historico" ADD CONSTRAINT "exp02ef1b_gates_historico_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp02ef1b_gates_historico" ADD CONSTRAINT "exp02ef1b_gates_historico_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp02ef1b_sessoes" ADD CONSTRAINT "exp02ef1b_sessoes_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp02ef1b_sessoes" ADD CONSTRAINT "exp02ef1b_sessoes_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp02ef1b_sessoes" ADD CONSTRAINT "exp02ef1b_sessoes_escola_id_pacote_id_fkey" FOREIGN KEY ("escola_id", "pacote_id") REFERENCES "exp02ef1b_pacotes"("escola_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Bloco MANUAL. O Prisma não gera CHECK, índice parcial, RLS nem GRANT.
-- Os vocabulários espelham `apps/api/src/enigma-capa/conteudo.ts`, e a suíte
-- `tests/enigma-capa-regras.spec.ts` compara os dois textos.
-- ---------------------------------------------------------------------------

ALTER TABLE "exp02ef1b_pacotes"
  ADD CONSTRAINT "exp02ef1b_pacotes_disciplina_check"
    CHECK ("disciplina" IN ('lingua-portuguesa', 'ciencias', 'historia', 'outra')),
  ADD CONSTRAINT "exp02ef1b_pacotes_origem_check" CHECK ("origem" IN ('padrao', 'ia')),
  ADD CONSTRAINT "exp02ef1b_pacotes_chave_cena_check" CHECK ("chave_cena" IN ('biblioteca', 'horta', 'museu', 'ia')),
  ADD CONSTRAINT "exp02ef1b_pacotes_conteudo_check" CHECK (jsonb_typeof("conteudo_json") = 'object'),
  -- Carimbo e autor andam juntos; só o homologado vai ao ar.
  ADD CONSTRAINT "exp02ef1b_pacotes_aprovado_check" CHECK (("aprovado_em" IS NULL) = ("aprovado_por" IS NULL)),
  ADD CONSTRAINT "exp02ef1b_pacotes_ativo_check" CHECK (NOT "ativo" OR "aprovado_em" IS NOT NULL),
  -- O homologado tem os DOIS alvos marcados (a cena da IA nasce sem eles).
  ADD CONSTRAINT "exp02ef1b_pacotes_alvos_check" CHECK (
    "aprovado_em" IS NULL OR (
      jsonb_typeof("conteudo_json" #> '{cena,invariantes,0,alvo}') = 'object'
      AND jsonb_typeof("conteudo_json" #> '{cena,invariantes,1,alvo}') = 'object'
    )
  ),
  ADD CONSTRAINT "exp02ef1b_pacotes_rodada_check" CHECK ("rodada_atual" >= 1);

-- Um em andamento por turma, e um rascunho por turma (o preparo custou saldo:
-- um F5 não pode jogá-lo fora, e dois rascunhos seriam dois "o último").
CREATE UNIQUE INDEX "exp02ef1b_pacotes_um_ativo_por_turma"
  ON "exp02ef1b_pacotes" ("escola_id", "turma_id") WHERE "ativo";
CREATE UNIQUE INDEX "exp02ef1b_pacotes_um_rascunho_por_turma"
  ON "exp02ef1b_pacotes" ("escola_id", "turma_id") WHERE "aprovado_em" IS NULL;

ALTER TABLE "exp02ef1b_gates_turma"
  ADD CONSTRAINT "exp02ef1b_gates_turma_fase_check" CHECK ("fase" IN ('aberta', 'virada'));

ALTER TABLE "exp02ef1b_gates_historico"
  ADD CONSTRAINT "exp02ef1b_gates_historico_fase_check" CHECK ("fase" = 'virada'),
  ADD CONSTRAINT "exp02ef1b_gates_historico_rodada_check" CHECK ("rodada" >= 1);

ALTER TABLE "exp02ef1b_sessoes"
  ADD CONSTRAINT "exp02ef1b_sessoes_rodada_check" CHECK ("rodada" >= 1),
  ADD CONSTRAINT "exp02ef1b_sessoes_cracha_check"
    CHECK ("cracha" IN ('fone-azul', 'fone-amarelo', 'microfone-verde', 'gravador-laranja')),
  -- A lupa (E2).
  ADD CONSTRAINT "exp02ef1b_sessoes_lupa_check"
    CHECK ("lupa_foto1_ms" >= 0 AND "lupa_foto2_ms" >= 0 AND "lupa_alertas" >= 0),
  -- A CAPA (E3) é o LATCH 1: os sete campos no MESMO UPDATE, e só depois da lupa.
  ADD CONSTRAINT "exp02ef1b_sessoes_capa_check" CHECK (
    ("capa_publicada_em" IS NULL) = ("capa_foto_id" IS NULL)
    AND ("capa_publicada_em" IS NULL) = ("capa_selo_id" IS NULL)
    AND ("capa_publicada_em" IS NULL) = ("capa_deslocamento" IS NULL)
    AND ("capa_publicada_em" IS NULL) = ("capa_selo_coerente" IS NULL)
    AND ("capa_publicada_em" IS NULL) = ("visitante_fala" IS NULL)
    AND ("capa_publicada_em" IS NULL) = ("capa_nucleo_visivel" IS NULL)
  ),
  ADD CONSTRAINT "exp02ef1b_sessoes_capa_foto_check" CHECK ("capa_foto_id" IS NULL OR "capa_foto_id" IN ('foto-1', 'foto-2')),
  ADD CONSTRAINT "exp02ef1b_sessoes_capa_selo_check" CHECK ("capa_selo_id" IS NULL OR "capa_selo_id" IN ('selo-1', 'selo-2')),
  ADD CONSTRAINT "exp02ef1b_sessoes_capa_ordem_check" CHECK ("capa_publicada_em" IS NULL OR "lupa_liberada_em" IS NOT NULL),
  -- Os invariantes (E4): a ajuda acende no 3º erro; erro depois da ajuda só com ela acesa.
  ADD CONSTRAINT "exp02ef1b_sessoes_invariantes_check" CHECK (
    jsonb_typeof("invariantes_encontrados") = 'array'
    AND "invariantes_erros" BETWEEN 0 AND 3
    AND ("invariantes_ajuda_em" IS NULL) = ("invariantes_erros" < 3)
    AND "invariantes_erros_pos_ajuda" >= 0
    AND ("invariantes_erros_pos_ajuda" = 0 OR "invariantes_ajuda_em" IS NOT NULL)
  ),
  ADD CONSTRAINT "exp02ef1b_sessoes_invariantes_ordem_check"
    CHECK ("invariantes_concluido_em" IS NULL OR "capa_publicada_em" IS NOT NULL),
  ADD CONSTRAINT "exp02ef1b_sessoes_panoramica_ordem_check"
    CHECK ("panoramica_aberta_em" IS NULL OR "invariantes_concluido_em" IS NOT NULL),
  -- O "o que ficou fora": toques e carimbo juntos, e só depois do slider.
  ADD CONSTRAINT "exp02ef1b_sessoes_fora_check" CHECK (
    ("fora_em" IS NULL) = ("fora_toques" IS NULL)
    AND ("fora_toques" IS NULL OR jsonb_typeof("fora_toques") = 'array')
    AND ("fora_em" IS NULL OR "panoramica_aberta_em" IS NOT NULL)
  ),
  -- E5, os pares: as duas cartas, o motivo e o acerto juntos; só depois do "fora".
  ADD CONSTRAINT "exp02ef1b_sessoes_par_check" CHECK (
    ("par_em" IS NULL) = ("par_motivo" IS NULL)
    AND ("par_em" IS NULL) = ("par_correto" IS NULL)
    AND cardinality("par_cartas") = CASE WHEN "par_em" IS NULL THEN 0 ELSE 2 END
    AND ("par_em" IS NULL OR "fora_em" IS NOT NULL)
  ),
  ADD CONSTRAINT "exp02ef1b_sessoes_par_motivo_check" CHECK ("par_motivo" IS NULL OR "par_motivo" IN ('atividade', 'roupa')),
  ADD CONSTRAINT "exp02ef1b_sessoes_par_cartas_check"
    CHECK ("par_cartas" <@ ARRAY['carta-a', 'carta-b', 'carta-c', 'carta-d']::TEXT[]),
  -- E5, a segunda foto: os quatro campos juntos; só depois dos pares.
  ADD CONSTRAINT "exp02ef1b_sessoes_segunda_check" CHECK (
    ("segunda_em" IS NULL) = ("segunda_elemento" IS NULL)
    AND ("segunda_em" IS NULL) = ("segunda_deslocamento" IS NULL)
    AND ("segunda_em" IS NULL) = ("segunda_essencial_visivel" IS NULL)
    AND ("segunda_em" IS NULL OR "par_em" IS NOT NULL)
  ),
  ADD CONSTRAINT "exp02ef1b_sessoes_segunda_elemento_check"
    CHECK ("segunda_elemento" IS NULL OR "segunda_elemento" IN ('mochila', 'parede', 'crianca-lendo')),
  -- E6 é o LATCH 2: o voto conclui (os dois juntos), e só depois da segunda foto.
  ADD CONSTRAINT "exp02ef1b_sessoes_transferencia_check" CHECK (
    ("transferencia_voto" IS NULL) = ("concluido_em" IS NULL)
    AND ("concluido_em" IS NULL OR "segunda_em" IS NOT NULL)
  ),
  ADD CONSTRAINT "exp02ef1b_sessoes_voto_check"
    CHECK ("transferencia_voto" IS NULL OR "transferencia_voto" IN ('so-um-pedaco', 'mostra-tudo'));

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['exp02ef1b_pacotes', 'exp02ef1b_gates_turma', 'exp02ef1b_gates_historico', 'exp02ef1b_sessoes'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (escola_id = current_setting(''app.escola_id'', true))', t || '_por_escola', t);
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_runtime', t);
    END IF;
  END LOOP;
END $$;
