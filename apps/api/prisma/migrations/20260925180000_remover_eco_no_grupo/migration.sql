-- ADR-113 — O Eco no Grupo sai da trilha, e o código `exp07ef1b` fica livre para
-- A Seleção (7º ano, unidade 1). O código é DERIVADO de série + unidade
-- (ADR-110) e não tem lugar para duas missões na mesma unidade: ou uma sai, ou o
-- formato muda. Saiu a missão.
--
-- Três coisas acontecem aqui, e a segunda é a que morde:
--
-- 1. As quatro tabelas do Eco somem. Nada de fora aponta para elas (as FKs são
--    internas ou para `users`/`turmas`), e a sequência de `exp07ef1b_mensagens`
--    sai junto com a tabela.
--
-- 2. As linhas que dizem `exp07ef1b` nas tabelas da PLATAFORMA são apagadas,
--    porque o id vai passar a significar OUTRA missão:
--    - `experiencias` e `experiencias_versoes`: sem isto a grade da sala continua
--      oferecendo "O Eco no Grupo" para liberar, e o rollback do painel da Unooria
--      oferece a 0.1.5 — cujo bundle imutável continua no bucket e passaria a ser
--      servido no lugar de A Seleção;
--    - `liberacoes`: a turma que liberou o Eco abriria A Seleção sem ninguém ter
--      liberado;
--    - `progresso`: o SDK da missão nova leria, pelo `/progresso/exp07ef1b`, o
--      JSON que o Eco salvou — e a conclusão dele;
--    - `disponibilidades`: o interruptor do Eco (inclusive `versao_fixa`, que
--      prende a escola a um bundle dele) valeria para A Seleção.
--    `liberacoes` e `progresso` têm FORCE ROW LEVEL SECURITY: sem `app.escola_id`
--    o DELETE casaria ZERO linhas, em silêncio. O FORCE sai, o DELETE roda, a
--    asserção confere e o FORCE volta — o molde de 20260923120000.
--
-- 3. O que NÃO é apagado, e por quê:
--    - `telemetria_eventos`: cada linha carrega `exp_version`, que já separa o Eco
--      (0.1.x) de A Seleção (1.0.0 em diante); e o DELETE varreria todas as
--      partições, porque o índice começa por `escola_id`.
--    - `recursos_auditoria`: é o histórico de quem ligou e desligou o quê, só de
--      inserção. Apagar reescreveria a história que ela existe para guardar.

DROP TABLE IF EXISTS "exp07ef1b_mensagens";
DROP TABLE IF EXISTS "exp07ef1b_reflexoes";
DROP TABLE IF EXISTS "exp07ef1b_gates_turma";
DROP TABLE IF EXISTS "exp07ef1b_sessoes";

ALTER TABLE "liberacoes" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "progresso"  NO FORCE ROW LEVEL SECURITY;

DELETE FROM "liberacoes"           WHERE "exp_id" = 'exp07ef1b';
DELETE FROM "progresso"            WHERE "exp_id" = 'exp07ef1b';
DELETE FROM "disponibilidades"     WHERE "recurso_id" = 'experiencia:exp07ef1b';
DELETE FROM "experiencias_versoes" WHERE "exp_id" = 'exp07ef1b';
DELETE FROM "experiencias"         WHERE "exp_id" = 'exp07ef1b';

-- A asserção roda ANTES de o FORCE voltar: com ele, esta leitura também veria
-- zero linhas, e passaria mentindo.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "liberacoes"           WHERE "exp_id" = 'exp07ef1b')
  OR EXISTS (SELECT 1 FROM "progresso"            WHERE "exp_id" = 'exp07ef1b')
  OR EXISTS (SELECT 1 FROM "disponibilidades"     WHERE "recurso_id" = 'experiencia:exp07ef1b')
  OR EXISTS (SELECT 1 FROM "experiencias_versoes" WHERE "exp_id" = 'exp07ef1b')
  OR EXISTS (SELECT 1 FROM "experiencias"         WHERE "exp_id" = 'exp07ef1b')
  THEN
    RAISE EXCEPTION 'sobrou linha do Eco no Grupo (exp07ef1b) depois do DELETE';
  END IF;
END $$;

ALTER TABLE "liberacoes" FORCE ROW LEVEL SECURITY;
ALTER TABLE "progresso"  FORCE ROW LEVEL SECURITY;
