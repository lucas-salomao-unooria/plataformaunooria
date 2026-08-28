import type { PrismaClient } from "@prisma/client";

/**
 * Turma para teste de integração.
 *
 * Existe porque `turmas.periodo_letivo_id` é NOT NULL desde a migration do
 * enturmamento: turma sem período letivo é a coluna `users.turma_id` de novo,
 * com outro nome, e é justamente o que a virada do ano quebra.
 */
export const TITULO_PERIODO_DE_TESTE = "Ano letivo 2026";

/**
 * Idempotente E tolerante a corrida: o Jest paraleliza as suítes, e `upsert` é
 * check-then-act. Duas suítes checam ao mesmo tempo, as duas criam, e uma recebe
 * `P2002` (violação do único `(tipo, titulo)`) — a suíte inteira falharia no
 * `beforeAll`, de forma intermitente e sem relação com o que ela testa. É a
 * mesma janela que `role-de-runtime.ts` fecha com `EXCEPTION WHEN
 * duplicate_object`.
 */
export async function periodoDeTeste(prisma: PrismaClient) {
  const where = { tipo_titulo: { tipo: "ano_letivo", titulo: TITULO_PERIODO_DE_TESTE } };
  const existente = await prisma.periodoLetivo.findUnique({ where });
  if (existente) return existente;
  try {
    return await prisma.periodoLetivo.create({
      data: {
        tipo: "ano_letivo",
        titulo: TITULO_PERIODO_DE_TESTE,
        ano: 2026,
        inicio: new Date(Date.UTC(2026, 0, 1)),
        fim: new Date(Date.UTC(2026, 11, 31)),
      },
    });
  } catch {
    // Outra suíte ganhou a corrida: o período existe, é isso que importa.
    return prisma.periodoLetivo.findUniqueOrThrow({ where });
  }
}

export async function criarTurmaDeTeste(
  prisma: PrismaClient,
  escolaId: string,
  nome: string,
  serie: string,
) {
  const periodo = await periodoDeTeste(prisma);
  return prisma.turma.create({
    data: { escolaId, periodoLetivoId: periodo.id, nome, serie },
  });
}
