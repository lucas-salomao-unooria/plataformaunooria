-- O nível REGIONAL passa a existir de verdade.
--
-- `escolas.tipo` e `escolas.pai_id` entraram na migração da rede e não eram
-- lidos por consulta nenhuma — só gravados e exibidos. É a armadilha que este
-- projeto já registrou duas vezes (o `expires_at` da Vila, o
-- `turmas.consentimento_em` do app de origem): coluna que promete uma capacidade
-- que o código não cumpre, e quem lê o schema acredita nela.
--
-- O QUE ELES PASSAM A SIGNIFICAR
--
-- Uma rede estadual tem ~5.000 escolas agrupadas em ~90 Diretorias de Ensino, e
-- entre `gestor` (uma escola) e `admin-contrato` (todas) não havia nada. O nível
-- que faltava é este — e ele NÃO precisa de papel novo: o supervisor de uma
-- diretoria é um `gestor` LOTADO nas escolas dela. `lotacoes` já permite isso, o
-- token continua carregando UMA escola, e a RLS não muda.
--
-- `pai_id` é o que agrupa: escola aponta para a regional, regional aponta para a
-- rede. Serve para montar a lista de escolas de uma diretoria — que é o insumo
-- da lotação em lote —, nunca para autorizar: quem autoriza é a lotação.
--
-- VOCABULÁRIO: `distrito` era o `district` do OneRoster traduzido ao pé da letra,
-- e não é o nome de nada no Brasil. Passa a ser `regional`, que cobre Diretoria
-- de Ensino (SP), polo, regional e secretaria municipal. O `district` do padrão
-- continua sendo aceito na importação e mapeado para cá.

ALTER TABLE "escolas" DROP CONSTRAINT IF EXISTS "escolas_tipo_check";

UPDATE "escolas" SET "tipo" = 'regional' WHERE "tipo" = 'distrito';

ALTER TABLE "escolas"
  ADD CONSTRAINT "escolas_tipo_check"
    CHECK ("tipo" IN ('escola', 'regional', 'rede'));

-- Uma escola não pode ser pai de outra: hierarquia de unidade dentro de unidade
-- não existe na rede pública, e permitir isso deixaria a lista de uma diretoria
-- dependendo de quantos níveis alguém cadastrou por engano.
CREATE OR REPLACE FUNCTION escolas_pai_precisa_agrupar() RETURNS trigger AS $$
DECLARE tipo_do_pai TEXT;
BEGIN
  IF NEW."pai_id" IS NULL THEN RETURN NEW; END IF;
  IF NEW."pai_id" = NEW."id" THEN
    RAISE EXCEPTION 'escola não pode ser pai de si mesma (%)', NEW."id";
  END IF;
  SELECT "tipo" INTO tipo_do_pai FROM "escolas" WHERE "id" = NEW."pai_id";
  IF tipo_do_pai = 'escola' THEN
    RAISE EXCEPTION 'pai de uma unidade tem de ser regional ou rede, não escola (%)', NEW."pai_id";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER escolas_pai_agrupa
  BEFORE INSERT OR UPDATE OF "pai_id" ON "escolas"
  FOR EACH ROW EXECUTE FUNCTION escolas_pai_precisa_agrupar();

-- "As escolas desta diretoria" é a consulta que a lotação em lote faz.
CREATE INDEX "escolas_pai_id_idx" ON "escolas"("pai_id");
CREATE INDEX "escolas_tipo_idx" ON "escolas"("tipo");
