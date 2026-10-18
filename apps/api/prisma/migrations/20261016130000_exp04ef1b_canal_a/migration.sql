-- exp04ef1b 3.0.0 — Canal A puro (ADR-168). O Canal B (P1/P2 do Desafio Final)
-- saiu; as três habilidades passam a ser medidas só por AÇÃO:
--   - os JULGAMENTOS ✓/✗ das pistas no "Adicionar ao Jornal" e no "Deixar de
--     fora" (EF15CO04);
--   - a Chave do Editor MONTADA (blocos, condições, "pare/siga", repetição) e a
--     SIMULAÇÃO dela em duas matérias novas (EF15CO02);
--   - a 2ª edição e a TRANSFERÊNCIA por ação, o boato com "Repassar" à mão
--     (EF04CO08).
-- Só acrescenta: nenhuma coluna sai, nenhuma política de RLS muda. As colunas
-- da Chave antiga (`chave_tentativas`, `chave_formada_em`) ficam — a 3.0.0 grava
-- uma tentativa e o carimbo no envio da montagem, e as rodadas antigas seguem
-- legíveis no painel.

ALTER TABLE "exp04ef1b_pacotes"
  -- As duas matérias da SIMULAÇÃO (`s1`, `s2`), sem imagem. Nulo nos pacotes
  -- anteriores à 3.0.0: a turma usa as do banco padrão (`catalogo.ts`).
  ADD COLUMN "simulacao" JSONB;

ALTER TABLE "exp04ef1b_pacotes"
  ADD CONSTRAINT "exp04ef1b_pacotes_simulacao_check"
    CHECK ("simulacao" IS NULL
           OR (jsonb_typeof("simulacao") = 'array' AND jsonb_array_length("simulacao") = 2));

ALTER TABLE "exp04ef1b_sessoes"
  -- `[{ noticiaId, tipo, veredito, decisao, em }]`, o PRIMEIRO julgamento de
  -- cada (notícia, pista), só antes da 1ª publicação.
  ADD COLUMN "julgamentos" JSONB NOT NULL DEFAULT '[]',
  -- A Chave como a criança a enviou: `{ vagas: [{ bloco, aprova, reprova,
  -- seReprovar }], repeticao }`. Uma vez só, sem correção.
  ADD COLUMN "chave_montagem" JSONB,
  -- A execução da Chave nas duas matérias: `{ materias: [{ id, passos:
  -- [{ tipo, veredito }], decisao }] }`.
  ADD COLUMN "simulacao" JSONB,
  ADD COLUMN "simulada_em" TIMESTAMPTZ(6),
  -- A transferência: `{ pistas: [tipo], decisao: 'repassar' | 'nao_repassar' }`.
  ADD COLUMN "transferencia" JSONB,
  ADD COLUMN "transferida_em" TIMESTAMPTZ(6);

ALTER TABLE "exp04ef1b_sessoes"
  DROP CONSTRAINT "exp04ef1b_sessoes_passo_check",
  DROP CONSTRAINT "exp04ef1b_sessoes_chave_check",
  DROP CONSTRAINT "exp04ef1b_sessoes_latch2_check";

ALTER TABLE "exp04ef1b_sessoes"
  ADD CONSTRAINT "exp04ef1b_sessoes_passo_check"
    CHECK ("passo" IN ('desafio', 'mesa', 'motivo', 'publicada', 'resultado', 'chave',
                       'revisao', 'comparativo', 'simulacao', 'transferencia', 'fim')),
  ADD CONSTRAINT "exp04ef1b_sessoes_chave_check"
    CHECK ("chave_tentativas" >= 0
           AND (("chave_formada_em" IS NOT NULL)
                = ("passo" IN ('revisao', 'comparativo', 'simulacao', 'transferencia', 'fim')))
           AND ("chave_formada_em" IS NULL OR "chave_tentativas" >= 1)),
  ADD CONSTRAINT "exp04ef1b_sessoes_latch2_check"
    CHECK (("publicada2_em" IS NOT NULL) = ("passo" IN ('comparativo', 'simulacao', 'transferencia', 'fim'))),
  ADD CONSTRAINT "exp04ef1b_sessoes_julgamentos_check"
    CHECK (jsonb_typeof("julgamentos") = 'array'),
  -- A montagem é o gesto que forma a Chave: com ela, o carimbo. A volta não
  -- vale — as rodadas da 2.x formaram a Chave sem montagem.
  ADD CONSTRAINT "exp04ef1b_sessoes_montagem_check"
    CHECK ("chave_montagem" IS NULL
           OR (jsonb_typeof("chave_montagem") = 'object' AND "chave_formada_em" IS NOT NULL)),
  -- Simulação e transferência: carimbo ⇔ dado, e só depois do passo delas.
  -- Implicação, não equivalência: a sessão da 2.x que já estava em
  -- `transferencia` passou pela simulação que não existia.
  ADD CONSTRAINT "exp04ef1b_sessoes_simulacao_check"
    CHECK ((("simulada_em" IS NULL) = ("simulacao" IS NULL))
           AND ("simulada_em" IS NULL OR "passo" IN ('transferencia', 'fim'))),
  ADD CONSTRAINT "exp04ef1b_sessoes_transferencia_check"
    CHECK ((("transferida_em" IS NULL) = ("transferencia" IS NULL))
           AND ("transferida_em" IS NULL OR "passo" IN ('transferencia', 'fim')));

-- A versão do instrumento (DAD-06): a sessão nova nasce na 2.0.0, a do Canal A
-- puro; as da 2.x ficam na 1.0.0, e o reprocessamento histórico as distingue.
ALTER TABLE "exp04ef1b_sessoes" ALTER COLUMN "versao_instrumento" SET DEFAULT '2.0.0';
