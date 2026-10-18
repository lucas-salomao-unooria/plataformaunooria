-- exp02em1b-canal-a: o Canal A da Missão Tempestade (ADR-172).
--
-- 1. `exp02em1b_tarefas` — as sete tarefas por ação: a leitura dos dados
--    (EM13CO12), as fontes (EM13CO14) e o alerta (EM13CO24) no registro da
--    operação; a ligação da Saúde (EM13CO26) na investigação; o "E se…"
--    (EM13CO11) no resultado; o WhatsApp (EM13CO08) e a moradora (EM13CO26) no
--    fechamento. Uma linha por (sessão, rodada da turma, tentativa, tarefa),
--    criada com a APRESENTAÇÃO que o servidor montou (os pares, os cartões, as
--    comparações, a ordem das opções) e completada no envio. Só ids de escolha
--    fechada: nenhum texto livre. Sai com a sessão (cascata), e o "Zerar a
--    turma" apaga as sessões.
-- 2. `exp02em1b_sessoes` ganha `registro_concluido_em` (o desfecho fica retido
--    até o registro), `oferta_saude_em` (quando a ligação apareceu) e
--    `inicio_com_relogio_aberto` (gravado ao entrar na investigação: a
--    tentativa que começou com o relógio fechado não marca a leitura nem as
--    fontes).
-- 3. `exp02em1b_relogio_turma.fechamento_aberto_em` — o professor abre o
--    fechamento. O "Zerar a turma" apaga o relógio e, com ele, o fechamento.
--
-- A tabela nova tem `escola_id NOT NULL` e RLS FORCE com a política por
-- escola, no padrão das `exp02em1b_*`. As colunas novas herdam a RLS das
-- tabelas delas.

ALTER TABLE "exp02em1b_sessoes" ADD COLUMN "registro_concluido_em" TIMESTAMPTZ(6);
ALTER TABLE "exp02em1b_sessoes" ADD COLUMN "oferta_saude_em" TIMESTAMPTZ(6);
ALTER TABLE "exp02em1b_sessoes" ADD COLUMN "inicio_com_relogio_aberto" BOOLEAN;
ALTER TABLE "exp02em1b_relogio_turma" ADD COLUMN "fechamento_aberto_em" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "exp02em1b_tarefas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "estudante_id" UUID NOT NULL,
    "rodada" INTEGER NOT NULL,
    "tentativa" SMALLINT NOT NULL,
    "tarefa" TEXT NOT NULL,
    "apresentacao" JSONB NOT NULL,
    "respostas" JSONB,
    "enviada_em" TIMESTAMPTZ(6),
    "criada_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp02em1b_tarefas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "exp02em1b_tarefas_escola_id_idx" ON "exp02em1b_tarefas"("escola_id");
CREATE UNIQUE INDEX "exp02em1b_tarefas_unica"
  ON "exp02em1b_tarefas"("escola_id", "estudante_id", "rodada", "tentativa", "tarefa");

ALTER TABLE "exp02em1b_tarefas" ADD CONSTRAINT "exp02em1b_tarefas_escola_id_estudante_id_fkey"
  FOREIGN KEY ("escola_id", "estudante_id") REFERENCES "exp02em1b_sessoes"("escola_id", "estudante_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
-- Bloco MANUAL. O Prisma não gera CHECK, RLS nem GRANT.

-- O vocabulário: o MESMO de `unoogpt/regras/canal-a.ts#TAREFAS`, que
-- `tests/unoogpt-canal-a-postgres.spec.ts` compara.
ALTER TABLE "exp02em1b_tarefas" ADD CONSTRAINT "exp02em1b_tarefas_tarefa_check"
  CHECK ("tarefa" IN ('leitura', 'fontes', 'alerta', 'saude', 'e-se', 'whatsapp', 'moradora'));
-- Respondida ⇔ com data de envio.
ALTER TABLE "exp02em1b_tarefas" ADD CONSTRAINT "exp02em1b_tarefas_envio_check"
  CHECK (("respostas" IS NULL) = ("enviada_em" IS NULL));
ALTER TABLE "exp02em1b_tarefas" ADD CONSTRAINT "exp02em1b_tarefas_rodada_check"
  CHECK ("rodada" >= 1 AND "tentativa" >= 1);

ALTER TABLE "exp02em1b_tarefas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp02em1b_tarefas" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp02em1b_tarefas_por_escola" ON "exp02em1b_tarefas"
  USING (escola_id = current_setting('app.escola_id', true));

-- A role de runtime (docs/INFRA.md) conecta sem ownership. Guardado: em dev/CI
-- a role não existe. O id é `gen_random_uuid()`: não há sequência.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "exp02em1b_tarefas" TO app_runtime;
  END IF;
END $$;
