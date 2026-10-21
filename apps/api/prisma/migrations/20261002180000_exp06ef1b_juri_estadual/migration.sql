-- exp06ef1b-juri-estadual: as três tabelas da missão O Júri Estadual de
-- Projetos (6º ano EF, unidade 1).
--
-- Molde: 20260927120000_exp04ef1b_jornal_da_escola. O Prisma gera as tabelas,
-- os índices e as FKs abaixo (`migrate diff`); CHECK, o índice único PARCIAL,
-- RLS e GRANT são o bloco MANUAL no fim — e é lá que a regra inviolável nº 1
-- (todo dado de estudante escopado por escola) é aplicada.
--
-- A ATIVIDADE da evidência pedagógica (ADR-112) é o PACOTE homologado — os
-- dezesseis projetos que a IA gerou no preparo e o professor aprovou; não há
-- acervo padrão —, e a RODADA é o "Zerar": a sessão é por (pacote, rodada), e
-- zerar a turma abre outra rodada sem apagar a anterior.
--
-- Os nomes de índice e de UNIQUE são DADOS À MÃO no schema (`map:`), como no
-- Jornal: o nome que o Prisma inventaria passa de 63 caracteres e o Postgres o
-- corta em silêncio.
-- CreateTable
CREATE TABLE "exp06ef1b_pacotes" (
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
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "criado_por" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ia_geracoes" INTEGER NOT NULL DEFAULT 0,
    "ia_tokens" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "exp06ef1b_pacotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp06ef1b_gates_turma" (
    "turma_id" UUID NOT NULL,
    "escola_id" TEXT NOT NULL,
    "pacote_id" UUID NOT NULL,
    "rodada" INTEGER NOT NULL DEFAULT 1,
    "etapa" TEXT NOT NULL DEFAULT 'exploracao',
    "galeria_liberada_em" TIMESTAMPTZ(6),
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp06ef1b_gates_turma_pkey" PRIMARY KEY ("turma_id")
);

-- CreateTable
CREATE TABLE "exp06ef1b_sessoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "pacote_id" UUID NOT NULL,
    "rodada" INTEGER NOT NULL,
    "estudante_id" UUID NOT NULL,
    "passo" TEXT NOT NULL DEFAULT 'credencial',
    "semente" TEXT NOT NULL,
    "posts_servidos" JSONB NOT NULL DEFAULT '[]',
    "curtidos" JSONB NOT NULL DEFAULT '[]',
    "permanencias" JSONB NOT NULL DEFAULT '[]',
    "voto_projeto" TEXT,
    "conviccao" TEXT,
    "votado_em" TIMESTAMPTZ(6),
    "auditoria" JSONB NOT NULL DEFAULT '{"abertos": [], "buscas": []}',
    "revisao_acao" TEXT,
    "voto_revisado" TEXT,
    "revisado_em" TIMESTAMPTZ(6),
    "pacotes_tentativas" INTEGER NOT NULL DEFAULT 0,
    "pacotes_remontados_em" TIMESTAMPTZ(6),
    "cadeia_tentativas" INTEGER NOT NULL DEFAULT 0,
    "cadeia_montada_em" TIMESTAMPTZ(6),
    "mecanismo" TEXT,
    "atitude" TEXT,
    "cartoes_em" TIMESTAMPTZ(6),
    "concluida_em" TIMESTAMPTZ(6),
    "versao_instrumento" TEXT NOT NULL DEFAULT '1.0.0',
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp06ef1b_sessoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exp06ef1b_pacotes_escola_turma_idx" ON "exp06ef1b_pacotes"("escola_id", "turma_id");

-- CreateIndex
CREATE INDEX "exp06ef1b_gates_turma_escola_idx" ON "exp06ef1b_gates_turma"("escola_id");

-- CreateIndex
CREATE INDEX "exp06ef1b_gates_turma_pacote_idx" ON "exp06ef1b_gates_turma"("pacote_id");

-- CreateIndex
CREATE INDEX "exp06ef1b_sessoes_rodada_idx" ON "exp06ef1b_sessoes"("escola_id", "turma_id", "pacote_id", "rodada");

-- CreateIndex
CREATE INDEX "exp06ef1b_sessoes_estudante_idx" ON "exp06ef1b_sessoes"("escola_id", "estudante_id");

-- CreateIndex
CREATE UNIQUE INDEX "exp06ef1b_sessao_unica_por_rodada" ON "exp06ef1b_sessoes"("pacote_id", "rodada", "estudante_id");

-- AddForeignKey
ALTER TABLE "exp06ef1b_pacotes" ADD CONSTRAINT "exp06ef1b_pacotes_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp06ef1b_gates_turma" ADD CONSTRAINT "exp06ef1b_gates_turma_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp06ef1b_gates_turma" ADD CONSTRAINT "exp06ef1b_gates_turma_pacote_id_fkey" FOREIGN KEY ("pacote_id") REFERENCES "exp06ef1b_pacotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp06ef1b_sessoes" ADD CONSTRAINT "exp06ef1b_sessoes_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp06ef1b_sessoes" ADD CONSTRAINT "exp06ef1b_sessoes_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp06ef1b_sessoes" ADD CONSTRAINT "exp06ef1b_sessoes_pacote_id_fkey" FOREIGN KEY ("pacote_id") REFERENCES "exp06ef1b_pacotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ===========================================================================
-- Bloco MANUAL. O Prisma não gera CHECK, índice parcial, RLS nem GRANT.
-- ===========================================================================

-- UM pacote ATIVO (= EM ANDAMENTO) por turma. Parcial, e não UNIQUE simples:
-- os inativos ficam (são as atividades prontas e as passadas, com as sessões
-- delas), e são vários. O Prisma não enxerga índice parcial.
CREATE UNIQUE INDEX "exp06ef1b_pacotes_um_ativo"
  ON "exp06ef1b_pacotes" ("escola_id", "turma_id")
  WHERE "ativo";

-- Os vocabulários moram aqui como CHECK, não como `enum`: a ordem das etapas e
-- dos passos é regra (`src/juri-estadual/regras/passos.ts`), e as disciplinas,
-- as convicções e as ações da revisão são `src/juri-estadual/vocabulario.ts`.
-- O mesmo texto das constantes do código — `tests/juri-estadual-postgres.spec.ts`
-- compara.
ALTER TABLE "exp06ef1b_pacotes"
  ADD CONSTRAINT "exp06ef1b_pacotes_origem_check"
    CHECK ("origem" IN ('ia')),
  ADD CONSTRAINT "exp06ef1b_pacotes_disciplina_check"
    CHECK ("disciplina" IN ('lingua-portuguesa', 'ciencias', 'historia', 'geografia', 'matematica',
                            'arte', 'educacao-fisica', 'lingua-inglesa', 'projeto-interdisciplinar')),
  ADD CONSTRAINT "exp06ef1b_pacotes_tema_check"
    CHECK (char_length(btrim("tema")) BETWEEN 3 AND 60),
  ADD CONSTRAINT "exp06ef1b_pacotes_assuntos_check"
    CHECK (char_length(btrim("assuntos")) BETWEEN 10 AND 600),
  ADD CONSTRAINT "exp06ef1b_pacotes_contexto_check"
    CHECK ("contexto" IS NULL OR char_length("contexto") <= 120),
  -- Quatro categorias e dezesseis projetos, sempre. As invariantes do conjunto
  -- (ids, áreas, hashtags, réguas de palavras, termos proibidos) são conferidas
  -- no Zod da homologação (`invariantes.ts`); contá-las aqui exigiria desmontar
  -- o JSONB dentro do CHECK, e duas gramáticas para a mesma regra é a
  -- divergência que o repo já pagou em `permissoes`.
  ADD CONSTRAINT "exp06ef1b_pacotes_conteudo_check"
    CHECK (jsonb_typeof("conteudo") = 'object'
           AND jsonb_typeof("conteudo" -> 'categorias') = 'array'
           AND jsonb_array_length("conteudo" -> 'categorias') = 4
           AND jsonb_typeof("conteudo" -> 'projetos') = 'array'
           AND jsonb_array_length("conteudo" -> 'projetos') = 16),
  ADD CONSTRAINT "exp06ef1b_pacotes_midia_check"
    CHECK (jsonb_typeof("midia") = 'object'),
  ADD CONSTRAINT "exp06ef1b_pacotes_contadores_check"
    CHECK ("ia_geracoes" >= 0 AND "ia_tokens" >= 0);

ALTER TABLE "exp06ef1b_gates_turma"
  ADD CONSTRAINT "exp06ef1b_gates_turma_etapa_check"
    CHECK ("etapa" IN ('exploracao', 'galeria')),
  ADD CONSTRAINT "exp06ef1b_gates_turma_rodada_check"
    CHECK ("rodada" >= 1),
  -- O carimbo do portão é DA RODADA em andamento e anda com a etapa. Zerar e
  -- pôr outra atividade no ar o limpam no mesmo UPDATE que volta a etapa.
  ADD CONSTRAINT "exp06ef1b_gates_turma_portao_check"
    CHECK (("galeria_liberada_em" IS NOT NULL) = ("etapa" = 'galeria'));

ALTER TABLE "exp06ef1b_sessoes"
  ADD CONSTRAINT "exp06ef1b_sessoes_passo_check"
    CHECK ("passo" IN ('credencial', 'feed', 'lacrada', 'galeria', 'pacotes', 'cadeia',
                       'mariana', 'enquetes', 'fim')),
  -- `galeria` é imposto pela etapa da turma a quem está em `lacrada`
  -- (`regras/passos.ts#passoEfetivo`) — nunca gravado. Gravá-lo faria o F5 de
  -- uma rodada zerada abrir a galeria sem o professor ter liberado.
  ADD CONSTRAINT "exp06ef1b_sessoes_passo_gravado_check"
    CHECK ("passo" <> 'galeria'),
  ADD CONSTRAINT "exp06ef1b_sessoes_rodada_check"
    CHECK ("rodada" >= 1),
  ADD CONSTRAINT "exp06ef1b_sessoes_semente_check"
    CHECK (char_length("semente") BETWEEN 8 AND 64),
  ADD CONSTRAINT "exp06ef1b_sessoes_feed_check"
    CHECK (jsonb_typeof("posts_servidos") = 'array' AND jsonb_array_length("posts_servidos") <= 10
           AND jsonb_typeof("curtidos") = 'array'
           AND jsonb_typeof("permanencias") = 'array'),
  ADD CONSTRAINT "exp06ef1b_sessoes_auditoria_check"
    CHECK (jsonb_typeof("auditoria") = 'object'
           AND jsonb_typeof("auditoria" -> 'abertos') = 'array'
           AND jsonb_typeof("auditoria" -> 'buscas') = 'array'),
  ADD CONSTRAINT "exp06ef1b_sessoes_vocabulario_check"
    CHECK (("conviccao" IS NULL OR "conviccao" IN ('examinei_bem', 'vi_tudo'))
           AND ("revisao_acao" IS NULL OR "revisao_acao" IN ('manter', 'trocar'))
           AND ("voto_projeto" IS NULL OR "voto_projeto" ~ '^proj-[a-d][1-4]$')
           AND ("voto_revisado" IS NULL OR "voto_revisado" ~ '^proj-[a-d][1-4]$')
           AND ("mecanismo" IS NULL OR "mecanismo" IN ('m1', 'm2', 'm3'))
           AND ("atitude" IS NULL OR "atitude" IN ('t1', 't2'))),
  ADD CONSTRAINT "exp06ef1b_sessoes_tentativas_check"
    CHECK ("pacotes_tentativas" >= 0 AND "cadeia_tentativas" >= 0
           AND ("pacotes_remontados_em" IS NULL OR "pacotes_tentativas" >= 1)
           AND ("cadeia_montada_em" IS NULL OR "cadeia_tentativas" >= 1)),
  -- O LATCH 1 é um gesto só: projeto, convicção e carimbo juntos — e em mão
  -- dupla com o passo GRAVADO: quem votou não está na credencial nem no feed, e
  -- quem está além deles votou. Vale por STATEMENT: o service grava carimbo e
  -- passo no MESMO update.
  ADD CONSTRAINT "exp06ef1b_sessoes_voto_check"
    CHECK (("votado_em" IS NOT NULL) = ("voto_projeto" IS NOT NULL)
           AND ("votado_em" IS NOT NULL) = ("conviccao" IS NOT NULL)),
  ADD CONSTRAINT "exp06ef1b_sessoes_latch1_check"
    CHECK (("votado_em" IS NOT NULL) = ("passo" NOT IN ('credencial', 'feed'))),
  -- O LATCH 2: ação, voto final e carimbo juntos; manter repete o voto, trocar
  -- escolhe outro. E é a revisão que tira o passo gravado de `lacrada`.
  ADD CONSTRAINT "exp06ef1b_sessoes_revisao_check"
    CHECK (("revisado_em" IS NOT NULL) = ("revisao_acao" IS NOT NULL)
           AND ("revisado_em" IS NOT NULL) = ("voto_revisado" IS NOT NULL)
           AND ("revisado_em" IS NULL OR "votado_em" IS NOT NULL)
           AND ("revisao_acao" IS DISTINCT FROM 'manter' OR "voto_revisado" = "voto_projeto")
           AND ("revisao_acao" IS DISTINCT FROM 'trocar' OR "voto_revisado" <> "voto_projeto")),
  ADD CONSTRAINT "exp06ef1b_sessoes_latch2_check"
    CHECK (("revisado_em" IS NOT NULL) = ("passo" IN ('pacotes', 'cadeia', 'mariana', 'enquetes', 'fim'))),
  -- A curtida remontada é o que tira o passo de `pacotes`; a cadeia montada, de
  -- `cadeia`; os cartões, de `mariana`.
  ADD CONSTRAINT "exp06ef1b_sessoes_pacotes_check"
    CHECK (("pacotes_remontados_em" IS NOT NULL) = ("passo" IN ('cadeia', 'mariana', 'enquetes', 'fim'))),
  ADD CONSTRAINT "exp06ef1b_sessoes_cadeia_check"
    CHECK (("cadeia_montada_em" IS NOT NULL) = ("passo" IN ('mariana', 'enquetes', 'fim'))),
  ADD CONSTRAINT "exp06ef1b_sessoes_cartoes_check"
    CHECK (("cartoes_em" IS NOT NULL) = ("mecanismo" IS NOT NULL)
           AND ("cartoes_em" IS NOT NULL) = ("atitude" IS NOT NULL)
           AND ("cartoes_em" IS NOT NULL) = ("passo" IN ('enquetes', 'fim'))),
  -- Conclusão e carimbo não divergem: o hub lê `concluida_em`, a experiência lê
  -- `passo`, e uma tela dizendo "missão concluída" sobre uma linha sem carimbo
  -- é um relatório que mente.
  ADD CONSTRAINT "exp06ef1b_sessoes_fim_check"
    CHECK (("passo" = 'fim') = ("concluida_em" IS NOT NULL));

-- RLS (regra inviolável nº 1) — a mesma expressão das outras tabelas de
-- estudante. O pacote entra junto: o tema e os assuntos que um professor
-- escreveu são da escola dele, e o acervo inteiro é o que a galeria só revela
-- com o portão aberto.
ALTER TABLE "exp06ef1b_pacotes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp06ef1b_pacotes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp06ef1b_pacotes_por_escola" ON "exp06ef1b_pacotes"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp06ef1b_gates_turma" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp06ef1b_gates_turma" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp06ef1b_gates_turma_por_escola" ON "exp06ef1b_gates_turma"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp06ef1b_sessoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp06ef1b_sessoes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp06ef1b_sessoes_por_escola" ON "exp06ef1b_sessoes"
  USING (escola_id = current_setting('app.escola_id', true));

-- A role de runtime (docs/INFRA.md) conecta sem ownership e precisa de
-- privilégio nas tabelas novas. Guardado: em dev/CI a role não existe. Nenhuma
-- das três tem sequência (os ids são `gen_random_uuid()` ou a turma), então não
-- há `GRANT USAGE` de sequência a esquecer.
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    FOREACH t IN ARRAY ARRAY['exp06ef1b_pacotes', 'exp06ef1b_gates_turma', 'exp06ef1b_sessoes']
    LOOP
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_runtime', t);
    END LOOP;
  END IF;
END $$;
