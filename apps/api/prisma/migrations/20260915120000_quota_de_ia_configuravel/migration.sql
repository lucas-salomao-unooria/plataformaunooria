-- A QUOTA DE IA VIRA DADO (ADR-105): o teto diário de tokens por perfil sai das
-- variáveis de ambiente e passa a morar no banco, editável pelo painel da
-- Unooria (`/unooria/uso-de-ia`, só `admin`, ADR-88).
--
-- O QUE FALTAVA. O limite vivia em `AI_DAILY_TOKEN_QUOTA_PER_ESTUDANTE` e
-- `AI_DAILY_TOKEN_QUOTA_PER_PROFESSOR`, lidas pelo `QuotaService` a cada
-- chamada. Mudar o teto de UMA rede era editar o Terraform de outro repositório
-- e fazer deploy da api — para uma decisão que é comercial e operacional
-- (quanto de IA esta rede contratou), não de código. É o mesmo movimento que
-- `disponibilidades` fez com o "este produto existe nesta rede?" (ADR-87).
--
-- Molde do bloco manual: 20260909120000_disponibilidade_de_recursos.

-- ============================================================ ia_quotas

-- UMA LINHA POR PERFIL, escopo do CONTRATO inteiro. Sem `escola_id`: um
-- contrato é uma stack (1 contrato = 1 stack GCP), então "a quota desta rede"
-- é a quota deste banco. Escopo por escola ou regional foi descartado na
-- ADR-105 — nenhuma rede pediu, e dobraria o resolvedor.
CREATE TABLE "ia_quotas" (
    "perfil" TEXT NOT NULL,
    "tokens_por_dia" INTEGER NOT NULL,
    "motivo" TEXT,
    "definido_por" UUID,
    "definido_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ia_quotas_pkey" PRIMARY KEY ("perfil")
);

-- ---------------------------------------------------------------- bloco MANUAL

-- Vocabulário FECHADO, espelhando `PERFIS_COM_QUOTA` de src/ai/quota.service.ts.
-- Só DOIS perfis chamam IA de fato: o estudante (tutor da exp-01, exp-03,
-- exp-07) e o professor (exp-04, exp-07, exp-08, exp-90, exp-91, exp-92). Os
-- gestores e o `admin` não têm rota de IA hoje; quando tiverem, a linha deles
-- nasce aqui E no CHECK, como `produto` faz. O `QuotaService` mapeia todo
-- perfil que não é `estudante` para a linha `professor` — é o comportamento
-- que já valia com as duas envs, agora dito em código.
ALTER TABLE "ia_quotas"
  ADD CONSTRAINT "ck_ia_quotas_perfil"
    CHECK ("perfil" IN ('estudante', 'professor'));

-- Zero e negativo não são "quota": são o interruptor de disponibilidade
-- (ADR-87) tentando entrar pela porta errada. Quem quer desligar a IA de um
-- produto desliga o produto.
ALTER TABLE "ia_quotas"
  ADD CONSTRAINT "ck_ia_quotas_tokens_positivos"
    CHECK ("tokens_por_dia" > 0);

-- **SEM FK em `definido_por`**, como `recursos_auditoria.autor_id` e ao
-- contrário de `disponibilidades.definido_por`. A linha é SOBRESCRITA a cada
-- mudança e o histórico com o nome CONGELADO de quem mexeu vive em
-- `recursos_auditoria` (ADR-89) — aqui o id é só o rastro da última mão. Uma FK
-- com RESTRICT travaria para sempre a exclusão de quem já ajustou a quota;
-- NULO = veio desta migration, e nenhuma pessoa decidiu ainda.

-- **SEM RLS**, e isto é a exceção que precisa estar escrita — toda tabela nova
-- deste repositório entra na política da regra inviolável nº 1. Duas razões,
-- as mesmas de `disponibilidades`: (a) não é dado de estudante, é configuração
-- comercial da rede; (b) não há `escola_id` — a linha vale para o contrato
-- inteiro, e uma política por escola a esconderia de todo mundo. Quem protege a
-- escrita é o `RolesGuard` (`@Roles("admin")`); a leitura é interna ao
-- `QuotaService` e à rota do painel.

-- A SEMENTE: os valores que valiam por env até aqui, para que NENHUMA rede mude
-- de comportamento no deploy desta migration. 300k = ~4 partidas da exp-03
-- (uma custa ~77k tokens, MEDIDO em `unoogpt/regras/defaults.ts`); 2M = seis a
-- nove planos anuais, cujo PROMPT sozinho passa de 200k tokens.
INSERT INTO "ia_quotas" ("perfil", "tokens_por_dia", "motivo")
VALUES
  ('estudante', 300000,  'Valor inicial da plataforma (migration de 2026-09-15): cabe ~4 partidas completas da Missão Tempestade por dia.'),
  ('professor', 2000000, 'Valor inicial da plataforma (migration de 2026-09-15): cabe de 6 a 9 planos anuais por dia.')
ON CONFLICT ("perfil") DO NOTHING;

-- ============================================================ auditoria

-- A MUDANÇA DE QUOTA ENTRA NO MESMO HISTÓRICO do painel (ADR-89), com uma ação
-- nova e um campo novo. Uma tabela de histórico própria foi descartada na
-- ADR-105: seriam duas telas de "quem mudou o quê" com colunas quase iguais, e
-- a segunda é a que ninguém abre.
--
-- `detalhe` guarda `{"de": 300000, "para": 500000}`. Bicondicional com a ação,
-- pela MESMA razão de `versao`: campo preenchido onde não significa nada faz
-- quem lê a linha `desligado` procurar um número que não existiu. `recurso_id`
-- desta tabela nunca teve CHECK de formato (só `disponibilidades` tem), então
-- `quota:estudante` entra sem mexer em constraint de id.
ALTER TABLE "recursos_auditoria" ADD COLUMN "detalhe" JSONB;

ALTER TABLE "recursos_auditoria" DROP CONSTRAINT "ck_recursos_auditoria_acao";
ALTER TABLE "recursos_auditoria"
  ADD CONSTRAINT "ck_recursos_auditoria_acao"
    CHECK ("acao" IN (
      'ligado', 'desligado', 'herdado',
      'versao-ativada', 'versao-fixada', 'versao-soltada',
      'quota-alterada'
    ));

ALTER TABLE "recursos_auditoria"
  ADD CONSTRAINT "ck_recursos_auditoria_detalhe"
    CHECK (("acao" = 'quota-alterada') = ("detalhe" IS NOT NULL));

-- A role de runtime (docs/INFRA.md) conecta sem ownership e precisa de
-- privilégio na tabela nova. Guardado: em dev/CI a role não existe. Sem DELETE:
-- a linha de um perfil não se apaga — sem ela, vale a constante do código e o
-- log `ia-quota-sem-linha` acusa.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON ia_quotas TO app_runtime';
  END IF;
END $$;
