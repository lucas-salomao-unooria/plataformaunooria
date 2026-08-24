-- Tenancy: toda tabela de dados tem escola_id NOT NULL + RLS.
CREATE TABLE IF NOT EXISTS progresso (
  escola_id     text NOT NULL,
  aluno_id      text NOT NULL,
  exp_id        text NOT NULL,
  dados         jsonb NOT NULL DEFAULT '{}',
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (escola_id, aluno_id, exp_id)
);
ALTER TABLE progresso ENABLE ROW LEVEL SECURITY;
-- A api conecta como role de app e seta: SET app.escola_id = '...':
CREATE POLICY progresso_por_escola ON progresso
  USING (escola_id = current_setting('app.escola_id', true));

CREATE TABLE IF NOT EXISTS telemetria_eventos (
  event_id   uuid PRIMARY KEY,
  ts         timestamptz NOT NULL,
  escola_id  text NOT NULL,
  aluno_id   text NOT NULL,
  exp_id     text NOT NULL,
  exp_version text NOT NULL,
  sessao_id  uuid NOT NULL,
  verbo      text NOT NULL,
  objeto     text NOT NULL,
  resultado  jsonb,
  contexto   jsonb
);
CREATE INDEX IF NOT EXISTS idx_tel_escola_exp_ts ON telemetria_eventos (escola_id, exp_id, ts);
