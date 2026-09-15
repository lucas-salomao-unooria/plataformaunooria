-- TODA ESCOLA TEM REGIONAL, e a rede nunca fica sem nenhuma.
--
-- A ADR-34 fez a regional existir de verdade, mas deixou `pai_id` opcional: a
-- unidade podia ficar órfã. O custo apareceu na tela — o filtro "Regional" não
-- particionava a lista (havia escolas fora de toda regional), e a importação
-- OneRoster entrava com `pai_id` nulo de propósito quando o `parentSourcedId`
-- era desconhecido. Somando os dois, "as escolas desta diretoria" nunca
-- respondia pela rede inteira, e a lotação em lote — o consumidor do
-- agrupamento — cobria menos do que parecia cobrir.
--
-- O QUE PASSA A VALER (ADR-79)
--
--   1. `tipo='escola'` exige `pai_id` (CHECK), e o pai tem de ser `regional`
--      — não mais `rede`. Escola pendurada na raiz era um segundo desenho de
--      hierarquia que ninguém usava e a tela nova não sabe desenhar.
--   2. A rede tem SEMPRE ao menos uma regional. Quem sustenta isso na escrita é
--      a rota de exclusão (409 na última); aqui o que se garante é o ponto de
--      partida.
--   3. `regional_padrao` marca a regional que a plataforma criou sozinha, para
--      a rede que não tem divisão administrativa. Ela é uma COLUNA e não uma
--      convenção de id porque três coisas dependem de reconhecê-la: o rótulo na
--      tela, a não-duplicação e o texto de apoio que explica de onde ela veio.
--      Convenção de id morreria no primeiro `PATCH` de nome — e renomear é
--      justamente o que a decisão de produto permite.
--
-- A ORDEM DESTE ARQUIVO É A REGRA: criar a padrão e adotar as órfãs vem ANTES
-- do CHECK. Invertido, a constraint é validada contra as linhas órfãs que ela
-- própria existe para eliminar, e a migração falha na criação.

ALTER TABLE "escolas"
  ADD COLUMN "regional_padrao" BOOLEAN NOT NULL DEFAULT false;

-- No máximo UMA padrão. É este índice que dá idempotência de graça: reexecutar
-- o bloco abaixo não consegue criar a segunda, mesmo que a condição escape.
-- Parcial de propósito — `UNIQUE(regional_padrao)` proibiria a segunda escola
-- com `false`, que são todas.
CREATE UNIQUE INDEX "escolas_regional_padrao_unica"
  ON "escolas"("regional_padrao")
  WHERE "regional_padrao";

/*
 * A regional padrão nasce em DOIS casos, e em nenhum outro:
 *
 *   (a) a rede não tem regional nenhuma — é o contrato recém-provisionado, e
 *       este é o "criar a rede cria a regional padrão" da decisão de produto;
 *   (b) a rede tem regionais MAS tem escola órfã — as órfãs precisam de um
 *       destino, e escolher uma das regionais existentes por elas seria a
 *       plataforma inventando uma diretoria para uma unidade.
 *
 * Fora desses dois, NÃO se cria nada: uma rede já organizada em diretorias, com
 * todas as escolas vinculadas, receberia uma regional vazia que não agrupa
 * ninguém — ruído numa tela cujo propósito é justamente parar de misturar
 * níveis. O invariante "ao menos uma regional" já vale ali por outro caminho.
 *
 * `nome` = 'Rede'. É deliberadamente genérico e EDITÁVEL: o nome real da rede
 * não existe no banco (o contrato é a stack, não uma linha), e a alternativa
 * — ler `CONTRATO_NOME` — não está ao alcance de uma migração e faria o dado
 * depender de uma env do hub. Quem sabe o nome é quem administra: a tela de
 * Regionais tem "Editar".
 */
DO $$
DECLARE
  id_novo TEXT := 'rede';
  tem_regional BOOLEAN;
  tem_orfa BOOLEAN;
BEGIN
  IF EXISTS (SELECT 1 FROM "escolas" WHERE "regional_padrao") THEN RETURN; END IF;

  SELECT EXISTS (SELECT 1 FROM "escolas" WHERE "tipo" = 'regional') INTO tem_regional;
  SELECT EXISTS (SELECT 1 FROM "escolas" WHERE "tipo" = 'escola' AND "pai_id" IS NULL) INTO tem_orfa;
  IF tem_regional AND NOT tem_orfa THEN RETURN; END IF;

  -- O id circula em `pai_id` e em nenhum token (regional não recebe lotação),
  -- mas ainda é chave primária: se `rede` já estiver ocupado por uma linha
  -- cadastrada à mão, sufixa em vez de estourar a migração inteira.
  IF EXISTS (SELECT 1 FROM "escolas" WHERE "id" = id_novo) THEN
    id_novo := 'rede-padrao';
  END IF;
  IF EXISTS (SELECT 1 FROM "escolas" WHERE "id" = id_novo) THEN
    id_novo := 'rede-padrao-' || to_char(now(), 'YYYYMMDDHH24MISS');
  END IF;

  INSERT INTO "escolas" ("id", "nome", "tipo", "regional_padrao", "created_at", "atualizado_em")
  VALUES (id_novo, 'Rede', 'regional', true, now(), now());
