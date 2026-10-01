-- A EQUIPE É DA ATIVIDADE (ADR-130), e não mais da turma × missão (ADR-111).
--
-- A missão é o esqueleto narrativo; a ATIVIDADE é a missão que a turma faz de
-- fato — e é na criação dela que o professor diz quantos computadores a sala
-- tem e quem senta com quem. Duas atividades da mesma missão na mesma turma
-- (uma por conteúdo) são duas aulas, em dias diferentes, com o laboratório
-- dividido de jeitos diferentes: uma montagem só por turma × missão fazia a
-- segunda aula herdar, em silêncio, as equipes da primeira.
--
-- O que muda:
--   1. `atividade_id` nas três tabelas, e na chave. Texto OPACO, o mesmo
--      alfabeto de `evidencias_marcas.atividade_id` (a evidência já era por
--      atividade): cada missão é DONA das próprias atividades — a cobertura da
--      exp07ef1b, o pacote da exp04ef1b e da exp05ef1b, a `activity` da
--      exp08ef1b —, e uma FK para quatro tabelas diferentes não existe. A
--      missão sem atividade (o unooGPT, até ser refeito, e o UnooTube
--      arquivado) usa o id fixo `turma`: uma montagem por turma, como antes.
--   2. A turma FICA na chave: a atividade é de uma turma só, e a RLS, a FK
--      para `turmas` e os índices por turma continuam como estão.
--   3. O modo `individual` — "um aluno por computador". Ele GRAVA a montagem
--      (é a resposta do passo de equipes da criação) e não grava equipe
--      nenhuma; `computadores` fica NULO, porque o número de máquinas é o
--      número de crianças e não é dito.
--
-- As montagens que já existem (dev e hml: produção é novembro) vão para a
-- atividade EM ANDAMENTO da turma naquela missão; a que não tem atividade em
-- andamento sai — não há a que aula ela pertence.

-- ------------------------------------------------------------- 1. a coluna

ALTER TABLE "equipes_montagens" ADD COLUMN "atividade_id" TEXT;
ALTER TABLE "equipes" ADD COLUMN "atividade_id" TEXT;
ALTER TABLE "equipes_membros" ADD COLUMN "atividade_id" TEXT;

-- ------------------------------------------------- 2. as montagens de hoje

-- As três tabelas têm FORCE ROW LEVEL SECURITY, que vale também para o DONO —
-- e sem `app.escola_id` armado a política esconde todas as linhas: o UPDATE
-- abaixo rodaria sobre nada, sem erro. Mesmo desenho de
-- `20260926120000_arquivar_unootube`: tira o FORCE, migra, devolve.
ALTER TABLE "equipes_montagens" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "equipes" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "equipes_membros" NO FORCE ROW LEVEL SECURITY;

-- A Seleção e o Jornal: o gate da turma aponta a atividade em andamento.
UPDATE "equipes_montagens" m SET "atividade_id" = g."cobertura_id"::text
  FROM "exp07ef1b_gates_turma" g
  WHERE m."exp_id" = 'exp07ef1b' AND g."escola_id" = m."escola_id" AND g."turma_id" = m."turma_id";

UPDATE "equipes_montagens" m SET "atividade_id" = g."pacote_id"::text
  FROM "exp04ef1b_gates_turma" g
  WHERE m."exp_id" = 'exp04ef1b' AND g."escola_id" = m."escola_id" AND g."turma_id" = m."turma_id";

-- Quem Mandou Isso?: o pacote ativo da turma (o gate dela não guarda pacote).
UPDATE "equipes_montagens" m SET "atividade_id" = p."id"::text
  FROM "exp05ef1b_pacotes" p
  WHERE m."exp_id" = 'exp05ef1b' AND p."escola_id" = m."escola_id" AND p."turma_id" = m."turma_id"
    AND p."ativo";

-- Instanooria: a atividade ativa DESTA turma, a mais recente se houver mais de uma.
UPDATE "equipes_montagens" m SET "atividade_id" = (
    SELECT a."id"::text FROM "exp08ef1b_activities" a
    WHERE a."escola_id" = m."escola_id" AND a."turma_id" = m."turma_id" AND a."status" = 'ativa'
    ORDER BY a."created_at" DESC LIMIT 1
  )
  WHERE m."exp_id" = 'exp08ef1b';

-- A missão sem atividade: uma montagem por turma, com o id fixo.
UPDATE "equipes_montagens" SET "atividade_id" = 'turma'
  WHERE "exp_id" IN ('exp02em1b', 'backup-exp04ef1b');

-- Sem atividade em andamento, não há aula a que a montagem pertença. As
-- equipes e os membros caem pela FK em cascata.
DELETE FROM "equipes_montagens" WHERE "atividade_id" IS NULL;

