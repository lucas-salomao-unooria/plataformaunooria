-- O início do ano letivo passa a ser dado DA REGÊNCIA.
--
-- O bug: a tela pedia a data ao professor e a descartava. `periodos_letivos` é
-- catálogo do CONTRATO, e o seed o cadastra como ANO CIVIL — "Ano letivo 2026"
-- de 01/01 a 31/12. Como o calendário do plano alinha cada período na segunda-
-- feira, a semana de 1º de janeiro de 2026 começa em 29/12/2025, e o professor
-- que declarou 02/02/2026 recebia um 1º bimestre iniciando em DEZEMBRO DO ANO
-- ANTERIOR.
--
-- Guardar aqui é o que corresponde à realidade: `periodos_letivos` é da rede
-- inteira, mas a data de volta às aulas varia entre escolas do mesmo contrato
-- (e entre turnos). A tabela do contrato continua servindo de sugestão para o
-- primeiro preenchimento; o que vale para o plano é esta coluna.
--
-- NULL é aceito e significa "usa a sugestão": as regências criadas antes desta
-- migração continuam funcionando, e a próxima edição preenche.

ALTER TABLE "exp_92_configuracoes" ADD COLUMN "inicio_do_ano_letivo" DATE;

-- Sanidade: a volta às aulas cai no ano letivo declarado ou na virada dele.
-- Uma data em julho é plausível (rede com ano letivo em dois semestres); uma em
-- 2019 é erro de digitação, e ele desalinharia as 40 janelas do plano.
ALTER TABLE "exp_92_configuracoes"
  ADD CONSTRAINT "exp_92_configuracoes_inicio_no_ano"
  CHECK (
    "inicio_do_ano_letivo" IS NULL
    OR EXTRACT(YEAR FROM "inicio_do_ano_letivo") BETWEEN "ano_letivo" - 1 AND "ano_letivo"
  );
