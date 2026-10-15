-- AS INSTRUÇÕES DA AJUDA NO PAINEL (ADR-165): o texto de "como responder" de
-- cada atendente — o mascote (ADR-158) e o avatar (ADR-132) — passa a ser
-- editável pelo `admin` em /unooria/ajuda.
--
-- NULO = vale o texto padrão do código (`instrucoesPadrao` em
-- src/ajuda/prompt.ts). Só a parte editável mora aqui: o cabeçalho do
-- conhecimento, a base gerada e "quem está falando" são sempre montados pela
-- api, e o texto nunca sai dela (regra 2).

ALTER TABLE "ajuda_configuracao" ADD COLUMN "instrucoes_mascote" TEXT;
ALTER TABLE "ajuda_configuracao" ADD COLUMN "instrucoes_avatar" TEXT;

-- O mesmo teto do Zod (`MAXIMO_DAS_INSTRUCOES`): um texto longo demais
-- disputaria a janela de contexto com a base. Vazio não é instrução: é NULO.
ALTER TABLE "ajuda_configuracao"
  ADD CONSTRAINT "ck_ajuda_configuracao_instrucoes"
    CHECK ((instrucoes_mascote IS NULL OR char_length(btrim(instrucoes_mascote)) BETWEEN 20 AND 8000)
       AND (instrucoes_avatar IS NULL OR char_length(btrim(instrucoes_avatar)) BETWEEN 20 AND 8000));
