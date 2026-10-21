-- exp06ef1b-ajustes-do-time: o Júri depois da aula de teste do time (ADR-176,
-- 2026-10-20). Nenhuma coluna sai, nenhuma linha muda, a RLS não afrouxa.
--
-- 1. A SEPARAÇÃO (EF06CO01) passa para o FEED: o "Salvar" do post abre as
--    quatro pastas da mostra, e a criança guarda cada estande na área dele. A
--    coluna `pastas` guarda `{postId: area}`; no VOTO o servidor corrige as
--    pastas e grava as mesmas colunas `classificacao_*` da 0.6.0. A tela
--    "Organize o que você viu" (o passo `classificacao`) sai do caminho, e o
--    passo continua no CHECK: há sessões paradas nele.
--
-- 2. O CASO MARIANA sai: a regra SE … ENTÃO conclui a missão. O CHECK dos
--    cartões exigia `cartoes_em` em TODA sessão em `fim` — agora só a direção
--    que continua verdadeira: quem tem cartões está em `enquetes` ou `fim`. O
--    passo `mariana` fica no CHECK (sessões paradas nele; `concluir` as leva a
--    `fim`), e as colunas `mecanismo`, `atitude` e `cartoes_em` ficam, sem uso.

ALTER TABLE "exp06ef1b_sessoes"
  ADD COLUMN "pastas" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "exp06ef1b_sessoes"
  DROP CONSTRAINT "exp06ef1b_sessoes_cartoes_check";

ALTER TABLE "exp06ef1b_sessoes"
  ADD CONSTRAINT "exp06ef1b_sessoes_cartoes_check"
    CHECK (("cartoes_em" IS NOT NULL) = ("mecanismo" IS NOT NULL)
           AND ("cartoes_em" IS NOT NULL) = ("atitude" IS NOT NULL)
           AND ("cartoes_em" IS NULL OR "passo" IN ('enquetes', 'fim'))),
  -- As pastas: um objeto (a leitura tolera chave e valor desconhecidos).
  ADD CONSTRAINT "exp06ef1b_sessoes_pastas_check"
    CHECK (jsonb_typeof("pastas") = 'object');
