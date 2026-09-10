-- QUEM DESLIGOU ISTO, E QUANDO? (ADR-89)
--
-- A ADR-87 declarou este gatilho e o deixou aberto de propósito: o histórico de
-- quem mexeu vivia só no registro estruturado (`codigo: recurso-alterado`),
-- porque a linha de `disponibilidades` é SOBRESCRITA a cada mudança. Log
-- responde a pergunta para quem tem acesso ao Cloud Logging; não responde na
-- TELA, e é na tela que a pergunta é feita — às 8h da manhã, por quem está com
-- a escola ao telefone.
--
-- Esta tabela é o registro APPEND-ONLY daquelas mudanças, e ela é lida por DOIS
-- painéis: o da Unooria (`/unooria/recursos`, quem faz) e o da rede
-- (`/admin/recursos`, quem sofre). A rede não escreve nada — ligar e desligar
-- continua sendo só do `admin` (ADR-88) —, mas ver POR QUÊ o produto dela mudou
-- de estado é informação que pertence ao cliente.

CREATE TABLE "recursos_auditoria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recurso_id" TEXT NOT NULL,
    "escola_id" TEXT,
    "acao" TEXT NOT NULL,
    "versao" TEXT,
    "motivo" TEXT,
    "autor_id" UUID NOT NULL,
    "autor_nome" TEXT NOT NULL,
    "quando" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recursos_auditoria_pkey" PRIMARY KEY ("id")
);

-- A leitura é sempre "o que aconteceu, do mais recente para o mais antigo",
-- filtrada por recurso ou por escola. Um índice por (quando DESC) cobre a
-- listagem geral; os dois parciais cobrem os filtros da tela.
CREATE INDEX "recursos_auditoria_quando_idx" ON "recursos_auditoria"("quando" DESC);
CREATE INDEX "recursos_auditoria_recurso_idx"
  ON "recursos_auditoria"("recurso_id", "quando" DESC);
CREATE INDEX "recursos_auditoria_escola_idx"
  ON "recursos_auditoria"("escola_id", "quando" DESC);

-- ---------------------------------------------------------------- bloco MANUAL

-- Vocabulário FECHADO das ações, espelhando `ACOES_DE_AUDITORIA` do código.
-- Mesmo par que o CHECK de `produto` e o de `permissoes`: o teste
-- `auditoria-de-recursos-postgres.spec.ts` prende os dois, porque a divergência
-- só aparece como 500 no log da api.
ALTER TABLE "recursos_auditoria"
  ADD CONSTRAINT "ck_recursos_auditoria_acao"
    CHECK ("acao" IN (
      'ligado', 'desligado', 'herdado',
      'versao-ativada', 'versao-fixada', 'versao-soltada'
    ));

-- `versao` existe exatamente nas ações de versão, e em nenhuma outra. Campo
-- preenchido onde não significa nada é pior que campo vazio: quem lê a linha
-- `desligado` com uma versão ao lado conclui que a versão foi parte da decisão.
ALTER TABLE "recursos_auditoria"
  ADD CONSTRAINT "ck_recursos_auditoria_versao"
    CHECK (
      ("acao" IN ('versao-ativada', 'versao-fixada')) = ("versao" IS NOT NULL)
    );

/*
 * APPEND-ONLY DE VERDADE: `UPDATE` é recusado pelo banco.
 *
 * Sem isto, "append-only" seria promessa do código — e a promessa que o banco
 * não cobra é a que a próxima rotina de correção quebra. Reescrever uma linha
 * de histórico é o único jeito de esta tabela mentir, e é o que o trigger
 * fecha.
 *
 * `DELETE` continua PERMITIDO, e isso é decisão, não esquecimento. Duas razões,
 * as duas concretas: retenção (nenhuma tabela deste produto tem prazo hoje, e
 * quando tiver, quem cumprir o prazo precisa apagar) e ISOLAMENTO DE TESTE —
 * uma tabela que não se limpa faz cada suíte deixar linha para trás, e em
 * 2026-09-10 esta sessão gastou três diagnósticos exatamente nesse tipo de
 * vazamento entre suítes.
 */
CREATE OR REPLACE FUNCTION recursos_auditoria_nao_reescreve() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'recursos_auditoria é append-only: UPDATE não é permitido (id %)', OLD."id";
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recursos_auditoria_sem_update
  BEFORE UPDATE ON "recursos_auditoria"
  FOR EACH ROW EXECUTE FUNCTION recursos_auditoria_nao_reescreve();

-- SEM RLS, pelo mesmo motivo de `disponibilidades`: é registro de configuração
-- da rede, não dado de estudante, e a linha de escopo-contrato tem `escola_id`
-- nulo por desenho — a política por `escola_id` a esconderia. Quem protege a
-- leitura é o `RolesGuard` (`GESTORES_DO_CONTRATO`): a rede vê o histórico do
-- próprio contrato, que é a stack inteira.
--
-- **`autor_id` NÃO tem FK**, ao contrário de `disponibilidades.definido_por`.
-- Uma FK com `RESTRICT` travaria a exclusão de qualquer conta que já tenha
-- mexido no painel — para sempre, porque histórico não se apaga. E `autor_nome`
-- é CONGELADO na linha: um JOIN mostraria o nome de hoje (ou nada, se a conta
-- saiu da rede), e o registro deixaria de dizer quem era aquela pessoa NAQUELE
-- dia. É a mesma razão de `exp_01_runs.nome_no_app` guardar o apelido em vez de
-- o resolver.

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    EXECUTE 'GRANT SELECT, INSERT, DELETE ON recursos_auditoria TO app_runtime';
  END IF;
END $$;
