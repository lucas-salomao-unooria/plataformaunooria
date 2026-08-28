import { PrismaClient } from "@prisma/client";

/**
 * Tenancy para os SEEDS.
 *
 * Os seeds escrevem em tabelas com `FORCE ROW LEVEL SECURITY` (`matriculas`,
 * `exp_01_*`, `progresso`, ...). Em desenvolvimento passa despercebido porque a
 * `DATABASE_URL` local aponta para `postgres`, que é SUPERUSUÁRIO e ignora RLS.
 * Em produção a conexão é com `app`, que não ignora — e o seed morre com
 * `new row violates row-level security policy for table "matriculas"`.
 *
 * Existem DUAS formas aqui porque os dois seeds têm formatos diferentes:
 *
 *  - `comEscola` (transação, `set_config(..., true)`) é o mesmo desenho do
 *    `PrismaService.comTenancy`. Serve quando o script escreve em mais de uma
 *    escola — é o caso do `seed.ts`, que cria `escola-demo` e `escola-demo-2`.
 *
 *  - `clientDoSeed` arma na SESSÃO (`false`) e força `connection_limit=1`.
 *    Serve quando o script inteiro é de uma escola só (`semear-demo.ts`):
 *    envolver 434 linhas numa transação daria um lock longo e esbarraria no
 *    timeout do Prisma. O limite de conexão não é detalhe — sem ele o pool
 *    abriria outras conexões sem o `set_config`, e a falha voltaria de forma
 *    intermitente, no meio do seed.
 */
export async function clientDoSeed(escolaId: string): Promise<PrismaClient> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ausente");

  const comLimite = new URL(url);
  comLimite.searchParams.set("connection_limit", "1");

  const prisma = new PrismaClient({ datasources: { db: { url: comLimite.toString() } } });
  await prisma.$executeRaw`SELECT set_config('app.escola_id', ${escolaId}, false)`;
  return prisma;
}

/** Executa `fn` numa transação com a RLS armada para `escolaId`. */
export function comEscola<T>(
  prisma: PrismaClient,
  escolaId: string,
  fn: (tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.escola_id', ${escolaId}, true)`;
    return fn(tx);
  });
}
