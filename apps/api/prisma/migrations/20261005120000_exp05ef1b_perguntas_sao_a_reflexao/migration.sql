-- exp05ef1b — as perguntas de múltipla escolha SÃO a reflexão (ADR-145).
--
-- A regra Se/Então da Etapa 6 saiu: o professor libera a reflexão e a criança
-- vai direto às duas perguntas da Nina. Nenhuma rota escreve mais
-- `reflexao_em` nem `exp05ef1b_reflexoes`; as duas ficam, porque guardam o que
-- já foi escrito antes desta mudança (e a tabela continua com RLS e CHECKs).
--
-- O que muda é o latch do fim: concluir exigia a regra enviada, e agora exige
-- o voto (o latch anterior às perguntas). Sem isto, toda criança que termina
-- as perguntas recebe um 500 do CHECK ao concluir.
ALTER TABLE "exp05ef1b_sessoes"
  DROP CONSTRAINT "exp05ef1b_sessoes_concluido_check",
  ADD CONSTRAINT "exp05ef1b_sessoes_concluido_check"
    CHECK ("concluido_em" IS NULL OR "votou_em" IS NOT NULL);
