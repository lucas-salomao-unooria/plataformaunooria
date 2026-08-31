import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { AuthController } from "../src/auth/auth.controller";
import { PrismaService } from "../src/prisma/prisma.service";
import { periodoDeTeste } from "./turma-de-teste";
import { servicosDeTeste } from "./servicos-de-teste";

/**
 * O primeiro acesso, do lado da api.
 *
 * A trava tem três pontos (middleware, BFF e /api/exp-token) e os dois últimos
 * são do hub — cobertos pelo `walkthrough-admin-usuarios.mjs`. Aqui está o que a
 * api tem de garantir para eles funcionarem: o `login` DIZER que falta trocar, e
 * a troca limpar a marca de verdade.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-escola-senha";
const SENHA_DO_LOTE = "SenhaDoLote123";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService &
  PrismaClient;
const { escolas, rostering, usuarios } = servicosDeTeste(prisma);
const auth = new AuthController(prisma, escolas);

/** O login é um só por escola, mas o rate limit é por username GLOBAL (8/min). */
const login = (username: string) => `sp-${username}`;

async function limpar() {
  await prisma.matricula.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.lotacao.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.user.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.turma.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.escola.deleteMany({ where: { id: ESCOLA } });
}

beforeAll(async () => {
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola Senha (teste)" } });
  await periodoDeTeste(prisma);
  await rostering.importarPlanilha(
    ESCOLA,
    [
      "matricula,nome,usuario,papel,turma,serie",
      `SP-1,Nina Prado,${login("nina")},estudante,7A,7EF`,
      `SP-2,Otto Vidal,${login("otto")},professor,7A,7EF`,
    ].join("\n"),
    { senhaPadrao: SENHA_DO_LOTE },
  );
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("primeiro acesso", () => {
  test("quem nasce da importação entra com a flag ligada", async () => {
    const r = (await auth.login({ username: login("nina"), password: SENHA_DO_LOTE })) as {
      usuarioId: string;
      usuario: string;
      precisaTrocarSenha: boolean;
      turmaId: string | null;
    };
    expect(r.precisaTrocarSenha).toBe(true);
    // O `usuario` (login) na resposta é o que a troca de senha do hub usa: sem
    // ele, o hub não sabe de quem é a senha que está trocando.
    expect(r.usuario).toBe(login("nina"));
    // E o claim `turma_id` do token sai do cache, que a matrícula alimentou.
    expect(r.turmaId).not.toBeNull();
  });

  test("senha atual errada não troca nada", async () => {
    await expect(
      auth.trocarSenha({
        username: login("nina"),
        senhaAtual: "nao-e-essa",
        senhaNova: "MinhaSenhaNova1",
      }),
    ).rejects.toMatchObject({ status: 401 });
  });

  test("nova senha igual à atual é recusada", async () => {
    await expect(
      auth.trocarSenha({
        username: login("nina"),
        senhaAtual: SENHA_DO_LOTE,
        senhaNova: SENHA_DO_LOTE,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  test("nova senha curta é recusada antes de tocar no banco", async () => {
    await expect(
      auth.trocarSenha({ username: login("nina"), senhaAtual: SENHA_DO_LOTE, senhaNova: "curta" }),
    ).rejects.toMatchObject({ status: 400 });
    const nina = await prisma.user.findFirstOrThrow({
      where: { escolaId: ESCOLA, username: login("nina") },
    });
    expect(await bcrypt.compare(SENHA_DO_LOTE, nina.passwordHash)).toBe(true);
  });

  test("a troca limpa a marca, grava quando foi, e o login seguinte já entra direto", async () => {
    const feito = await auth.trocarSenha({
      username: login("nina"),
      senhaAtual: SENHA_DO_LOTE,
      senhaNova: "MinhaSenhaNova1",
    });
    expect(feito).toEqual({ ok: true });

    const nina = await prisma.user.findFirstOrThrow({
      where: { escolaId: ESCOLA, username: login("nina") },
    });
    expect(nina.senhaProvisoria).toBe(false);
    expect(nina.senhaDefinidaEm).not.toBeNull();

    const r = (await auth.login({
      username: login("nina"),
      password: "MinhaSenhaNova1",
    })) as { precisaTrocarSenha: boolean };
    expect(r.precisaTrocarSenha).toBe(false);
  });

  test("a senha antiga deixa de valer na hora", async () => {
    await expect(
      auth.login({ username: login("nina"), password: SENHA_DO_LOTE }),
    ).rejects.toMatchObject({ status: 401 });
  });

  test("reimportar NÃO devolve a pessoa para a tela de senha", async () => {
    // É o cenário do dia a dia: o gestor corrige um nome e reimporta a planilha.
    // Resetar a senha de quem já entrou trancaria a escola inteira para fora.
    await rostering.importarPlanilha(
      ESCOLA,
      ["matricula,nome,papel,turma,serie", "SP-1,Nina Prado Lima,estudante,7A,7EF"].join("\n"),
      { senhaPadrao: SENHA_DO_LOTE },
    );
    const nina = await prisma.user.findFirstOrThrow({
      where: { escolaId: ESCOLA, matriculaExterna: "SP-1" },
    });
    expect(nina.displayName).toBe("Nina Prado Lima");
    expect(nina.senhaProvisoria).toBe(false);
  });

  test("reset pelo gestor volta a exigir a troca", async () => {
    const nina = await prisma.user.findFirstOrThrow({
      where: { escolaId: ESCOLA, matriculaExterna: "SP-1" },
    });
    const reset = await usuarios.resetarSenha(ESCOLA, nina.id);

    const r = (await auth.login({
      username: login("nina"),
      password: reset!.senhaTemporaria,
    })) as { precisaTrocarSenha: boolean };
    expect(r.precisaTrocarSenha).toBe(true);
  });

  test("conta desativada não entra — e a mensagem é a genérica de sempre", async () => {
    const otto = await prisma.user.findFirstOrThrow({
      where: { escolaId: ESCOLA, username: login("otto") },
    });
    await usuarios.atualizar(ESCOLA, otto.id, { ativo: false });

    await expect(
      auth.login({ username: login("otto"), password: SENHA_DO_LOTE }),
    ).rejects.toMatchObject({
      status: 401,
      // Nada distingue "conta desativada" de "senha errada": saber que a conta
      // existe já é informação.
      response: { mensagem: "Usuário ou senha incorretos." },
    });
  });
});
