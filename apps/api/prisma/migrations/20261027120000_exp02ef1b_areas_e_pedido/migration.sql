-- exp02ef1b 2.2.0 (ADR-188): a lupa por foto, a área desenhada e o pedido de imagem.
--
-- 1. A LUPA conta o tempo de cada objeto EM CADA foto. Até a 2.1.0 eram dois
--    tempos, um por objeto "em qualquer das duas fotos": parar a lupa no
--    relógio da foto 1 marcava o relógio da foto 2. Viram quatro colunas, com
--    a chave dos achados da E4 (inv × foto). RENAME e não DROP/ADD: o tempo
--    gravado não se perde. Ele não diz em QUAL foto foi medido, então vai para
--    as duas — a sessão que já passou da lupa continua com os quatro achados.
-- 2. O ALVO de cada objeto deixa de ser um círculo de raio fixo e vira a ÁREA
--    que o professor desenha (um retângulo da panorâmica, `{x, y, w, h}`). O
--    pacote já gravado tem `{x, y, r}`: vira o retângulo que circunscreve o
--    círculo (r em % da largura; na altura, r × 16/9).
-- 3. O PEDIDO DE IMAGEM da cena gerada por IA fica no pacote: o professor o vê
--    e o edita na curadoria. Só a descrição da cena — as regras fixas a api
--    acrescenta a cada chamada, e não são gravadas.
--
-- Os UPDATEs precisam de NO FORCE ROW LEVEL SECURITY em volta: a migração
-- roda sem app.escola_id, e o FORCE barra até o owner (como em 20261010120000).

-- ── 1. a lupa por foto ──────────────────────────────────────────────────────

ALTER TABLE "exp02ef1b_sessoes" DROP CONSTRAINT IF EXISTS "exp02ef1b_sessoes_lupa_check";

ALTER TABLE "exp02ef1b_sessoes" RENAME COLUMN "lupa_alvo1_ms" TO "lupa_inv1_foto1_ms";
ALTER TABLE "exp02ef1b_sessoes" RENAME COLUMN "lupa_alvo2_ms" TO "lupa_inv2_foto1_ms";
ALTER TABLE "exp02ef1b_sessoes"
  ADD COLUMN "lupa_inv1_foto2_ms" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lupa_inv2_foto2_ms" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "exp02ef1b_sessoes" NO FORCE ROW LEVEL SECURITY;
UPDATE "exp02ef1b_sessoes"
   SET "lupa_inv1_foto2_ms" = "lupa_inv1_foto1_ms",
       "lupa_inv2_foto2_ms" = "lupa_inv2_foto1_ms";
ALTER TABLE "exp02ef1b_sessoes" FORCE ROW LEVEL SECURITY;

ALTER TABLE "exp02ef1b_sessoes"
  -- A lupa (E2): o tempo sobre cada um dos dois objetos do fundo, em cada foto.
  ADD CONSTRAINT "exp02ef1b_sessoes_lupa_check"
    CHECK (
      "lupa_inv1_foto1_ms" >= 0 AND "lupa_inv1_foto2_ms" >= 0
      AND "lupa_inv2_foto1_ms" >= 0 AND "lupa_inv2_foto2_ms" >= 0
      AND "lupa_alertas" >= 0
    );

ALTER TABLE "exp02ef1b_sessoes" ALTER COLUMN "versao_instrumento" SET DEFAULT '2.2.0';

-- ── 2. o alvo vira a área ───────────────────────────────────────────────────

ALTER TABLE "exp02ef1b_pacotes" NO FORCE ROW LEVEL SECURITY;
UPDATE "exp02ef1b_pacotes"
   SET "conteudo_json" = jsonb_set(
         "conteudo_json",
         '{cena,invariantes}',
         (
           SELECT jsonb_agg(
                    CASE
                      WHEN jsonb_typeof(inv -> 'alvo') = 'object' AND (inv -> 'alvo') ? 'r' THEN
                        jsonb_set(
                          inv,
                          '{alvo}',
                          jsonb_build_object(
                            'x', round(greatest(0, (inv -> 'alvo' ->> 'x')::numeric - (inv -> 'alvo' ->> 'r')::numeric), 4),
                            'y', round(greatest(0, (inv -> 'alvo' ->> 'y')::numeric - (inv -> 'alvo' ->> 'r')::numeric * 16 / 9), 4),
                            'w', round((inv -> 'alvo' ->> 'r')::numeric * 2, 4),
                            'h', round(least(100, (inv -> 'alvo' ->> 'r')::numeric * 32 / 9), 4)
                          )
                        )
                      ELSE inv
                    END
                    ORDER BY ord
                  )
             FROM jsonb_array_elements("conteudo_json" -> 'cena' -> 'invariantes') WITH ORDINALITY AS t(inv, ord)
         )
       )
 WHERE EXISTS (
         SELECT 1
           FROM jsonb_array_elements("conteudo_json" -> 'cena' -> 'invariantes') AS e(inv)
          WHERE jsonb_typeof(inv -> 'alvo') = 'object' AND (inv -> 'alvo') ? 'r'
       );
ALTER TABLE "exp02ef1b_pacotes" FORCE ROW LEVEL SECURITY;

-- ── 3. o pedido de imagem ───────────────────────────────────────────────────

ALTER TABLE "exp02ef1b_pacotes"
  ADD COLUMN "pedido_da_imagem" TEXT,
  -- Só a cena gerada por IA tem pedido; o Zod da rota limita a 2.000, o banco a 4.000 (a rede final).
  ADD CONSTRAINT "exp02ef1b_pacotes_pedido_check"
    CHECK ("pedido_da_imagem" IS NULL OR (char_length("pedido_da_imagem") BETWEEN 1 AND 4000 AND "chave_cena" = 'ia'));
