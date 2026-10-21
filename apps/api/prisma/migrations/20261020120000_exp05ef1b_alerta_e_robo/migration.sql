-- exp05ef1b — o alerta do grupo e o robô do grupo (instrumento 2.5.0).
--
-- Duas ações do Canal A trocam de forma:
--
--   EF05CO03: o CARTÃO DE FRASES vira o ALERTA DO GRUPO — no fim do Mural
--   revelado, a criança monta um filtro com E, OU e NÃO sobre o quadro das
--   oito mensagens, vê o resultado e envia o alerta, em quatro pedidos fixos.
--   Coluna nova `alertas` (um item por pedido aberto, com as execuções e o
--   enviado) e o carimbo `alertas_em`, no QUARTO envio, junto da marca.
--   As colunas do cartão (`frases_operacoes`, `respostas_operacoes`,
--   `operacoes_em`) ficam pelo histórico; nenhuma rota as escreve mais.
--
--   EF05CO04: a REGRA DO TIO com previsão vira o ROBÔ DO GRUPO — blocos com o
--   laço opcional, ligado em quatro mensagens, sem previsão. Reusa
--   `regra_testes` (as ligações) e `regra_final`/`regra_em` (o robô enviado),
--   agora com `laco`; linha antiga sem `laco` é lida como robô sem laço.
--
-- O robô deixa de depender do cartão (e do alerta): os dois CHECKs que exigiam
-- `operacoes_em` são recriados exigindo só o voto. Quem não enviou os alertas
-- fica "Não avaliado" na EF05CO03 e monta o robô do mesmo jeito.
--
-- O CHECK vale por STATEMENT: o quarto alerta e o carimbo saem no MESMO UPDATE.
ALTER TABLE "exp05ef1b_sessoes"
  ADD COLUMN "alertas" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "alertas_em" TIMESTAMPTZ(6),
  ALTER COLUMN "versao_instrumento" SET DEFAULT '2.5.0';

ALTER TABLE "exp05ef1b_sessoes"
  -- Um item por pedido, no máximo quatro; e só depois do voto (o alerta abre
  -- na revelação DA CRIANÇA, que exige o voto).
  ADD CONSTRAINT "exp05ef1b_sessoes_alertas_check"
    CHECK (jsonb_typeof("alertas") = 'array'
           AND jsonb_array_length("alertas") <= 4
           AND (jsonb_array_length("alertas") = 0 OR "votou_em" IS NOT NULL)),
  -- O carimbo é o quarto envio: com ele, os quatro pedidos estão lá.
  ADD CONSTRAINT "exp05ef1b_sessoes_alertas_em_check"
    CHECK ("alertas_em" IS NULL
           OR ("votou_em" IS NOT NULL AND jsonb_array_length("alertas") = 4));

-- O robô sem depender do cartão: as ligações e o envio exigem só o voto.
ALTER TABLE "exp05ef1b_sessoes"
  DROP CONSTRAINT "exp05ef1b_sessoes_regra_testes_check",
  DROP CONSTRAINT "exp05ef1b_sessoes_regra_check";

ALTER TABLE "exp05ef1b_sessoes"
  ADD CONSTRAINT "exp05ef1b_sessoes_regra_testes_check"
    CHECK (jsonb_typeof("regra_testes") = 'array' AND jsonb_array_length("regra_testes") <= 5
           AND (jsonb_array_length("regra_testes") = 0 OR "votou_em" IS NOT NULL)),
  ADD CONSTRAINT "exp05ef1b_sessoes_regra_check"
    CHECK ("regra_em" IS NULL
           OR ("votou_em" IS NOT NULL
               AND jsonb_typeof("regra_final") = 'object'
               AND "regra_final"->>'condicao' IN ('urgente_alarmante', 'parente_proximo',
                                                    'link_nao_checado', 'promessa_incrivel')));
