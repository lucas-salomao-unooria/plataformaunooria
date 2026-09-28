-- EVIDÊNCIA PEDAGÓGICA: que habilidades da BNCC cada estudante demonstrou numa
-- atividade de uma missão, rodada a rodada (E14).
--
-- A missão já via o que a criança fazia — tirou o post do ar, respondeu a
-- pergunta —, e isso morria dentro da experiência. O professor não tinha como
-- dizer, no fim do bimestre, "a Ana atingiu a EF08CO05 e o Caio ainda está em
-- processo". Estas três tabelas guardam isso, e separam o DADO BRUTO da
-- missão da EVIDÊNCIA que o professor lê e pode corrigir:
--
--   evidencias_marcas   o que a missão viu: uma linha por marcador da ficha
--                       (uma ação, ou a resposta de uma pergunta), por
--                       estudante, atividade e rodada.
--   evidencias          a evidência por HABILIDADE: a melhor marca, a cópia da
--                       equipe, ou o ajuste do professor — com a origem e a
--                       situação (`a_revisar` até o professor confirmar a
--                       projeção).
--   evidencias_eventos  o histórico APPEND-ONLY de toda mudança, com de/para,
--                       quem e quando.
--
-- Molde: 20260925120000_equipes_na_missao.

-- CreateTable
CREATE TABLE "evidencias_marcas" (
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "exp_id" TEXT NOT NULL,
    "atividade_id" TEXT NOT NULL,
    "rodada" INTEGER NOT NULL,
    "estudante_id" UUID NOT NULL,
    "habilidade" TEXT NOT NULL,
    "marcador" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "versao_ficha" INTEGER NOT NULL,
    "registrada_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidencias_marcas_pkey" PRIMARY KEY ("escola_id","exp_id","atividade_id","rodada","estudante_id","marcador")
);

-- CreateTable
CREATE TABLE "evidencias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "exp_id" TEXT NOT NULL,
    "atividade_id" TEXT NOT NULL,
    "rodada" INTEGER NOT NULL,
    "estudante_id" UUID NOT NULL,
    "habilidade" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "situacao" TEXT NOT NULL,
    "fonte_estudante_id" UUID,
    "equipe_id" UUID,
    "editado_por" UUID,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidencias_eventos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "exp_id" TEXT NOT NULL,
    "atividade_id" TEXT NOT NULL,
    "rodada" INTEGER NOT NULL,
    "estudante_id" UUID,
    "habilidade" TEXT,
    "tipo" TEXT NOT NULL,
    "de" JSONB,
    "para" JSONB,
    "autor_id" UUID,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidencias_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- A RODADA EM ANDAMENTO da turma × missão é a da marca mais recente: é ela que
-- as equipes recalculam quando mudam, e este índice é o que a encontra.
CREATE INDEX "evidencias_marcas_escola_id_turma_id_exp_id_registrada_em_idx" ON "evidencias_marcas"("escola_id", "turma_id", "exp_id", "registrada_em");

-- CreateIndex
-- O painel do professor: a turma, a missão e a atividade, todas as rodadas.
CREATE INDEX "evidencias_escola_id_turma_id_exp_id_atividade_id_rodada_idx" ON "evidencias"("escola_id", "turma_id", "exp_id", "atividade_id", "rodada");

-- CreateIndex
-- O perfil do estudante: todas as missões dele, de uma vez.
CREATE INDEX "evidencias_escola_id_estudante_id_idx" ON "evidencias"("escola_id", "estudante_id");

-- CreateIndex
-- UMA evidência por habilidade, por estudante, por rodada. O nome é o que o
-- Prisma gera (truncado em 63 caracteres) — trocá-lo faria o `migrate diff`
-- acusar um índice a renomear.
CREATE UNIQUE INDEX "evidencias_escola_id_exp_id_atividade_id_rodada_estudante_i_key" ON "evidencias"("escola_id", "exp_id", "atividade_id", "rodada", "estudante_id", "habilidade");

-- CreateIndex
CREATE INDEX "evidencias_eventos_escola_id_turma_id_exp_id_atividade_id_r_idx" ON "evidencias_eventos"("escola_id", "turma_id", "exp_id", "atividade_id", "rodada");

-- CreateIndex
CREATE INDEX "evidencias_eventos_escola_id_estudante_id_idx" ON "evidencias_eventos"("escola_id", "estudante_id");

