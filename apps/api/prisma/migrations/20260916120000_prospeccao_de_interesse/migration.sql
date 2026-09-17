-- O CADASTRO DE INTERESSE DO SITE PÚBLICO (ADR-107): quem preenche o formulário
-- do ENTRE REDES em `/` passa a cair no Postgres da plataforma, pela api.
--
-- O QUE ISTO SUBSTITUI. O site nasceu fora deste repositório, e o formulário
-- dele escrevia num SQLite (Cloudflare D1) servido por um Worker próprio, com
-- uma página de listagem protegida por um token no fragmento da URL. Eram um
-- banco, um runtime e um modelo de autorização a mais na arquitetura, nenhum
-- deles visível para quem opera a plataforma. A migração fecha os três: os
-- dados vêm para cá, a escrita passa pela api e quem lê é o `admin` no painel
-- da Unooria (`/unooria/prospeccao`, ADR-88).
--
-- Molde do bloco manual: 20260915120000_quota_de_ia_configuravel.

-- ============================================================ prospeccao_leads

CREATE TABLE "prospeccao_leads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "organizacao" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "consentimento_texto" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospeccao_leads_pkey" PRIMARY KEY ("id")
);

-- Dedupe e leitura da tela, nesta ordem de uso: a rota pública consulta
-- `(email, criado_em)` antes de gravar, e o painel lista por data decrescente.
CREATE INDEX "prospeccao_leads_email_criado_em_idx" ON "prospeccao_leads" ("email", "criado_em");
CREATE INDEX "prospeccao_leads_criado_em_idx" ON "prospeccao_leads" ("criado_em" DESC);

-- ---------------------------------------------------------------- bloco MANUAL

-- Campo vazio não é cadastro: o Zod da rota já recusa, e o CHECK garante que
-- nenhum outro caminho (seed, correção manual, importação futura) escreva uma
-- linha que a tela mostraria como uma fileira de células em branco.
ALTER TABLE "prospeccao_leads"
  ADD CONSTRAINT "ck_prospeccao_leads_campos_preenchidos"
    CHECK (
      length(btrim("nome")) > 0 AND
      length(btrim("email")) > 0 AND
      length(btrim("telefone")) > 0 AND
      length(btrim("organizacao")) > 0 AND
      length(btrim("cargo")) > 0 AND
      length(btrim("consentimento_texto")) > 0
    );

-- O e-mail entra SEMPRE em minúsculas. É a chave do dedupe da rota pública, e
-- `Diretoria@rede.sp.gov.br` e `diretoria@rede.sp.gov.br` são a mesma pessoa
-- tentando de novo — com o CHECK, nenhuma escrita futura reabre essa porta.
ALTER TABLE "prospeccao_leads"
  ADD CONSTRAINT "ck_prospeccao_leads_email_minusculo"
    CHECK ("email" = lower("email"));

-- **SEM RLS, e sem `escola_id`** — a exceção à regra inviolável nº 1, e ela
-- precisa estar escrita. A regra isola DADO DE ESTUDANTE por escola; aqui não
-- há estudante, não há escola e não há contrato: quem escreve é um visitante do
-- site, meses ANTES de existir tenant para o qual isolar. Uma política por
-- `escola_id` sobre uma tabela sem a coluna esconderia a tabela de todo mundo.
-- Quem protege a LEITURA é o `RolesGuard` (`@Roles("admin")`, ADR-88) e a
-- ESCRITA é pública por desenho — a defesa dela é o Zod, a cota por IP e o
-- campo-armadilha, em `prospeccao-publico.controller.ts`.
--
-- Consequência a não esquecer: como não há RLS, TODA query desta tabela na api
-- roda fora de `comTenancy`. É de propósito, e é o único lugar do repositório
-- em que isso vale.

-- DADO PESSOAL DE ADULTO, com base legal de CONSENTIMENTO (LGPD art. 7º, I) —
-- ao contrário do dado de estudante, cuja base é a execução de política pública
-- (ver `/privacidade`). Aqui o consentimento é válido porque a relação é
-- voluntária: ninguém é obrigado a pedir uma apresentação comercial.
--
-- Por isso a role de runtime recebe DELETE, que `ia_quotas` não tem: o titular
-- pode revogar o consentimento e pedir a eliminação (art. 18, VI), e uma tabela
-- sem DELETE tornaria o pedido impossível de atender. Não há rota de exclusão
-- hoje — o pedido é atendido por acesso direto ao banco, e a tela de Prospecção
-- diz isso em vez de prometer um botão que não existe.
--
-- Sem UPDATE: cadastro não se edita. Se a pessoa mandar de novo com o dado
-- certo, a linha nova é o registro certo, e a antiga continua sendo verdade
-- sobre o que foi enviado naquele dia.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    EXECUTE 'GRANT SELECT, INSERT, DELETE ON prospeccao_leads TO app_runtime';
  END IF;
END $$;
