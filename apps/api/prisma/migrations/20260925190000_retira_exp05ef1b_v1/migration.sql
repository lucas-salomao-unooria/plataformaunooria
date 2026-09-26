-- ADR-114 — A primeira versão de "Quem mandou isso?" (5º ano, unidade 1) sai da
-- trilha, e o código `exp05ef1b` fica para a v2.2, que entra depois com o MESMO
-- código e tabelas NOVAS. A mecânica muda quase inteira (a matriz verdadeira/
-- falsa x emocional/neutra, exatamente três encaminhamentos, a enquete de
-- motivo, a reflexão Se/Então, a régua de evidência e as equipes): evoluir as
-- tabelas da v1 no lugar seria reescrever cada coluna e cada CHECK dela.
--
-- A v1 nunca saiu de `dev-local`: nenhuma stack em nuvem aplicou
-- 20260917120000, e nenhum bundle dela foi publicado. Lá esta migração roda
-- depois da criação e do rename (20260923120000) e deixa o banco como se a v1
-- nunca tivesse existido. Onde ela faz diferença é no Postgres local.
--
-- Três coisas acontecem aqui (o molde é o de 20260923120000, o mesmo da
-- retirada do Eco no Grupo, ADR-113):
--
-- 1. As cinco tabelas da v1 somem, as filhas antes da mãe: encaminhamentos e
--    reflexões apontam para a sessão; a sessão, o gate e o lote apontam só para
--    `users`/`turmas`. Nada de fora aponta para elas, e a sequência de
--    `exp05ef1b_encaminhamentos` (BIGSERIAL) sai junto com a tabela, como as
--    políticas de RLS.
--
-- 2. As linhas que dizem `exp05ef1b` nas tabelas da PLATAFORMA são apagadas,
--    porque o código vai passar a significar a v2.2:
--    - `experiencias` e `experiencias_versoes`: o seed as escreve a partir do
--      manifesto, e sem isto a grade da sala continuaria oferecendo a v1 para
--      liberar, e o painel da Unooria ofereceria a 0.1.1 como versão conhecida;
--    - `liberacoes`: a turma que liberou a v1 (a 5A do seed) abriria a v2.2 sem
--      ninguém ter liberado;
--    - `progresso`: o SDK da v2.2 leria, pelo `/progresso/exp05ef1b`, o JSON que
--      a v1 salvou;
--    - `disponibilidades`: um interruptor da v1 (inclusive `versao_fixa`, que
--      prenderia a escola à 0.1.1) valeria para a v2.2.
--    `liberacoes` e `progresso` têm FORCE ROW LEVEL SECURITY: sem `app.escola_id`
--    o DELETE casaria ZERO linhas, em silêncio. O FORCE sai, o DELETE roda, a
--    asserção confere e o FORCE volta.
--
-- 3. O que NÃO é apagado, e por quê:
--    - `telemetria_eventos`: cada linha carrega `exp_version`, que já separa a
--      v1 (0.1.x) da v2.2 (0.2.0 em diante); e o DELETE varreria todas as
--      partições, porque o índice começa por `escola_id`.
--    - `recursos_auditoria`: é o histórico de quem ligou e desligou o quê, só de
--      inserção. Apagar reescreveria a história que ela existe para guardar.
--    - `equipes_*` e `evidencias*`: a v1 nunca escreveu nelas (a api recusa
--      equipe para missão fora de `EXPERIENCIAS_COM_EQUIPE`, e a v1 não chamava
--      a porta das evidências), então não há o que apagar.

DROP TABLE IF EXISTS "exp05ef1b_encaminhamentos";
DROP TABLE IF EXISTS "exp05ef1b_reflexoes";
DROP TABLE IF EXISTS "exp05ef1b_sessoes";
DROP TABLE IF EXISTS "exp05ef1b_gates_turma";
DROP TABLE IF EXISTS "exp05ef1b_conteudo_turma";

ALTER TABLE "liberacoes" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "progresso"  NO FORCE ROW LEVEL SECURITY;

DELETE FROM "liberacoes"           WHERE "exp_id" = 'exp05ef1b';
DELETE FROM "progresso"            WHERE "exp_id" = 'exp05ef1b';
DELETE FROM "disponibilidades"     WHERE "recurso_id" = 'experiencia:exp05ef1b';
DELETE FROM "experiencias_versoes" WHERE "exp_id" = 'exp05ef1b';
DELETE FROM "experiencias"         WHERE "exp_id" = 'exp05ef1b';

-- A asserção roda ANTES de o FORCE voltar: com ele, esta leitura também veria
-- zero linhas, e passaria mentindo.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "liberacoes"           WHERE "exp_id" = 'exp05ef1b')
  OR EXISTS (SELECT 1 FROM "progresso"            WHERE "exp_id" = 'exp05ef1b')
  OR EXISTS (SELECT 1 FROM "disponibilidades"     WHERE "recurso_id" = 'experiencia:exp05ef1b')
  OR EXISTS (SELECT 1 FROM "experiencias_versoes" WHERE "exp_id" = 'exp05ef1b')
  OR EXISTS (SELECT 1 FROM "experiencias"         WHERE "exp_id" = 'exp05ef1b')
  THEN
    RAISE EXCEPTION 'sobrou linha da v1 de Quem mandou isso? (exp05ef1b) depois do DELETE';
  END IF;
END $$;

ALTER TABLE "liberacoes" FORCE ROW LEVEL SECURITY;
ALTER TABLE "progresso"  FORCE ROW LEVEL SECURITY;
