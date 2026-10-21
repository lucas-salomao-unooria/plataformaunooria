-- ARQUIVAR O UNOOTUBE (ADR-116).
--
-- O Jornal da Escola é a missão do 4º ano, unidade 1, e o código é derivado da
-- série e da unidade (ADR-110): ele é `exp04ef1b`, o código do UnooTube. O
-- UnooTube NÃO é apagado (o Eco foi, ADR-113) — é ARQUIVADO: tudo o que era dele
-- ganha o prefixo `backup-` e sai do produto, com os dados guardados.
--
-- Quatro partes, numa transação só (o `migrate deploy` embrulha o arquivo):
--
-- 1. A TABELA DAS ARQUIVADAS. A linha do UnooTube SAI de `experiencias` e vai
--    para `experiencias_arquivadas`. Não é uma coluna `arquivada_em` em
--    `experiencias` de propósito: seis leitores listam aquela tabela (a grade da
--    sala, o catálogo, o painel de recursos, a evidência, a portabilidade…), e
--    cada um teria de lembrar de filtrar. Fora dela, a arquivada some de tudo sem
--    que ninguém lembre de nada. Quem precisa enxergá-la é a área
--    `/unooria/arquivados` (só o admin) e o documento de portabilidade.
--
-- 2. NOMES — RENAME de tabela, constraint, índice e política, nunca DROP/CREATE
--    (ADR-20). Por OID, com o snapshot antes do primeiro rename, como na
--    `20260923120000_codigo_das_experiencias`. `backup_` soma 7 caracteres e o
--    maior nome novo tem 42: o corte de 63 do Postgres não chega a morder.
--
-- 3. DADOS — o id como VALOR vira `backup-exp04ef1b` em `experiencias_versoes`,
--    `liberacoes`, `progresso`, nas tabelas de equipes e de evidência e, com o
--    prefixo `experiencia:`, em `disponibilidades` e `recursos_auditoria`. Sem
--    isto o Jornal nasceria HERDANDO as liberações, o progresso (o SDK leria o
--    JSON do UnooTube), as equipes montadas e o histórico do interruptor do
--    UnooTube. As travas afrouxadas só dentro da transação são as mesmas da
--    ADR-110: o FORCE ROW LEVEL SECURITY (sem ele sair, o UPDATE casaria zero
--    linhas em silêncio) e o trigger append-only de `recursos_auditoria`
--    (reescrever o nome do recurso não muda o que a linha diz).
--    `telemetria_eventos` FICA: `exp_version` separa o UnooTube (1.x) do Jornal
--    (2.x), e o UPDATE varreria todas as partições.
--
-- 4. A ASSERÇÃO: sobrou `exp04ef1b` em qualquer uma = a migration aborta.

-- 1. -------------------------------------------------------------------------

CREATE TABLE "experiencias_arquivadas" (
    "exp_id" TEXT NOT NULL,
    "codigo_de_origem" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "versao" TEXT NOT NULL,
    "series" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "unidade" SMALLINT,
    "produto" TEXT,
    "motivo" TEXT NOT NULL,
    "turmas_guardadas" INTEGER NOT NULL DEFAULT 0,
    "estudantes_guardados" INTEGER NOT NULL DEFAULT 0,
    "arquivada_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "experiencias_arquivadas_pkey" PRIMARY KEY ("exp_id")
);

-- O id arquivado É o prefixo mais o código de origem: não há como os dois
-- dizerem coisas diferentes.
ALTER TABLE "experiencias_arquivadas"
  ADD CONSTRAINT "experiencias_arquivadas_exp_id_check"
    CHECK ("exp_id" = 'backup-' || "codigo_de_origem");

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON experiencias_arquivadas TO app_runtime';
  END IF;
END $$;

-- Numa stack sem a linha (banco novo), não há o que mover: o seed escreve a
-- arquivada a partir de `apps/experiencias/backup-*` (catalogo-e-liberacoes.ts).
INSERT INTO "experiencias_arquivadas"
  ("exp_id", "codigo_de_origem", "nome", "versao", "series", "unidade", "produto", "motivo")
SELECT 'backup-exp04ef1b', "exp_id", "nome", "versao_ativa", "series", "unidade", "produto",
       'O Jornal da Escola tomou o código exp04ef1b (4º ano, unidade 1).'
  FROM "experiencias" WHERE "exp_id" = 'exp04ef1b';

