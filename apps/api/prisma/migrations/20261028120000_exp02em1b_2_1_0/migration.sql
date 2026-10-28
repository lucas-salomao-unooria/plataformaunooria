-- O Efeito Amplificador 2.1.0 (ADR-191): a missão revisada pelo PO
-- (artefatos de 2026-10-27). Só ALTERA — nenhuma tabela nova, nenhuma apagada.
--
-- 1. O gate da turma ganha os nomes do PRD (API-010):
--    aberta → exploracao, debate → pausa (explicar fica).
-- 2. O conteúdo dos pacotes da 2.0.x passa à forma nova, para continuar
--    legível no hub e na sala: ganha a PAUTA do grêmio, o veículo vira
--    `fonteOriginal`, e cada comentário perde o @handle, troca o horário para
--    o formato "02h40" e a categoria para o vocabulário do PRD
--    (risco_seguranca → anonimo_agressivo, neutro → engajamento). A régua
--    nova só vale na homologação: o pacote antigo continua rodando como foi
--    aprovado.
-- 3. As sessões e as marcas de evidência ficam como estão: a prévia e o feed
--    da 2.0.x são lidos com tolerância (`lerPrevia`, `lerFeed`), e cada marca
--    carrega a versão da ficha que a mediu.

-- 1. O gate ------------------------------------------------------------------

ALTER TABLE "exp02em1b_gates_turma" DROP CONSTRAINT "exp02em1b_gates_turma_fase_check";
ALTER TABLE "exp02em1b_gates_historico" DROP CONSTRAINT "exp02em1b_gates_historico_fase_check";

UPDATE "exp02em1b_gates_turma" SET "fase" = 'exploracao' WHERE "fase" = 'aberta';
UPDATE "exp02em1b_gates_turma" SET "fase" = 'pausa' WHERE "fase" = 'debate';
UPDATE "exp02em1b_gates_historico" SET "fase" = 'pausa' WHERE "fase" = 'debate';

ALTER TABLE "exp02em1b_gates_turma" ALTER COLUMN "fase" SET DEFAULT 'exploracao';
ALTER TABLE "exp02em1b_gates_turma"
  ADD CONSTRAINT "exp02em1b_gates_turma_fase_check" CHECK ("fase" IN ('exploracao', 'pausa', 'explicar'));
ALTER TABLE "exp02em1b_gates_historico"
  ADD CONSTRAINT "exp02em1b_gates_historico_fase_check" CHECK ("fase" IN ('pausa', 'explicar'));

-- 2. O conteúdo dos pacotes da 2.0.x --------------------------------------------

UPDATE "exp02em1b_pacotes" p
SET "conteudo_json" =
  (p."conteudo_json" - 'veiculo' - 'comentarios')
  || jsonb_build_object(
       'fonteOriginal', p."conteudo_json" -> 'veiculo',
       'pauta', jsonb_build_object(
         'titulo', left('Campanha ' || p."tema", 80),
         'descricao', left('Mobilização do grêmio estudantil sobre ' || p."tema" || ', com hábitos digitais conscientes e diálogo respeitoso.', 250),
         'orientacoes', jsonb_build_array(
           'Produza uma mensagem informativa e acolhedora para os estudantes.',
           'Audite fontes e remova menções diretas à vida privada de colegas.',
           'Garanta que o conteúdo promova a integração e o bem-estar coletivo.'
         )
       ),
       'comentarios', (
         SELECT coalesce(jsonb_agg(
           jsonb_build_object(
             'id', c -> 'id',
             'autor', c -> 'autor',
             'horario', to_jsonb(replace(c ->> 'horario', ':', 'h')),
             'tipo', to_jsonb(CASE c ->> 'tipo'
                               WHEN 'risco_seguranca' THEN 'anonimo_agressivo'
                               WHEN 'neutro' THEN 'engajamento'
                               ELSE c ->> 'tipo' END),
             'texto', c -> 'texto'
           ) ORDER BY ord), '[]'::jsonb)
         FROM jsonb_array_elements(p."conteudo_json" -> 'comentarios') WITH ORDINALITY AS e(c, ord)
       )
     )
WHERE p."conteudo_json" ? 'veiculo';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "exp02em1b_pacotes" WHERE NOT ("conteudo_json" ? 'pauta') OR "conteudo_json" ? 'veiculo') THEN
    RAISE EXCEPTION 'exp02em1b 2.1.0: sobrou pacote na forma da 2.0.x';
  END IF;
END $$;
