-- De onde veio o nível (ADR-166): o marcador da ficha que deu cada evidência
-- PRÓPRIA. O painel o mostra ao professor ("Raio-x", "Reflexão — sugestão da
-- IA"), e o consolidado o lê para contar à parte o "em processo" que mede a
-- atividade escolhida, e não o estudante (marcador `limitadoPelaAtividade`).
--
-- A tabela já tem `escola_id NOT NULL` e RLS forçada; nada disso muda. A coluna
-- é nula na cópia da equipe, no ajuste do professor e nas linhas gravadas antes
-- dela — o painel dessas fica como sempre foi.

ALTER TABLE "evidencias" ADD COLUMN "marcador" TEXT;

-- O mesmo alfabeto dos ids da ficha (`ID_DA_FICHA_RE` em `evidencias/regras.ts`).
ALTER TABLE "evidencias"
  ADD CONSTRAINT "evidencias_marcador_check"
    CHECK ("marcador" IS NULL OR "marcador" ~ '^[A-Za-z0-9_.:-]{1,100}$');

-- Coerência: só a evidência PRÓPRIA sabe de que marcador veio. Cópia e ajuste
-- que chegassem com marcador mentiriam sobre a origem do nível.
ALTER TABLE "evidencias"
  ADD CONSTRAINT "evidencias_marcador_so_na_propria_check"
    CHECK ("marcador" IS NULL OR "origem" = 'propria');
