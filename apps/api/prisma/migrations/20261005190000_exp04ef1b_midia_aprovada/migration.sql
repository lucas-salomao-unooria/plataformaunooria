-- exp04ef1b-midia-aprovada: o professor dá o OK nas imagens do Jornal antes da turma (ADR-147).
--
-- O PO pediu: as imagens das notícias são geradas por IA, e o professor as
-- gerava sem vê-las — iam direto para a mesa das crianças. Agora ele as vê na
-- página da atividade, gera outra para a que não serve e aprova.
--
-- A aprovação é POR IMAGEM, e não um carimbo do pacote como na exp07ef1b
-- (ADR-146): aqui o professor pode gerar imagem também na atividade que já
-- está no ar, e um carimbo único, apagado pela imagem nova, esconderia de uma
-- vez todas as que a turma está vendo. `midia_aprovada` guarda a URL que o
-- professor aprovou para cada notícia; a imagem chega ao estudante só quando
-- `midia_aprovada->>id = midia->>id`. Gerar outra troca a URL em `midia`, e só
-- aquela notícia fica sem imagem até o novo OK.
--
-- Pôr no ar (`POST em-andamento`) exige TODAS as notícias que pedem imagem com
-- imagem gerada E aprovada: 409 `imagens-nao-aprovadas` (decisão do Lucas,
-- 2026-10-05 — a imagem deixou de ser opcional).
--
-- Os pacotes que JÁ existem entram com as imagens que têm aprovadas: nenhuma
-- turma que roda hoje pode perder imagem por uma regra que nasceu depois.
--
-- Sem RLS nova: a tabela já tem RLS FORCE e a política por escola
-- (20260927120000_exp04ef1b_jornal_da_escola), e coluna nova herda as duas.

ALTER TABLE "exp04ef1b_pacotes" ADD COLUMN "midia_aprovada" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "exp04ef1b_pacotes"
  ADD CONSTRAINT "exp04ef1b_pacotes_midia_aprovada_check"
    CHECK (jsonb_typeof("midia_aprovada") = 'object');

UPDATE "exp04ef1b_pacotes" SET "midia_aprovada" = "midia";