DELETE FROM "experiencias" WHERE "exp_id" = 'exp04ef1b';

-- 2. -------------------------------------------------------------------------

DO $$
DECLARE
  antigo_re constant text := '^exp04ef1b_';
  tabelas   oid[];  nomes_tab text[];
  cons_rel  oid[];  cons_nome text[];
  idx_oid   oid[];  idx_nome  text[];
  pol_rel   oid[];  pol_nome  text[];
  i int;
BEGIN
  SELECT array_agg(c.oid), array_agg(c.relname) INTO tabelas, nomes_tab
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relname ~ antigo_re;

  SELECT array_agg(co.conrelid), array_agg(co.conname) INTO cons_rel, cons_nome
    FROM pg_constraint co JOIN pg_namespace n ON n.oid = co.connamespace
   WHERE n.nspname = 'public' AND co.conname ~ antigo_re;

  -- Índice que sustenta constraint fica de fora: o RENAME CONSTRAINT já o leva.
  SELECT array_agg(c.oid), array_agg(c.relname) INTO idx_oid, idx_nome
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('i', 'I') AND c.relname ~ antigo_re
     AND NOT EXISTS (SELECT 1 FROM pg_constraint co WHERE co.conindid = c.oid);

  SELECT array_agg(p.polrelid), array_agg(p.polname) INTO pol_rel, pol_nome
    FROM pg_policy p WHERE p.polname ~ antigo_re;

  FOR i IN 1 .. coalesce(array_length(tabelas, 1), 0) LOOP
    EXECUTE format('ALTER TABLE %s RENAME TO %I', tabelas[i]::regclass, 'backup_' || nomes_tab[i]);
  END LOOP;
  FOR i IN 1 .. coalesce(array_length(cons_rel, 1), 0) LOOP
    EXECUTE format('ALTER TABLE %s RENAME CONSTRAINT %I TO %I',
                   cons_rel[i]::regclass, cons_nome[i], 'backup_' || cons_nome[i]);
  END LOOP;
  FOR i IN 1 .. coalesce(array_length(idx_oid, 1), 0) LOOP
    EXECUTE format('ALTER INDEX %s RENAME TO %I', idx_oid[i]::regclass, 'backup_' || idx_nome[i]);
  END LOOP;
  FOR i IN 1 .. coalesce(array_length(pol_rel, 1), 0) LOOP
    EXECUTE format('ALTER POLICY %I ON %s RENAME TO %I',
                   pol_nome[i], pol_rel[i]::regclass, 'backup_' || pol_nome[i]);
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'backup_exp04ef1b_sessoes') THEN
    RAISE EXCEPTION 'a tabela do UnooTube (exp04ef1b_sessoes) não foi encontrada para arquivar';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname ~ antigo_re
  ) OR EXISTS (SELECT 1 FROM pg_constraint WHERE conname ~ antigo_re)
    OR EXISTS (SELECT 1 FROM pg_policy WHERE polname ~ antigo_re) THEN
    RAISE EXCEPTION 'sobrou nome com prefixo exp04ef1b_ depois do rename';
  END IF;
END $$;

-- 3. -------------------------------------------------------------------------

ALTER TABLE "liberacoes"         NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "progresso"          NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "equipes_montagens"  NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "equipes"            NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "equipes_membros"    NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "evidencias_marcas"  NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "evidencias"         NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "evidencias_eventos" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "recursos_auditoria" DISABLE TRIGGER "recursos_auditoria_sem_update";

