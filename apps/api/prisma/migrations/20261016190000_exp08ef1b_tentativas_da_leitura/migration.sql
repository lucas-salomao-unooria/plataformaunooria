-- exp08ef1b-tentativas-da-leitura: a leitura da reflexão pela IA tenta até 3
-- vezes quando a falha é TÉCNICA (ADR-167). Continua uma leitura só por
-- (atividade, estudante); a coluna diz quantas chamadas ela fez, para o
-- professor e para o diagnóstico. Sem texto. A RLS da tabela vale para ela.

ALTER TABLE "exp08ef1b_leituras_da_reflexao" ADD COLUMN "tentativas" SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE "exp08ef1b_leituras_da_reflexao" ADD CONSTRAINT "exp08ef1b_leituras_da_reflexao_tentativas_check"
  CHECK ("tentativas" BETWEEN 0 AND 3);
