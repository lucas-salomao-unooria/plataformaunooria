-- A MISSÃO TEMPESTADE VIRA A VERSÃO ANTERIOR `exp02em1b-v0` (ADR-180).
--
-- A missão da 2ª série do EM, unidade 1, foi reformulada por inteiro (O Efeito
-- Amplificador), e o código é derivado da série e da unidade (ADR-110): a nova é
-- `exp02em1b`. A Tempestade NÃO é arquivada como o UnooTube (ADR-116), que saiu
-- do ar: ela CONTINUA no ar — disponibilidade, liberações, dados e o módulo
-- `unoogpt` seguem — e só sai do catálogo (a trilha do professor, a grade da sala
-- e a lista do estudante), o que é DERIVADO do sufixo `-vN` do id
-- (`ehVersaoAnterior`). Por isso a linha FICA em `experiencias`, com o id novo.
--
-- Quatro partes, numa transação só (o `migrate deploy` embrulha o arquivo):
--
-- 1. O CHECK do podcast aceita o sufixo. `podcast_roteiros_exp_id_formato` era a
--    única trava de banco do formato do id; a Tempestade tem podcast FIXO e não
--    escreve linha ali, mas o UPDATE do passo 3 vale para o banco inteiro.
--
-- 2. NOMES — as sete tabelas `exp02em1b_*` ganham `_v0_` (`exp02em1b_v0_sessoes`…),
--    com constraints, índices, políticas e as duas sequências BIGSERIAL. RENAME,
--    nunca DROP/CREATE (ADR-20), por OID e com o snapshot antes do primeiro
--    rename, como na `20260926120000_arquivar_unootube`. Sem isto a missão nova
--    não teria o prefixo dela. O maior nome novo tem 47 caracteres.
--
-- 3. DADOS — o id como VALOR vira `exp02em1b-v0` em `experiencias`,
--    `experiencias_versoes`, `liberacoes`, `progresso`, equipes, evidência,
--    podcast e, com o prefixo `experiencia:`, em `disponibilidades` e
--    `recursos_auditoria`. Sem isto a missão nova nasceria HERDANDO as liberações
--    (a turma da Tempestade abriria O Efeito Amplificador sem o professor
--    escolher), o progresso, as equipes, a evidência e o interruptor da antiga.
--    `telemetria_eventos` FICA, como na ADR-116: `exp_version` separa as duas
--    (1.x × 2.x) e o UPDATE varreria todas as partições.
--
-- 4. A ASSERÇÃO: sobrou `exp02em1b` em qualquer uma = a migration aborta.

-- 1. -------------------------------------------------------------------------

ALTER TABLE "podcast_roteiros" DROP CONSTRAINT "podcast_roteiros_exp_id_formato";
ALTER TABLE "podcast_roteiros" ADD CONSTRAINT "podcast_roteiros_exp_id_formato"
  CHECK (exp_id ~ '^exp[0-9]{2}(ef|em)[0-9][a-z](-v[0-9]+)?$');

-- 2. -------------------------------------------------------------------------

DO $$
DECLARE
  antigo_re constant text := '^exp02em1b_';
  tabelas   oid[];  nomes_tab text[];
  cons_rel  oid[];  cons_nome text[];
  idx_oid   oid[];  idx_nome  text[];
  seq_oid   oid[];  seq_nome  text[];
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

  -- O DEFAULT nextval() aponta a sequência por OID: renomear não o quebra.
  SELECT array_agg(c.oid), array_agg(c.relname) INTO seq_oid, seq_nome
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'S' AND c.relname ~ antigo_re;

  SELECT array_agg(p.polrelid), array_agg(p.polname) INTO pol_rel, pol_nome
    FROM pg_policy p WHERE p.polname ~ antigo_re;

  FOR i IN 1 .. coalesce(array_length(tabelas, 1), 0) LOOP
    EXECUTE format('ALTER TABLE %s RENAME TO %I', tabelas[i]::regclass,
                   regexp_replace(nomes_tab[i], antigo_re, 'exp02em1b_v0_'));
  END LOOP;
  FOR i IN 1 .. coalesce(array_length(cons_rel, 1), 0) LOOP
    EXECUTE format('ALTER TABLE %s RENAME CONSTRAINT %I TO %I', cons_rel[i]::regclass,
                   cons_nome[i], regexp_replace(cons_nome[i], antigo_re, 'exp02em1b_v0_'));
  END LOOP;
  FOR i IN 1 .. coalesce(array_length(idx_oid, 1), 0) LOOP
    EXECUTE format('ALTER INDEX %s RENAME TO %I', idx_oid[i]::regclass,
                   regexp_replace(idx_nome[i], antigo_re, 'exp02em1b_v0_'));
  END LOOP;
  FOR i IN 1 .. coalesce(array_length(seq_oid, 1), 0) LOOP
    EXECUTE format('ALTER SEQUENCE %s RENAME TO %I', seq_oid[i]::regclass,
                   regexp_replace(seq_nome[i], antigo_re, 'exp02em1b_v0_'));
  END LOOP;
  FOR i IN 1 .. coalesce(array_length(pol_rel, 1), 0) LOOP
    EXECUTE format('ALTER POLICY %I ON %s RENAME TO %I', pol_nome[i], pol_rel[i]::regclass,
                   regexp_replace(pol_nome[i], antigo_re, 'exp02em1b_v0_'));
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'exp02em1b_v0_sessoes')
  OR NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'exp02em1b_v0_tarefas') THEN
    RAISE EXCEPTION 'as tabelas da Missão Tempestade (exp02em1b_*) não foram encontradas para renomear';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname ~ antigo_re AND c.relname !~ '^exp02em1b_v0_'
  ) OR EXISTS (SELECT 1 FROM pg_constraint WHERE conname ~ antigo_re AND conname !~ '^exp02em1b_v0_')
    OR EXISTS (SELECT 1 FROM pg_policy WHERE polname ~ antigo_re AND polname !~ '^exp02em1b_v0_') THEN
    RAISE EXCEPTION 'sobrou nome com prefixo exp02em1b_ depois do rename';
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
ALTER TABLE "podcast_roteiros"   NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "recursos_auditoria" DISABLE TRIGGER "recursos_auditoria_sem_update";

