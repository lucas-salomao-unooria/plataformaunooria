-- EQUIPES NA MISSÃO: quem divide UM computador numa missão (E13, ADR-111).
--
-- A escola pública tem menos máquinas que crianças. Na sala real, dois ou três
-- estudantes sentam diante da mesma tela e fazem a missão juntos, com o login
-- de um deles — e a plataforma não sabia disso: o painel do professor contava
-- a sala como se cada criança tivesse o próprio computador, e dizia "12 não
-- começaram" quando os 12 estavam sentados ao lado de quem começou.
--
-- Estas três tabelas dizem QUEM ESTÁ COM QUEM, por turma × missão. Elas não
-- mudam a porta da sala (a liberação continua sendo por turma, ADR-69) nem o
-- dado da experiência: cada criança continua com a própria linha lá. O que
-- muda é a LEITURA — o painel passa a poder contar por computador.
--
-- Três tabelas, e não uma coluna `equipe` em algum lugar:
--   equipes_montagens  a decisão da aula: quantos computadores, sorteio ou
--                      manual, quem faltou — e a `versao` da concorrência
--                      otimista (o computador da sala e o celular do professor
--                      salvando ao mesmo tempo não podem se sobrescrever).
--   equipes            cada computador, com nome e ordem.
--   equipes_membros    quem senta diante de cada um.
--
-- Molde: 20260905120000_liberacoes_por_turma.

-- CreateTable
CREATE TABLE "equipes_montagens" (
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "exp_id" TEXT NOT NULL,
    "modo" TEXT NOT NULL,
    "computadores" INTEGER NOT NULL,
    "ausentes" UUID[] DEFAULT ARRAY[]::UUID[],
    "versao" INTEGER NOT NULL DEFAULT 1,
    "atualizado_por" UUID NOT NULL,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipes_montagens_pkey" PRIMARY KEY ("escola_id","turma_id","exp_id")
);

-- CreateTable
CREATE TABLE "equipes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "exp_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "equipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipes_membros" (
    "escola_id" TEXT NOT NULL,
    "equipe_id" UUID NOT NULL,
    "turma_id" UUID NOT NULL,
    "exp_id" TEXT NOT NULL,
    "estudante_id" UUID NOT NULL,

    CONSTRAINT "equipes_membros_pkey" PRIMARY KEY ("equipe_id","estudante_id")
);

-- CreateIndex
CREATE INDEX "equipes_montagens_escola_id_turma_id_idx" ON "equipes_montagens"("escola_id", "turma_id");

-- CreateIndex
CREATE INDEX "equipes_escola_id_turma_id_exp_id_idx" ON "equipes"("escola_id", "turma_id", "exp_id");

-- CreateIndex
CREATE UNIQUE INDEX "equipes_escola_id_turma_id_exp_id_nome_key"
  ON "equipes"("escola_id", "turma_id", "exp_id", "nome");

-- CreateIndex
CREATE INDEX "equipes_membros_escola_id_estudante_id_idx" ON "equipes_membros"("escola_id", "estudante_id");

-- CreateIndex
-- UMA CRIANÇA, UMA EQUIPE POR MISSÃO. É por este índice que `turma_id` e
-- `exp_id` se repetem em `equipes_membros`: sem as colunas aqui, a regra só
-- existiria no código, e dois `PUT` em paralelo poriam a mesma criança em dois
-- computadores.
CREATE UNIQUE INDEX "equipes_membros_escola_id_turma_id_exp_id_estudante_id_key"
  ON "equipes_membros"("escola_id", "turma_id", "exp_id", "estudante_id");

-- AddForeignKey
ALTER TABLE "equipes_montagens" ADD CONSTRAINT "equipes_montagens_turma_id_fkey"
  FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipes" ADD CONSTRAINT "equipes_escola_id_turma_id_exp_id_fkey"
  FOREIGN KEY ("escola_id", "turma_id", "exp_id")
  REFERENCES "equipes_montagens"("escola_id", "turma_id", "exp_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipes_membros" ADD CONSTRAINT "equipes_membros_equipe_id_fkey"
  FOREIGN KEY ("equipe_id") REFERENCES "equipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipes_membros" ADD CONSTRAINT "equipes_membros_estudante_id_fkey"
  FOREIGN KEY ("estudante_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------- bloco MANUAL

-- Dois modos, e o vocabulário vive em dois lugares: aqui e em
-- `equipes/regras.ts#MODOS`. É o par que já custou um deploy em `permissoes` —
-- o Zod aceita, o banco recusa, e o 500 só aparece no log da api. O teste de
-- Postgres compara os dois.
ALTER TABLE "equipes_montagens"
  ADD CONSTRAINT "equipes_montagens_modo_check"
    CHECK ("modo" IN ('sorteio', 'manual'));

-- Zero computadores não é uma aula com equipes: é uma aula sem missão. Quem
-- quer desfazer as equipes apaga a montagem (`DELETE`), não grava zero.
ALTER TABLE "equipes_montagens"
  ADD CONSTRAINT "equipes_montagens_computadores_check"
    CHECK ("computadores" >= 1);

-- A primeira montagem é a versão 1; o cliente manda 0 quando ainda não havia
-- nenhuma. Versão 0 gravada tornaria o 409 incapaz de distinguir "não existe"
-- de "existe e ninguém mexeu".
ALTER TABLE "equipes_montagens"
  ADD CONSTRAINT "equipes_montagens_versao_check"
    CHECK ("versao" >= 1);

-- O nome é o que a criança lê na tela. Cinco espaços passariam por um
-- `NOT NULL` e apareceriam no painel como uma equipe sem nome; o teto de 30 é
-- `NOME_MAX` no código, o que cabe no card sem quebrar a linha.
ALTER TABLE "equipes"
  ADD CONSTRAINT "equipes_nome_check"
    CHECK (char_length(btrim("nome")) BETWEEN 1 AND 30);

ALTER TABLE "equipes"
  ADD CONSTRAINT "equipes_ordem_check"
    CHECK ("ordem" >= 0);

-- **NÃO há FK de `exp_id` para `experiencias`**, e é a mesma decisão de
-- `liberacoes.exp_id`: aquele catálogo é escrito pelo CI ao publicar o bundle,
-- e numa stack de dev (ou num ambiente novo) ele está VAZIO. Quem restringe
-- quais missões aceitam equipe é `EXPERIENCIAS_COM_EQUIPE`, no código.

-- RLS (regra inviolável nº 1). As três carregam `escola_id` e entram na política
-- como qualquer tabela de dado de escola — `equipes_membros` com mais razão:
-- é a única das três que tem id de criança.
ALTER TABLE "equipes_montagens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "equipes_montagens" FORCE ROW LEVEL SECURITY;
CREATE POLICY "equipes_montagens_por_escola" ON "equipes_montagens"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "equipes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "equipes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "equipes_por_escola" ON "equipes"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "equipes_membros" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "equipes_membros" FORCE ROW LEVEL SECURITY;
CREATE POLICY "equipes_membros_por_escola" ON "equipes_membros"
  USING (escola_id = current_setting('app.escola_id', true));

-- A role de runtime (docs/INFRA.md) conecta sem ownership e precisa de
-- privilégio nas tabelas novas. Guardado: em dev/CI a role não existe.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON equipes_montagens, equipes, equipes_membros TO app_runtime';
  END IF;
END $$;
