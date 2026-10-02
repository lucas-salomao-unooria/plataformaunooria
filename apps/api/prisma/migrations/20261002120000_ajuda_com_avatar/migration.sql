-- A AJUDA COM AVATAR (ADR-132): o medidor de minutos do atendente em vídeo e os
-- limites que o `admin` edita, mais o produto novo no vocabulário (ADR-87).
--
-- O vendor (LiveAvatar) cobra por MINUTO de avatar, e a decisão do dono do
-- produto foi que a Ajuda NÃO passa pela quota de tokens (exceção à regra 5,
-- ADR-132): o que limita o custo é o tempo. Esta migration guarda o tempo — a
-- conversa em si não é guardada em lugar nenhum.
--
-- O Prisma gera as tabelas e o índice (`migrate diff`); CHECK, semente, GRANT
-- e o CHECK de produto são o bloco MANUAL. Molde: 20260915120000_quota_de_ia_configuravel.

-- CreateTable
CREATE TABLE "ajuda_sessoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "escola_id" TEXT,
    "perfil" TEXT NOT NULL,
    "avatar_sessao_id" TEXT,
    "inicio" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duracao_max_s" INTEGER NOT NULL,
    "fim" TIMESTAMPTZ(6),

    CONSTRAINT "ajuda_sessoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajuda_limites" (
    "chave" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "motivo" TEXT,
    "definido_por" UUID,
    "definido_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajuda_limites_pkey" PRIMARY KEY ("chave")
);

-- CreateIndex
CREATE INDEX "ajuda_sessoes_por_pessoa_idx" ON "ajuda_sessoes"("usuario_id", "inicio" DESC);



-- ===========================================================================
-- Bloco MANUAL. O Prisma não gera CHECK, semente nem GRANT.
-- ===========================================================================

-- ------------------------------------------------------------ ajuda_sessoes

-- Estudante NÃO abre a Ajuda (decisão do dono do produto). O `@Roles` da rota
-- já barra; o CHECK é a segunda tranca, para que uma rota nova esquecida não
-- grave a linha de uma criança. Espelha `PERFIS_DA_AJUDA` de src/ajuda/regras.ts.
ALTER TABLE "ajuda_sessoes"
  ADD CONSTRAINT "ck_ajuda_sessoes_perfil"
    CHECK ("perfil" IN ('professor', 'gestor_escola', 'gestor_regional', 'gestor_contrato', 'admin'));

-- O teto que a api pede ao vendor: entre 30 s e 1 h. Fora disso é erro de
-- programação, e o CHECK impede que ele vire custo.
ALTER TABLE "ajuda_sessoes"
  ADD CONSTRAINT "ck_ajuda_sessoes_duracao"
    CHECK ("duracao_max_s" BETWEEN 30 AND 3600);

ALTER TABLE "ajuda_sessoes"
  ADD CONSTRAINT "ck_ajuda_sessoes_fim"
    CHECK ("fim" IS NULL OR "fim" >= "inicio");

-- **SEM RLS, e esta é a exceção que precisa estar escrita** (ADR-132) — toda
-- tabela com dado de pessoa entra na política da regra inviolável nº 1. Três
-- razões: (a) a Ajuda vale para `gestor_contrato` e `admin`, que não têm escola
-- no token, e a política por `escola_id` esconderia a linha deles de todo
-- mundo, inclusive deles mesmos; (b) não é dado de estudante — o CHECK acima
-- recusa o perfil; (c) não guarda conteúdo, só início, teto e fim de uma
-- sessão de vídeo. Toda query é escopada pelo `usuario_id` do TOKEN.
--
-- **SEM FK em `usuario_id` nem em `escola_id`**, como `ia_uso_diario`: é um
-- medidor, e uma FK com RESTRICT travaria a exclusão de quem já usou a Ajuda.

-- ------------------------------------------------------------ ajuda_limites

-- Vocabulário FECHADO, espelhando `CHAVES_DE_LIMITE` de src/ajuda/regras.ts.
ALTER TABLE "ajuda_limites"
  ADD CONSTRAINT "ck_ajuda_limites_chave"
    CHECK ("chave" IN ('minutos-por-dia', 'minutos-por-sessao'));

-- Zero não é limite: é o interruptor (ADR-87) tentando entrar pela porta
-- errada. Quem quer fechar a Ajuda desliga o produto `ajuda`. O teto de 600
-- minutos/dia é sanidade: um zero a mais no campo não vira custo sem fim. A
-- sessão cabe em 60 minutos — o CHECK de `ajuda_sessoes` aceita até 1 h.
ALTER TABLE "ajuda_limites"
  ADD CONSTRAINT "ck_ajuda_limites_valor"
    CHECK ("valor" > 0 AND "valor" <= 600
           AND ("chave" <> 'minutos-por-sessao' OR "valor" <= 60));

-- SEM RLS e SEM FK em `definido_por`, pelas razões de `ia_quotas`: é
-- configuração comercial do contrato, sem escola, e o histórico com o nome
-- congelado de quem mexeu vive em `recursos_auditoria` (`quota-alterada`).

-- A SEMENTE: 30 minutos por dia e 10 por sessão. Dá três conversas longas por
-- pessoa por dia — a Ajuda é para tirar dúvida, não para treinamento.
INSERT INTO "ajuda_limites" ("chave", "valor", "motivo")
VALUES
  ('minutos-por-dia',    30, 'Padrão da plataforma: três conversas de dez minutos por pessoa por dia.'),
  ('minutos-por-sessao', 10, 'Padrão da plataforma: uma dúvida cabe em dez minutos.')
ON CONFLICT ("chave") DO NOTHING;

-- ------------------------------------------------------------ produto

-- O produto novo no vocabulário (`PRODUTOS` de `src/recursos/catalogo.ts`). Como
-- o `agente-professor`, é produto SEM experiência — nenhuma linha de
-- `experiencias` aponta para ele —, mas o CHECK espelha a tupla INTEIRA e
-- `tests/disponibilidades-postgres.spec.ts` compara os dois textos.
ALTER TABLE "experiencias" DROP CONSTRAINT "ck_experiencias_produto";
ALTER TABLE "experiencias"
  ADD CONSTRAINT "ck_experiencias_produto"
    CHECK ("produto" IS NULL OR "produto" IN
      ('entre-redes', 'plano-de-aula', 'plano-de-ensino', 'bem-estar', 'agente-professor', 'ajuda'));

-- A role de runtime (docs/INFRA.md) conecta sem ownership. Guardado: em dev/CI
-- a role não existe. `ajuda_limites` sem DELETE: sem a linha vale a constante
-- do código, e o log `ajuda-limite-sem-linha` acusa.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON ajuda_sessoes TO app_runtime';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON ajuda_limites TO app_runtime';
  END IF;
END $$;
