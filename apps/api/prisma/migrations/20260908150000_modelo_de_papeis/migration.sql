-- O MODELO DE PAPÉIS passa de quatro nomes para seis (ADR-80).
--
--   estudante | professor | gestor_escola | gestor_regional | gestor_contrato | admin
--
-- Dois são RENOME, sem mudança de semântica:
--   gestor        -> gestor_escola
--   admin-contrato -> gestor_contrato
-- O hífen sai junto: `admin-contrato` era o único valor do vocabulário com um,
-- e um separador diferente dos outros é a diferença que ninguém lembra na hora
-- de escrever a comparação.
--
-- Dois são NOVOS:
--   gestor_regional — quem cobre as escolas de uma regional (Diretoria de
--     Ensino, polo, secretaria municipal) SEM ter lotação em cada uma.
--   admin — a conta da Unooria. Mesmas capacidades de `gestor_contrato`; o que
--     a distingue é de QUEM é a conta, não o que ela pode.
--
-- O QUE ESTA MIGRAÇÃO NÃO FAZ, E É O PONTO MAIS IMPORTANTE DELA
--
-- Nenhuma política de RLS é tocada, e nenhuma passa a olhar papel. A RLS
-- continua sendo `escola_id = current_setting('app.escola_id')`, e o token
-- continua carregando UMA escola. O `gestor_regional` trabalha uma escola por
-- vez, como o `gestor_escola`: o que a regional dele determina é a LISTA de
-- escolas que ele pode ativar, não um contexto que enxerga várias somadas.
--
-- Sem isso, "gestor regional" exigiria a política de RLS aceitar um conjunto de
-- escolas — e aí toda tabela de dado de estudante passaria a depender de um
-- segundo caminho de autorização, que é a superfície que a regra inviolável nº 1
-- existe para não ter.

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_role_check";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_escola_check";
ALTER TABLE "lotacoes" DROP CONSTRAINT IF EXISTS "lotacoes_papel_check";

UPDATE "users" SET "role" = 'gestor_escola' WHERE "role" = 'gestor';
UPDATE "users" SET "role" = 'gestor_contrato' WHERE "role" = 'admin-contrato';
UPDATE "lotacoes" SET "papel" = 'gestor_escola' WHERE "papel" = 'gestor';

/*
 * A REGIONAL de um `gestor_regional`.
 *
 * Coluna, e não uma lotação apontando para a linha da regional: a ADR-79
 * proibiu lotação em regional, e a razão dela continua valendo — a regional
 * apareceria no seletor de escola do cabeçalho como uma escola sem turma, sem
 * estudante e sem dado. `lotacoes` continua respondendo "em que ESCOLAS a
 * pessoa trabalha"; esta coluna responde "que regional ela cobre".
 *
 * O `ON DELETE RESTRICT` é deliberado: apagar a regional de um supervisor
 * deixaria a conta dele sem escopo nenhum, e a tela de Regionais já sabe pedir
 * a transferência das escolas antes de excluir — pedir também que não haja
 * supervisor pendurado é a mesma conversa.
 */
ALTER TABLE "users"
  ADD COLUMN "regional_id" TEXT,
  ADD CONSTRAINT "users_regional_id_fkey"
    FOREIGN KEY ("regional_id") REFERENCES "escolas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "users_regional_id_idx" ON "users"("regional_id");

ALTER TABLE "users"
  ADD CONSTRAINT "users_role_check"
    CHECK ("role" IN ('estudante','professor','gestor_escola','gestor_regional','gestor_contrato','admin')),
  /* Quem NÃO tem escola: os dois papéis de contrato (que enxergam todas) e o
     regional (cuja escola ativa é escolhida a cada sessão, entre as da regional
     dele — não há "principal" a cachear, porque não há lotação). */
  ADD CONSTRAINT "users_escola_check"
    CHECK ("role" IN ('gestor_contrato','admin','gestor_regional') OR "escola_id" IS NOT NULL),
  /* A coluna só existe para UM papel. Sem este CHECK ela seria a próxima coluna
     que promete uma capacidade que o código não cumpre — a armadilha que este
     projeto já registrou quatro vezes. */
  ADD CONSTRAINT "users_regional_check"
    CHECK (("role" = 'gestor_regional') = ("regional_id" IS NOT NULL));

/*
 * `regional_id` tem de apontar para uma REGIONAL, e não para uma escola. A FK
 * garante que a linha existe; que ela AGRUPA é trigger e não CHECK, porque
 * CHECK no Postgres não aceita subconsulta — escrito como CHECK, o banco recusa
 * a própria migração com "cannot use subquery in check constraint".
 */
CREATE OR REPLACE FUNCTION users_regional_precisa_agrupar() RETURNS trigger AS $$
DECLARE tipo_da_regional TEXT;
BEGIN
  IF NEW."regional_id" IS NULL THEN RETURN NEW; END IF;
  SELECT "tipo" INTO tipo_da_regional FROM "escolas" WHERE "id" = NEW."regional_id";
  IF tipo_da_regional IS DISTINCT FROM 'regional' THEN
    RAISE EXCEPTION 'regional de um gestor_regional tem de ser uma regional (% é %)',
      NEW."regional_id", COALESCE(tipo_da_regional, 'inexistente');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_regional_agrupa
  BEFORE INSERT OR UPDATE OF "regional_id" ON "users"
  FOR EACH ROW EXECUTE FUNCTION users_regional_precisa_agrupar();

ALTER TABLE "lotacoes"
  ADD CONSTRAINT "lotacoes_papel_check"
    CHECK ("papel" IN ('estudante','professor','gestor_escola'));
