import { Prisma, PrismaClient } from "@prisma/client";
import { RegistroDeConsumo } from "../src/ai/consumo-de-ia";
import { ROLES_KEY } from "../src/auth/roles";
import { diaDaPlataforma } from "../src/comum/fuso";
import { PrismaService } from "../src/prisma/prisma.service";
import { CustosDeIaController } from "../src/recursos/custos-de-ia.controller";

/**
 * O PAINEL DE CUSTOS DE IA contra o Postgres (ADR-161): o registro soma por
 * dia, e a consulta deriva o custo com o preço VIGENTE em cada dia e a PTAX do
 * dia — inclusive a de terça para a quarta sem cotação.
 *
 * As três tabelas são de CONTRATO, e a suíte escreve nelas. As precauções:
 * tudo em janeiro de 2001 (nenhum dado real mora lá), modelos `teste-custos-*`,
 * preços com motivo `[suite]`, e a limpeza apaga só isso. O preço de 2001 do
 * `liveavatar-full` não muda o presente: a vigência de 2026 da semente é mais nova.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-custos-ia";
const TEXTO = "teste-custos-texto";
const SEM_PRECO = "teste-custos-sem-preco";
const REGISTRO = "teste-custos-registro";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;
const controller = new CustosDeIaController(prisma);
let admin = "";
const comoAdmin = () => ({ auth: { usuarioId: admin, escolaId: "", perfil: "admin" as const } });

const dia = (d: string) => new Date(`${d}T00:00:00Z`);

async function limpar() {
  await prisma.$executeRaw`DELETE FROM ia_consumo_diario WHERE modelo LIKE 'teste-custos-%'`;
  await prisma.iaPreco.deleteMany({ where: { motivo: { startsWith: "[suite]" } } });
  await prisma.cotacaoDolar.deleteMany({ where: { dia: { lt: dia("2002-01-01") } } });
  if (admin) await prisma.ajudaSessao.deleteMany({ where: { usuarioId: admin } });
}

async function consumo(linha: { dia: string; escola: string; recurso: string; modelo: string; entrada: number; saida: number }) {
  await prisma.$executeRaw`
    INSERT INTO ia_consumo_diario (dia, escola_id, perfil, recurso, operacao, modelo, modalidade, chamadas, tokens_entrada, tokens_saida)
    VALUES (${linha.dia}::date, ${linha.escola}, 'professor', ${linha.recurso}, 'generate', ${linha.modelo}, 'texto', 1, ${linha.entrada}, ${linha.saida})`;
}

const preco = (modelo: string, componente: string, usd: number, desde: string) =>
  prisma.iaPreco.create({
    data: { modelo, componente, usd: new Prisma.Decimal(usd), vigenteDesde: dia(desde), motivo: "[suite] preço de teste" },
  });

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.escola.deleteMany({ where: { id: ESCOLA } });
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola dos custos" } });
  admin = (
    await prisma.user.create({
      data: { escolaId: ESCOLA, username: "custos-admin", role: "admin", displayName: "Rui da Unooria", passwordHash: "x" },
    })
  ).id;
  await limpar();

  // 2001-01-01 é segunda. O preço de saída DOBRA no dia 03.
  await preco(TEXTO, "entrada", 1, "2001-01-01");
  await preco(TEXTO, "saida", 2, "2001-01-01");
  await preco(TEXTO, "saida", 4, "2001-01-03");
  await preco("liveavatar-full", "minuto", 0.2, "2001-01-01");

  // PTAX de segunda e terça; quarta (03) não tem — vale a de terça.
  const agora = new Date();
  await prisma.cotacaoDolar.createMany({
    data: [
      { dia: dia("2001-01-01"), compra: new Prisma.Decimal(1.99), venda: new Prisma.Decimal(2), cotadoEm: agora, buscadoEm: agora },
      { dia: dia("2001-01-02"), compra: new Prisma.Decimal(2.49), venda: new Prisma.Decimal(2.5), cotadoEm: agora, buscadoEm: agora },
    ],
  });

  await consumo({ dia: "2001-01-01", escola: ESCOLA, recurso: "planos", modelo: TEXTO, entrada: 1_000_000, saida: 1_000_000 });
  await consumo({ dia: "2001-01-03", escola: ESCOLA, recurso: "posts", modelo: TEXTO, entrada: 1_000_000, saida: 1_000_000 });
  await consumo({ dia: "2001-01-02", escola: "", recurso: "runs", modelo: SEM_PRECO, entrada: 500, saida: 0 });

  // Avatar: 5 minutos com fim, e uma sala que o vendor nunca abriu (não custa).
  await prisma.ajudaSessao.create({
    data: {
      usuarioId: admin,
      escolaId: ESCOLA,
      perfil: "professor",
      avatarSessaoId: "sala-teste",
      inicio: new Date("2001-01-02T13:00:00Z"),
      fim: new Date("2001-01-02T13:05:00Z"),
      duracaoMaxS: 600,
      atendente: "avatar",
    },
  });
  await prisma.ajudaSessao.create({
    data: { usuarioId: admin, escolaId: ESCOLA, perfil: "professor", inicio: new Date("2001-01-02T14:00:00Z"), duracaoMaxS: 600, atendente: "avatar" },
  });
});

afterAll(async () => {
  await limpar().catch(() => undefined);
  await prisma.user.deleteMany({ where: { escolaId: ESCOLA } }).catch(() => undefined);
  await prisma.escola.deleteMany({ where: { id: ESCOLA } }).catch(() => undefined);
  await prisma.$disconnect();
});

describe("a rota é só do admin", () => {
  it("@Roles('admin') na classe", () => {
    expect(Reflect.getMetadata(ROLES_KEY, CustosDeIaController)).toEqual(["admin"]);
  });
});

describe("o painel deriva o custo com o preço e a PTAX de cada dia", () => {
  it("os totais, os dias e os produtos batem entre si", async () => {
    const p = await controller.painel({ de: "2001-01-01", ate: "2001-01-07" });

    // planos (01): 1 + 2 = US$ 3 × 2,00 · posts (03): 1 + 4 = US$ 5 × 2,50 (PTAX de terça)
    // avatar (02): 5 min × 0,20 = US$ 1 × 2,50 · sem preço: US$ 0
    expect(p.totais.usd).toBeCloseTo(9);
    expect(p.totais.brl).toBeCloseTo(6 + 12.5 + 2.5);
    expect(p.totais.minutosDeVideo).toBeCloseTo(5);
    expect(p.totais.tokensEntrada).toBe(2_000_500);

    expect(p.porDia.map((d) => [d.dia, Number(d.usd.toFixed(4))])).toEqual([
      ["2001-01-01", 3],
      ["2001-01-02", 1],
      ["2001-01-03", 5],
    ]);
    expect(p.porDia.reduce((s, d) => s + d.usd, 0)).toBeCloseTo(p.totais.usd);

    // `posts` e `runs` são o mesmo produto: uma linha, e ela carrega o aviso de preço faltando.
    expect(p.porRecurso.map((r) => [r.recurso, Number(r.usd.toFixed(4)), r.semPreco])).toEqual([
      ["unoovista", 5, true],
      ["planos", 3, false],
      ["ajuda", 1, false],
    ]);
    expect(p.porModalidade.map((m) => m.modalidade).sort()).toEqual(["texto", "video"]);
    expect(p.modelosSemPreco).toEqual([SEM_PRECO]);
    expect(p.porEscola.find((e) => e.escolaId === "")?.nome).toBe("Sem escola (contas do contrato)");
    expect(p.porEscola.find((e) => e.escolaId === ESCOLA)?.nome).toBe("Escola dos custos");
  });

  it("um preço corrigido com data no passado recalcula o painel para trás", async () => {
    const tabela = await controller.definirPreco(
      { modelo: TEXTO, componente: "saida", usd: 3, vigenteDesde: "2001-01-01", motivo: "[suite] desconto descoberto depois" },
      comoAdmin(),
    );
    // Mesma (modelo, componente, data): substitui; a vigência do dia 03 continua.
    const saidas = tabela.precos.filter((x) => x.modelo === TEXTO && x.componente === "saida");
    expect(saidas.map((x) => [x.vigenteDesde, x.usd])).toEqual([
      ["2001-01-03", 4],
      ["2001-01-01", 3],
    ]);
    expect(saidas.find((x) => x.vigenteDesde === "2001-01-01")?.definidoPorNome).toBe("Rui da Unooria");

    const p = await controller.painel({ de: "2001-01-01", ate: "2001-01-07" });
    expect(p.porDia.find((d) => d.dia === "2001-01-01")?.usd).toBeCloseTo(4);
    expect(p.totais.usd).toBeCloseTo(10);
  });

  it("período invertido e período longo demais são recusados com a frase certa", async () => {
    await expect(controller.painel({ de: "2001-01-07", ate: "2001-01-01" })).rejects.toThrow("depois do fim");
    await expect(controller.painel({ de: "2000-01-01", ate: "2001-06-01" })).rejects.toThrow("366 dias");
  });
});

describe("o registro soma no agregado do dia", () => {
  it("duas chamadas iguais viram UMA linha com a soma, e a falha conta à parte", async () => {
    const registro = new RegistroDeConsumo(prisma);
    const uso = {
      operacao: "generate" as const,
      modelo: REGISTRO,
      modalidade: "texto" as const,
      tokensEntrada: 100,
      tokensSaida: 40,
      atribuicao: { escolaId: ESCOLA, perfil: "professor", recurso: "planos" },
    };
    await registro.registrar({ ...uso, ok: true });
    await registro.registrar({ ...uso, ok: false });

    const linhas = await prisma.iaConsumoDiario.findMany({ where: { modelo: REGISTRO, escolaId: ESCOLA } });
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toEqual(
      expect.objectContaining({ recurso: "planos", chamadas: 2, falhas: 1, tokensEntrada: 200n, tokensSaida: 80n }),
    );
    expect(linhas[0]!.dia.toISOString().slice(0, 10)).toBe(diaDaPlataforma(new Date()));
  });

  it("sem escola, a linha vai com a sentinela vazia — e não duplica", async () => {
    const registro = new RegistroDeConsumo(prisma);
    const uso = { operacao: "generate" as const, modelo: REGISTRO, modalidade: "texto" as const, ok: true, tokensEntrada: 1, tokensSaida: 1 };
    await registro.registrar(uso);
    await registro.registrar(uso);
    const semEscola = await prisma.iaConsumoDiario.findMany({ where: { modelo: REGISTRO, escolaId: "" } });
    expect(semEscola).toHaveLength(1);
    expect(semEscola[0]!.chamadas).toBe(2);
  });
});
