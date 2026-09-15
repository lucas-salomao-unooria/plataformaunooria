import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { ACOES_DE_AUDITORIA } from "../src/recursos/auditoria";
import { RecursosAdminController } from "../src/recursos/recursos-admin.controller";
import { RecursosAuditoriaController } from "../src/recursos/recursos-auditoria.controller";

/**
 * O HISTÓRICO do painel (ADR-89): quem mexeu, no quê, quando e por quê.
 *
 * Ele existe porque a linha de `disponibilidades` é SOBRESCRITA: o estado atual
 * ela responde, o histórico não. O que se prova aqui é que toda escrita do
 * painel deixa rastro, que o rastro NÃO se reescreve, e que a rede lê o próprio
 * histórico sem ganhar poder de escrita.
 *
 * `exp-99-*` e escola própria, como as outras suítes de recursos: `experiencias`
 * e `recursos_auditoria` são tabelas de CONTRATO, sem `escola_id` para isolar.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-auditoria";
const EXP = "exp-99-auditoria";
const RECURSO = `experiencia:${EXP}`;

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;
const painel = new RecursosAdminController(prisma);
const historico = new RecursosAuditoriaController(prisma);

let admin = "";
const comoAdmin = () => ({ auth: { usuarioId: admin, escolaId: "", perfil: "admin" as const } });
const comoRede = () => ({ auth: { usuarioId: admin, escolaId: "", perfil: "gestor_contrato" as const } });

async function limpar() {
  await prisma.recursoAuditoria.deleteMany({ where: { OR: [{ recursoId: RECURSO }, { escolaId: ESCOLA }] } });
  await prisma.disponibilidade.deleteMany({ where: { OR: [{ recursoId: RECURSO }, { escolaId: ESCOLA }] } });
  await prisma.experienciaVersao.deleteMany({ where: { expId: EXP } });
  await prisma.experiencia.deleteMany({ where: { expId: EXP } });
  await prisma.user.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.escola.deleteMany({ where: { id: ESCOLA } });
}

beforeAll(async () => {
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola da auditoria" } });
  admin = (
    await prisma.user.create({
      data: {
        escolaId: ESCOLA,
        username: "auditoria-admin",
        role: "admin",
        displayName: "Marina Auditora",
        passwordHash: "x",
      },
    })
  ).id;
  /* `publico: "professor"` mantém a experiência de mentira FORA de toda grade
     de turma — o catálogo é global, e uma linha de estudante entraria na grade
     de todas as escolas (lição de 2026-09-10). */
  await prisma.experiencia.create({
    data: {
      expId: EXP,
      nome: "Experiência da auditoria",
      versaoAtiva: "1.0.0",
      produto: "entre-redes",
      publico: "professor",
      series: [],
    },
  });
  await prisma.experienciaVersao.create({
    data: { expId: EXP, versao: "1.0.0", manifesto: { nome: "Experiência da auditoria" }, publicadaPor: "seed" },
  });
});

beforeEach(async () => {
  await prisma.recursoAuditoria.deleteMany({ where: { OR: [{ recursoId: RECURSO }, { escolaId: ESCOLA }] } });
  await prisma.disponibilidade.deleteMany({ where: { OR: [{ recursoId: RECURSO }, { escolaId: ESCOLA }] } });
});

afterAll(async () => {
  await limpar().catch(() => undefined);
  await prisma.$disconnect();
});

const linhas = async (escolaId?: string) =>
  (await historico.auditoria(escolaId, RECURSO, undefined, comoAdmin())).linhas;

