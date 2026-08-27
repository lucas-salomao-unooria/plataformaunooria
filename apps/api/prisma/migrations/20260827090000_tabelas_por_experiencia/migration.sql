-- Padroniza o nome das tabelas pelo NÚMERO da experiência que as possui.
--
-- Convenção (vale para as 48): tabela de experiência recebe o prefixo
-- `exp_NN_`, onde NN é o número da experiência. Tabela da PLATAFORMA — que
-- serve a todas — não recebe prefixo: `escolas`, `turmas`, `users`,
-- `experiencias`, `progresso`, `telemetria_eventos`, `ia_uso_diario`.
--
-- Por que o prefixo e não um schema por experiência: as experiências NÃO são
-- isoladas por desenho (o perfil da Vila alimenta a largada do Instanooria, a
-- telemetria e o progresso atravessam todas), e um schema por experiência
-- traria fronteira de GRANT que ninguém usa — há uma role de aplicação só.
-- O prefixo dá o mesmo namespace sem custo. Decisão registrada no CLAUDE.md.
--
-- `exp_01_exp_70_perfis_importados` carrega DOIS números de propósito: a
-- exp-70 escreve, a exp-01 lê. É contrato entre experiências, e chamá-la de
-- uma só mentiria sobre quem depende dela.
--
-- RENAME, não DROP/CREATE: preserva dados, FKs, políticas de RLS e o
-- `FORCE ROW LEVEL SECURITY`. Os índices e constraints NÃO acompanham o
-- rename da tabela em Postgres — se ficarem com o nome antigo, o Prisma
-- acusa drift no próximo `migrate dev`. Por isso o bloco renomeia os três
-- (tabela, constraints, índices) e também a política de RLS.

DO $$
DECLARE
  mapa text[][] := ARRAY[
    -- exp-01 Instanooria (o motor: feed adaptativo, geração e dossiê)
    ['activities',            'exp_01_activities'],
    ['authors',               'exp_01_authors'],
    ['posts',                 'exp_01_posts'],
    ['post_comments',         'exp_01_post_comments'],
    ['generation_jobs',       'exp_01_generation_jobs'],
    ['runs',                  'exp_01_runs'],
    ['events',                'exp_01_events'],
    ['student_posts',         'exp_01_student_posts'],
    ['conclusoes',            'exp_01_conclusoes'],
    ['dossiers',              'exp_01_dossiers'],
    ['reflexoes',             'exp_01_reflexoes'],
    ['comentarios_da_sessao', 'exp_01_comentarios_da_sessao'],
    -- contrato exp-70 -> exp-01 (o "Ato 1")
    ['perfis_importados',     'exp_01_exp_70_perfis_importados'],
    -- exp-02 UnooTube
    ['unootube_sessoes',      'exp_02_sessoes'],
    -- exp-70 Vila do Lume
    ['vila_sessoes',          'exp_70_sessoes'],
    ['vila_perfis',           'exp_70_perfis'],
    ['vila_bolhas',           'exp_70_bolhas'],
    -- exp-90 Plano de aula
    ['planos_de_aula',        'exp_90_planos'],
    ['planos_referencias',    'exp_90_referencias'],
    -- exp-91 Check-in de bem-estar
    ['bem_estar_ciclos',      'exp_91_ciclos'],
    ['bem_estar_checkins',    'exp_91_checkins']
  ];
  par     text[];
  antigo  text;
  novo    text;
  nomes_cons text[];
  nomes_idx  text[];
  nome       text;
BEGIN
  FOREACH par SLICE 1 IN ARRAY mapa LOOP
    antigo := par[1];
    novo   := par[2];

    -- Idempotente: `migrate deploy` roda uma vez, mas um ambiente reconstruído
    -- pela metade não pode abortar o resto do bloco.
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = antigo
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I RENAME TO %I', antigo, novo);

    -- Política de RLS: o nome é `<tabela>_por_escola` (ver a migration init).
    -- As tabelas sem `escola_id` não têm política — daí o IF.
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = novo AND policyname = antigo || '_por_escola'
    ) THEN
      EXECUTE format('ALTER POLICY %I ON %I RENAME TO %I',
                     antigo || '_por_escola', novo, novo || '_por_escola');
    END IF;

    -- Constraints e índices: os DOIS snapshots saem ANTES de qualquer rename.
    --
    -- Duas armadilhas aqui, ambas custaram um prefixo dobrado
    -- (`exp_01_exp_01_activities_pkey`):
    --  1. `FOR r IN SELECT ... FROM pg_constraint` relê o catálogo enquanto o
    --     laço o altera, e o nome já renomeado casa de novo;
    --  2. `ALTER TABLE ... RENAME CONSTRAINT` renomeia TAMBÉM o índice que
    --     sustenta a constraint — então um snapshot de índices tirado depois
    --     disso pega o nome novo, que ainda contém o antigo, e renomeia outra
    --     vez. Por isso os índices de constraint saem da lista de índices.
    SELECT array_agg(conname) INTO nomes_cons
      FROM pg_constraint
     WHERE conrelid = format('public.%I', novo)::regclass
       AND position(antigo in conname) > 0;

    SELECT array_agg(i.indexname) INTO nomes_idx
      FROM pg_indexes i
     WHERE i.schemaname = 'public'
       AND i.tablename = novo
       AND position(antigo in i.indexname) > 0
       AND NOT EXISTS (
         SELECT 1 FROM pg_constraint c
          WHERE c.conrelid = format('public.%I', novo)::regclass
            AND c.conindid = format('public.%I', i.indexname)::regclass
       );

    IF nomes_cons IS NOT NULL THEN
      FOREACH nome IN ARRAY nomes_cons LOOP
        EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I',
                       novo, nome, replace(nome, antigo, novo));
      END LOOP;
    END IF;

    IF nomes_idx IS NOT NULL THEN
      FOREACH nome IN ARRAY nomes_idx LOOP
        EXECUTE format('ALTER INDEX %I RENAME TO %I',
                       nome, replace(nome, antigo, novo));
      END LOOP;
    END IF;
  END LOOP;
END $$;
