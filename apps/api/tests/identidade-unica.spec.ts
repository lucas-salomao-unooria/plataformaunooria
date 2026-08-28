import { PrismaClient } from "@prisma/client";

/**
 * A trava estrutural da identidade única.
 *
 * As experiências vieram de projetos onde CADA atividade tinha o próprio
 * cadastro de usuário. No monorepo existe uma tabela de pessoas — `users` — e a
 * próxima experiência não pode trazer a dela de volta sem que alguém perceba.
 * Estes dois testes leem o BANCO, não o schema: é o único lugar onde a resposta
 * é a verdade.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const prisma = new PrismaClient({ datasources: { db: { url: URL } } });

afterAll(() => prisma.$disconnect());

/**
 * Exceções deliberadas: colunas de pessoa SEM chave estrangeira.
 *
 * `telemetria_eventos` é particionada e escrita em lote pelo push do Pub/Sub —
 * uma FK por linha cobraria uma verificação a cada evento no pico da manhã.
 * `progresso` e `ia_uso_diario` têm chave composta e são escritas no caminho
 * quente. Nos três, o `aluno_id`/`usuario_id` continua sendo o id de `users`;
 * o que não existe é a garantia do banco.
 */
const SEM_CHAVE_POR_DECISAO = new Set([
  "telemetria_eventos.aluno_id",
  "progresso.aluno_id",
  "ia_uso_diario.usuario_id",
]);

describe("identidade única", () => {
  test("só existe UMA tabela de credencial na plataforma", async () => {
    const tabelas = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.columns
       WHERE table_schema = 'public' AND column_name = 'password_hash'
       ORDER BY table_name
    `;
    expect(tabelas.map((t) => t.table_name)).toEqual(["users"]);
  });

  test("toda coluna de pessoa aponta para users (direta ou transitivamente)", async () => {
    const soltas = await prisma.$queryRaw<Array<{ coluna: string }>>`
      SELECT c.table_name || '.' || c.column_name AS coluna
        FROM information_schema.columns c
       WHERE c.table_schema = 'public'
         AND c.column_name IN ('aluno_id', 'professor_id', 'usuario_id')
         AND NOT EXISTS (
           SELECT 1
             FROM information_schema.table_constraints tc
             JOIN information_schema.key_column_usage k
               ON k.constraint_name = tc.constraint_name
              AND k.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema = 'public'
              AND tc.table_name = c.table_name
              AND k.column_name = c.column_name
         )
       ORDER BY 1
    `;
    // Quem cai aqui ou ganha a FK, ou entra na lista com o motivo escrito.
    expect(soltas.map((s) => s.coluna).filter((c) => !SEM_CHAVE_POR_DECISAO.has(c))).toEqual([]);
  });

  /**
   * As escolas `teste-*` ficam de fora: as suítes de integração criam usuário
   * com `turma_id` direto, porque estão testando outra coisa, e o Jest roda
   * todas contra o mesmo banco em paralelo. Policiar fixture aqui só produziria
   * falha intermitente sem relação com o que este teste protege — o dado real.
   */
  test("o CPF existe em UM lugar só: users.cpf", async () => {
    const colunas = await prisma.$queryRaw<Array<{ coluna: string }>>`
      SELECT table_name || '.' || column_name AS coluna
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND column_name ~ 'cpf'
       ORDER BY 1
    `;
    /* O número é guardado (ADR-33) — o gestor precisa vê-lo. O que sustenta a
       decisão é a CONTENÇÃO: uma coluna só. Cópia em tabela de experiência, em
       telemetria ou em JSONB é o número escapando para onde ninguém mais o
       controla, e é isso que este teste impede de passar em silêncio. */
    expect(colunas.map((c) => c.coluna)).toEqual(["users.cpf"]);
  });

  test("nenhuma tabela de experiência nem a telemetria carregam CPF", async () => {
    /* Complemento do teste acima pelo outro lado: procura o FORMATO do dado, não
       o nome da coluna. Um `dados` JSONB com o CPF dentro não apareceria em
       `information_schema` — e é o caminho mais fácil de o número vazar. */
    const suspeitas = await prisma.$queryRaw<Array<{ tabela: string; total: bigint }>>`
      SELECT 'telemetria_eventos' AS tabela,
             count(*)::bigint AS total
        FROM telemetria_eventos
       WHERE resultado::text ~ '[0-9]{11}' OR contexto::text ~ '[0-9]{11}'
      UNION ALL
      SELECT 'progresso', count(*)::bigint FROM progresso WHERE dados::text ~ '[0-9]{11}'
    `;
    expect(suspeitas.filter((s) => Number(s.total) > 0)).toEqual([]);
  });

  test("lotacoes é a fonte da escola — e `users.escola_id` é cache dela", async () => {
    const divergentes = await prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT count(*)::bigint AS total
        FROM users u
       WHERE u.escola_id IS NOT NULL
         AND u.role IN ('aluno','professor','gestor')
         AND u.escola_id NOT LIKE 'teste-%'
         AND NOT EXISTS (
           SELECT 1 FROM lotacoes l
            WHERE l.usuario_id = u.id AND l.escola_id = u.escola_id AND l.fim IS NULL
         )
    `;
    expect(Number(divergentes[0]?.total ?? 0)).toBe(0);
  });

  test("matriculas é a única fonte de enturmamento — e `users.turma_id` é cache dela", async () => {
    const divergentes = await prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT count(*)::bigint AS total
        FROM users u
       WHERE u.turma_id IS NOT NULL
         AND u.role = 'aluno'
         AND u.escola_id NOT LIKE 'teste-%'
         AND NOT EXISTS (
           SELECT 1 FROM matriculas m
            WHERE m.usuario_id = u.id AND m.turma_id = u.turma_id
              AND m.papel = 'aluno' AND m.fim IS NULL
         )
    `;
    expect(Number(divergentes[0]?.total ?? 0)).toBe(0);
  });
});
