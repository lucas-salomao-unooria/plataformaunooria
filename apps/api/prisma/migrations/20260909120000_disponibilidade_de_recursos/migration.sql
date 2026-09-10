-- O INTERRUPTOR DA REDE: produto e experiência passam a poder ser desligados
-- (ADR-87), e a experiência passa a declarar A QUE PRODUTO pertence.
--
-- O QUE FALTAVA. Havia dois eixos decidindo se uma missão abre — o catálogo
-- (`experiencias`: série, unidade, público) e a liberação por turma
-- (`liberacoes`, ADR-69) — e nenhum deles responde "este produto existe nesta
-- rede?". A resposta vivia em duas constantes compiladas no bundle do hub:
-- `PRODUTOS` (apps/hub/lib/produtos.ts) e o `status: 'disponivel' | 'em-breve'`
-- do catálogo do Entre Redes. Desligar o jogo numa rede era, literalmente,
-- editar TypeScript e fazer deploy.
--
-- O TERCEIRO EIXO, com nome próprio para não se confundir com os outros dois:
--
--   catálogo         que forma a experiência tem?      o manifesto / o CI
--   liberação        está aberta NESTA TURMA?          o professor
--   disponibilidade  existe NESTA REDE?                a Unooria (`admin`)
--
-- Disponibilidade é PRÉ-CONDIÇÃO de liberação, nunca o contrário.
--
-- Molde do bloco manual: 20260905120000_liberacoes_por_turma.

-- ============================================================ produto

-- A QUE PRODUTO a experiência pertence. Declarado no `public/experiencia.json`
-- e escrito por `PUT /experiencias/:expId` — a MESMA cadeia de `unidade` e
-- `permissoes`, e ela tem de ser percorrida inteira (Zod → coluna →
-- publicar-manifesto.mjs → seed → _template), senão o campo é invisível em dev
-- e nasce vazio em produção.
--
-- É esta coluna que faz o painel se auto-estender: a composição produto →
-- experiências é DERIVADA do manifesto, não uma lista mantida à mão que alguém
-- esquece de atualizar quando a exp-08 nascer.
--
-- NULÁVEL, e não NOT NULL com default: default nenhum é correto aqui (a exp-91
-- não é "entre-redes" por omissão), e uma linha antiga sem produto é dado real
-- — ela responde só pelo próprio interruptor. Quem impede uma experiência NOVA
-- de nascer assim é o teste `manifestos-declaram-produto.spec.ts`, não o banco.
ALTER TABLE "experiencias" ADD COLUMN "produto" TEXT;

-- O backfill das nove que existem. Escrito à mão porque é a única vez: daqui em
-- diante o valor chega pelo manifesto, no publish.
UPDATE "experiencias" SET "produto" = 'entre-redes'    WHERE "exp_id" IN
  ('exp-01-instanooria', 'exp-02-unootube', 'exp-03-unoogpt',
   'exp-06-rastro-boato', 'exp-07-o-eco-no-grupo', 'exp-70-vila-do-lume');
UPDATE "experiencias" SET "produto" = 'plano-de-aula'   WHERE "exp_id" = 'exp-90-plano-de-aula';
UPDATE "experiencias" SET "produto" = 'bem-estar'       WHERE "exp_id" = 'exp-91-bem-estar';
UPDATE "experiencias" SET "produto" = 'plano-de-ensino' WHERE "exp_id" = 'exp-92-plano-de-ensino';

-- Vocabulário FECHADO, e o CHECK espelha `PRODUTOS` de src/recursos/catalogo.ts.
-- O teste `disponibilidades-postgres.spec.ts` prende os dois pelo mesmo motivo
-- de `ck_experiencias_permissoes`: quando aquele par divergiu, o custo foi um
-- deploy inteiro — o Zod aceitou `forms`, o banco recusou, e o 500 do
-- `PUT /experiencias/:expId` só aparecia no log da api. Local não pega, porque
-- em dev o hub lê o manifesto do dev server do Vite e não encosta nesta tabela.
ALTER TABLE "experiencias"
  ADD CONSTRAINT "ck_experiencias_produto"
    CHECK ("produto" IS NULL OR "produto" IN
      ('entre-redes', 'plano-de-aula', 'plano-de-ensino', 'bem-estar'));