UPDATE "experiencias_versoes" SET "exp_id" = 'backup-exp04ef1b' WHERE "exp_id" = 'exp04ef1b';
UPDATE "liberacoes"           SET "exp_id" = 'backup-exp04ef1b' WHERE "exp_id" = 'exp04ef1b';
UPDATE "progresso"            SET "exp_id" = 'backup-exp04ef1b' WHERE "exp_id" = 'exp04ef1b';
-- `equipes` aponta para a montagem com FK ON UPDATE CASCADE: o UPDATE da
-- montagem a leva junto. `equipes_membros` NÃO: a FK dela é para `equipes(id)`,
-- e o `exp_id` ali é cópia — sem o UPDATE próprio, os membros ficariam com o
-- código antigo (a asserção do fim pegou isso no banco descartável).
UPDATE "equipes_montagens"    SET "exp_id" = 'backup-exp04ef1b' WHERE "exp_id" = 'exp04ef1b';
UPDATE "equipes_membros"      SET "exp_id" = 'backup-exp04ef1b' WHERE "exp_id" = 'exp04ef1b';
-- O UnooTube nunca teve ficha de evidência (FICHAS estava vazio): estes três
-- não devem casar nada. Estão aqui para a asserção valer para o banco inteiro.
UPDATE "evidencias_marcas"    SET "exp_id" = 'backup-exp04ef1b' WHERE "exp_id" = 'exp04ef1b';
UPDATE "evidencias"           SET "exp_id" = 'backup-exp04ef1b' WHERE "exp_id" = 'exp04ef1b';
UPDATE "evidencias_eventos"   SET "exp_id" = 'backup-exp04ef1b' WHERE "exp_id" = 'exp04ef1b';
UPDATE "disponibilidades"     SET "recurso_id" = 'experiencia:backup-exp04ef1b'
  WHERE "recurso_id" = 'experiencia:exp04ef1b';
UPDATE "recursos_auditoria"   SET "recurso_id" = 'experiencia:backup-exp04ef1b'
  WHERE "recurso_id" = 'experiencia:exp04ef1b';

-- A FOTOGRAFIA do que ficou guardado, tirada aqui porque é o único momento em
-- que a contagem atravessa escolas sem pedir nada à RLS (o FORCE está fora). A
-- tela do admin só LÊ estes números: nenhuma rota conta `liberacoes` ou
-- `progresso` de todas as escolas em tempo de uso.
UPDATE "experiencias_arquivadas" a SET
  "turmas_guardadas" = (SELECT count(DISTINCT ("escola_id", "turma_id")) FROM "liberacoes"
                         WHERE "exp_id" = a."exp_id"),
  "estudantes_guardados" = (SELECT count(DISTINCT "estudante_id") FROM "progresso"
                             WHERE "exp_id" = a."exp_id")
  WHERE a."exp_id" = 'backup-exp04ef1b';

-- 4. -------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "experiencias"         WHERE "exp_id" = 'exp04ef1b')
  OR EXISTS (SELECT 1 FROM "experiencias_versoes" WHERE "exp_id" = 'exp04ef1b')
  OR EXISTS (SELECT 1 FROM "liberacoes"           WHERE "exp_id" = 'exp04ef1b')
  OR EXISTS (SELECT 1 FROM "progresso"            WHERE "exp_id" = 'exp04ef1b')
  OR EXISTS (SELECT 1 FROM "equipes_montagens"    WHERE "exp_id" = 'exp04ef1b')
  OR EXISTS (SELECT 1 FROM "equipes"              WHERE "exp_id" = 'exp04ef1b')
  OR EXISTS (SELECT 1 FROM "equipes_membros"      WHERE "exp_id" = 'exp04ef1b')
  OR EXISTS (SELECT 1 FROM "evidencias_marcas"    WHERE "exp_id" = 'exp04ef1b')
  OR EXISTS (SELECT 1 FROM "evidencias"           WHERE "exp_id" = 'exp04ef1b')
  OR EXISTS (SELECT 1 FROM "evidencias_eventos"   WHERE "exp_id" = 'exp04ef1b')
  OR EXISTS (SELECT 1 FROM "disponibilidades"     WHERE "recurso_id" = 'experiencia:exp04ef1b')
  OR EXISTS (SELECT 1 FROM "recursos_auditoria"   WHERE "recurso_id" = 'experiencia:exp04ef1b')
  THEN
    RAISE EXCEPTION 'sobrou linha do UnooTube (exp04ef1b) depois de arquivar';
  END IF;
END $$;

ALTER TABLE "recursos_auditoria" ENABLE TRIGGER "recursos_auditoria_sem_update";
ALTER TABLE "liberacoes"         FORCE ROW LEVEL SECURITY;
ALTER TABLE "progresso"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "equipes_montagens"  FORCE ROW LEVEL SECURITY;
ALTER TABLE "equipes"            FORCE ROW LEVEL SECURITY;
ALTER TABLE "equipes_membros"    FORCE ROW LEVEL SECURITY;
ALTER TABLE "evidencias_marcas"  FORCE ROW LEVEL SECURITY;
ALTER TABLE "evidencias"         FORCE ROW LEVEL SECURITY;
ALTER TABLE "evidencias_eventos" FORCE ROW LEVEL SECURITY;
