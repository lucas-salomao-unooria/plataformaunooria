-- `telemetria_eventos` particionada por mês.
--
-- O problema: a tabela é append-only, cresce para sempre (não há prazo de
-- retenção declarado — decisão registrada no CLAUDE.md) e a 10 mil alunos dá
-- ~60M linhas/ano. Numa tabela única isso vira índice inchado, VACUUM lento, e
-- qualquer retenção futura seria um `DELETE` que trava a tabela e deixa bloat.
--
-- Com partição por RANGE (ts): cada mês é uma tabela pequena, a consulta faz
-- pruning, e uma eventual retenção vira `DROP TABLE particoes.<mês>` —
-- instantâneo e sem bloat. A decisão sobre prazo continua em aberto; o que
-- muda é que ela deixa de ser cara.
--
-- DUAS ESCOLHAS QUE PRECISAM DE EXPLICAÇÃO:
--
-- 1. As partições vivem no schema `particoes`, não em `public`. O Prisma
--    gerencia `public` e enxergaria cada partição como uma tabela fora do
--    schema.prisma — drift a cada `migrate dev`. Postgres permite a partição
--    num schema diferente do pai, e é o que mantém as duas ferramentas em paz.
--
-- 2. Existe uma partição DEFAULT. Sem ela, um evento com `ts` fora de todas as
--    faixas é RECUSADO — telemetria perdida em silêncio, que é pior do que
--    guardar mal. Ela é rede de segurança, não plano: linha que cai ali impede
--    criar a partição daquela faixa depois sem mover os dados. Se ela começar a
--    encher, é sinal de que faltou criar partição (não há job agendado nesta
--    plataforma, de propósito — ver INFRA.md).
--
-- A PK passa a ser (event_id, ts): Postgres exige a chave de partição em
-- qualquer índice único. A dedupe do Pub/Sub (`ON CONFLICT`) continua correta,
-- porque a reentrega da MESMA mensagem traz o mesmo `ts`.

CREATE SCHEMA IF NOT EXISTS particoes;

ALTER TABLE telemetria_eventos RENAME TO telemetria_eventos_antiga;

-- Constraint e índice NÃO acompanham o rename da tabela em Postgres. Sem
-- liberar os nomes aqui, o CREATE abaixo falha com "relation ... already
-- exists" — e o erro fala do ÍNDICE, não da tabela, o que despista.
ALTER TABLE telemetria_eventos_antiga
  RENAME CONSTRAINT telemetria_eventos_pkey TO telemetria_eventos_antiga_pkey;
ALTER INDEX idx_tel_escola_exp_ts RENAME TO idx_tel_escola_exp_ts_antiga;

CREATE TABLE telemetria_eventos (
  event_id    uuid          NOT NULL,
  ts          timestamptz(6) NOT NULL,
  escola_id   text          NOT NULL,
  aluno_id    text          NOT NULL,
  exp_id      text          NOT NULL,
  exp_version text          NOT NULL,
  sessao_id   uuid          NOT NULL,
  verbo       text          NOT NULL,
  objeto      text          NOT NULL,
  resultado   jsonb,
  contexto    jsonb,
  CONSTRAINT telemetria_eventos_pkey PRIMARY KEY (event_id, ts)
) PARTITION BY RANGE (ts);

-- Uma partição por mês, criadas com folga. Rodar sem partição para o mês
-- corrente cairia na DEFAULT.
DO $$
DECLARE
  base  date := date '2026-01-01';
  i     int;
  ini   date;
  fim   date;
  nome  text;
BEGIN
  FOR i IN 0..35 LOOP  -- 2026-01 .. 2028-12
    ini  := (base + (i || ' months')::interval)::date;
    fim  := (base + ((i + 1) || ' months')::interval)::date;
    nome := 'telemetria_eventos_' || to_char(ini, 'YYYY_MM');
    EXECUTE format(
      'CREATE TABLE particoes.%I PARTITION OF public.telemetria_eventos FOR VALUES FROM (%L) TO (%L)',
      nome, ini, fim);
  END LOOP;
END $$;

CREATE TABLE particoes.telemetria_eventos_fora_de_faixa
  PARTITION OF public.telemetria_eventos DEFAULT;

-- Índice no PAI: o Postgres o propaga para toda partição, inclusive as futuras.
CREATE INDEX idx_tel_escola_exp_ts
  ON telemetria_eventos (escola_id, exp_id, ts);

-- A cópia vem ANTES da RLS de propósito: com `FORCE ROW LEVEL SECURITY` e sem
-- `app.escola_id` no contexto, a política reprovaria o próprio INSERT da
-- migration (o USING vale como WITH CHECK numa policy FOR ALL).
INSERT INTO telemetria_eventos
  (event_id, ts, escola_id, aluno_id, exp_id, exp_version, sessao_id, verbo, objeto, resultado, contexto)
SELECT event_id, ts, escola_id, aluno_id, exp_id, exp_version, sessao_id, verbo, objeto, resultado, contexto
  FROM telemetria_eventos_antiga;

DROP TABLE telemetria_eventos_antiga;

-- Mesma tenancy de antes. Na tabela particionada a política do PAI vale para
-- todo acesso feito através dele, que é o único caminho da api.
ALTER TABLE telemetria_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetria_eventos FORCE ROW LEVEL SECURITY;
CREATE POLICY telemetria_eventos_por_escola ON telemetria_eventos
  USING (escola_id = current_setting('app.escola_id', true));
