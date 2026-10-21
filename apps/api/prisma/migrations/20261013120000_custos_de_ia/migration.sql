-- CUSTOS DE IA (ADR-161): o painel de FinOps da Unooria em /unooria/custos-de-ia.
--
-- Três tabelas, todas de CONTRATO (sem RLS, como `ia_quotas` e
-- `ajuda_sessoes`), lidas só pelo `admin`:
--   1. `ia_consumo_diario`: o que cada chamada de IA PAGOU (tokens, imagens,
--      segundos), somado por dia, escola, perfil, recurso, operação e modelo.
--      Sem `usuario_id`: FinOps não pergunta QUEM (regra 6).
--   2. `ia_precos`: o preço de cada modelo, com VIGÊNCIA. Só se insere: a
--      tabela é o próprio histórico (quem, quando, por quê).
--   3. `cotacoes_dolar`: a PTAX de venda do Banco Central, por dia útil.
--
-- O CUSTO não é gravado em lugar nenhum: é derivado na leitura (consumo ×
-- preço vigente no dia × PTAX do dia). Gravar congelaria um preço errado da
-- semente; derivar deixa a correção valer para trás.

-- ------------------------------------------------------------ ia_consumo_diario

-- `escola_id` e `perfil` são '' (e não NULL) quando não há: a chave do
-- agregado é a PK, e no Postgres NULL ≠ NULL — duas chamadas sem escola
-- criariam duas linhas e o ON CONFLICT nunca casaria.
CREATE TABLE "ia_consumo_diario" (
    "dia" DATE NOT NULL,
    "escola_id" TEXT NOT NULL DEFAULT '',
    "perfil" TEXT NOT NULL DEFAULT '',
    "recurso" TEXT NOT NULL,
    "operacao" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "modalidade" TEXT NOT NULL,
    "chamadas" INTEGER NOT NULL DEFAULT 0,
    "falhas" INTEGER NOT NULL DEFAULT 0,
    "tokens_entrada" BIGINT NOT NULL DEFAULT 0,
    "tokens_saida" BIGINT NOT NULL DEFAULT 0,
    "imagens" INTEGER NOT NULL DEFAULT 0,
    "segundos" BIGINT NOT NULL DEFAULT 0,
    "estimado" BOOLEAN NOT NULL DEFAULT false,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ia_consumo_diario_pkey"
      PRIMARY KEY ("dia", "escola_id", "perfil", "recurso", "operacao", "modelo")
);

-- Espelha `ModalidadeDeIa` de src/ai/consumo-de-ia.ts.
ALTER TABLE "ia_consumo_diario"
  ADD CONSTRAINT "ck_ia_consumo_diario_modalidade"
    CHECK ("modalidade" IN ('texto', 'imagem', 'audio', 'video'));

-- Toda leitura do painel é por período.
CREATE INDEX "ia_consumo_diario_dia_idx" ON "ia_consumo_diario" ("dia");

-- ------------------------------------------------------------ ia_precos

-- `usd` é por 1 MILHÃO de tokens em `entrada`/`saida` e por MINUTO em
-- `minuto` (o avatar em vídeo, cobrado pelo tempo). Uma linha nova por mudança:
-- o preço que vale num dia é o de maior `vigente_desde` <= aquele dia.
CREATE TABLE "ia_precos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "modelo" TEXT NOT NULL,
    "componente" TEXT NOT NULL,
    "usd" NUMERIC(14, 6) NOT NULL,
    "vigente_desde" DATE NOT NULL,
    "motivo" TEXT,
    -- NULO = veio da migration. Sem FK, como `ia_quotas.definido_por`.
    "definido_por" UUID,
    "definido_por_nome" TEXT,
    "definido_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ia_precos_pkey" PRIMARY KEY ("id")
);

-- Espelha `COMPONENTES_DE_PRECO` de src/recursos/custos-de-ia.ts.
ALTER TABLE "ia_precos"
  ADD CONSTRAINT "ck_ia_precos_componente" CHECK ("componente" IN ('entrada', 'saida', 'minuto'));
ALTER TABLE "ia_precos" ADD CONSTRAINT "ck_ia_precos_usd" CHECK ("usd" >= 0);
-- O nome vai para a tela e para a busca do preço: só o formato de um id de modelo.
ALTER TABLE "ia_precos"
  ADD CONSTRAINT "ck_ia_precos_modelo" CHECK ("modelo" ~ '^[a-z0-9][a-z0-9._-]{1,79}$');

-- Dois preços para o mesmo componente no mesmo dia seriam uma escolha pela
-- ordem do índice: o segundo SUBSTITUI o primeiro (ON CONFLICT na rota).
CREATE UNIQUE INDEX "ia_precos_vigencia_unica"
  ON "ia_precos" ("modelo", "componente", "vigente_desde");

