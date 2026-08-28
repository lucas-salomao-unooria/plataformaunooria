-- O CPF passa a ser guardado.
--
-- A migração anterior gravava `HMAC-SHA256(cpf, CPF_PEPPER)` e os três últimos
-- dígitos, para dar identidade sem o banco virar um acervo de CPF de menores. O
-- hash entregava as duas coisas que a PLATAFORMA precisa — unicidade na rede e
-- reconhecer a mesma criança numa transferência — e ignorava a que o GESTOR
-- precisa: ver o número. Ele confere identidade contra o sistema da rede,
-- preenche documento e atende a família no balcão, e um hash é de mão única:
-- nenhuma chave o destrava, porque não existe chave (ADR-33 revisa ADR-31).
--
-- CPF é dado pessoal COMUM — não do art. 11 da LGPD, que trata de saúde, raça,
-- religião e biometria —, com base legal clara num contrato de educação pública.
-- É o que todo sistema de gestão escolar brasileiro guarda.
--
-- O que sustenta a decisão não é a coluna, é o que NÃO acontece com ela: nunca
-- em log, nunca em telemetria, JSONB, claim de token ou bundle de experiência, e
-- em lugar nenhum fora de `users.cpf` — com teste estrutural cobrando os dois.
--
-- Os hashes NÃO são convertíveis (é o ponto de um hash). Quem já tinha CPF
-- gravado como hash precisa reimportar a planilha; em dev não havia dado real.

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_cpf_hash_check";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_cpf_final_check";
DROP INDEX IF EXISTS "users_cpf_hash_key";

ALTER TABLE "users" DROP COLUMN IF EXISTS "cpf_hash";
ALTER TABLE "users" DROP COLUMN IF EXISTS "cpf_final";

ALTER TABLE "users" ADD COLUMN "cpf" TEXT;

-- Só os 11 dígitos, sem pontuação: a formatação é da tela. Um CHECK aqui é o que
-- impede "529.982.247-25" e "52998224725" coexistirem como duas pessoas.
ALTER TABLE "users"
  ADD CONSTRAINT "users_cpf_check" CHECK ("cpf" IS NULL OR "cpf" ~ '^[0-9]{11}$');

-- Único por CONTRATO, não por escola: o CPF é a identidade da pessoa na REDE
-- inteira. É esta unicidade que transforma "esse CPF já existe na escola B" em
-- transferência reconhecida, em vez de duas crianças com o histórico partido.
CREATE UNIQUE INDEX "users_cpf_key" ON "users"("cpf") WHERE "cpf" IS NOT NULL;
