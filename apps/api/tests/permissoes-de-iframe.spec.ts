import { PrismaClient } from "@prisma/client";

/**
 * O vocabulário de `experiencias.permissoes` vive em DOIS lugares: o `z.enum`
 * do controller e o CHECK da migration. Eles têm que dizer a mesma coisa.
 *
 * Quando divergiram, o custo foi um deploy inteiro: a exp-03 declarou `forms`,
 * o Zod aceitou, e o banco recusou com 500 no `PUT /experiencias/:expId` — no
 * CI, com o motivo visível só no log da api. Local nunca pega, porque em dev o
 * hub lê o manifesto do dev server do Vite e não encosta nesta tabela.
 *
 * Este teste é a ponte: acrescentar uma permissão sem migration falha aqui.
 */
const prisma = new PrismaClient();

/** Espelha o `z.enum` de `experiencias.controller.ts`. */
const PERMISSOES_NO_CODIGO = ["pointer-lock", "forms"];

afterAll(async () => {
  await prisma.$disconnect();
});

test("o CHECK do banco aceita exatamente as permissões que o Zod aceita", async () => {
  const [linha] = await prisma.$queryRaw<{ definicao: string }[]>`
    SELECT pg_get_constraintdef(oid) AS definicao
      FROM pg_constraint
     WHERE conname = 'ck_experiencias_permissoes'`;

  if (!linha) throw new Error("constraint ck_experiencias_permissoes não existe");

  // `CHECK ((permissoes <@ ARRAY['pointer-lock'::text, 'forms'::text]))`
  const noBanco = [...linha.definicao.matchAll(/'([a-z-]+)'::text/g)].map((m) => m[1]);

  expect(noBanco.sort()).toEqual([...PERMISSOES_NO_CODIGO].sort());
});

test("uma permissão fora do vocabulário é recusada pelo banco", async () => {
  await expect(
    prisma.$executeRaw`
      INSERT INTO experiencias (exp_id, nome, versao_ativa, series, capabilities, permissoes)
      VALUES ('exp-teste-permissao', 'teste', '1.0.0', '{}', '{}', ARRAY['camera'])`,
  ).rejects.toThrow();
});
