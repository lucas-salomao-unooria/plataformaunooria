-- O CÓDIGO NOVO DAS EXPERIÊNCIAS (ADR-110).
--
-- A missão da trilha passa a se chamar pelo lugar dela na grade — `exp08ef1b`
-- é o 8º ano do Fundamental, unidade 1 — e o que não é missão vira
-- `app-NN-nome`. Antes era `exp-NN-slug`, e o NN era a ORDEM DE CRIAÇÃO: a
-- `exp-01` era do 8º ano e a `exp-04` do 1º. Por isso o de-para embaralha os
-- números, e é a razão de ele estar escrito por extenso, e não derivado:
--
--   exp-01-instanooria        -> exp08ef1b              exp_01_ -> exp08ef1b_
--   exp-02-unootube           -> exp04ef1b              exp_02_ -> exp04ef1b_
--   exp-03-unoogpt            -> exp02em1b              exp_03_ -> exp02em1b_
--   exp-04-o-que-a-foto-conta -> exp01ef1b              exp_04_ -> exp01ef1b_
--   exp-05-quem-mandou-isso   -> exp05ef1b              exp_05_ -> exp05ef1b_
--   exp-06-rastro-boato       -> exp06ef2b              exp_06_ -> exp06ef2b_
--   exp-07-o-eco-no-grupo     -> exp07ef1b              exp_07_ -> exp07ef1b_
--   exp-08-manifesto-ia       -> exp08ef4b              exp_08_ -> exp08ef4b_
--   exp-70-vila-do-lume       -> app-70-vila-do-lume    exp_70_ -> app_70_
--   exp-90-plano-de-aula      -> app-90-plano-de-aula   exp_90_ -> app_90_
--   exp-91-bem-estar          -> app-91-bem-estar       exp_91_ -> app_91_
--   exp-92-plano-de-ensino    -> app-92-plano-de-ensino exp_92_ -> app_92_
--
-- Duas partes, numa transação só (o `migrate deploy` embrulha o arquivo):
--
-- 1. NOMES — RENAME de tabela, constraint, índice, política de RLS e sequence,
--    nunca DROP/CREATE (ADR-20). Mesma técnica e mesmas duas armadilhas da
--    `20260827090000_tabelas_por_experiencia`, só que resolvidas por OID em vez
--    de por nome: o snapshot de TUDO sai antes do primeiro rename, e cada objeto
--    é achado pelo OID, que o rename não muda. Assim nenhum laço relê o que o
--    próprio laço alterou, e o `RENAME CONSTRAINT` (que renomeia também o índice
--    que a sustenta) não faz o índice ser renomeado duas vezes.
--    A troca de prefixo é sequencial e é segura assim: nenhum nome NOVO contém
--    `exp_NN_` (o código novo não tem sublinhado entre `exp` e o número), então
--    uma troca não reabre a outra.
--
-- 2. DADOS — o id como VALOR em `experiencias`, `experiencias_versoes`,
--    `liberacoes`, `progresso`, `telemetria_eventos` e, com o prefixo
--    `experiencia:`, em `disponibilidades` e `recursos_auditoria`. Nenhuma
--    delas tem FK para `experiencias`, então a ordem é livre.
--    Duas travas que o banco põe, e que esta migration afrouxa SÓ dentro da
--    transação:
--    - `FORCE ROW LEVEL SECURITY` (liberacoes, progresso, telemetria): com ele
--      até o dono obedece à política, e sem `app.escola_id` armado o UPDATE
--      casaria ZERO linhas em silêncio. Sai o FORCE, entra o UPDATE, volta o
--      FORCE.
--    - `recursos_auditoria` é append-only por trigger (ADR-89). Reescrever o id
--      não muda o que a linha diz — quem mexeu, quando, em qual recurso —, só o
--      nome do recurso; sem isto o histórico de cada experiência SUMIRIA da tela
--      dela, que filtra pelo id novo. É a única escrita que o trigger deixa
--      passar, e ela está registrada na ADR-110.
--    No fim, a asserção: sobrou id antigo em qualquer uma = a migration aborta.

