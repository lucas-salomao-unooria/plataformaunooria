-- exp-92: o planejamento passa a ser SEMPRE semanal (ADR-76).
--
-- A `periodicidade` (semanal | quinzenal) era o passo do planejamento granular.
-- Ela sai porque o que a quinzena resolvia era a ENTREGA — a escola que recolhe
-- planejamento de quinze em quinze dias —, e isso virou recorte de EXPORTAÇÃO:
-- o professor planeja semana a semana e baixa duas juntas, ou o período inteiro.
--
-- Como PASSO ela custava caro: `exp_92_planos_de_periodo` é endereçada por
-- (escola, plano anual, ordem), e a ordem MUDA DE SIGNIFICADO com a
-- periodicidade — a 3ª quinzena não é a 3ª semana. Um plano gravado em modo
-- quinzenal e lido em modo semanal casa pela ordem e devolve as datas da
-- quinzena com as aulas de outro pedaço do calendário.
--
-- Por isso o DELETE abaixo, que é a única parte destrutiva desta migração: os
-- planos de período das regências que estavam em QUINZENAL são apagados, porque
-- mantê-los produziria exatamente o documento que mente sobre as próprias
-- datas. As regências, os planos anuais e a distribuição de habilidades ficam —
-- o que se perde é o detalhamento aula a aula, que o professor regera pelo botão
-- da semana. Regência semanal não é tocada.

DELETE FROM "exp_92_planos_de_periodo"
WHERE "plano_anual_id" IN (
  SELECT pa."id"
  FROM "exp_92_planos_anuais" pa
  JOIN "exp_92_configuracoes" c ON c."id" = pa."configuracao_id"
  WHERE c."periodicidade" = 'quinzenal'
);

-- A CHECK vai antes da coluna: dropar a coluna a levaria junto, mas nomeá-la
-- aqui deixa no histórico o registro do que foi retirado.
ALTER TABLE "exp_92_configuracoes"
  DROP CONSTRAINT IF EXISTS "exp_92_configuracoes_periodicidade_valida";

ALTER TABLE "exp_92_configuracoes"
  DROP COLUMN IF EXISTS "periodicidade";