-- ============================================================ disponibilidades

-- CreateTable
CREATE TABLE "disponibilidades" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recurso_id" TEXT NOT NULL,
    "escola_id" TEXT,
    "ligado" BOOLEAN NOT NULL,
    "versao_fixa" TEXT,
    "motivo" TEXT,
    "definido_por" UUID NOT NULL,
    "definido_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disponibilidades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "disponibilidades_recurso_id_escola_id_key"
  ON "disponibilidades"("recurso_id", "escola_id");

-- CreateIndex
CREATE INDEX "disponibilidades_recurso_id_idx" ON "disponibilidades"("recurso_id");

-- AddForeignKey
ALTER TABLE "disponibilidades" ADD CONSTRAINT "disponibilidades_escola_id_fkey"
  FOREIGN KEY ("escola_id") REFERENCES "escolas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disponibilidades" ADD CONSTRAINT "disponibilidades_definido_por_fkey"
  FOREIGN KEY ("definido_por") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------- bloco MANUAL

-- A ARMADILHA PRINCIPAL DESTE ARQUIVO. O índice único acima **não** impede duas
-- linhas de escopo-contrato: no Postgres `NULL` é distinto de `NULL` num índice
-- único, então `('produto:bem-estar', NULL)` cabe quantas vezes se quiser. Dois
-- cliques em "desligar para a rede" criariam duas linhas, e o resolvedor
-- passaria a depender da ordem do `findMany` — sem erro, sem sintoma, até as
-- duas discordarem.
--
-- Parcial pelo mesmo motivo de `escolas_regional_padrao_unica`, e é ele que dá
-- idempotência de graça ao upsert do painel.
CREATE UNIQUE INDEX "disponibilidades_recurso_no_contrato_unica"
  ON "disponibilidades"("recurso_id")
  WHERE "escola_id" IS NULL;

-- O vocabulário do id espelha `RECURSO_ID_RE` de src/recursos/catalogo.ts. Id
-- é texto com prefixo, e não duas colunas (`tipo` + `alvo`), porque a chave da
-- decisão é o par (recurso, escopo): com duas colunas o único acima teria TRÊS
-- campos, um deles nulável — de novo o desenho em que o Postgres não garante
-- unicidade.
ALTER TABLE "disponibilidades"
  ADD CONSTRAINT "ck_disponibilidades_recurso_id"
    CHECK ("recurso_id" ~ '^(produto|experiencia):[a-z0-9-]+$');

-- `versao_fixa` só existe para experiência: produto não tem bundle, logo não tem
-- versão. Sem o CHECK, o campo aceitaria valor numa linha `produto:*` e não
-- faria nada — a mesma razão pela qual `fullscreen` ficou FORA de `permissoes`:
-- campo que não muda nada é pior que campo nenhum, porque quem lê acredita que
-- declarou algo.
ALTER TABLE "disponibilidades"
  ADD CONSTRAINT "ck_disponibilidades_versao_so_em_experiencia"
    CHECK ("versao_fixa" IS NULL OR "recurso_id" LIKE 'experiencia:%');

-- DESLIGAR EXIGE MOTIVO. "Desligado sem motivo" é o estado que ninguém sabe
-- desfazer: seis meses depois, quem abre o painel não tem como saber se aquilo
-- é uma decisão comercial ou um incidente que ninguém reverteu. Ligar não pede
-- motivo — ligado é o estado normal, e é a exceção que precisa se explicar.
--
-- No banco e não só no Zod de propósito: um acerto em SQL no meio de um
-- incidente é o caso REAL, e escrever `, 'incidente #123'` ali custa nada
-- perto de um painel que não sabe explicar o que ele mesmo mostra.
ALTER TABLE "disponibilidades"
  ADD CONSTRAINT "ck_disponibilidades_motivo_ao_desligar"
    CHECK ("ligado" OR "motivo" IS NOT NULL);