UPDATE "equipes" e SET "atividade_id" = m."atividade_id"
  FROM "equipes_montagens" m
  WHERE e."escola_id" = m."escola_id" AND e."turma_id" = m."turma_id" AND e."exp_id" = m."exp_id";

UPDATE "equipes_membros" em SET "atividade_id" = e."atividade_id"
  FROM "equipes" e
  WHERE em."equipe_id" = e."id";

ALTER TABLE "equipes_montagens" FORCE ROW LEVEL SECURITY;
ALTER TABLE "equipes" FORCE ROW LEVEL SECURITY;
ALTER TABLE "equipes_membros" FORCE ROW LEVEL SECURITY;

ALTER TABLE "equipes_montagens" ALTER COLUMN "atividade_id" SET NOT NULL;
ALTER TABLE "equipes" ALTER COLUMN "atividade_id" SET NOT NULL;
ALTER TABLE "equipes_membros" ALTER COLUMN "atividade_id" SET NOT NULL;

-- ------------------------------------------------------- 3. a chave nova

ALTER TABLE "equipes" DROP CONSTRAINT "equipes_escola_id_turma_id_exp_id_fkey";
ALTER TABLE "equipes_montagens" DROP CONSTRAINT "equipes_montagens_pkey";
ALTER TABLE "equipes_montagens" ADD CONSTRAINT "equipes_montagens_pkey"
  PRIMARY KEY ("escola_id", "turma_id", "exp_id", "atividade_id");

ALTER TABLE "equipes" ADD CONSTRAINT "equipes_escola_id_turma_id_exp_id_atividade_id_fkey"
  FOREIGN KEY ("escola_id", "turma_id", "exp_id", "atividade_id")
  REFERENCES "equipes_montagens"("escola_id", "turma_id", "exp_id", "atividade_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX "equipes_escola_id_turma_id_exp_id_idx";
CREATE INDEX "equipes_escola_id_turma_id_exp_id_atividade_id_idx"
  ON "equipes"("escola_id", "turma_id", "exp_id", "atividade_id");

DROP INDEX "equipes_escola_id_turma_id_exp_id_nome_key";
CREATE UNIQUE INDEX "equipes_escola_id_turma_id_exp_id_atividade_id_nome_key"
  ON "equipes"("escola_id", "turma_id", "exp_id", "atividade_id", "nome");

-- UMA CRIANÇA, UMA EQUIPE POR ATIVIDADE. Era por missão; numa missão com duas
-- atividades na turma, a criança está numa equipe em cada uma.
DROP INDEX "equipes_membros_escola_id_turma_id_exp_id_estudante_id_key";
-- O nome é o que o Prisma gera: passa de 63 caracteres, e o Postgres cortaria o
-- FIM enquanto o Prisma corta o MEIO — o drift da ADR-110.
CREATE UNIQUE INDEX "equipes_membros_escola_id_turma_id_exp_id_atividade_id_estu_key"
  ON "equipes_membros"("escola_id", "turma_id", "exp_id", "atividade_id", "estudante_id");

-- --------------------------------------------------------- 4. os CHECKs

-- O alfabeto do id da atividade, o MESMO de `evidencias_marcas` e de
-- `equipes/regras.ts#ATIVIDADE_ID_RE`.
ALTER TABLE "equipes_montagens"
  ADD CONSTRAINT "equipes_montagens_atividade_id_check"
    CHECK ("atividade_id" ~ '^[A-Za-z0-9_.:-]{1,100}$');

-- O terceiro modo. O vocabulário continua em dois lugares (aqui e
-- `regras.ts#MODOS`), e o teste de Postgres continua comparando os dois.
ALTER TABLE "equipes_montagens" DROP CONSTRAINT "equipes_montagens_modo_check";
ALTER TABLE "equipes_montagens"
  ADD CONSTRAINT "equipes_montagens_modo_check"
    CHECK ("modo" IN ('sorteio', 'manual', 'individual'));

-- `individual` não diz quantos computadores: são tantos quantas crianças. Os
-- outros dois modos continuam exigindo ao menos um.
--
-- O `IS NOT NULL` explícito NÃO é redundante: com `computadores` nulo,
-- `"computadores" >= 1` dá NULL, a expressão inteira dá NULL — e um CHECK que
-- dá NULL PASSA. Sem ele, um `manual` sem computadores entrava no banco.
ALTER TABLE "equipes_montagens" ALTER COLUMN "computadores" DROP NOT NULL;
ALTER TABLE "equipes_montagens" DROP CONSTRAINT "equipes_montagens_computadores_check";
ALTER TABLE "equipes_montagens"
  ADD CONSTRAINT "equipes_montagens_computadores_check"
    CHECK (
      ("modo" = 'individual' AND "computadores" IS NULL)
      OR ("modo" <> 'individual' AND "computadores" IS NOT NULL AND "computadores" >= 1)
    );
