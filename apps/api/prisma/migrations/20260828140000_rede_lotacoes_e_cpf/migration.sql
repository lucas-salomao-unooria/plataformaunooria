-- A REDE: escola identificável, professor em mais de uma escola, e o CPF como
-- identidade imutável do estudante.
--
-- O QUE MUDA, E O QUE DELIBERADAMENTE NÃO MUDA
--
-- Trinta e uma tabelas carregam `escola_id` e dezenove arquivos da api derivam a
-- escola do TOKEN. Nenhum deles é tocado aqui, e isso é a decisão central: o
-- token continua carregando UMA escola, a RLS continua sendo
-- `escola_id = current_setting('app.escola_id')`, e a regra inviolável nº 1
-- continua literalmente verdadeira.
--
-- O que entra é a camada que faltava ACIMA disso:
--
-- 1. `lotacoes` — o vínculo PESSOA × ESCOLA, datado. "Lotação" é o termo que a
--    rede pública usa para a alocação de um servidor a uma unidade, e é
--    exatamente isso. O professor tem lotação em várias escolas; ao entrar, ele
--    ESCOLHE em qual está trabalhando, e o token leva essa. O estudante tem uma
--    ativa; trocar de escola é transferência, que encerra a anterior.
--    É o `roles.csv` do OneRoster: papel no nível da organização.
--
-- 2. `users.cpf_hash` — a identidade IMUTÁVEL do estudante. Nome muda, login
--    muda, matrícula muda, escola muda; o CPF não. É por ele que uma
--    transferência é reconhecida como a mesma criança em vez de virar uma
--    segunda pessoa com o histórico partido em duas.
--
-- 3. `escolas.municipio` / `uf` — numa rede estadual são milhares de escolas em
--    centenas de municípios. Sem isso a lista de escolas é inutilizável.
--
-- O CPF NUNCA É GUARDADO EM CLARO. A coluna é `HMAC-SHA256(cpf, CPF_PEPPER)`,
-- determinístico de propósito: é o que permite procurar e reconhecer a mesma
-- pessoa. O que fica legível são os três últimos dígitos, para confirmação
-- humana na tela — três dígitos não reconstroem um CPF. Sem a pimenta
-- configurada, a importação RECUSA a coluna em vez de guardar o número de outro
-- jeito.

-- ============================================================================
-- 1. ESCOLAS — identificação numa rede
-- ============================================================================

ALTER TABLE "escolas"
  ADD COLUMN "municipio" TEXT,
  ADD COLUMN "uf" TEXT;

ALTER TABLE "escolas"
  ADD CONSTRAINT "escolas_uf_check"
    CHECK ("uf" IS NULL OR "uf" ~ '^[A-Z]{2}$');

-- ============================================================================
-- 2. LOTAÇÕES — pessoa × escola
-- ============================================================================

CREATE TABLE "lotacoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "usuario_id" UUID NOT NULL,
    "papel" TEXT NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "inicio" DATE NOT NULL,
    "fim" DATE,
    "fonte_id" TEXT,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "lotacoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lotacoes_escola_id_usuario_id_papel_key"
  ON "lotacoes"("escola_id", "usuario_id", "papel");
CREATE INDEX "lotacoes_usuario_id_idx" ON "lotacoes"("usuario_id");
CREATE INDEX "lotacoes_escola_id_papel_idx" ON "lotacoes"("escola_id", "papel");

ALTER TABLE "lotacoes"
  ADD CONSTRAINT "lotacoes_papel_check" CHECK ("papel" IN ('estudante','professor','gestor')),
  ADD CONSTRAINT "lotacoes_intervalo_check" CHECK ("fim" IS NULL OR "fim" >= "inicio"),
  ADD CONSTRAINT "lotacoes_escola_id_fkey"
    FOREIGN KEY ("escola_id") REFERENCES "escolas"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "lotacoes_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- O ESTUDANTE tem UMA lotação ativa. Não é regra de tela: é o banco que garante,
-- porque "estudante em duas escolas ao mesmo tempo" quebra a leitura do histórico e
-- é indistinguível de uma transferência que ficou pela metade.
CREATE UNIQUE INDEX "lotacoes_uma_escola_por_estudante_ativo"
  ON "lotacoes"("usuario_id")
  WHERE "papel" = 'estudante' AND "fim" IS NULL;

-- SEM RLS, de propósito, e pelo mesmo motivo de `users`/`turmas`: esta tabela é
-- lida no LOGIN, antes de se saber a escola — é ela que responde "quais escolas
-- são suas". Uma política por `escola_id` esconderia justamente a resposta, e o
-- sintoma seria o professor de duas escolas não conseguindo trocar para a
-- segunda. Os services filtram `escola_id` explicitamente, como sempre.

-- Backfill: a escola que cada pessoa já tinha vira a lotação principal dela.
INSERT INTO "lotacoes" ("escola_id", "usuario_id", "papel", "principal", "inicio")
SELECT u."escola_id", u."id", u."role", true,
       COALESCE(
         (SELECT "inicio" FROM "periodos_letivos"
           WHERE "tipo" = 'ano_letivo' ORDER BY "inicio" DESC LIMIT 1),
         CURRENT_DATE
       )
  FROM "users" u
 WHERE u."escola_id" IS NOT NULL
   AND u."role" IN ('estudante','professor','gestor')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. CPF — identidade imutável do estudante
-- ============================================================================

ALTER TABLE "users"
  ADD COLUMN "cpf_hash" TEXT,
  ADD COLUMN "cpf_final" TEXT;

ALTER TABLE "users"
  -- Hash de SHA-256 em hexadecimal: 64 caracteres. O CHECK existe para o número
  -- em claro não caber na coluna por acidente de código.
  ADD CONSTRAINT "users_cpf_hash_check"
    CHECK ("cpf_hash" IS NULL OR "cpf_hash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "users_cpf_final_check"
    CHECK ("cpf_final" IS NULL OR "cpf_final" ~ '^[0-9]{3}$');

-- Único por CONTRATO, não por escola: o CPF é a identidade da pessoa na REDE
-- inteira. É esta unicidade que transforma "esse CPF já existe na escola B" em
-- transferência reconhecida, em vez de duas crianças com o histórico partido.
CREATE UNIQUE INDEX "users_cpf_hash_key"
  ON "users"("cpf_hash")
  WHERE "cpf_hash" IS NOT NULL;
