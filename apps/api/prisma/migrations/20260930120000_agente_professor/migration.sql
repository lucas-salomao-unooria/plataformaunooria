-- O AGENTE DE IA DO PROFESSOR: a tabela da POSSE das conversas e o produto
-- novo no vocabulário da disponibilidade (ADR-87).
--
-- Contrato das quatro pontas: `docs/regras/agente-professor.md`. O CONTEÚDO da
-- conversa mora na sessão do Vertex AI Agent Engine; esta tabela diz DE QUEM a
-- sessão é. Existe porque os endpoints de sessão do engine por nome de recurso
-- não conferem o usuário, e a SA da api enxerga todas as sessões do engine.
--
-- Tabela da PLATAFORMA, sem prefixo de experiência (convenções de código): o
-- agente é um produto, não uma experiência. O Prisma gera a tabela, os índices e
-- as FKs (`migrate diff`); RLS, GRANT e o CHECK de produto são o bloco MANUAL.

-- CreateTable
CREATE TABLE "agente_professor_conversas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "usuario_id" UUID NOT NULL,
    "sessao_id" TEXT NOT NULL,
    "titulo" TEXT,
    "criada_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizada_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agente_professor_conversas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agente_professor_conversas_sessao_id_key" ON "agente_professor_conversas"("sessao_id");

-- CreateIndex
CREATE INDEX "agente_professor_conversas_lista_idx" ON "agente_professor_conversas"("escola_id", "usuario_id", "atualizada_em" DESC);

-- AddForeignKey
ALTER TABLE "agente_professor_conversas" ADD CONSTRAINT "agente_professor_conversas_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "escolas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agente_professor_conversas" ADD CONSTRAINT "agente_professor_conversas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ===========================================================================
-- Bloco MANUAL. O Prisma não gera CHECK, RLS nem GRANT.
-- ===========================================================================

-- O título é o `titulo_conversa` que o AGENTE escreve com o próprio LLM: um
-- teto aqui impede que um estado inesperado vire uma linha de lista enorme.
-- Espelha `TAMANHO_MAXIMO_DO_TITULO` de `src/agente-professor/regras.ts`.
ALTER TABLE "agente_professor_conversas"
  ADD CONSTRAINT "agente_professor_conversas_titulo_check"
    CHECK ("titulo" IS NULL OR char_length("titulo") BETWEEN 1 AND 120),
  ADD CONSTRAINT "agente_professor_conversas_sessao_id_check"
    CHECK (char_length("sessao_id") BETWEEN 1 AND 200);

-- RLS (regra inviolável nº 1) — a mesma expressão das outras tabelas com
-- `escola_id`. O professor pode escrever o nome de um estudante na pergunta, e
-- o título que o agente gera sai dela.
ALTER TABLE "agente_professor_conversas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agente_professor_conversas" FORCE ROW LEVEL SECURITY;
CREATE POLICY "agente_professor_conversas_por_escola" ON "agente_professor_conversas"
  USING (escola_id = current_setting('app.escola_id', true));

-- O produto novo no vocabulário (`PRODUTOS` de `src/recursos/catalogo.ts`).
-- Nenhuma experiência aponta para ele — é o primeiro produto SEM experiência —,
-- mas o CHECK espelha a tupla INTEIRA, e `tests/disponibilidades-postgres.spec.ts`
-- compara os dois textos: divergir é o Zod aceitando o que o banco recusa.
-- O CHECK de `disponibilidades.recurso_id` é uma regex e já aceita
-- `produto:agente-professor`.
ALTER TABLE "experiencias" DROP CONSTRAINT "ck_experiencias_produto";
ALTER TABLE "experiencias"
  ADD CONSTRAINT "ck_experiencias_produto"
    CHECK ("produto" IS NULL OR "produto" IN
      ('entre-redes', 'plano-de-aula', 'plano-de-ensino', 'bem-estar', 'agente-professor'));

-- A role de runtime (docs/INFRA.md) conecta sem ownership. Guardado: em dev/CI
-- a role não existe. O id é `gen_random_uuid()`: sem sequência a liberar.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "agente_professor_conversas" TO app_runtime;
  END IF;
END $$;
