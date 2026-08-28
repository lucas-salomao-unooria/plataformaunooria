-- PERFIL PORTÁTIL: o que a criança leva quando sai da rede.
--
-- POR QUE ESTA TABELA EXISTE
--
-- Um contrato é uma rede e uma stack. A criança que sai da rede estadual para a
-- municipal sai também da instalação: banco diferente, escolas diferentes,
-- nenhum JOIN possível. A transferência entre escolas do MESMO contrato já é
-- resolvida pela lotação — esta tabela é para o outro caso, e ele é o caso em
-- que não há garantia nenhuma de que o destino comprou o produto.
--
-- Por isso o perfil portátil é um DOCUMENTO ASSINADO, e não uma integração: um
-- arquivo que a escola de origem emite a pedido do titular (LGPD art. 18 V) e
-- que a escola de destino importa como um ato dela. Funciona inclusive para uma
-- rede que nunca vai instalar esta plataforma — lá o arquivo é só um documento
-- legível.
--
-- A REGRA QUE DÁ SENTIDO À TABELA: O QUE VEM DE FORA NUNCA SE MISTURA
--
-- O documento importado vive AQUI, nesta tabela, e em lugar nenhum mais. Ele não
-- vira matrícula, não vira progresso, não vira perfil da Vila e não entra em
-- nenhuma média. A razão é que ele é a AFIRMAÇÃO DE OUTRA INSTALAÇÃO sobre a
-- criança — pode ter sido emitido por uma versão diferente do mapeamento, por
-- uma rede com outro currículo, ou simplesmente estar errado. Misturado ao dado
-- produzido aqui, ele ficaria indistinguível dele; separado, o professor lê os
-- dois e sabe qual é qual.
--
-- `verificacao` guarda a diferença entre "conferi a assinatura com o emissor" e
-- "não consegui falar com o emissor". Documento com assinatura INVÁLIDA nunca
-- chega a esta tabela: a api recusa a importação. Não conseguir verificar é uma
-- limitação de rede; assinatura quebrada é adulteração.

CREATE TABLE "perfis_portateis" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escola_id" TEXT NOT NULL,
    "aluno_id" UUID NOT NULL,
    /* Quem emitiu: o id do contrato de origem e a origem HTTPS do hub que
       assinou. Os dois ficam na linha porque o documento pode chegar de uma rede
       que esta instalação nunca viu. */
    "emissor_contrato" TEXT NOT NULL,
    "emissor_hub" TEXT NOT NULL,
    "emissor_nome" TEXT,
    "emitido_em" TIMESTAMPTZ(6) NOT NULL,
    /* O documento inteiro, como veio. É a fonte: reprocessar a leitura de um
       perfil importado tem de partir do que foi assinado, não da nossa cópia
       interpretada. */
    "documento" JSONB NOT NULL,
    "assinatura" TEXT NOT NULL,
    /* verificada | nao-verificada — CHECK abaixo. */
    "verificacao" TEXT NOT NULL,
    "importado_por" UUID NOT NULL,
    "importado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "perfis_portateis_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "perfis_portateis"
  ADD CONSTRAINT "perfis_portateis_verificacao_check"
    CHECK ("verificacao" IN ('verificada', 'nao-verificada'));

ALTER TABLE "perfis_portateis"
  ADD CONSTRAINT "perfis_portateis_escola_id_fkey"
    FOREIGN KEY ("escola_id") REFERENCES "escolas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "perfis_portateis"
  ADD CONSTRAINT "perfis_portateis_aluno_id_fkey"
    FOREIGN KEY ("aluno_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "perfis_portateis"
  ADD CONSTRAINT "perfis_portateis_importado_por_fkey"
    FOREIGN KEY ("importado_por") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reimportar o MESMO documento não cria uma segunda linha: a escola recebe o
-- arquivo por e-mail, alguém importa duas vezes, e duas cópias do mesmo fato
-- pareceriam duas medidas.
CREATE UNIQUE INDEX "perfis_portateis_documento_unico"
  ON "perfis_portateis"("escola_id", "aluno_id", "emissor_contrato", "emitido_em");

CREATE INDEX "perfis_portateis_por_aluno" ON "perfis_portateis"("escola_id", "aluno_id");

-- RLS pela mesma política de sempre. Perfil importado é dado de aluno: pertence
-- à escola que o recebeu, e some da vista de todas as outras.
ALTER TABLE "perfis_portateis" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "perfis_portateis" FORCE ROW LEVEL SECURITY;
CREATE POLICY "perfis_portateis_por_escola" ON "perfis_portateis"
  USING ("escola_id" = current_setting('app.escola_id', true));
