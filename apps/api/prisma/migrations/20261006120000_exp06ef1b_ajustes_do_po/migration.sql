-- exp06ef1b-ajustes-do-po: o Júri Estadual sem os pacotes, e as imagens
-- aprovadas antes de ir ao ar (pedido do PO, 2026-10-06).
--
-- 1. O PASSO `pacotes` SAI. A tela da curtida em pacotes exercitava a EF06CO07,
--    que o PO tirou da missão: a ficha mede a EF06CO10 (foco primário), a
--    EF06CO01 e a EF06CO03. A revisão do voto (o LATCH 2) agora leva direto à
--    `cadeia`.
--
--    As sessões que estavam EM `pacotes` vão para `cadeia`: é o passo seguinte,
--    e a criança só perde a tela que não existe mais. Elas não têm
--    `cadeia_montada_em`, então as equivalências novas valem para elas sem
--    tocar em mais nada. As que já passaram dos pacotes não mudam de passo.
--
--    As colunas `pacotes_tentativas` e `pacotes_remontados_em` são APAGADAS, e
--    não deixadas: nenhuma rota as escreve mais, e o que elas mediam já está
--    gravado onde o professor lê — a marca `pacotes` (EF06CO07) em
--    `evidencias_marcas`/`evidencias`, que fica intocada. Diferente da
--    `exp05ef1b_reflexoes` (20261005120000), que guardava TEXTO de criança sem
--    outra cópia, aqui não há dado sem outro lugar.
--
--    Os CHECKs que citavam `pacotes` são recriados com o vocabulário novo — o
--    mesmo texto de `src/juri-estadual/regras/passos.ts`, que
--    `tests/juri-estadual-postgres.spec.ts` compara.
--
-- 2. `imagens_aprovadas_em` — a SEGUNDA fase da aprovação, no molde da
--    exp07ef1b (ADR-146): `homologar` grava os textos com o carimbo NULO, as
--    imagens se geram depois, o professor as vê, refaz a que não serve e
--    aprova. NULO = a atividade não vai ao ar (`POST em-andamento` responde
--    409 `imagens-nao-aprovadas`). Os pacotes que JÁ existem entram aprovados,
--    com o carimbo da última alteração: nenhuma turma que roda hoje pode travar
--    por uma regra que nasceu depois dela.
--
-- Sem RLS nova: as duas tabelas já têm RLS FORCE e a política por escola
-- (20261002180000_exp06ef1b_juri_estadual), e coluna nova herda as duas.

-- ── 1. o passo `pacotes` sai ────────────────────────────────────────────────

ALTER TABLE "exp06ef1b_sessoes"
  DROP CONSTRAINT "exp06ef1b_sessoes_passo_check",
  DROP CONSTRAINT "exp06ef1b_sessoes_latch2_check",
  DROP CONSTRAINT "exp06ef1b_sessoes_pacotes_check",
  DROP CONSTRAINT "exp06ef1b_sessoes_tentativas_check";

UPDATE "exp06ef1b_sessoes" SET "passo" = 'cadeia', "atualizado_em" = now() WHERE "passo" = 'pacotes';

ALTER TABLE "exp06ef1b_sessoes"
  DROP COLUMN "pacotes_tentativas",
  DROP COLUMN "pacotes_remontados_em";

ALTER TABLE "exp06ef1b_sessoes"
  ADD CONSTRAINT "exp06ef1b_sessoes_passo_check"
    CHECK ("passo" IN ('credencial', 'feed', 'lacrada', 'galeria', 'cadeia',
                       'mariana', 'enquetes', 'fim')),
  ADD CONSTRAINT "exp06ef1b_sessoes_tentativas_check"
    CHECK ("cadeia_tentativas" >= 0
           AND ("cadeia_montada_em" IS NULL OR "cadeia_tentativas" >= 1)),
  -- O LATCH 2 é o que tira o passo gravado de `lacrada` — agora para a cadeia.
  ADD CONSTRAINT "exp06ef1b_sessoes_latch2_check"
    CHECK (("revisado_em" IS NOT NULL) = ("passo" IN ('cadeia', 'mariana', 'enquetes', 'fim')));

-- ── 2. as imagens aprovadas ─────────────────────────────────────────────────

ALTER TABLE "exp06ef1b_pacotes" ADD COLUMN "imagens_aprovadas_em" TIMESTAMPTZ(6);

UPDATE "exp06ef1b_pacotes" SET "imagens_aprovadas_em" = "atualizado_em";
