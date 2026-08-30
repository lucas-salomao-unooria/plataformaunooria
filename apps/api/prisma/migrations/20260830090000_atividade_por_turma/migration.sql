-- A atividade do Instanooria não dizia para qual TURMA ela era.
--
-- O schema já falava como se dissesse: o comentário de `etapa` chama o campo de
-- "Relógio COLETIVO da turma", e `distribuicaoDaTurma` tem "turma" no nome. Mas
-- o vínculo não existia — `exp_01_activities` só tinha `escola_id` e
-- `professor_id`. As consequências eram todas silenciosas:
--
--   * o painel de perfis listava os alunos da ESCOLA, misturando salas;
--   * `POST :id/perfis/da-vila` mandava `{}` e varria a escola, então o
--     "N ainda não jogaram" contava crianças de outras turmas;
--   * `POST /runs` entrega ao aluno a atividade ativa mais recente da escola,
--     então o aluno do 8B entrava na atividade do 8A.
--
-- Anulável e SEM backfill, de propósito. `NULL` quer dizer "atividade anterior a
-- esta mudança", e é assim que ela continua se comportando como antes — escolher
-- uma turma para as que já existem inventaria uma decisão que nenhum professor
-- tomou. É a mesma regra do `inclinacao_inicial` em
-- `20260829120000_conclusao_primeira_e_ultima`.
--
-- `ON DELETE RESTRICT`: apagar uma turma que tem atividade rodando deixaria o
-- painel e a largada sem referência no meio da aula. Turma sai de cena por
-- período letivo novo, não por DELETE.
--
-- RLS não muda: a policy de `exp_01_activities` é
-- `USING (escola_id = current_setting('app.escola_id', true))`, sem WITH CHECK e
-- sem enumerar colunas — coluna nova é transparente para ela.
ALTER TABLE "exp_01_activities" ADD COLUMN "turma_id" UUID;

ALTER TABLE "exp_01_activities"
  ADD CONSTRAINT "exp_01_activities_turma_id_fkey"
  FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "exp_01_activities_turma_id_idx" ON "exp_01_activities"("turma_id");
