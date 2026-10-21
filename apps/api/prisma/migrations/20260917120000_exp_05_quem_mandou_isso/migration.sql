-- exp-05-quem-mandou-isso: as cinco tabelas da missão.
--
-- Molde: 20260910140000_exp_08_manifesto_ia. O Prisma gera as tabelas, os
-- índices e as FKs acima; CHECK, RLS e GRANT são o bloco MANUAL no fim — e é lá
-- que a regra inviolável nº 1 (todo dado de estudante escopado por escola) é
-- aplicada.
--
-- A diferença de desenho em relação à exp-08 é `exp_05_encaminhamentos`: 1:N de
-- propósito, porque QUAIS mensagens foram ao Mural é o dado que o telão mostra.
-- O resto do que é 1:1 com a sessão continua sendo COLUNA dela.

-- CreateTable
CREATE TABLE "exp_05_conteudo_turma" (
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "tema" TEXT NOT NULL,
    "gatilho" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "mensagens_json" JSONB NOT NULL,
    "aprovado_por_professor" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp_05_conteudo_turma_pkey" PRIMARY KEY ("escola_id","turma_id")
);

-- CreateTable
CREATE TABLE "exp_05_sessoes" (
    "escola_id" TEXT NOT NULL,
    "estudante_id" UUID NOT NULL,
    "turma_id" UUID,
    "passo" TEXT NOT NULL DEFAULT 'contexto',
    "entrou_em" TIMESTAMPTZ(6),
    "primeiro_encaminhamento_em" TIMESTAMPTZ(6),
    "leu_tudo" BOOLEAN NOT NULL DEFAULT false,
    "midias_abertas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confirmado_em" TIMESTAMPTZ(6),
    "versao_instrumento" TEXT NOT NULL DEFAULT '1.0.0',
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluido_em" TIMESTAMPTZ(6),

    CONSTRAINT "exp_05_sessoes_pkey" PRIMARY KEY ("escola_id","estudante_id")
);

-- CreateTable
CREATE TABLE "exp_05_encaminhamentos" (
    "id" BIGSERIAL NOT NULL,
    "escola_id" TEXT NOT NULL,
    "estudante_id" UUID NOT NULL,
    "mensagem_id" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp_05_encaminhamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp_05_reflexoes" (
    "escola_id" TEXT NOT NULL,
    "estudante_id" UUID NOT NULL,
    "texto" VARCHAR(500) NOT NULL,
    "chars_count" INTEGER NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp_05_reflexoes_pkey" PRIMARY KEY ("escola_id","estudante_id")
);

-- CreateTable
CREATE TABLE "exp_05_gates_turma" (
    "escola_id" TEXT NOT NULL,
    "turma_id" UUID NOT NULL,
    "etapa" TEXT NOT NULL DEFAULT 'exploracao',
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp_05_gates_turma_pkey" PRIMARY KEY ("escola_id","turma_id")
);

-- CreateIndex
CREATE INDEX "exp_05_conteudo_turma_escola_id_idx" ON "exp_05_conteudo_turma"("escola_id");

-- CreateIndex
CREATE INDEX "exp_05_sessoes_escola_id_idx" ON "exp_05_sessoes"("escola_id");

-- CreateIndex
CREATE INDEX "exp_05_sessoes_escola_id_turma_id_idx" ON "exp_05_sessoes"("escola_id", "turma_id");

-- CreateIndex
CREATE INDEX "exp_05_encaminhamentos_escola_id_estudante_id_idx" ON "exp_05_encaminhamentos"("escola_id", "estudante_id");

-- CreateIndex
CREATE UNIQUE INDEX "exp_05_encaminhamentos_escola_id_estudante_id_mensagem_id_key" ON "exp_05_encaminhamentos"("escola_id", "estudante_id", "mensagem_id");

-- CreateIndex
CREATE INDEX "exp_05_reflexoes_escola_id_idx" ON "exp_05_reflexoes"("escola_id");

-- CreateIndex
CREATE INDEX "exp_05_gates_turma_escola_id_idx" ON "exp_05_gates_turma"("escola_id");

