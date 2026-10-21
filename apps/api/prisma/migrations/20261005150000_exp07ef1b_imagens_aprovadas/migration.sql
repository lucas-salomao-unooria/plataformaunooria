-- exp07ef1b-imagens-aprovadas: a SEGUNDA fase da aprovação da cobertura (ADR-146).
--
-- O PO pediu a aprovação em duas fases numa tela só: o professor aprova os 12
-- textos (a homologação, que já gravava a linha) e só então as imagens são
-- geradas, no card de cada post — e ele as vê, regera a que não serve e aprova.
-- Antes, nada impedia a turma de abrir com imagem que ninguém viu.
--
-- NULO = as imagens ainda não foram aprovadas: a cobertura existe, mas não vai
-- ao ar (`POST em-andamento` responde 409 `imagens-nao-aprovadas`).
--
-- As coberturas que JÁ existem entram aprovadas, com o carimbo da última
-- alteração: nenhuma turma que roda hoje pode travar por causa de uma regra
-- que nasceu depois dela.
--
-- Sem RLS nova: a tabela já tem RLS FORCE e a política por escola
-- (20260926140000_exp07ef1b_a_selecao), e coluna nova herda as duas.

ALTER TABLE "exp07ef1b_coberturas" ADD COLUMN "imagens_aprovadas_em" TIMESTAMPTZ(6);

UPDATE "exp07ef1b_coberturas" SET "imagens_aprovadas_em" = "atualizada_em";
