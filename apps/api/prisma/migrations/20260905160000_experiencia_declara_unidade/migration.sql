-- A experiência declara a UNIDADE do ano a que pertence (ADR-69).
--
-- O catálogo já dizia a SÉRIE (`series[]`, do manifesto), e é ela que decide se
-- a missão entra na grade de uma turma. A unidade é o que ORDENA essa grade: a
-- trilha do Entre Redes é de 4 unidades por ano, e sem esta coluna a ordem caía
-- no `exp_id` — ordem de numeração da experiência, não do ano letivo. A exp-07
-- é do 7º ano e a exp-01 do 8º; por `exp_id` a segunda vem antes.
--
-- ANULÁVEL, e sem backfill: transversal (`series: []`) não mora em unidade
-- nenhuma, e ferramenta de professor (exp-90, exp-91) não é missão de turma.
-- NULL aqui quer dizer "não pertence a uma unidade", não "esqueceram de
-- preencher" — e é por isso que ela ordena por último em vez de virar zero.

ALTER TABLE "experiencias" ADD COLUMN "unidade" SMALLINT;

ALTER TABLE "experiencias"
  ADD CONSTRAINT "experiencias_unidade_check"
    CHECK ("unidade" IS NULL OR "unidade" BETWEEN 1 AND 4);