-- AddForeignKey
ALTER TABLE "exp_05_conteudo_turma" ADD CONSTRAINT "exp_05_conteudo_turma_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp_05_sessoes" ADD CONSTRAINT "exp_05_sessoes_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp_05_encaminhamentos" ADD CONSTRAINT "exp_05_encaminhamentos_escola_id_estudante_id_fkey" FOREIGN KEY ("escola_id", "estudante_id") REFERENCES "exp_05_sessoes"("escola_id", "estudante_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp_05_reflexoes" ADD CONSTRAINT "exp_05_reflexoes_escola_id_estudante_id_fkey" FOREIGN KEY ("escola_id", "estudante_id") REFERENCES "exp_05_sessoes"("escola_id", "estudante_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp_05_gates_turma" ADD CONSTRAINT "exp_05_gates_turma_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ===========================================================================
-- Bloco MANUAL. O Prisma não gera CHECK, RLS nem GRANT.
-- ===========================================================================

-- Os enums do domínio moram aqui como CHECK, não como type: a ordem dos passos
-- é regra (`src/quem-mandou-isso/regras/passos.ts`), e um `enum` do Postgres
-- amarraria toda mudança de roteiro a uma migration de `ALTER TYPE`.
ALTER TABLE "exp_05_sessoes"
  ADD CONSTRAINT "exp_05_sessoes_passo_check"
    CHECK ("passo" IN ('contexto', 'curadoria', 'espera', 'revelado',
                       'reflexao', 'fim')),
  -- Conclusão e carimbo não podem divergir: o hub lê o `concluido_em` e a
  -- experiência lê o `passo`, e uma tela dizendo "missão cumprida" sobre uma
  -- linha sem carimbo é um relatório que mente.
  ADD CONSTRAINT "exp_05_sessoes_fim_check"
    CHECK (("passo" = 'fim') = ("concluido_em" IS NOT NULL)),
  -- O LATCH nunca convive com a cena de abertura.
  --
  -- A regra que se quer escrever aqui é "confirmou ⇒ está na espera ou além", e
  -- ela é FALSA: a revelação coletiva sobe o PISO do passo (`regras/passos.ts`),
  -- então quem NÃO confirmou é empurrado para `revelado` quando o telão acende,
  -- e `passo` deixa de testemunhar sobre confirmação. Na direção contrária a
  -- implicação também não fecha, porque o `voltar-exploracao` da professora
  -- reduz o passo EFETIVO de volta para `espera` sem apagar carimbo nenhum.
  --
  -- O que sobra verdadeiro em todos os caminhos é este: confirmar exige ter
  -- entrado no grupo e curado o Mural, então uma linha com `confirmado_em` e
  -- `passo = 'contexto'` é um Mural fechado por quem nunca viu uma mensagem —
  -- o sintoma de um POST direto em `/confirmar`, que é endereço alcançável.
  --
  -- E é de propósito que ele não vede `curadoria`: o CHECK vale por STATEMENT,
  -- não por transação, e um service que grave o carimbo e o passo em dois
  -- UPDATEs veria o estado intermediário reprovar — falha que só aparece em
  -- produção, no meio da aula.
  ADD CONSTRAINT "exp_05_sessoes_confirmado_check"
    CHECK ("confirmado_em" IS NULL OR "passo" <> 'contexto'),
  -- O indicativo de impulsividade é uma SUBTRAÇÃO de duas colunas desta linha,
  -- e subtração fora de ordem produz segundos negativos no painel — que se lê
  -- como defeito do produto, não como relógio torto. Os dois ramos nulos ficam
  -- livres: sessão sem `entrou_em` apenas não tem o indicativo, e recusar a
  -- gravação do encaminhamento por causa disso trocaria um número ausente por
  -- um 500 na mão da criança.
  ADD CONSTRAINT "exp_05_sessoes_primeiro_encaminhamento_check"
    CHECK ("primeiro_encaminhamento_em" IS NULL OR "entrou_em" IS NULL
           OR "primeiro_encaminhamento_em" >= "entrou_em"),
  -- Os oito ids do catálogo. Um id fora da lista aqui é uma mídia "aberta" que
  -- não existe em balão nenhum, e ela apareceria no painel como leitura que
  -- ninguém fez.
  ADD CONSTRAINT "exp_05_sessoes_midias_check"
    CHECK ("midias_abertas" <@ ARRAY['msg-1', 'msg-2', 'msg-3', 'msg-4',
                                     'msg-5', 'msg-6', 'msg-7', 'msg-8']::text[]);

-- O mesmo vocabulário de ids, do outro lado: o histograma é montado a partir
-- destas linhas, e um `msg-9` viraria uma barra órfã no telão da sala.
ALTER TABLE "exp_05_encaminhamentos"
  ADD CONSTRAINT "exp_05_encaminhamentos_mensagem_check"
    CHECK ("mensagem_id" IN ('msg-1', 'msg-2', 'msg-3', 'msg-4',
                             'msg-5', 'msg-6', 'msg-7', 'msg-8'));

-- O lote da turma tem OITO mensagens, sempre. A homologação confere a mesma
-- coisa em TypeScript (o Zod de `contrato-de-rotas.ts`, com a paridade 3/3/2
-- junto); a razão de o CHECK existir é a linha escrita por um caminho que ainda
-- não existe — um lote com 6 mensagens deixaria o grupo com dois balões a menos
-- e o piso de 3 encaminhamentos medindo outra coisa, e o sintoma apareceria na
-- aula, não no deploy.
--
-- A paridade NÃO entra aqui: contá-la em SQL exigiria desmontar o JSONB dentro
-- do CHECK, e o gabarito só existe em uma forma — a do Zod. Duas gramáticas
-- para a mesma regra é a divergência que o repo já pagou em `permissoes`.
ALTER TABLE "exp_05_conteudo_turma"
  ADD CONSTRAINT "exp_05_conteudo_mensagens_check"
    CHECK (jsonb_typeof("mensagens_json") = 'array'
           AND jsonb_array_length("mensagens_json") = 8),
  ADD CONSTRAINT "exp_05_conteudo_gatilho_check"
    CHECK ("gatilho" IN ('urgencia', 'indignacao', 'medo')),
  -- `padrao` é o banco curado da Unooria, não fallback de erro. O CHECK existe
  -- porque esta coluna responde "a curadoria assistida está sendo usada?", e um
  -- terceiro valor inventado apagaria a pergunta em vez de respondê-la.
  ADD CONSTRAINT "exp_05_conteudo_origem_check"
    CHECK ("origem" IN ('ia', 'padrao'));

-- 500 é o teto do campo na tela, e a coluna é VARCHAR(500): o CHECK cobre o
-- piso, que o tipo não cobre. Cinco espaços passariam o comprimento e contariam
-- como reflexão entregue no painel da professora.
ALTER TABLE "exp_05_reflexoes"
  ADD CONSTRAINT "exp_05_reflexoes_texto_check"
    CHECK (char_length(btrim("texto")) BETWEEN 5 AND 500),
  ADD CONSTRAINT "exp_05_reflexoes_chars_check"
    CHECK ("chars_count" BETWEEN 5 AND 500);

ALTER TABLE "exp_05_gates_turma"
  ADD CONSTRAINT "exp_05_gates_turma_etapa_check"
    CHECK ("etapa" IN ('exploracao', 'revelacao', 'reflexao'));

-- RLS (regra inviolável nº 1) — mesma expressão das outras tabelas de estudante.
-- O gate e o lote da turma entram junto: uma rede vizinha não vê a aula da
-- outra, e o acontecimento da escola que a professora escreveu no preparo é
-- dela. No lote a RLS pesa mais que nas irmãs: ali mora o GABARITO, e ele é o
-- que a missão inteira existe para não entregar cedo demais.
ALTER TABLE "exp_05_conteudo_turma" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp_05_conteudo_turma" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp_05_conteudo_turma_por_escola" ON "exp_05_conteudo_turma"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp_05_sessoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp_05_sessoes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp_05_sessoes_por_escola" ON "exp_05_sessoes"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp_05_encaminhamentos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp_05_encaminhamentos" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp_05_encaminhamentos_por_escola" ON "exp_05_encaminhamentos"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp_05_reflexoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp_05_reflexoes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp_05_reflexoes_por_escola" ON "exp_05_reflexoes"
  USING (escola_id = current_setting('app.escola_id', true));

ALTER TABLE "exp_05_gates_turma" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exp_05_gates_turma" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exp_05_gates_turma_por_escola" ON "exp_05_gates_turma"
  USING (escola_id = current_setting('app.escola_id', true));

-- A role de runtime (docs/INFRA.md) conecta sem ownership e precisa de
-- privilégio nas tabelas novas. Guardado: em dev/CI a role não existe.
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    FOREACH t IN ARRAY ARRAY['exp_05_conteudo_turma', 'exp_05_sessoes',
                             'exp_05_encaminhamentos', 'exp_05_reflexoes',
                             'exp_05_gates_turma']
    LOOP
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_runtime', t);
    END LOOP;
    -- `exp_05_encaminhamentos` tem id BIGSERIAL: sem USAGE na sequência o
    -- INSERT falha para a role de runtime mesmo com o GRANT acima — e falha só
    -- em produção, que é onde a role existe. É o encaminhamento, ou seja: a
    -- missão inteira parando no primeiro toque da criança no balão.
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE exp_05_encaminhamentos_id_seq TO app_runtime';
  END IF;
END $$;
