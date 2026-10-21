-- exp06ef1b-quarenta-projetos: o Júri Estadual com 40 projetos (2026-10-14).
--
-- O PO aprovou dez projetos por área (quarenta) no lugar de quatro
-- (dezesseis), com o feed de dez posts SEM REPETIR post. Nenhuma coluna entra
-- nem sai, a RLS não afrouxa, nenhuma linha muda. O que muda são dois CHECKs:
--
-- 1. `exp06ef1b_pacotes_conteudo_check`: o pacote tem 16 OU 40 projetos. A
--    ESCRITA (homologar, o preparo, o banco padrão) só produz 40 — o Zod de
--    `src/juri-estadual/contrato-de-rotas.ts#ConteudoDoPacoteSchema` cobra —,
--    mas os pacotes de dezesseis da 0.4.x existem e continuam legíveis até a
--    turma trocar de atividade. As outras condições ficam como estavam.
--
-- 2. `exp06ef1b_sessoes_vocabulario_check`: o id de projeto passa a ser
--    `proj-[a-d](10|[1-9])` (de `proj-a1` a `proj-d10`) nas três colunas que o
--    guardam — o voto, o voto revisado e o complemento da 0.3.0. O resto é o
--    texto vigente, o de `20261007120000_exp06ef1b_ciclo_do_voto` (a última
--    migração que recriou este CHECK). A regex nova contém a antiga: toda linha
--    que passava continua passando.
--
-- O texto da regex é o de `src/juri-estadual/vocabulario.ts#ID_DE_PROJETO_RE`,
-- que `tests/juri-estadual-postgres.spec.ts` compara.

ALTER TABLE "exp06ef1b_pacotes"
  DROP CONSTRAINT "exp06ef1b_pacotes_conteudo_check";

ALTER TABLE "exp06ef1b_pacotes"
  ADD CONSTRAINT "exp06ef1b_pacotes_conteudo_check"
    CHECK (jsonb_typeof("conteudo") = 'object'
           AND jsonb_typeof("conteudo" -> 'categorias') = 'array'
           AND jsonb_array_length("conteudo" -> 'categorias') = 4
           AND jsonb_typeof("conteudo" -> 'projetos') = 'array'
           AND jsonb_array_length("conteudo" -> 'projetos') IN (16, 40));

ALTER TABLE "exp06ef1b_sessoes"
  DROP CONSTRAINT "exp06ef1b_sessoes_vocabulario_check";

ALTER TABLE "exp06ef1b_sessoes"
  ADD CONSTRAINT "exp06ef1b_sessoes_vocabulario_check"
    CHECK (("conviccao" IS NULL OR "conviccao" IN ('examinei_bem', 'vi_tudo'))
           AND ("revisao_acao" IS NULL OR "revisao_acao" IN ('manter', 'trocar', 'complementar'))
           AND ("voto_motivo" IS NULL OR "voto_motivo" IN ('v1', 'v2', 'v3'))
           AND ("revisao_motivo" IS NULL OR "revisao_motivo" IN ('r1', 'r2', 'r3'))
           AND ("voto_trecho" IS NULL OR "voto_trecho" BETWEEN 0 AND 11)
           AND ("revisao_trecho" IS NULL OR "revisao_trecho" BETWEEN 0 AND 11)
           AND ("voto_projeto" IS NULL OR "voto_projeto" ~ '^proj-[a-d](10|[1-9])$')
           AND ("voto_revisado" IS NULL OR "voto_revisado" ~ '^proj-[a-d](10|[1-9])$')
           AND ("complemento_projeto" IS NULL OR "complemento_projeto" ~ '^proj-[a-d](10|[1-9])$')
           AND ("mecanismo" IS NULL OR "mecanismo" IN ('m1', 'm2', 'm3'))
           AND ("atitude" IS NULL OR "atitude" IN ('t1', 't2')));
