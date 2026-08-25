import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Seed de desenvolvimento — evolução multi-tenant do seed do projeto origem:
 * 1 escola demo com 2 turmas de 8º ano (40 alunos, 20 por turma) + 1 turma de
 * 4º ano (10 alunos, para a exp-02-unootube), 1 professor, 1 gestor e
 * 1 admin-contrato (sem escola — única exceção da regra de tenancy).
 * Todos com a senha "unooria123". Idempotente — pode rodar quantas vezes quiser.
 *
 * Usuários reais NÃO nascem aqui: entram por importação CSV
 * (`POST /usuarios/importar-csv`, papel gestor/admin-contrato).
 */
const prisma = new PrismaClient();
const SENHA_PADRAO = "unooria123";
const TOTAL_ALUNOS = 40;
const TOTAL_ALUNOS_4A = 10;
const ESCOLA_ID = "escola-demo";

async function main() {
  const passwordHash = await bcrypt.hash(SENHA_PADRAO, 10);

  await prisma.escola.upsert({
    where: { id: ESCOLA_ID },
    update: { nome: "Escola Demo" },
    create: { id: ESCOLA_ID, nome: "Escola Demo" },
  });

  const turmas = await Promise.all(
    ["8A", "8B"].map((nome) =>
      prisma.turma.upsert({
        where: { escolaId_nome: { escolaId: ESCOLA_ID, nome } },
        update: { serie: "8EF" },
        create: { escolaId: ESCOLA_ID, nome, serie: "8EF" },
      }),
    ),
  );

  const upsertUsuario = (
    username: string,
    displayName: string,
    role: string,
    extras: { escolaId?: string | null; turmaId?: string } = {},
  ) =>
    prisma.user.upsert({
      where: { escolaId_username: { escolaId: extras.escolaId ?? ESCOLA_ID, username } },
      update: { displayName, role, passwordHash, turmaId: extras.turmaId },
      create: {
        username,
        displayName,
        role,
        passwordHash,
        escolaId: extras.escolaId === null ? undefined : (extras.escolaId ?? ESCOLA_ID),
        turmaId: extras.turmaId,
      },
    });

  await upsertUsuario("prof.demo", "Prof. Demo", "professor");
  await upsertUsuario("gestor.demo", "Gestor Demo", "gestor");

  for (let i = 1; i <= TOTAL_ALUNOS; i += 1) {
    const numero = String(i).padStart(2, "0");
    const turma = turmas[i <= TOTAL_ALUNOS / 2 ? 0 : 1];
    await upsertUsuario(`aluno${numero}`, `Aluno ${numero}`, "aluno", { turmaId: turma?.id });
  }

  // 4º ano: a série roteia o aluno para a exp-02-unootube (apps/hub/lib/experiencia-do-aluno.ts).
  const turma4A = await prisma.turma.upsert({
    where: { escolaId_nome: { escolaId: ESCOLA_ID, nome: "4A" } },
    update: { serie: "4EF" },
    create: { escolaId: ESCOLA_ID, nome: "4A", serie: "4EF" },
  });
  for (let i = 1; i <= TOTAL_ALUNOS_4A; i += 1) {
    const numero = String(i).padStart(2, "0");
    await upsertUsuario(`aluno4a${numero}`, `Aluno 4A ${numero}`, "aluno", { turmaId: turma4A.id });
  }

  // admin-contrato: papel de nível de produto (o "analista" do origem). Vê a
  // análise entre escolas/turmas; não alcança as telas do professor nem a do
  // aluno. Único papel sem escola — o upsert por (escolaId, username) não o
  // cobre com escolaId NULL, então procura-se manualmente.
  const admin = await prisma.user.findFirst({
    where: { username: "analise.unooria", role: "admin-contrato" },
  });
  if (admin) {
    await prisma.user.update({
      where: { id: admin.id },
      data: { displayName: "Análise Unooria", passwordHash },
    });
  } else {
    await prisma.user.create({
      data: {
        username: "analise.unooria",
        displayName: "Análise Unooria",
        role: "admin-contrato",
        passwordHash,
      },
    });
  }

  const total = await prisma.user.count();
  console.log(
    `Seed ok: escola "${ESCOLA_ID}" com 3 turmas (8A, 8B, 4A), 1 professor, 1 gestor, ${TOTAL_ALUNOS + TOTAL_ALUNOS_4A} alunos e 1 admin-contrato (senha "${SENHA_PADRAO}"). Usuários na base: ${total}.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (erro) => {
    console.error(erro);
    await prisma.$disconnect();
    process.exit(1);
  });