UPDATE "experiencias"         SET "exp_id" = 'exp02em1b-v0' WHERE "exp_id" = 'exp02em1b';
UPDATE "experiencias_versoes" SET "exp_id" = 'exp02em1b-v0' WHERE "exp_id" = 'exp02em1b';
UPDATE "liberacoes"           SET "exp_id" = 'exp02em1b-v0' WHERE "exp_id" = 'exp02em1b';
UPDATE "progresso"            SET "exp_id" = 'exp02em1b-v0' WHERE "exp_id" = 'exp02em1b';
-- `equipes` vai junto da montagem (FK ON UPDATE CASCADE); `equipes_membros` não
-- (a FK é para `equipes(id)` e o `exp_id` ali é cópia) — a lição da ADR-116.
UPDATE "equipes_montagens"    SET "exp_id" = 'exp02em1b-v0' WHERE "exp_id" = 'exp02em1b';
UPDATE "equipes_membros"      SET "exp_id" = 'exp02em1b-v0' WHERE "exp_id" = 'exp02em1b';
UPDATE "evidencias_marcas"    SET "exp_id" = 'exp02em1b-v0' WHERE "exp_id" = 'exp02em1b';
UPDATE "evidencias"           SET "exp_id" = 'exp02em1b-v0' WHERE "exp_id" = 'exp02em1b';
UPDATE "evidencias_eventos"   SET "exp_id" = 'exp02em1b-v0' WHERE "exp_id" = 'exp02em1b';
UPDATE "podcast_roteiros"     SET "exp_id" = 'exp02em1b-v0' WHERE "exp_id" = 'exp02em1b';
UPDATE "disponibilidades"     SET "recurso_id" = 'experiencia:exp02em1b-v0'
  WHERE "recurso_id" = 'experiencia:exp02em1b';
UPDATE "recursos_auditoria"   SET "recurso_id" = 'experiencia:exp02em1b-v0'
  WHERE "recurso_id" = 'experiencia:exp02em1b';

-- 4. -------------------------------------------------------------------------
-- A asserção roda ANTES de o FORCE voltar: com ele, esta leitura também veria
-- zero linhas, e passaria mentindo.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "experiencias"         WHERE "exp_id" = 'exp02em1b')
  OR EXISTS (SELECT 1 FROM "experiencias_versoes" WHERE "exp_id" = 'exp02em1b')
  OR EXISTS (SELECT 1 FROM "liberacoes"           WHERE "exp_id" = 'exp02em1b')
  OR EXISTS (SELECT 1 FROM "progresso"            WHERE "exp_id" = 'exp02em1b')
  OR EXISTS (SELECT 1 FROM "equipes_montagens"    WHERE "exp_id" = 'exp02em1b')
  OR EXISTS (SELECT 1 FROM "equipes"              WHERE "exp_id" = 'exp02em1b')
  OR EXISTS (SELECT 1 FROM "equipes_membros"      WHERE "exp_id" = 'exp02em1b')
  OR EXISTS (SELECT 1 FROM "evidencias_marcas"    WHERE "exp_id" = 'exp02em1b')
  OR EXISTS (SELECT 1 FROM "evidencias"           WHERE "exp_id" = 'exp02em1b')
  OR EXISTS (SELECT 1 FROM "evidencias_eventos"   WHERE "exp_id" = 'exp02em1b')
  OR EXISTS (SELECT 1 FROM "podcast_roteiros"     WHERE "exp_id" = 'exp02em1b')
  OR EXISTS (SELECT 1 FROM "disponibilidades"     WHERE "recurso_id" = 'experiencia:exp02em1b')
  OR EXISTS (SELECT 1 FROM "recursos_auditoria"   WHERE "recurso_id" = 'experiencia:exp02em1b')
  THEN
    RAISE EXCEPTION 'sobrou linha da Missão Tempestade (exp02em1b) depois de renomear';
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
ALTER TABLE "podcast_roteiros"   FORCE ROW LEVEL SECURITY;
