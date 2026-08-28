import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Seed de desenvolvimento — evolução multi-tenant do seed do projeto origem:
 * 1 escola demo com 2 turmas de 8º ano (40 alunos, 20 por turma), 1 turma de
 * 4º ano (10 alunos, para a exp-02-unootube) e 1 turma de 2ª série do EM
 * (10 alunos, para a exp-03-unoogpt), 1 professor, 1 gestor e
 * 1 admin-contrato (sem escola — única exceção da regra de tenancy).
 * Todos com a senha "unooria123". Idempotente — pode rodar quantas vezes quiser.
 *
 * Usuários reais NÃO nascem aqui: entram por importação
 * (`POST /rostering/importar`, papel gestor/admin-contrato).
 *
 * `SEED_MINIMO=1` cria só a escola, o gestor e o admin-contrato — nada de
 * turmas, alunos nem professor. É o ponto de partida para percorrer a plataforma
 * do zero: com o seed completo, as 61 contas de demonstração aparecem no
 * diagnóstico de contas de assento e poluem o caminho que se quer testar.
 * Os walkthroughs visuais exigem o seed COMPLETO — o mínimo não os serve.
 */
const prisma = new PrismaClient();
const SENHA_PADRAO = "unooria123";
const ANO_LETIVO = 2026;
const TITULO_PERIODO = `Ano letivo ${ANO_LETIVO}`;
const TOTAL_ALUNOS = 40;
const TOTAL_ALUNOS_4A = 10;
/** 2ª série do EM: a turma da Missão Tempestade (exp-03-unoogpt). */
const TOTAL_ALUNOS_2A = 10;
const ESCOLA_ID = "escola-demo";
/** Segunda escola: é ela que torna visível o professor lotado em DUAS. */
const ESCOLA_2_ID = "escola-demo-2";
const TOTAL_ALUNOS_5A = 10;
const MINIMO = process.env.SEED_MINIMO === "1";

