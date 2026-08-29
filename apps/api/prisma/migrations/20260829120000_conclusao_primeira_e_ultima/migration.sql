-- A resposta do aluno guardava só a ÚLTIMA escolha.
--
-- A tela diz "pode trocar de ideia enquanto espera — vale a última", e o aluno
-- oscila de propósito enquanto os colegas terminam. O upsert sobrescrevia
-- `inclinacao`, e a primeira escolha — a reação imediata ao feed, antes de dois
-- minutos de espera e de olhar a tela do colega — não existia em lugar nenhum.
--
-- A correlação "lado em que o feed nasceu × resposta dada" é o dado mais forte
-- que esta atividade produz, e ela não tinha como dizer qual das duas estava
-- lendo. Agora tem.
--
-- Aditivo: `inclinacao_inicial` é NULL nas linhas que já existem, e é assim que
-- se lê "esta resposta é anterior à mudança" — preencher com a `inclinacao`
-- atual inventaria uma primeira escolha que ninguém observou.
ALTER TABLE "exp_01_conclusoes"
  ADD COLUMN "inclinacao_inicial" TEXT,
  ADD COLUMN "trocas" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT now();

-- `created_at` já mentia nas linhas antigas (congelava no primeiro envio
-- enquanto a inclinação seguia mudando); alinhar o novo campo a ele é o melhor
-- que se pode afirmar sobre o passado sem inventar.
UPDATE "exp_01_conclusoes" SET "atualizado_em" = "created_at";
