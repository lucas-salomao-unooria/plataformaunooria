-- O MASCOTE NA AJUDA (ADR-158): o segundo atendente, ao lado do avatar em vídeo
-- do LiveAvatar (ADR-132). O mascote 3D da Unooria fala pelo Gemini Live da
-- Vertex, por um proxy WebSocket desta api; a boca sai do próprio áudio.
--
-- Três mudanças:
--   1. `ajuda_sessoes.atendente`: qual dos dois a pessoa usou. Os minutos do
--      dia (`ajuda_limites`) valem para os dois juntos — é o mesmo medidor.
--   2. `ajuda_configuracao`: UMA linha com o atendente padrão e os ajustes do
--      mascote, editada só pelo `admin` em `/unooria/uso-de-ia`.
--   3. A ação `configuracao-alterada` no histórico do painel.
--
-- Molde: 20261002120000_ajuda_com_avatar.

-- ------------------------------------------------------------ ajuda_sessoes

-- As linhas que já existem são todas do avatar (o único atendente até aqui).
ALTER TABLE "ajuda_sessoes" ADD COLUMN "atendente" TEXT NOT NULL DEFAULT 'avatar';
ALTER TABLE "ajuda_sessoes"
  ADD CONSTRAINT "ck_ajuda_sessoes_atendente"
    CHECK ("atendente" IN ('avatar', 'mascote'));

-- ------------------------------------------------------------ ajuda_configuracao

-- UMA linha (id = 1), escopo do contrato inteiro, como `ia_quotas` e
-- `ajuda_limites`: SEM RLS e SEM `escola_id` — é configuração comercial da
-- rede, e o `admin` não tem escola no token. SEM FK em `definido_por`, pela
-- mesma razão de `ajuda_limites`: o nome congelado de quem mexeu vive em
-- `recursos_auditoria`.
CREATE TABLE "ajuda_configuracao" (
    "id" SMALLINT NOT NULL DEFAULT 1,
    "atendente_padrao" TEXT NOT NULL DEFAULT 'mascote',
    "permitir_troca" BOOLEAN NOT NULL DEFAULT true,
    "mascote_voz" TEXT NOT NULL DEFAULT 'Leda',
    "mascote_modelo" TEXT NOT NULL DEFAULT 'gemini-3.8-live',
    "mascote_sensibilidade" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "mascote_suavizacao" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "mascote_antecipacao_ms" INTEGER NOT NULL DEFAULT 60,
    "mascote_boca_repouso" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "motivo" TEXT,
    "definido_por" UUID,
    "definido_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajuda_configuracao_pkey" PRIMARY KEY ("id")
);

-- Uma linha só: a configuração é da rede, não de alguém.
ALTER TABLE "ajuda_configuracao"
  ADD CONSTRAINT "ck_ajuda_configuracao_unica" CHECK ("id" = 1);

-- Espelha `ATENDENTES` de src/ajuda/regras.ts.
ALTER TABLE "ajuda_configuracao"
  ADD CONSTRAINT "ck_ajuda_configuracao_atendente"
    CHECK ("atendente_padrao" IN ('avatar', 'mascote'));

-- A voz e o modelo vão para o setup do vendor: só o formato de um nome, nada
-- que possa carregar texto livre para dentro do pedido.
ALTER TABLE "ajuda_configuracao"
  ADD CONSTRAINT "ck_ajuda_configuracao_voz"
    CHECK ("mascote_voz" ~ '^[A-Za-z]{2,30}$');
ALTER TABLE "ajuda_configuracao"
  ADD CONSTRAINT "ck_ajuda_configuracao_modelo"
    CHECK ("mascote_modelo" ~ '^[a-z0-9][a-z0-9.-]{2,80}$');

-- Os ajustes da boca: as mesmas faixas dos controles do PoC.
ALTER TABLE "ajuda_configuracao"
  ADD CONSTRAINT "ck_ajuda_configuracao_boca"
    CHECK ("mascote_sensibilidade" BETWEEN 0 AND 1
           AND "mascote_suavizacao" BETWEEN 0 AND 1
           AND "mascote_boca_repouso" BETWEEN 0 AND 1
           AND "mascote_antecipacao_ms" BETWEEN 0 AND 200);

-- A SEMENTE: o mascote é o atendente padrão (decisão do dono do produto,
-- 2026-10-12), com os ajustes que o PoC deixou como padrão.
INSERT INTO "ajuda_configuracao" ("id", "motivo")
VALUES (1, 'Padrão da plataforma: o mascote atende, com os ajustes do teste do mascote.')
ON CONFLICT ("id") DO NOTHING;

-- ------------------------------------------------------------ histórico

ALTER TABLE "recursos_auditoria" DROP CONSTRAINT "ck_recursos_auditoria_acao";
ALTER TABLE "recursos_auditoria"
  ADD CONSTRAINT "ck_recursos_auditoria_acao"
    CHECK ("acao" IN (
      'ligado', 'desligado', 'herdado',
      'versao-ativada', 'versao-fixada', 'versao-soltada',
      'quota-alterada', 'configuracao-alterada'
    ));

-- A role de runtime conecta sem ownership. Sem DELETE: sem a linha vale a
-- constante do código, e o log `ajuda-configuracao-sem-linha` acusa.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON ajuda_configuracao TO app_runtime';
  END IF;
END $$;