-- **SEM RLS**, e isto é a exceção que precisa estar escrita — toda tabela nova
-- deste repo entra na política da regra inviolável nº 1.
--
-- Duas razões. (a) Não é dado de estudante: é configuração comercial e
-- operacional da rede, do mesmo naipe de `experiencias` (que também está fora).
-- (b) A linha de escopo-contrato tem `escola_id IS NULL` POR DESENHO, e a
-- política `escola_id = current_setting('app.escola_id')` a esconderia de todo
-- mundo — ou seja, esconderia exatamente a resposta que a tabela existe para
-- dar. É o mesmo motivo pelo qual `users`, `turmas` e `lotacoes` ficam fora: são
-- lidas ANTES de haver escola no contexto.
--
-- O que protege a escrita é o `RolesGuard` (`@Roles("admin")`), e a leitura é
-- pública para qualquer autenticado — saber que o Entre Redes está ligado na
-- sua rede não é dado sensível de ninguém.

-- ============================================================ histórico

-- O HISTÓRICO DE VERSÕES — e ele conserta um bug que ninguém tinha notado.
--
-- Rollback hoje é `publicar-manifesto.mjs <exp> --versao x.y.z`, que manda o
-- número ANTIGO com o manifesto ATUAL do repositório. Ou seja: voltar a versão
-- não volta `viewport`, `permissoes`, `series` nem `unidade`. É exatamente a
-- classe de bug que o AGENTS.md das experiências já documenta — iframe sem
-- `allow-pointer-lock` faz a criança entrar na Vila e a câmera não girar, sem
-- erro em lugar nenhum.
--
-- Guardando o manifesto INTEIRO por versão, o rollback do painel passa a ser
-- fiel: ele reescreve as colunas com o que aquela versão realmente tinha.
CREATE TABLE "experiencias_versoes" (
    "exp_id" TEXT NOT NULL,
    "versao" TEXT NOT NULL,
    "manifesto" JSONB NOT NULL,
    "publicada_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publicada_por" TEXT NOT NULL,

    CONSTRAINT "experiencias_versoes_pkey" PRIMARY KEY ("exp_id", "versao")
);

-- CreateIndex
CREATE INDEX "experiencias_versoes_exp_id_publicada_em_idx"
  ON "experiencias_versoes"("exp_id", "publicada_em" DESC);

-- `publicada_por` é TEXTO SEM FK, ao contrário de `disponibilidades.definido_por`.
-- Quem publica quase sempre é o CI, e o token dele tem `sub = 'ci-deploy'` — que
-- não é uuid e não existe em `users`. Uma FK aqui faria o job de ativação do
-- deploy.yml morrer na constraint, DEPOIS de os bundles já terem subido e com a
-- `versao_ativa` ainda apontando para a versão antiga.

-- Sem FK de `exp_id` para `experiencias`, pela mesma razão de `liberacoes` e
-- `progresso`: aquele catálogo é escrito pelo CI no publish, e numa stack nova
-- ele está vazio.

-- O histórico nasce com o que já está no ar: a `versao_ativa` de hoje É uma
-- versão publicada, e sem esta linha o painel abriria com "nenhuma versão
-- conhecida" para as nove experiências — a tela vazia que faz a pessoa duvidar
-- da tela em vez do dado. `manifesto` sai das próprias colunas.
INSERT INTO "experiencias_versoes"
  ("exp_id", "versao", "manifesto", "publicada_em", "publicada_por")
SELECT
  "exp_id",
  "versao_ativa",
  jsonb_build_object(
    'id', "exp_id",
    'nome', "nome",
    'versao', "versao_ativa",
    'series', to_jsonb("series"),
    'unidade', "unidade",
    'capabilities', to_jsonb("capabilities"),
    'viewport', "viewport",
    'publico', "publico",
    'permissoes', to_jsonb("permissoes"),
    'produto', "produto"
  ),
  "atualizado_em",
  'backfill-migracao'
  FROM "experiencias"
ON CONFLICT DO NOTHING;

-- Também SEM RLS: é o mesmo dado de `experiencias`, com uma linha por versão.

-- A role de runtime (docs/INFRA.md) conecta sem ownership e precisa de
-- privilégio nas tabelas novas. Guardado: em dev/CI a role não existe.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON disponibilidades TO app_runtime';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON experiencias_versoes TO app_runtime';
  END IF;
END $$;
