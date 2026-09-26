-- exp07ef1b-podcast: as três falas do podcast de recapitulação na cobertura.
--
-- O podcast é do PROFESSOR (decisão do dono do produto, 2026-09-26) e o texto
-- é o do sheet aprovado, com UMA exceção: três falas do Bloco 2 dizem o que
-- cada veículo mostrou, e num tema gerado por IA elas são escritas junto com o
-- lote e revisadas pela professora antes de aprovar. É isso que esta coluna
-- guarda — por cobertura, porque cada cobertura é uma atividade.
--
-- NULO é a leitura das falas do sheet (a Praça Central): as coberturas que já
-- existem continuam valendo sem backfill. A forma do objeto é cobrada pelo Zod
-- da homologação (`podcast.ts#FalasDoTemaSchema`); o CHECK aqui só garante que
-- a coluna não recebe um array nem um escalar por outro caminho.
--
-- Sem RLS nova: a tabela já tem RLS FORCE e a política por escola
-- (20260926140000_exp07ef1b_a_selecao), e coluna nova herda as duas.

ALTER TABLE "exp07ef1b_coberturas" ADD COLUMN "podcast" JSONB;

ALTER TABLE "exp07ef1b_coberturas"
  ADD CONSTRAINT "exp07ef1b_coberturas_podcast_check"
  CHECK ("podcast" IS NULL OR jsonb_typeof("podcast") = 'object');