END $$;

-- As órfãs são adotadas pela padrão. Os vínculos que já existiam não são
-- tocados: `pai_id IS NULL` é a condição inteira.
UPDATE "escolas"
   SET "pai_id" = (SELECT "id" FROM "escolas" WHERE "regional_padrao"),
       "atualizado_em" = now()
 WHERE "tipo" = 'escola'
   AND "pai_id" IS NULL
   AND EXISTS (SELECT 1 FROM "escolas" WHERE "regional_padrao");

-- Escola pendurada direto na `rede` deixa de ser válida (item 1). Nada cria
-- linha `tipo='rede'` neste produto, então na prática isto fecha uma porta que
-- ninguém atravessou — e é melhor fechá-la agora que descobrir a segunda
-- hierarquia possível quando a tela de Regionais não souber desenhá-la.
UPDATE "escolas" AS e
   SET "pai_id" = (SELECT "id" FROM "escolas" WHERE "regional_padrao"),
       "atualizado_em" = now()
 WHERE e."tipo" = 'escola'
   AND EXISTS (SELECT 1 FROM "escolas" p WHERE p."id" = e."pai_id" AND p."tipo" = 'rede')
   AND EXISTS (SELECT 1 FROM "escolas" WHERE "regional_padrao");

ALTER TABLE "escolas"
  ADD CONSTRAINT "escolas_escola_tem_regional_check"
    CHECK ("tipo" <> 'escola' OR "pai_id" IS NOT NULL);

/*
 * O trigger de pai ganha DUAS coisas: a adoção pela regional padrão e a
 * exigência do tipo. Recriado inteiro (CREATE OR REPLACE) em vez de
 * acrescentado: são regras sobre a mesma coluna, e duas funções lendo `pai_id`
 * deixariam a mensagem de erro dependendo de qual disparou primeiro.
 *
 * A ADOÇÃO é a rede de segurança da regra, e existe porque o CHECK sozinho
 * transformaria todo `INSERT` de escola feito fora do produto — as três dezenas
 * de suítes que criam uma escola de mentira para testar outra coisa, um acerto
 * pontual em SQL — em erro de constraint por um campo que quem escreveu a linha
 * não tinha motivo para conhecer.
 *
 * Ela NÃO é o caminho do produto: o formulário e a importação EXIGEM a escolha
 * explícita quando há mais de uma regional (`NovaEscolaSchema`, `aplicarOrgs`),
 * e é lá que a decisão de produto vive. Aqui não há escolha a respeitar — quem
 * chegou sem regional não declarou preferência, e a padrão é exatamente a linha
 * que a rede sem divisão administrativa usa.
 *
 * Sem padrão na rede (rede já organizada em diretorias), `pai_id` continua nulo
 * e o CHECK recusa. É o comportamento certo: ali não existe destino óbvio, e
 * escolher uma das diretorias por conta própria seria a plataforma inventando
 * vínculo administrativo para uma unidade.
 */
CREATE OR REPLACE FUNCTION escolas_pai_precisa_agrupar() RETURNS trigger AS $$
DECLARE tipo_do_pai TEXT;
BEGIN
  IF NEW."tipo" = 'escola' AND NEW."pai_id" IS NULL THEN
    SELECT "id" INTO NEW."pai_id" FROM "escolas" WHERE "regional_padrao";
  END IF;
  IF NEW."pai_id" IS NULL THEN RETURN NEW; END IF;
  IF NEW."pai_id" = NEW."id" THEN
    RAISE EXCEPTION 'escola não pode ser pai de si mesma (%)', NEW."id";
  END IF;
  SELECT "tipo" INTO tipo_do_pai FROM "escolas" WHERE "id" = NEW."pai_id";
  IF tipo_do_pai = 'escola' THEN
    RAISE EXCEPTION 'pai de uma unidade tem de ser regional, não escola (%)', NEW."pai_id";
  END IF;
  IF NEW."tipo" = 'escola' AND tipo_do_pai IS DISTINCT FROM 'regional' THEN
    RAISE EXCEPTION 'toda escola pertence a uma REGIONAL (% é %)', NEW."pai_id", COALESCE(tipo_do_pai, 'inexistente');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
