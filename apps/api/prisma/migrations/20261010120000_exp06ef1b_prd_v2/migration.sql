-- exp06ef1b-prd-v2: o Júri Estadual na 0.4.0 (PRD v2, 2026-10-10).
--
-- Nenhuma coluna sai, nenhuma migração antiga muda, a RLS não afrouxa. O que
-- muda:
--
-- 1. O BANCO PADRÃO volta: a origem do pacote aceita 'padrao' além de 'ia'
--    (os dezesseis projetos do PRD, `src/juri-estadual/banco-padrao.ts`).
--
-- 2. A RODADA DE DESVIO sai (melhoria 6): a etapa `desvio` da turma e o passo
--    `desvio` deixam o vocabulário. Os gates que estavam no desvio voltam à
--    `galeria` (o portão dela continua aberto) e perdem o carimbo do desvio.
--    As colunas `desvio_*`, a justificativa (`voto_motivo`, `voto_trecho`,
--    `revisao_*`) e o `complemento_projeto` FICAM, sem uso — e os CHECKs que
--    as amarram continuam valendo para as linhas antigas. A equivalência
--    "desvio concluído ⇔ passo ≥ cadeia" cai: a cadeia agora vem direto da
--    revisão (`POST passo` com `para: cadeia`).
--
-- 3. A TELEMETRIA DOCENTE (PRD §13, EVT-P01..P05): no pacote, quando o preparo
--    começou, quem aprovou e quando, e as leituras do painel; e a tabela
--    `exp06ef1b_gates_historico` (uma linha por etapa liberada).
--
-- 4. Na sessão (PRD §11.1): o relógio do feed (`feed_iniciado_em`, os 8 min
--    contados desde a 1ª rolagem, melhoria 9), o batimento da cédula aberta
--    (`cedula_batimento_em`, `cedula_inativa_desde`, o sinalizador de ociosos,
--    melhoria 8), os status das três ações (`*_status`) e as alternativas das
--    enquetes (`enquete_*_alt`).
--
-- Os CHECKs recriados usam o MESMO texto de `src/juri-estadual/regras/passos.ts`
-- e de `vocabulario.ts`, que `tests/juri-estadual-postgres.spec.ts` compara.

-- ── as colunas ──────────────────────────────────────────────────────────────

ALTER TABLE "exp06ef1b_pacotes"
  ADD COLUMN "preparo_iniciado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "aprovado_em"         TIMESTAMPTZ(6),
  ADD COLUMN "aprovado_por"        TEXT,
  ADD COLUMN "painel_visto_em"     TIMESTAMPTZ(6),
  ADD COLUMN "painel_vistas"       INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "exp06ef1b_sessoes"
  ADD COLUMN "feed_iniciado_em"     TIMESTAMPTZ(6),
  ADD COLUMN "cedula_batimento_em"  TIMESTAMPTZ(6),
  ADD COLUMN "cedula_inativa_desde" TIMESTAMPTZ(6),
  ADD COLUMN "auditoria_status"     VARCHAR(16),
  ADD COLUMN "classificacao_status" VARCHAR(16),
  ADD COLUMN "logica_status"        VARCHAR(16),
  ADD COLUMN "enquete_ef06co10_alt" VARCHAR(64),
  ADD COLUMN "enquete_ef06co01_alt" VARCHAR(64),
  ADD COLUMN "enquete_ef06co03_alt" VARCHAR(64);

-- ── as linhas que já existem ────────────────────────────────────────────────
-- Sem NO FORCE ROW LEVEL SECURITY os UPDATEs casariam zero linhas: a migração
-- roda sem app.escola_id e o FORCE barra até o owner (como em 20261007120000).

ALTER TABLE "exp06ef1b_pacotes" NO FORCE ROW LEVEL SECURITY;
-- Os pacotes de antes foram homologados ao nascer: o preparo e a aprovação
-- ficam com o carimbo da criação.
UPDATE "exp06ef1b_pacotes"
   SET "preparo_iniciado_em" = "criado_em",
       "aprovado_em" = "criado_em",
       "aprovado_por" = "criado_por"::text;
ALTER TABLE "exp06ef1b_pacotes" FORCE ROW LEVEL SECURITY;

ALTER TABLE "exp06ef1b_gates_turma" NO FORCE ROW LEVEL SECURITY;
UPDATE "exp06ef1b_gates_turma"
   SET "etapa" = 'galeria', "desvio_liberado_em" = NULL, "atualizado_em" = now()
 WHERE "etapa" = 'desvio';
ALTER TABLE "exp06ef1b_gates_turma" FORCE ROW LEVEL SECURITY;

-- ── o pacote: a origem ──────────────────────────────────────────────────────