async function main() {
  const passwordHash = await bcrypt.hash(SENHA_PADRAO, 10);

  await prisma.escola.upsert({
    where: { id: ESCOLA_ID },
    update: { nome: "EE Escola Demo", municipio: "São Paulo", uf: "SP", codigoInep: "35000101" },
    create: {
      id: ESCOLA_ID,
      nome: "EE Escola Demo",
      municipio: "São Paulo",
      uf: "SP",
      codigoInep: "35000101",
    },
  });
  await prisma.escola.upsert({
    where: { id: ESCOLA_2_ID },
    update: { nome: "EE Vila Nova", municipio: "Campinas", uf: "SP", codigoInep: "35000202" },
    create: {
      id: ESCOLA_2_ID,
      nome: "EE Vila Nova",
      municipio: "Campinas",
      uf: "SP",
      codigoInep: "35000202",
    },
  });

  // Toda turma vive dentro de um ano letivo — é o que faz "8A de 2026" e "8A de
  // 2027" serem turmas diferentes, e o histórico sobreviver à virada do ano.
  const periodo = await prisma.periodoLetivo.upsert({
    where: { tipo_titulo: { tipo: "ano_letivo", titulo: TITULO_PERIODO } },
    update: {},
    create: {
      tipo: "ano_letivo",
      titulo: TITULO_PERIODO,
      ano: ANO_LETIVO,
      inicio: new Date(Date.UTC(ANO_LETIVO, 0, 1)),
      fim: new Date(Date.UTC(ANO_LETIVO, 11, 31)),
    },
  });

  const upsertTurma = (nome: string, serie: string, turno = "manha", escolaId = ESCOLA_ID) =>
    prisma.turma.upsert({
      where: {
        escolaId_periodoLetivoId_nome: { escolaId, periodoLetivoId: periodo.id, nome },
      },
      update: { serie, turno },
      create: { escolaId, periodoLetivoId: periodo.id, nome, serie, turno },
    });

  /**
   * Enturmamento. `users.turma_id` continua preenchido porque é o CACHE da
   * matrícula principal (o login e o claim `turma_id` do token o leem fora de
   * contexto de tenancy); a verdade é a linha em `matriculas`.
   */
  /**
   * Lotação: o vínculo com a ESCOLA. Professor acumula; aluno tem uma só.
   * `users.escola_id` é o cache da principal.
   */
  const lotar = (escolaId: string, usuarioId: string, papel: string, principal: boolean) =>
    prisma.lotacao.upsert({
      where: { escolaId_usuarioId_papel: { escolaId, usuarioId, papel } },
      update: { fim: null, principal },
      create: { escolaId, usuarioId, papel, principal, inicio: periodo.inicio },
    });

  const matricular = (
    turmaId: string,
    usuarioId: string,
    papel: "aluno" | "professor",
    escolaId = ESCOLA_ID,
  ) =>
    prisma.matricula.upsert({
      where: {
        escolaId_turmaId_usuarioId_papel: { escolaId, turmaId, usuarioId, papel },
      },
      update: { fim: null },
      create: {
        escolaId,
        turmaId,
        usuarioId,
        papel,
        principal: papel === "aluno",
        inicio: periodo.inicio,
      },
    });

  const upsertUsuarioMinimo = (username: string, displayName: string, role: string) =>
    prisma.user.upsert({
      where: { escolaId_username: { escolaId: ESCOLA_ID, username } },
      update: { displayName, role, passwordHash, ativo: true },
      create: { username, displayName, role, passwordHash, escolaId: ESCOLA_ID, senhaProvisoria: false },
    });

  const upsertAdminContrato = async () => {
    // Único papel sem escola — o upsert por (escolaId, username) não o cobre com
    // escolaId NULL, então procura-se manualmente.
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
          senhaProvisoria: false,
        },
      });
    }
  };

  if (MINIMO) {
    const gestorMinimo = await upsertUsuarioMinimo("gestor.demo", "Gestor Demo", "gestor");
    await lotar(ESCOLA_ID, gestorMinimo.id, "gestor", true);
    await upsertAdminContrato();
    console.log(
      `Seed MÍNIMO: escola "${ESCOLA_ID}", período "${periodo.titulo}", gestor.demo e ` +
        `analise.unooria (senha "${SENHA_PADRAO}"). Nenhuma turma, nenhum aluno — ` +
        `as pessoas entram por /admin/importar.`,
    );
    return;
  }

  const turmas = await Promise.all(["8A", "8B"].map((nome) => upsertTurma(nome, "8EF")));

  const upsertUsuario = (
    username: string,
    displayName: string,
    role: string,
    extras: { escolaId?: string | null; turmaId?: string } = {},
  ) =>
    prisma.user.upsert({
      where: { escolaId_username: { escolaId: extras.escolaId ?? ESCOLA_ID, username } },
      update: { displayName, role, passwordHash, turmaId: extras.turmaId, ativo: true },
      create: {
        username,
        displayName,
        role,
        passwordHash,
        // Usuário de demonstração entra direto: senha provisória é o caminho de
        // quem NASCE de uma importação, e prender o seed nela pararia os seis
        // walkthroughs na tela de troca de senha.
        senhaProvisoria: false,
        escolaId: extras.escolaId === null ? undefined : (extras.escolaId ?? ESCOLA_ID),
        turmaId: extras.turmaId,
      },
    });

  const professor = await upsertUsuario("prof.demo", "Prof. Demo", "professor");
  const gestor = await upsertUsuario("gestor.demo", "Gestor Demo", "gestor");

  for (let i = 1; i <= TOTAL_ALUNOS; i += 1) {
    const numero = String(i).padStart(2, "0");
    const turma = turmas[i <= TOTAL_ALUNOS / 2 ? 0 : 1]!;
    const aluno = await upsertUsuario(`aluno${numero}`, `Aluno ${numero}`, "aluno", {
      turmaId: turma.id,
    });
    await lotar(ESCOLA_ID, aluno.id, "aluno", true);
    await matricular(turma.id, aluno.id, "aluno");
  }

  // 4º ano: a série roteia o aluno para a exp-02-unootube (apps/hub/lib/experiencia-do-aluno.ts).
  const turma4A = await upsertTurma("4A", "4EF");
  for (let i = 1; i <= TOTAL_ALUNOS_4A; i += 1) {
    const numero = String(i).padStart(2, "0");
    const aluno = await upsertUsuario(`aluno4a${numero}`, `Aluno 4A ${numero}`, "aluno", {
      turmaId: turma4A.id,
    });
    await lotar(ESCOLA_ID, aluno.id, "aluno", true);
    await matricular(turma4A.id, aluno.id, "aluno");
  }

  // 2ª série do EM: a turma da Missão Tempestade (exp-03-unoogpt). O relógio
  // dela é por TURMA — quem dá a largada é o professor, em
  // /professor/entre-redes/2-serie/unidade-1/resultados. Sem a largada o aluno
  // vê o cronômetro parado, e é o motivo nº 1 de "a missão não abre".
  const turma2A = await upsertTurma("2A", "2EM");
  for (let i = 1; i <= TOTAL_ALUNOS_2A; i += 1) {
    const numero = String(i).padStart(2, "0");
    const aluno = await upsertUsuario(`aluno2a${numero}`, `Aluno 2A ${numero}`, "aluno", {
      turmaId: turma2A.id,
    });
    await lotar(ESCOLA_ID, aluno.id, "aluno", true);
    await matricular(turma2A.id, aluno.id, "aluno");
  }

  // O professor demo é matriculado nas QUATRO turmas. Sem isso as telas dele
  // ficam vazias — a partir daqui "as turmas do professor" são as turmas em que
  // ele tem matrícula, e não mais todas as turmas da escola.
  await lotar(ESCOLA_ID, professor.id, "professor", true);
  await lotar(ESCOLA_ID, gestor.id, "gestor", true);
  for (const turma of [...turmas, turma4A, turma2A]) {
    await matricular(turma.id, professor.id, "professor");
  }

  /**
   * SEGUNDA ESCOLA. Existe para o caso da rede estadual ficar visível sem
   * ninguém precisar montar nada: o `prof.demo` fica lotado nas DUAS, e é isso
   * que faz aparecer o seletor de escola no cabeçalho dele.
   */
  const turma5A = await upsertTurma("5A", "5EF", "tarde", ESCOLA_2_ID);
  const gestor2 = await upsertUsuario("gestor.vilanova", "Gestor Vila Nova", "gestor", {
    escolaId: ESCOLA_2_ID,
  });
  await lotar(ESCOLA_2_ID, gestor2.id, "gestor", true);
  await lotar(ESCOLA_2_ID, professor.id, "professor", false);
  await matricular(turma5A.id, professor.id, "professor", ESCOLA_2_ID);
  for (let i = 1; i <= TOTAL_ALUNOS_5A; i += 1) {
    const numero = String(i).padStart(2, "0");
    const aluno = await upsertUsuario(`aluno5a${numero}`, `Aluno 5A ${numero}`, "aluno", {
      escolaId: ESCOLA_2_ID,
      turmaId: turma5A.id,
    });
    await lotar(ESCOLA_2_ID, aluno.id, "aluno", true);
    await matricular(turma5A.id, aluno.id, "aluno", ESCOLA_2_ID);
  }

  // admin-contrato: papel de nível de produto (o "analista" do origem). Vê a
  // análise entre escolas/turmas; não alcança as telas do professor nem a do aluno.
  await upsertAdminContrato();

  const total = await prisma.user.count();
  console.log(
    `Seed ok: 2 escolas ("${ESCOLA_ID}" com 8A, 8B, 4A, 2A e "${ESCOLA_2_ID}" com 5A), ` +
      `prof.demo lotado nas DUAS, gestor.demo, gestor.vilanova, ` +
      `${TOTAL_ALUNOS + TOTAL_ALUNOS_4A + TOTAL_ALUNOS_2A + TOTAL_ALUNOS_5A} alunos e ` +
      `1 admin-contrato (senha "${SENHA_PADRAO}"). Usuários na base: ${total}.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (erro) => {
    console.error(erro);
    await prisma.$disconnect();
    process.exit(1);
  });
