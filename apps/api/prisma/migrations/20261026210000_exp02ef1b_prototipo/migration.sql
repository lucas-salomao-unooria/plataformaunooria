-- O ENIGMA DA CAPA DA RÁDIO 2.0.0 — a missão segue o protótipo (ADR-186).
--
-- O que sai: o crachá (a sessão nasce no ABRIR BANCADA), a lupa por foto e
-- por fundo (vira o tempo sobre cada um dos dois objetos do fundo) e a etapa
-- de transferência (a segunda foto conclui). O que muda: o vocabulário das
-- disciplinas (todos os componentes do 2º ano, Computação e "Outro
-- componente"). A migração de 2026-10-26 12:00 não é editada: já está em dev.
--
-- O DDL de coluna é o `prisma migrate diff`, com os RENAME no lugar do
-- DROP/ADD que ele propõe (o tempo da lupa já gravado não se perde); os
-- CHECKs são o bloco manual, e espelham `apps/api/src/enigma-capa/conteudo.ts`
-- (`tests/enigma-capa-regras.spec.ts` compara os textos).

-- ---------------------------------------------------------------- sessões

ALTER TABLE "exp02ef1b_sessoes"
  DROP CONSTRAINT IF EXISTS "exp02ef1b_sessoes_cracha_check",
  DROP CONSTRAINT IF EXISTS "exp02ef1b_sessoes_lupa_check",
  DROP CONSTRAINT IF EXISTS "exp02ef1b_sessoes_transferencia_check",
  DROP CONSTRAINT IF EXISTS "exp02ef1b_sessoes_voto_check";

ALTER TABLE "exp02ef1b_sessoes" DROP COLUMN "cracha";
ALTER TABLE "exp02ef1b_sessoes" DROP COLUMN "lupa_fundo1";
ALTER TABLE "exp02ef1b_sessoes" DROP COLUMN "lupa_fundo2";
ALTER TABLE "exp02ef1b_sessoes" DROP COLUMN "transferencia_voto";
ALTER TABLE "exp02ef1b_sessoes" RENAME COLUMN "lupa_foto1_ms" TO "lupa_alvo1_ms";
ALTER TABLE "exp02ef1b_sessoes" RENAME COLUMN "lupa_foto2_ms" TO "lupa_alvo2_ms";
ALTER TABLE "exp02ef1b_sessoes" ALTER COLUMN "versao_instrumento" SET DEFAULT '2.0.0';

ALTER TABLE "exp02ef1b_sessoes"
  -- A lupa (E2): o tempo sobre cada um dos dois objetos do fundo.
  ADD CONSTRAINT "exp02ef1b_sessoes_lupa_check"
    CHECK ("lupa_alvo1_ms" >= 0 AND "lupa_alvo2_ms" >= 0 AND "lupa_alertas" >= 0),
  -- A segunda foto conclui ("Colocar no álbum"): a conclusão só depois dela.
  ADD CONSTRAINT "exp02ef1b_sessoes_conclusao_check"
    CHECK ("concluido_em" IS NULL OR "segunda_em" IS NOT NULL);

-- ---------------------------------------------------------------- pacotes

ALTER TABLE "exp02ef1b_pacotes" DROP CONSTRAINT IF EXISTS "exp02ef1b_pacotes_disciplina_check";
ALTER TABLE "exp02ef1b_pacotes"
  ADD CONSTRAINT "exp02ef1b_pacotes_disciplina_check"
    CHECK ("disciplina" IN ('lingua-portuguesa', 'arte', 'educacao-fisica', 'matematica', 'ciencias', 'geografia', 'historia', 'ensino-religioso', 'computacao', 'outra'));
