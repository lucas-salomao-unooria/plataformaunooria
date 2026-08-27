-- Vila do Lume: sai o prazo de retenção declarado.
--
-- A migration anterior criou `vila_sessoes.expires_at` com 90 dias e um índice
-- para a purga varrer. A purga nunca foi escrita — e uma coluna de prazo que
-- ninguém lê é o pior estado possível: o schema promete uma retenção que o
-- código não cumpre, e quem lê o schema acredita nela.
--
-- É a mesma armadilha que o app de origem documentou com `turmas.consentimento_em`:
-- a regra saiu do código, a coluna ficou, e todo mundo continuou acreditando que
-- ela existia.
--
-- DECISÃO (2026-08-26): não há prazo declarado. O `payload` bruto vive enquanto o
-- contrato durar. Em troca, o reprocessamento fica preservado indefinidamente —
-- e ele é um requisito de verdade deste instrumento: o mapeamento
-- comportamento → valor é hipótese de design, `VERSAO_MAPEAMENTO` vai subir, e
-- recomputar o histórico a partir das medidas brutas é a única forma de comparar
-- as duas gerações. Era isso que 90 dias matavam.
--
-- Se um contrato exigir prazo, ele volta COM a rotina que o cumpre — nunca só a
-- coluna.
--
-- NOVA migration em vez de editar a anterior: a `20260826140000` pode já ter sido
-- aplicada em máquina de dev, e reescrever migration aplicada dessincroniza o
-- checksum do `_prisma_migrations`. DROP é barato; arqueologia de checksum não.

DROP INDEX IF EXISTS "idx_vila_sessoes_purga";

ALTER TABLE "vila_sessoes" DROP CONSTRAINT IF EXISTS "ck_vila_sessoes_expira";

ALTER TABLE "vila_sessoes" DROP COLUMN IF EXISTS "expires_at";