-- A semente: preço de LISTA da Vertex (endpoint global, contexto <= 200k) e
-- da LiveAvatar, lidos em 13/10/2026. É ponto de partida — o contrato pode ter
-- desconto, e o `admin` corrige no painel com vigência retroativa.
--   * Gemini 3.x Flash: preço introdutório até 31/12/2026; de 01/01/2027 em
--     diante, o dobro (a própria página da Vertex anuncia).
--   * Imagem: a saída é token de IMAGEM ($60/1M, ~1120 tokens por imagem 1K).
--   * Voz (Gemini-TTS na Cloud TTS) e Live: a saída é token de ÁUDIO
--     (25 tokens por segundo). A entrada do Live é a do áudio do microfone.
--   * Avatar (LiveAvatar FULL): 2 créditos por minuto a ~US$ 0,09 o crédito
--     (plano Essential: US$ 99 por 1.100 créditos).
INSERT INTO "ia_precos" ("modelo", "componente", "usd", "vigente_desde", "motivo") VALUES
  ('gemini-3.6-flash', 'entrada', 0.75, '2026-01-01', 'Preço de lista da Vertex (global), lido em 13/10/2026.'),
  ('gemini-3.6-flash', 'saida', 3.75, '2026-01-01', 'Preço de lista da Vertex (global), lido em 13/10/2026.'),
  ('gemini-3.6-flash', 'entrada', 1.50, '2027-01-01', 'Fim do preço introdutório anunciado pela Vertex.'),
  ('gemini-3.6-flash', 'saida', 7.50, '2027-01-01', 'Fim do preço introdutório anunciado pela Vertex.'),
  ('gemini-3.7-flash', 'entrada', 0.75, '2026-01-01', 'Preço de lista da Vertex (global), lido em 13/10/2026.'),
  ('gemini-3.7-flash', 'saida', 3.75, '2026-01-01', 'Preço de lista da Vertex (global), lido em 13/10/2026.'),
  ('gemini-3.7-flash', 'entrada', 1.50, '2027-01-01', 'Fim do preço introdutório anunciado pela Vertex.'),
  ('gemini-3.7-flash', 'saida', 7.50, '2027-01-01', 'Fim do preço introdutório anunciado pela Vertex.'),
  ('gemini-3.8-flash', 'entrada', 0.75, '2026-01-01', 'Preço de lista da Vertex (global), lido em 13/10/2026.'),
  ('gemini-3.8-flash', 'saida', 3.75, '2026-01-01', 'Preço de lista da Vertex (global), lido em 13/10/2026.'),
  ('gemini-3.8-flash', 'entrada', 1.50, '2027-01-01', 'Fim do preço introdutório anunciado pela Vertex.'),
  ('gemini-3.8-flash', 'saida', 7.50, '2027-01-01', 'Fim do preço introdutório anunciado pela Vertex.'),
  ('gemini-3.5-flash-lite', 'entrada', 0.30, '2026-01-01', 'Preço de lista da Vertex (global), lido em 13/10/2026.'),
  ('gemini-3.5-flash-lite', 'saida', 2.50, '2026-01-01', 'Preço de lista da Vertex (global), lido em 13/10/2026.'),
  ('gemini-3.1-flash-image', 'entrada', 0.50, '2026-01-01', 'Preço de lista da Vertex (global), lido em 13/10/2026.'),
  ('gemini-3.1-flash-image', 'saida', 60.00, '2026-01-01', 'Saída de IMAGEM, lida em 13/10/2026 (~US$ 0,067 por imagem 1K).'),
  ('gemini-2.5-flash-tts', 'entrada', 0.50, '2026-01-01', 'Gemini-TTS na Cloud Text-to-Speech, lido em 13/10/2026.'),
  ('gemini-2.5-flash-tts', 'saida', 10.00, '2026-01-01', 'Saída de ÁUDIO (25 tokens/s), lida em 13/10/2026.'),
  ('gemini-3.8-live', 'entrada', 3.00, '2026-01-01', 'Entrada de ÁUDIO da Live API (regional), lida em 13/10/2026.'),
  ('gemini-3.8-live', 'saida', 12.00, '2026-01-01', 'Saída de ÁUDIO da Live API (regional), lida em 13/10/2026.'),
  ('liveavatar-full', 'minuto', 0.18, '2026-01-01', 'FULL Mode = 2 créditos/min a ~US$ 0,09 (plano Essential), lido em 13/10/2026.');

-- ------------------------------------------------------------ cotacoes_dolar

-- Só dias úteis: fim de semana e feriado não têm PTAX, e o dia sem linha usa
-- a do último dia útil anterior (a mesma regra do Banco Central).
CREATE TABLE "cotacoes_dolar" (
    "dia" DATE NOT NULL,
    "compra" NUMERIC(10, 4) NOT NULL,
    "venda" NUMERIC(10, 4) NOT NULL,
    "cotado_em" TIMESTAMPTZ(6) NOT NULL,
    "buscado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cotacoes_dolar_pkey" PRIMARY KEY ("dia")
);

-- ------------------------------------------------------------ a role de runtime

-- A api roda como `app_runtime` em dev/hml/prd (o Postgres local não tem a
-- role, e é por isso que a suíte passa sem isto). Sem o GRANT, o registro de
-- consumo falharia CALADO (só o log `ia-consumo-nao-gravado`) e o painel daria
-- 500. UPDATE nas três: o consumo e a PTAX são upsert, e o preço da mesma data
-- substitui aquela vigência. Sem DELETE: a tabela de preços é o histórico.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON ia_consumo_diario, ia_precos, cotacoes_dolar TO app_runtime';
  END IF;
END $$;
