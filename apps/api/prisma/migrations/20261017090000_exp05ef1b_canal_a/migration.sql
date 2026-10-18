-- exp05ef1b — só o Canal A (instrumento 2.4.0).
--
-- As perguntas P1 e P2 saíram da missão; as três habilidades passam a ser
-- medidas pelo que a criança FAZ. Duas ações novas, gravadas na sessão:
--
--   o CARTÃO DE FRASES (EF05CO03) — seis frases com E, OU e NÃO sobre as três
--   mensagens encaminhadas, respondidas com Sim/Não depois dos crachás;
--
--   a REGRA DO TIO (EF05CO04) — montada com peças, com a previsão antes de
--   cada teste no áudio do tio, e enviada.
--
-- O NÍVEL não mora aqui: é da evidência da plataforma (`evidencias_marcas`),
-- marcado na MESMA transação de cada envio. Aqui fica o dado bruto que o
-- professor lê na folha e que permite recalcular o histórico.
--
-- Os carimbos seguem em ordem, como os latches da v2.2 (o CHECK vale por
-- STATEMENT: carimbo e dado no mesmo UPDATE):
--   votou_em → operacoes_em → regra_em; o fim continua exigindo só o voto
--   (quem sai antes de uma ação fica "Não avaliado" nela, nunca travado).
ALTER TABLE "exp05ef1b_sessoes"
  -- As seis frases COMO a criança as viu (com a resposta esperada) e as
  -- respostas dela: a foto da tentativa, gravada no envio.
  ADD COLUMN "frases_operacoes" JSONB,
  ADD COLUMN "respostas_operacoes" JSONB,
  ADD COLUMN "operacoes_em" TIMESTAMPTZ(6),
  -- Os testes, em ordem: [{condicao, acoes, previsao, situacao, em}]. A
  -- régua lê o PRIMEIRO; o limite é técnico (5).
  ADD COLUMN "regra_testes" JSONB NOT NULL DEFAULT '[]',
  -- A regra enviada: {condicao, acoes}.
  ADD COLUMN "regra_final" JSONB,
  ADD COLUMN "regra_em" TIMESTAMPTZ(6),
  ALTER COLUMN "versao_instrumento" SET DEFAULT '2.4.0';

ALTER TABLE "exp05ef1b_sessoes"
  ADD CONSTRAINT "exp05ef1b_sessoes_operacoes_check"
    CHECK ("operacoes_em" IS NULL
           OR ("votou_em" IS NOT NULL
               AND jsonb_typeof("frases_operacoes") = 'array'
               AND jsonb_array_length("frases_operacoes") = 6
               AND jsonb_typeof("respostas_operacoes") = 'array'
               AND jsonb_array_length("respostas_operacoes") = 6)),
  ADD CONSTRAINT "exp05ef1b_sessoes_regra_testes_check"
    CHECK (jsonb_typeof("regra_testes") = 'array' AND jsonb_array_length("regra_testes") <= 5
           AND (jsonb_array_length("regra_testes") = 0 OR "operacoes_em" IS NOT NULL)),
  -- A regra só sai depois do cartão: na reflexão, o cartão vem primeiro.
  ADD CONSTRAINT "exp05ef1b_sessoes_regra_check"
    CHECK ("regra_em" IS NULL
           OR ("operacoes_em" IS NOT NULL
               AND jsonb_typeof("regra_final") = 'object'
               AND "regra_final"->>'condicao' IN ('urgente_alarmante', 'parente_proximo',
                                                    'link_nao_checado', 'promessa_incrivel'))),
  ADD CONSTRAINT "exp05ef1b_sessoes_regra_final_check"
    CHECK (("regra_final" IS NULL) = ("regra_em" IS NULL));
