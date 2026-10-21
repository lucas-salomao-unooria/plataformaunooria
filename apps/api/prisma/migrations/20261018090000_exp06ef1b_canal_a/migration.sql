-- exp06ef1b-canal-a: o Júri Estadual mede pelo que a criança FAZ (ADR-174,
-- 2026-10-18). Nenhuma coluna sai, nenhuma linha muda, a RLS não afrouxa.
--
-- O PO tirou as enquetes P1–P3 e a EF06CO10 e mediu as outras duas por ação:
--
-- 1. A SEPARAÇÃO (EF06CO01): logo depois do voto, a criança põe cada estande
--    que viu numa das quatro áreas. Entra o passo `classificacao` (entre o voto
--    e a espera) e quatro colunas — as respostas, os acertos, o total e o
--    carimbo. O `classificacao_status`, que a 0.5.0 gravava na revisão do voto,
--    passa a ser gravado AQUI: o CHECK de status aceita as duas origens, para
--    as linhas antigas continuarem válidas.
--
-- 2. A REGRA SE … ENTÃO (EF06CO03): no passo `cadeia` (o nome ficou), a
--    criança escolhe a condição e a ação. Entram `regra_se` e `regra_entao` (os
--    ids das peças, de `src/juri-estadual/conteudo.ts`). O carimbo é o
--    `cadeia_montada_em` de sempre, com `cadeia_tentativas = 1`: os CHECKs de
--    passo da cadeia continuam fechando.
--
-- O texto do CHECK de passo é o de `src/juri-estadual/regras/passos.ts#PASSOS`,
-- na mesma ordem (`tests/juri-estadual-postgres.spec.ts` compara). `enquetes`
-- fica: há sessões paradas ali, e `concluir` ainda as leva a `fim`.
--
-- Os CHECKs novos são FRACOS de propósito: uma sessão que votou na 0.5.0 está
-- em `lacrada` (ou adiante) SEM separação, e precisa continuar válida.

ALTER TABLE "exp06ef1b_sessoes"
  ADD COLUMN "classificacao_respostas" JSONB,
  ADD COLUMN "classificacao_acertos" INTEGER,
  ADD COLUMN "classificacao_total" INTEGER,
  ADD COLUMN "classificada_em" TIMESTAMPTZ(6),
  ADD COLUMN "regra_se" VARCHAR(32),
  ADD COLUMN "regra_entao" VARCHAR(32);

ALTER TABLE "exp06ef1b_sessoes"
  DROP CONSTRAINT "exp06ef1b_sessoes_passo_check",
  DROP CONSTRAINT "exp06ef1b_sessoes_status_check";

ALTER TABLE "exp06ef1b_sessoes"
  ADD CONSTRAINT "exp06ef1b_sessoes_passo_check"
    CHECK ("passo" IN ('credencial', 'feed', 'classificacao', 'lacrada', 'galeria', 'revisada', 'cadeia', 'mariana', 'enquetes', 'fim')),
  -- Os status: o vocabulário da evidência (E14), ou nulo (sem marca). O da
  -- classificação vem da separação (0.6.0) ou da revisão do voto (até a 0.5.0).
  ADD CONSTRAINT "exp06ef1b_sessoes_status_check"
    CHECK (("auditoria_status" IS NULL OR "auditoria_status" IN ('atingiu', 'em_processo', 'nao_atingiu'))
           AND ("classificacao_status" IS NULL OR "classificacao_status" IN ('atingiu', 'em_processo', 'nao_atingiu'))
           AND ("logica_status" IS NULL OR "logica_status" IN ('atingiu', 'em_processo', 'nao_atingiu'))
           AND ("auditoria_status" IS NULL OR "revisado_em" IS NOT NULL)
           AND ("classificacao_status" IS NULL OR "revisado_em" IS NOT NULL OR "classificada_em" IS NOT NULL)
           AND ("logica_status" IS NULL OR "cadeia_montada_em" IS NOT NULL)),
  -- A separação: as quatro colunas juntas, depois do voto, e os acertos cabem no total.
  ADD CONSTRAINT "exp06ef1b_sessoes_classificacao_check"
    CHECK (("classificada_em" IS NULL) = ("classificacao_respostas" IS NULL)
           AND ("classificada_em" IS NULL) = ("classificacao_acertos" IS NULL)
           AND ("classificada_em" IS NULL) = ("classificacao_total" IS NULL)
           AND ("classificada_em" IS NULL OR "votado_em" IS NOT NULL)
           AND ("classificacao_respostas" IS NULL OR jsonb_typeof("classificacao_respostas") = 'array')
           AND ("classificacao_total" IS NULL OR "classificacao_total" BETWEEN 0 AND 10)
           AND ("classificacao_acertos" IS NULL OR "classificacao_acertos" BETWEEN 0 AND "classificacao_total")
           AND ("passo" <> 'classificacao' OR "classificada_em" IS NULL)),
  -- A regra: as duas peças juntas, e só com o carimbo da cadeia.
  ADD CONSTRAINT "exp06ef1b_sessoes_regra_check"
    CHECK (("regra_se" IS NULL) = ("regra_entao" IS NULL)
           AND ("regra_se" IS NULL OR "cadeia_montada_em" IS NOT NULL));