describe("toda escrita do painel deixa rastro", () => {
  test("desligar grava a ação, o motivo e QUEM fez", async () => {
    await painel.definir(RECURSO, { escolaId: ESCOLA, ligado: false, motivo: "incidente #7" }, comoAdmin());
    const [linha] = await linhas(ESCOLA);
    expect(linha).toMatchObject({
      recursoId: RECURSO,
      escolaId: ESCOLA,
      acao: "desligado",
      motivo: "incidente #7",
      autorNome: "Marina Auditora",
      versao: null,
    });
  });

  test("remover a exceção grava `herdado` — e remover o que não existe NÃO grava nada", async () => {
    await painel.remover(RECURSO, ESCOLA, comoAdmin());
    expect(await linhas(ESCOLA)).toHaveLength(0);

    await painel.definir(RECURSO, { escolaId: ESCOLA, ligado: true }, comoAdmin());
    await painel.remover(RECURSO, ESCOLA, comoAdmin());
    expect((await linhas(ESCOLA)).map((l) => l.acao)).toEqual(["herdado", "ligado"]);
  });

  test("ativar versão grava a VERSÃO; ligar/desligar não", async () => {
    await painel.ativar(EXP, { versao: "1.0.0", motivo: "volta da regressão" }, comoAdmin());
    const [linha] = await linhas();
    expect(linha).toMatchObject({ acao: "versao-ativada", versao: "1.0.0", escolaId: null });
  });

  test("fixar e soltar a versão gravam ações distintas", async () => {
    await painel.fixarVersao(EXP, { escolaId: ESCOLA, versao: "1.0.0" }, comoAdmin());
    await painel.fixarVersao(EXP, { escolaId: ESCOLA, versao: null }, comoAdmin());
    const acoes = (await linhas(ESCOLA)).map((l) => `${l.acao}:${l.versao ?? "-"}`);
    // Mais recente primeiro. A soltura não carrega versão (CHECK do banco).
    expect(acoes).toEqual(["versao-soltada:-", "versao-fixada:1.0.0"]);
  });

  test("o vocabulário do código e o CHECK do banco dizem a mesma coisa", async () => {
    const [c] = await prisma.$queryRaw<{ definicao: string }[]>`
      SELECT pg_get_constraintdef(oid) AS definicao
        FROM pg_constraint WHERE conname = 'ck_recursos_auditoria_acao'`;
    const noBanco = [...(c?.definicao ?? "").matchAll(/'([a-z-]+)'::text/g)].map((m) => m[1]);
    expect(noBanco.sort()).toEqual([...ACOES_DE_AUDITORIA].sort());
  });
});

describe("append-only é do BANCO, não do código", () => {
  test("UPDATE numa linha de histórico é RECUSADO pelo trigger", async () => {
    await painel.definir(RECURSO, { escolaId: ESCOLA, ligado: false, motivo: "original" }, comoAdmin());
    const [linha] = await linhas(ESCOLA);
    /* Reescrever histórico é o único jeito de esta tabela mentir. Sem o
       trigger, "append-only" seria promessa do código — e a promessa que o
       banco não cobra é a que a próxima rotina de correção quebra. */
    await expect(
      prisma.recursoAuditoria.update({
        where: { id: linha!.id },
        data: { motivo: "reescrito" },
      }),
    ).rejects.toThrow();
  });

  test("DELETE continua permitido — retenção futura e limpeza de suíte", async () => {
    await painel.definir(RECURSO, { escolaId: ESCOLA, ligado: true }, comoAdmin());
    const { count } = await prisma.recursoAuditoria.deleteMany({ where: { recursoId: RECURSO } });
    expect(count).toBeGreaterThan(0);
  });
});

describe("quem lê o histórico", () => {
  test("a REDE lê o próprio histórico — e é a única rota de /recursos que ela alcança", async () => {
    await painel.definir(RECURSO, { escolaId: ESCOLA, ligado: false, motivo: "não contratado" }, comoAdmin());
    const daRede = await historico.auditoria(ESCOLA, RECURSO, undefined, comoRede());
    expect(daRede.linhas[0]).toMatchObject({ acao: "desligado", motivo: "não contratado" });
  });

  test("o histórico de uma ESCOLA inclui as decisões de CONTRATO que a alcançaram", async () => {
    await painel.ativar(EXP, { versao: "1.0.0" }, comoAdmin());
    await painel.definir(RECURSO, { escolaId: ESCOLA, ligado: true }, comoAdmin());
    /* Sem as de contrato, a tela da escola diria "nada aconteceu aqui" sobre um
       produto que a REDE mudou — e é justamente essa a pergunta do gestor. */
    const escopos = (await linhas(ESCOLA)).map((l) => l.escolaId);
    expect(escopos).toContain(ESCOLA);
    expect(escopos).toContain(null);
  });

  test("o teto é dito na resposta, não silencioso", async () => {
    for (let i = 0; i < 4; i += 1) {
      await painel.definir(RECURSO, { escolaId: ESCOLA, ligado: i % 2 === 0, motivo: `mudanca ${i}` }, comoAdmin());
    }
    const curto = await historico.auditoria(ESCOLA, RECURSO, "2", comoAdmin());
    expect(curto.linhas).toHaveLength(2);
    expect(curto.truncado).toBe(true);
  });
});