-- AddForeignKey
ALTER TABLE "evidencias_marcas" ADD CONSTRAINT "evidencias_marcas_turma_id_fkey"
  FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidencias" ADD CONSTRAINT "evidencias_turma_id_fkey"
  FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidencias_eventos" ADD CONSTRAINT "evidencias_eventos_turma_id_fkey"
  FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- O `estudante_id` aponta para `users` nas três: é a trava da IDENTIDADE ÚNICA
-- (`tests/identidade-unica.spec.ts` — toda coluna de pessoa tem FK). Cascata,
-- porque a evidência é dado da criança e sai com ela. No histórico, cascata e
-- não `SET NULL`: anular seria um `UPDATE`, que o trigger abaixo recusa, e a
-- saída da criança travaria.
ALTER TABLE "evidencias_marcas" ADD CONSTRAINT "evidencias_marcas_estudante_id_fkey"
  FOREIGN KEY ("estudante_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidencias" ADD CONSTRAINT "evidencias_estudante_id_fkey"
  FOREIGN KEY ("estudante_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidencias_eventos" ADD CONSTRAINT "evidencias_eventos_estudante_id_fkey"
  FOREIGN KEY ("estudante_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------- bloco MANUAL

-- O VOCABULÁRIO vive em dois lugares: aqui e em `evidencias/regras.ts`
-- (`STATUS_DE_MARCA`, `STATUS`, `ORIGENS`, `SITUACOES`, `TIPOS_DE_MARCADOR`,
-- `TIPOS_DE_EVENTO`, `ATIVIDADE_ID_RE`). É o par que já custou um deploy em
-- `permissoes` — o Zod aceita, o banco recusa, e o 500 só aparece no log da
-- api. `tests/evidencias-postgres.spec.ts` compara os dois.

-- A MARCA só tem os três níveis: "não participou" é decisão do professor, e
-- nunca o que a missão viu.
ALTER TABLE "evidencias_marcas"
  ADD CONSTRAINT "evidencias_marcas_status_check"
    CHECK ("status" IN ('atingiu', 'em_processo', 'nao_atingiu'));

ALTER TABLE "evidencias_marcas"
  ADD CONSTRAINT "evidencias_marcas_tipo_check"
    CHECK ("tipo" IN ('acao', 'multipla_escolha'));

-- A primeira rodada é a 1. Zero ou negativo é um reinício contado errado na
-- missão, e o painel mostraria uma coluna "Rodada 0" que ninguém sabe ler.
ALTER TABLE "evidencias_marcas"
  ADD CONSTRAINT "evidencias_marcas_rodada_check" CHECK ("rodada" >= 1);

ALTER TABLE "evidencias_marcas"
  ADD CONSTRAINT "evidencias_marcas_versao_ficha_check" CHECK ("versao_ficha" >= 1);

-- O id da atividade é da MISSÃO e é opaco aqui — mas vai para o endereço da
-- rota do painel, então só caracteres que dispensam escape.
ALTER TABLE "evidencias_marcas"
  ADD CONSTRAINT "evidencias_marcas_atividade_id_check"
    CHECK ("atividade_id" ~ '^[A-Za-z0-9_.:-]{1,100}$');

ALTER TABLE "evidencias"
  ADD CONSTRAINT "evidencias_status_check"
    CHECK ("status" IN ('atingiu', 'em_processo', 'nao_atingiu', 'nao_participou'));

ALTER TABLE "evidencias"
  ADD CONSTRAINT "evidencias_origem_check"
    CHECK ("origem" IN ('propria', 'equipe', 'projecao', 'professor'));

ALTER TABLE "evidencias"
  ADD CONSTRAINT "evidencias_situacao_check"
    CHECK ("situacao" IN ('valida', 'a_revisar'));

ALTER TABLE "evidencias"
  ADD CONSTRAINT "evidencias_rodada_check" CHECK ("rodada" >= 1);

ALTER TABLE "evidencias"
  ADD CONSTRAINT "evidencias_atividade_id_check"
    CHECK ("atividade_id" ~ '^[A-Za-z0-9_.:-]{1,100}$');

-- A COERÊNCIA entre as colunas, cobrada pelo banco e não só pelo código — é o
-- que impede um ajuste mal escrito de produzir uma linha que o painel não sabe
-- mostrar:
--   * só a PROJEÇÃO espera revisão (a cópia da turma inteira não conta até o
--     professor confirmar; a própria, a da equipe e o ajuste já valem);
--   * a cópia diz de quem veio, e só a cópia;
--   * o ajuste diz quem ajustou, e só o ajuste;
--   * "não participou" é decisão do professor, nunca da missão nem da equipe.
ALTER TABLE "evidencias"
  ADD CONSTRAINT "evidencias_a_revisar_check"
    CHECK ("situacao" = 'valida' OR "origem" = 'projecao');

ALTER TABLE "evidencias"
  ADD CONSTRAINT "evidencias_fonte_check"
    CHECK (("origem" IN ('equipe', 'projecao')) = ("fonte_estudante_id" IS NOT NULL));

ALTER TABLE "evidencias"
  ADD CONSTRAINT "evidencias_editado_por_check"
    CHECK (("origem" = 'professor') = ("editado_por" IS NOT NULL));

ALTER TABLE "evidencias"
  ADD CONSTRAINT "evidencias_nao_participou_check"
    CHECK ("status" <> 'nao_participou' OR "origem" = 'professor');

ALTER TABLE "evidencias_eventos"
  ADD CONSTRAINT "evidencias_eventos_tipo_check"
    CHECK ("tipo" IN ('marca', 'copia', 'recalculo', 'confirmacao', 'ajuste'));

ALTER TABLE "evidencias_eventos"
  ADD CONSTRAINT "evidencias_eventos_rodada_check" CHECK ("rodada" >= 1);

ALTER TABLE "evidencias_eventos"
  ADD CONSTRAINT "evidencias_eventos_atividade_id_check"
    CHECK ("atividade_id" ~ '^[A-Za-z0-9_.:-]{1,100}$');

/*
 * O HISTÓRICO É APPEND-ONLY DE VERDADE: `UPDATE` é recusado pelo banco, para
 * qualquer role — a dona das tabelas inclusive.
 *
 * Mesmo desenho de `recursos_auditoria` (20260910120000): sem isto,
 * "append-only" seria promessa do código, e a promessa que o banco não cobra é
 * a que a próxima rotina de correção quebra. Reescrever um evento é o único
 * jeito de o histórico mentir sobre quem mudou a evidência de uma criança.
 *
 * `DELETE` fica fora do trigger, pelas mesmas duas razões de lá: a RETENÇÃO
 * (quando houver prazo, quem o cumprir precisa apagar) e o ISOLAMENTO DE TESTE.
 * E a cascata da turma precisa dele. Quem não apaga é a role de RUNTIME: ela
 * recebe só `SELECT, INSERT` aqui embaixo — a api nunca apaga um evento.
 */
CREATE OR REPLACE FUNCTION evidencias_eventos_nao_reescreve() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'evidencias_eventos é append-only: UPDATE não é permitido (id %)', OLD."id";
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER evidencias_eventos_sem_update
  BEFORE UPDATE ON "evidencias_eventos"
  FOR EACH ROW EXECUTE FUNCTION evidencias_eventos_nao_reescreve();

-- **NÃO há FK de `exp_id` para `experiencias`** (catálogo vazio em dev), como
-- em `liberacoes` e `equipes_montagens`; nem de `equipe_id`,
-- `fonte_estudante_id`, `editado_por` e `autor_id` para `equipes`/`users`: as
-- equipes são trocadas INTEIRAS a cada `PUT` (ADR-111), e o carimbo de quem
-- ajustou (ou de quem a cópia veio) não pode travar a saída de ninguém da rede.

-- RLS (regra inviolável nº 1). As três carregam `escola_id` e id de criança:
-- entram na política como qualquer tabela de dado de estudante.
ALTER TABLE "evidencias_marcas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evidencias_marcas" FORCE ROW LEVEL SECURITY;
CREATE POLICY "evidencias_marcas_por_escola" ON "evidencias_marcas"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "evidencias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evidencias" FORCE ROW LEVEL SECURITY;
CREATE POLICY "evidencias_por_escola" ON "evidencias"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "evidencias_eventos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evidencias_eventos" FORCE ROW LEVEL SECURITY;
CREATE POLICY "evidencias_eventos_por_escola" ON "evidencias_eventos"
  USING (escola_id = current_setting('app.escola_id', true));

-- A role de runtime (docs/INFRA.md) conecta sem ownership e precisa de
-- privilégio nas tabelas novas. Guardado: em dev/CI a role não existe. O
-- histórico recebe só `SELECT, INSERT` — a api acrescenta, nunca reescreve nem
-- apaga.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON evidencias_marcas, evidencias TO app_runtime';
    EXECUTE 'GRANT SELECT, INSERT ON evidencias_eventos TO app_runtime';
  END IF;
END $$;
