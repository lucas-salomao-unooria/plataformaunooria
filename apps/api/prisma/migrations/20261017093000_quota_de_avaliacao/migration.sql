-- A QUOTA DE AVALIAÇÃO (ADR-169): a terceira linha de `ia_quotas`.
--
-- O QUE FALTAVA. A leitura que a plataforma faz do trabalho da criança para a
-- evidência pedagógica (o Canal A da exp07ef1b: a legenda dos Stories lida pela
-- IA) debitava a quota do ESTUDANTE. Avaliar não pode competir com o uso que o
-- estudante faz da IA como ferramenta: quem gastou a quota no tutor de outra
-- missão de manhã cairia, à tarde, na régua de reserva — mais fraca — pelo mesmo
-- trabalho que o colega teve lido pela IA.
--
-- `avaliacao` NÃO é perfil de token: é a linha da plataforma. O teto é POR
-- ESCOLA por dia, contado em `ia_uso_diario` com o usuário `avaliacao` (a
-- coluna é texto e sem FK desde o init). Esgotado, a leitura cai na reserva e
-- vai para a revisão da professora — a aula nunca trava.

ALTER TABLE "ia_quotas" DROP CONSTRAINT "ck_ia_quotas_perfil";
ALTER TABLE "ia_quotas"
  ADD CONSTRAINT "ck_ia_quotas_perfil"
    CHECK ("perfil" IN ('estudante', 'professor', 'avaliacao'));

-- A SEMENTE: 4 milhões por escola por dia. Uma escola grande (5 turmas × 40
-- estudantes × 2 rodadas) faz ~400 leituras num dia de aula; a leitura de uma
-- legenda custa da ordem de milhares de tokens (o Gemini 3 raciocina e o
-- raciocínio sai do mesmo orçamento, ADR-148). A folga é de propósito: o teto
-- existe para conter um laço, não para racionar a avaliação. O `admin` ajusta
-- em `/unooria/uso-de-ia` com o número MEDIDO no painel de custos.
INSERT INTO "ia_quotas" ("perfil", "tokens_por_dia", "motivo")
VALUES
  ('avaliacao', 4000000, 'Por escola e dia: cabe a leitura das legendas de uma escola grande com folga (cerca de 400 leituras num dia de aula).')
ON CONFLICT ("perfil") DO NOTHING;
