-- exp-03: o marco carrega o relógio do instante (ADR-64).
--
-- Só ALTER. Nenhuma coluna de tenancy muda, nenhuma política de RLS é tocada:
-- as políticas de `exp_03_marcos` e `exp_03_simulacoes` continuam as da
-- migration 20260827184956, e as colunas novas nascem dentro delas.

-- O cronômetro de parede no instante do marco ("faltavam 1:40") e o motivo,
-- quando o relógio já tinha fechado. Reconstruir depois é inviável: "+2 min"
-- altera `duracao_seg` sem histórico e "zerar a turma" apaga o relógio.
ALTER TABLE "exp_03_marcos"
  ADD COLUMN "segundos_restantes" INTEGER,
  ADD COLUMN "motivo_do_fim" TEXT;

ALTER TABLE "exp_03_marcos"
  ADD CONSTRAINT "exp_03_marcos_segundos_check"
    CHECK ("segundos_restantes" IS NULL OR "segundos_restantes" >= 0),
  ADD CONSTRAINT "exp_03_marcos_motivo_check"
    CHECK ("motivo_do_fim" IS NULL OR "motivo_do_fim" IN ('tempo', 'professor'));

-- Dois tipos novos: `inicio` (entrou na Investigação — de onde se mede o tempo
-- até a primeira fala) e `recomeco` (o clique em Recomeçar/Tentar de novo, com
-- o relógio que o estudante via). Recriar o CHECK é a única forma de estendê-lo.
ALTER TABLE "exp_03_marcos"
  DROP CONSTRAINT "exp_03_marcos_tipo_check";
ALTER TABLE "exp_03_marcos"
  ADD CONSTRAINT "exp_03_marcos_tipo_check"
    CHECK ("tipo" IN ('fontes', 'leitura', 'alocacao', 'envio', 'inicio', 'recomeco'));

-- A FAIXA da mesma decisão, gravada no confirmar. Era recomputada (200
-- corridas) a cada leitura, e uma mudança de parâmetro reescrevia em silêncio
-- o relatório de partidas antigas. Null = anterior à coluna; a leitura recomputa.
ALTER TABLE "exp_03_simulacoes"
  ADD COLUMN "esperado" JSONB;