CREATE FUNCTION pg_temp.nome_novo(antigo text) RETURNS text AS $$
DECLARE
  prefixos text[][] := ARRAY[
    ['exp_01_', 'exp08ef1b_'],
    ['exp_02_', 'exp04ef1b_'],
    ['exp_03_', 'exp02em1b_'],
    ['exp_04_', 'exp01ef1b_'],
    ['exp_05_', 'exp05ef1b_'],
    ['exp_06_', 'exp06ef2b_'],
    ['exp_07_', 'exp07ef1b_'],
    ['exp_08_', 'exp08ef4b_'],
    ['exp_70_', 'app_70_'],
    ['exp_90_', 'app_90_'],
    ['exp_91_', 'app_91_'],
    ['exp_92_', 'app_92_']
  ];
  par    text[];
  novo   text := antigo;
  sufixo text;
BEGIN
  FOREACH par SLICE 1 IN ARRAY prefixos LOOP
    novo := replace(novo, par[1], par[2]);
  END LOOP;
  -- O prefixo novo é até 3 caracteres mais longo, e acima de 63 o Postgres
  -- CORTA O FIM em silêncio (`..._mensagem_id_ke`). O Prisma corta o MEIO e
  -- guarda o sufixo (`..._mensagem_i_key`) — e acusaria drift no nome que o
  -- Postgres deixou. Aqui o corte é o do Prisma. Nome longo sem sufixo
  -- conhecido não tem regra, e aborta.
  IF length(novo) > 63 THEN
    sufixo := substring(novo from '_(pkey|fkey|key|idx)$');
    IF sufixo IS NULL THEN
      RAISE EXCEPTION 'nome novo passa de 63 caracteres e não tem sufixo conhecido: %', novo;
    END IF;
    novo := left(novo, 63 - length(sufixo) - 1) || '_' || sufixo;
  END IF;
  RETURN novo;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ---------------------------------------------------------------------------
-- 1. NOMES
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  antigo_re constant text := 'exp_(0[1-8]|70|9[0-2])_';
  tabelas    oid[];  nomes_tab  text[];
  cons_rel   oid[];  cons_nome  text[];
  idx_oid    oid[];  idx_nome   text[];
  pol_rel    oid[];  pol_nome   text[];
  seq_oid    oid[];  seq_nome   text[];
  i int;
BEGIN
  -- Snapshot de tudo, ANTES do primeiro rename.
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

  SELECT array_agg(c.oid), array_agg(c.relname) INTO seq_oid, seq_nome
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'S' AND c.relname ~ antigo_re;

  -- Os renames, cada um pelo OID.
  FOR i IN 1 .. coalesce(array_length(tabelas, 1), 0) LOOP
    EXECUTE format('ALTER TABLE %s RENAME TO %I', tabelas[i]::regclass, pg_temp.nome_novo(nomes_tab[i]));
  END LOOP;
  FOR i IN 1 .. coalesce(array_length(cons_rel, 1), 0) LOOP
    EXECUTE format('ALTER TABLE %s RENAME CONSTRAINT %I TO %I',
                   cons_rel[i]::regclass, cons_nome[i], pg_temp.nome_novo(cons_nome[i]));
  END LOOP;
  FOR i IN 1 .. coalesce(array_length(idx_oid, 1), 0) LOOP
    EXECUTE format('ALTER INDEX %s RENAME TO %I', idx_oid[i]::regclass, pg_temp.nome_novo(idx_nome[i]));
  END LOOP;
  FOR i IN 1 .. coalesce(array_length(pol_rel, 1), 0) LOOP
    EXECUTE format('ALTER POLICY %I ON %s RENAME TO %I',
                   pol_nome[i], pol_rel[i]::regclass, pg_temp.nome_novo(pol_nome[i]));
  END LOOP;
  FOR i IN 1 .. coalesce(array_length(seq_oid, 1), 0) LOOP
    EXECUTE format('ALTER SEQUENCE %s RENAME TO %I', seq_oid[i]::regclass, pg_temp.nome_novo(seq_nome[i]));
  END LOOP;

  -- Objeto que o snapshot não pegou (de outro tipo, ou criado no meio) deixaria
  -- um nome antigo que o Prisma acusaria como drift. Aqui ele aborta.
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname ~ antigo_re
  ) OR EXISTS (SELECT 1 FROM pg_constraint WHERE conname ~ antigo_re)
    OR EXISTS (SELECT 1 FROM pg_policy WHERE polname ~ antigo_re) THEN
    RAISE EXCEPTION 'sobrou nome com prefixo antigo (exp_NN_) depois do rename';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. DADOS
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE de_para (antigo text PRIMARY KEY, novo text NOT NULL UNIQUE) ON COMMIT DROP;
INSERT INTO de_para (antigo, novo) VALUES
  ('exp-01-instanooria',        'exp08ef1b'),
  ('exp-02-unootube',           'exp04ef1b'),
  ('exp-03-unoogpt',            'exp02em1b'),
  ('exp-04-o-que-a-foto-conta', 'exp01ef1b'),
  ('exp-05-quem-mandou-isso',   'exp05ef1b'),
  ('exp-06-rastro-boato',       'exp06ef2b'),
  ('exp-07-o-eco-no-grupo',     'exp07ef1b'),
  ('exp-08-manifesto-ia',       'exp08ef4b'),
  ('exp-70-vila-do-lume',       'app-70-vila-do-lume'),
  ('exp-90-plano-de-aula',      'app-90-plano-de-aula'),
  ('exp-91-bem-estar',          'app-91-bem-estar'),
  ('exp-92-plano-de-ensino',    'app-92-plano-de-ensino');