ALTER TABLE "exp06ef1b_pacotes" DROP CONSTRAINT "exp06ef1b_pacotes_origem_check";
ALTER TABLE "exp06ef1b_pacotes"
  ADD CONSTRAINT "exp06ef1b_pacotes_origem_check" CHECK ("origem" IN ('ia', 'padrao')),
  ADD CONSTRAINT "exp06ef1b_pacotes_painel_check" CHECK ("painel_vistas" >= 0);

-- ── a turma: as etapas sem o desvio ─────────────────────────────────────────

ALTER TABLE "exp06ef1b_gates_turma"
  DROP CONSTRAINT "exp06ef1b_gates_turma_etapa_check",
  DROP CONSTRAINT "exp06ef1b_gates_turma_portao_check";

ALTER TABLE "exp06ef1b_gates_turma"
  ADD CONSTRAINT "exp06ef1b_gates_turma_etapa_check"
    CHECK ("etapa" IN ('exploracao', 'galeria')),
  -- O portão da galeria anda com a etapa; o do desvio não abre mais.
  ADD CONSTRAINT "exp06ef1b_gates_turma_portao_check"
    CHECK (("galeria_liberada_em" IS NOT NULL) = ("etapa" = 'galeria')
           AND "desvio_liberado_em" IS NULL);

-- ── a sessão: os passos sem o desvio, e as colunas novas ────────────────────

ALTER TABLE "exp06ef1b_sessoes"
  DROP CONSTRAINT "exp06ef1b_sessoes_passo_check",
  DROP CONSTRAINT "exp06ef1b_sessoes_passo_gravado_check",
  DROP CONSTRAINT "exp06ef1b_sessoes_desvio_check";

ALTER TABLE "exp06ef1b_sessoes"
  ADD CONSTRAINT "exp06ef1b_sessoes_passo_check"
    CHECK ("passo" IN ('credencial', 'feed', 'lacrada', 'galeria', 'revisada', 'cadeia', 'mariana', 'enquetes', 'fim')),
  -- `galeria` é imposta pela etapa da turma a quem está em `lacrada`
  -- (`regras/passos.ts#passoEfetivo`) — nunca gravada.
  ADD CONSTRAINT "exp06ef1b_sessoes_passo_gravado_check"
    CHECK ("passo" <> 'galeria'),
  -- O desvio concluído das sessões da 0.3.0 só existe depois da revisão.
  ADD CONSTRAINT "exp06ef1b_sessoes_desvio_check"
    CHECK ("desvio_concluido_em" IS NULL OR "revisado_em" IS NOT NULL),
  -- Os status das três ações: o vocabulário da evidência (E14), ou nulo (sem marca).
  ADD CONSTRAINT "exp06ef1b_sessoes_status_check"
    CHECK (("auditoria_status" IS NULL OR "auditoria_status" IN ('atingiu', 'em_processo', 'nao_atingiu'))
           AND ("classificacao_status" IS NULL OR "classificacao_status" IN ('atingiu', 'em_processo', 'nao_atingiu'))
           AND ("logica_status" IS NULL OR "logica_status" IN ('atingiu', 'em_processo', 'nao_atingiu'))
           AND ("auditoria_status" IS NULL OR "revisado_em" IS NOT NULL)
           AND ("classificacao_status" IS NULL OR "revisado_em" IS NOT NULL)
           AND ("logica_status" IS NULL OR "cadeia_montada_em" IS NOT NULL)),
  -- O batimento da cédula é um par, e só existe antes do voto.
  ADD CONSTRAINT "exp06ef1b_sessoes_cedula_check"
    CHECK (("cedula_batimento_em" IS NULL) = ("cedula_inativa_desde" IS NULL)
           AND ("cedula_batimento_em" IS NULL OR "votado_em" IS NULL));

-- ── o histórico do gate (EVT-P05) ───────────────────────────────────────────

CREATE TABLE "exp06ef1b_gates_historico" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "turma_id" UUID NOT NULL,
    "escola_id" TEXT NOT NULL,
    "etapa" TEXT NOT NULL,
    "liberada_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp06ef1b_gates_historico_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "exp06ef1b_gates_historico_escola_turma_idx" ON "exp06ef1b_gates_historico"("escola_id", "turma_id");

ALTER TABLE "exp06ef1b_gates_historico" ADD CONSTRAINT "exp06ef1b_gates_historico_turma_id_fkey"
  FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "exp06ef1b_gates_historico"
  ADD CONSTRAINT "exp06ef1b_gates_historico_etapa_check" CHECK ("etapa" IN ('exploracao', 'galeria'));

-- RLS (regra inviolável nº 1), a mesma expressão das outras tabelas da missão.
ALTER TABLE "exp06ef1b_gates_historico" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp06ef1b_gates_historico" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp06ef1b_gates_historico_por_escola" ON "exp06ef1b_gates_historico"
  USING (escola_id = current_setting('app.escola_id', true));

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "exp06ef1b_gates_historico" TO app_runtime';
  END IF;
END $$;