ALTER TABLE "liberacoes"         NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "progresso"          NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "telemetria_eventos" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "recursos_auditoria" DISABLE TRIGGER "recursos_auditoria_sem_update";

UPDATE "experiencias"         t SET "exp_id" = d.novo FROM de_para d WHERE t."exp_id" = d.antigo;
UPDATE "experiencias_versoes" t SET "exp_id" = d.novo FROM de_para d WHERE t."exp_id" = d.antigo;
UPDATE "liberacoes"           t SET "exp_id" = d.novo FROM de_para d WHERE t."exp_id" = d.antigo;
UPDATE "progresso"            t SET "exp_id" = d.novo FROM de_para d WHERE t."exp_id" = d.antigo;
UPDATE "telemetria_eventos"   t SET "exp_id" = d.novo FROM de_para d WHERE t."exp_id" = d.antigo;
UPDATE "disponibilidades"     t SET "recurso_id" = 'experiencia:' || d.novo
  FROM de_para d WHERE t."recurso_id" = 'experiencia:' || d.antigo;
UPDATE "recursos_auditoria"   t SET "recurso_id" = 'experiencia:' || d.novo
  FROM de_para d WHERE t."recurso_id" = 'experiencia:' || d.antigo;

-- A asserção roda ANTES de o FORCE voltar: com ele, esta leitura também veria
-- zero linhas, e passaria mentindo.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "experiencias"         WHERE "exp_id" IN (SELECT antigo FROM de_para))
  OR EXISTS (SELECT 1 FROM "experiencias_versoes" WHERE "exp_id" IN (SELECT antigo FROM de_para))
  OR EXISTS (SELECT 1 FROM "liberacoes"           WHERE "exp_id" IN (SELECT antigo FROM de_para))
  OR EXISTS (SELECT 1 FROM "progresso"            WHERE "exp_id" IN (SELECT antigo FROM de_para))
  OR EXISTS (SELECT 1 FROM "telemetria_eventos"   WHERE "exp_id" IN (SELECT antigo FROM de_para))
  OR EXISTS (SELECT 1 FROM "disponibilidades"     WHERE "recurso_id" IN (SELECT 'experiencia:' || antigo FROM de_para))
  OR EXISTS (SELECT 1 FROM "recursos_auditoria"   WHERE "recurso_id" IN (SELECT 'experiencia:' || antigo FROM de_para))
  THEN
    RAISE EXCEPTION 'sobrou expId antigo depois do UPDATE';
  END IF;
END $$;

ALTER TABLE "recursos_auditoria" ENABLE TRIGGER "recursos_auditoria_sem_update";
ALTER TABLE "liberacoes"         FORCE ROW LEVEL SECURITY;
ALTER TABLE "progresso"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "telemetria_eventos" FORCE ROW LEVEL SECURITY;
