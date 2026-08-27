import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HttpException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import type { AiJsonRequest, AiProvider, AiRequest, AiResult } from "../src/ai/provider";
import { QuotaService } from "../src/ai/quota.service";
import { ObjectStorageService } from "../src/object-storage/object-storage.service";
import { markdownParaHtml, PlanosService } from "../src/planos/planos.service";
import { sanitizarHtmlDoPlano } from "../src/planos/sanitizar";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * Integração da exp-90-plano-de-aula no Postgres: geração assíncrona (claim,
 * pronto/erro, órfã), Salvar/Restaurar/Excluir, posse entre professores e
 * quota por perfil. Provider FAKE (controlável) e storage local em pasta
 * temporária. UMA ESCOLA POR SUÍTE.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-planos";
const DISCIPLINA = "teste-planos-disciplina";
const DISCIPLINA_SO_GERAL = "teste-planos-so-geral";

const MARKDOWN = `# Plano Anual — Teste

## Objetivos

- Ler criticamente.

| Código | Habilidade |
|---|---|
| EF08CO01 | Avaliar fontes. |
`;

class ProviderFake implements AiProvider {
  proximo: AiResult = { texto: MARKDOWN, tokensUsados: 1200, finishReason: "STOP" };
  falha: Error | null = null;
  /** Quando definido, `generate` espera este portão abrir (simula minutos de IA). */
  portao: Promise<void> | null = null;
  chamadas: AiRequest[] = [];

  async generate(req: AiRequest): Promise<AiResult> {
    this.chamadas.push(req);
    if (this.portao) await this.portao;
    if (this.falha) throw this.falha;
    return this.proximo;
  }
  generateJson<T>(_req: AiJsonRequest<T>): Promise<T> {
    throw new Error("não usado");
  }
  generateImage(): Promise<Buffer> {
    throw new Error("não usado");
  }
  conversar(): Promise<AiResult> {
    throw new Error("não usado");
  }
}

const dirTemporario = mkdtempSync(join(tmpdir(), "planos-teste-"));
const config = new ConfigService({
  PLANOS_DRIVER: "local",
  PLANOS_LOCAL_DIR: dirTemporario,
  AI_DAILY_TOKEN_QUOTA_PER_ALUNO: 20000,
  AI_DAILY_TOKEN_QUOTA_PER_PROFESSOR: 2_000_000,
});
const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;
const storage = new ObjectStorageService(config);
const provider = new ProviderFake();
const quota = new QuotaService(prisma, config);
const service = new PlanosService(prisma, storage, provider, quota);

let profA = "";
let profB = "";

async function limpar() {
  await prisma.planoDeAula.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.iaUsoDiario.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.planoReferencia.deleteMany({ where: { disciplina: { in: [DISCIPLINA, DISCIPLINA_SO_GERAL] } } });
  await prisma.user.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.escola.deleteMany({ where: { id: ESCOLA } });
}

async function statusDe(promessa: Promise<unknown>): Promise<number | null> {
  try {
    await promessa;
    return null;
  } catch (e) {
    if (e instanceof HttpException) return e.getStatus();
    throw e;
  }
}

async function gerarPronto(professorId: string) {
  const { id } = await service.criar(ESCOLA, professorId, "professor", { disciplina: DISCIPLINA, serie: "8EF" });
  await service.aguardarGeracao(id);
  return id;
}

beforeAll(async () => {
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola Planos (teste)" } });
  const criar = (username: string) =>
    prisma.user.create({
      data: { role: "professor", escolaId: ESCOLA, username, displayName: username, passwordHash: "x" },
      select: { id: true },
    });
  profA = (await criar("plano.prof.a")).id;
  profB = (await criar("plano.prof.b")).id;
  await prisma.planoReferencia.createMany({
    data: [
      { disciplina: DISCIPLINA, serie: null, nome: "Currículo da rede", texto: "TEXTO GERAL", ordem: 0 },
      { disciplina: DISCIPLINA, serie: "8EF", nome: "Unidade 1", texto: "TEXTO 8EF U1", ordem: 0 },
      { disciplina: DISCIPLINA, serie: "8EF", nome: "Unidade 2", texto: "TEXTO 8EF U2", ordem: 1 },
      { disciplina: DISCIPLINA, serie: "2EM", nome: "Unidade EM", texto: "TEXTO 2EM", ordem: 0 },
      { disciplina: DISCIPLINA_SO_GERAL, serie: null, nome: "Só currículo", texto: "SEM SÉRIE", ordem: 0 },
    ],
  });
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
  rmSync(dirTemporario, { recursive: true, force: true });
});

beforeEach(() => {
  provider.proximo = { texto: MARKDOWN, tokensUsados: 1200, finishReason: "STOP" };
  provider.falha = null;
  provider.portao = null;
  provider.chamadas = [];
});

describe("referências e prompt", () => {
  test("disponíveis: só disciplinas com referência ESPECÍFICA de série, séries ordenadas", async () => {
    const lista = await service.disponiveis();
    const daSuite = lista.find((d) => d.disciplina === DISCIPLINA);
    expect(daSuite).toEqual({ disciplina: DISCIPLINA, rotulo: "Teste Planos Disciplina", series: ["8EF", "2EM"] });
    expect(lista.find((d) => d.disciplina === DISCIPLINA_SO_GERAL)).toBeUndefined();
  });

  test("prompt: template → gerais → específicas na ordem, com as molduras do origem", async () => {
    const prompt = await service.montarPrompt(DISCIPLINA, "8EF");
    const posicoes = [
      prompt.indexOf("DOCUMENTO DE REFERÊNCIA OBRIGATÓRIA"),
      prompt.indexOf("DOCUMENTO DE REFERÊNCIA GERAL DA DISCIPLINA (vale para todos os anos): Currículo da rede"),
      prompt.indexOf("DOCUMENTO DE REFERÊNCIA DA REDE: Unidade 1"),
      prompt.indexOf("DOCUMENTO DE REFERÊNCIA DA REDE: Unidade 2"),
      prompt.indexOf("Ano escolar: 8º ano"),
    ];
    expect(posicoes.every((p) => p >= 0)).toBe(true);
    expect([...posicoes].sort((a, b) => a - b)).toEqual(posicoes);
    expect(prompt).not.toContain("TEXTO 2EM");
  });

  test("sem referência da série → 400 SEM_REFERENCIA (nenhuma linha criada)", async () => {
    const antes = await prisma.planoDeAula.count({ where: { escolaId: ESCOLA } });
    expect(await statusDe(service.criar(ESCOLA, profA, "professor", { disciplina: DISCIPLINA, serie: "5EF" }))).toBe(400);
    expect(await statusDe(service.criar(ESCOLA, profA, "professor", { disciplina: DISCIPLINA_SO_GERAL, serie: "8EF" }))).toBe(400);
    expect(await prisma.planoDeAula.count({ where: { escolaId: ESCOLA } })).toBe(antes);
  });
});

describe("geração assíncrona", () => {
  test("criar → pendente/gerando; ao terminar, pronto com HTML (tabela) e objetos no storage", async () => {
    const { id } = await service.criar(ESCOLA, profA, "professor", { disciplina: DISCIPLINA, serie: "8EF" });
    expect(service.geracaoAtiva(id)).toBe(true);
    await service.aguardarGeracao(id);

    const { plano, html } = await service.obter(ESCOLA, profA, id);
    expect(plano.status).toBe("pronto");
    expect(plano.titulo).toBe("Plano Anual — Teste Planos Disciplina — 8º ano");
    expect(plano.tokensUsados).toBe(1200);
    expect(html).toContain("<table>");
    expect(html).toContain("<h1>Plano Anual — Teste</h1>");

    expect(existsSync(join(dirTemporario, "planos", ESCOLA, id, "gerado.md"))).toBe(true);
    expect(existsSync(join(dirTemporario, "planos", ESCOLA, id, "atual.html"))).toBe(true);

    // A chamada de IA pediu o modelo LONGO com o prompt de sistema do plano.
    // 64k, não os 32k do app origem: com o material real (currículo da rede +
    // 4 unidades) o gemini-2.5-flash é cortado em 32k e não sobra plano.
    expect(provider.chamadas[0]).toMatchObject({ modelo: "longo", maxTokens: 64000 });
    expect(provider.chamadas[0]!.system).toContain("# PAPEL");
    // Quota consumida (por professor).
    expect(await quota.usadoHoje(ESCOLA, profA)).toBeGreaterThanOrEqual(1200);
  });

  test("segundo plano com um em curso → 409 JA_GERANDO", async () => {
    let abrir!: () => void;
    provider.portao = new Promise<void>((r) => (abrir = r));
    const { id } = await service.criar(ESCOLA, profA, "professor", { disciplina: DISCIPLINA, serie: "2EM" });
    expect(await statusDe(service.criar(ESCOLA, profA, "professor", { disciplina: DISCIPLINA, serie: "8EF" }))).toBe(409);
    // Excluir durante a geração também é recusado.
    expect(await statusDe(service.excluir(ESCOLA, profA, id))).toBe(409);
    abrir();
    await service.aguardarGeracao(id);
    expect((await service.obter(ESCOLA, profA, id)).plano.status).toBe("pronto");
  });

  test("finishReason MAX_TOKENS → erro 'cortado' (quota ainda conta o gasto)", async () => {
    provider.proximo = { texto: "# incompleto", tokensUsados: 500, finishReason: "MAX_TOKENS" };
    const antes = await quota.usadoHoje(ESCOLA, profA);
    const { id } = await service.criar(ESCOLA, profA, "professor", { disciplina: DISCIPLINA, serie: "8EF" });
    await service.aguardarGeracao(id);
    const { plano, html } = await service.obter(ESCOLA, profA, id);
    expect(plano.status).toBe("erro");
    expect(plano.erro).toContain("cortado");
    expect(html).toBeNull();
    expect(await quota.usadoHoje(ESCOLA, profA)).toBe(antes + 500);
  });

  test("provider lança → erro com a mensagem truncada", async () => {
    provider.falha = new Error("Vertex respondeu 503 " + "x".repeat(600));
    const { id } = await service.criar(ESCOLA, profA, "professor", { disciplina: DISCIPLINA, serie: "8EF" });
    await service.aguardarGeracao(id);
    const { plano } = await service.obter(ESCOLA, profA, id);
    expect(plano.status).toBe("erro");
    expect(plano.erro!.length).toBeLessThanOrEqual(500);
    expect(plano.erro).toContain("Vertex respondeu 503");
  });

  test("órfã (gerando há muito, sem worker): tentativas < 2 redispara; = 2 vira erro", async () => {
    const id = await gerarPronto(profA);
    const antigo = new Date(Date.now() - 30 * 60_000);

    await prisma.planoDeAula.update({
      where: { id },
      data: { status: "gerando", iniciadoEm: antigo, tentativas: 1 },
    });
    let r = await service.obter(ESCOLA, profA, id);
    expect(["gerando", "pronto"]).toContain(r.plano.status); // redisparada
    await service.aguardarGeracao(id);
    r = await service.obter(ESCOLA, profA, id);
    expect(r.plano.status).toBe("pronto");
    expect((await prisma.planoDeAula.findUniqueOrThrow({ where: { id } })).tentativas).toBe(2);

    await prisma.planoDeAula.update({ where: { id }, data: { status: "gerando", iniciadoEm: antigo } });
    r = await service.obter(ESCOLA, profA, id);
    expect(r.plano.status).toBe("erro");
    expect(r.plano.erro).toContain("interrompida");
  });

  test("gerando RECENTE em outra instância não é reclamada nem marcada como erro", async () => {
    const id = await gerarPronto(profA);
    await prisma.planoDeAula.update({
      where: { id },
      data: { status: "gerando", iniciadoEm: new Date(), tentativas: 1 },
    });
    const r = await service.obter(ESCOLA, profA, id);
    expect(r.plano.status).toBe("gerando");
    expect(service.geracaoAtiva(id)).toBe(false);
    await prisma.planoDeAula.update({ where: { id }, data: { status: "pronto" } });
  });

  test("quota do professor esgotada → 429 antes de qualquer trabalho", async () => {
    // `ConfigService.get` lê o process.env ANTES do config injetado, e o
    // Prisma carrega o `apps/api/.env` ao subir os testes: sem apertar
    // também o process.env, um `AI_DAILY_TOKEN_QUOTA_PER_PROFESSOR` no .env
    // local vencia o config apertado e o 429 nunca acontecia. E o consumo é
    // forçado aqui em vez de herdado dos testes anteriores, para o caso valer
    // rodando isolado (`-t`).
    const envAnterior = process.env.AI_DAILY_TOKEN_QUOTA_PER_PROFESSOR;
    process.env.AI_DAILY_TOKEN_QUOTA_PER_PROFESSOR = "100";
    try {
      await rodarQuotaEsgotada();
    } finally {
      if (envAnterior === undefined) delete process.env.AI_DAILY_TOKEN_QUOTA_PER_PROFESSOR;
      else process.env.AI_DAILY_TOKEN_QUOTA_PER_PROFESSOR = envAnterior;
    }
  });

  async function rodarQuotaEsgotada() {
    const configApertada = new ConfigService({ ...config["internalConfig"], AI_DAILY_TOKEN_QUOTA_PER_PROFESSOR: 100 });
    const servicoApertado = new PlanosService(prisma, storage, provider, new QuotaService(prisma, configApertada));
    await quota.consumir(ESCOLA, profA, 500);
    const chamadasAntes = provider.chamadas.length;
    expect(await statusDe(servicoApertado.criar(ESCOLA, profA, "professor", { disciplina: DISCIPLINA, serie: "8EF" }))).toBe(429);
    expect(provider.chamadas.length).toBe(chamadasAntes);
    // O mesmo consumo, medido pela régua do ALUNO, também estaria estourado —
    // e a régua do professor (2M) não: é isso que `perfil` muda.
    expect(await quota.temSaldo(ESCOLA, profA, "aluno")).toBe(true); // 20k > ~3k gastos
    expect(await new QuotaService(prisma, configApertada).temSaldo(ESCOLA, profA, "professor")).toBe(false);
  }
});

describe("salvar, restaurar, renomear, excluir", () => {
  test("Salvar sanitiza (<script> some, <table> fica) e o GET devolve o salvo", async () => {
    const id = await gerarPronto(profA);
    const r = await service.salvarConteudo(
      ESCOLA,
      profA,
      id,
      `<h1>Editado</h1><script>alert(1)</script><p onclick="x()" style="color:#ff0000;position:fixed">ok</p><table><tr><td>c</td></tr></table><a href="javascript:evil()">x</a>`,
    );
    expect(r.ok).toBe(true);
    const { html } = await service.obter(ESCOLA, profA, id);
    expect(html).toContain("<h1>Editado</h1>");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("position");
    expect(html).toContain('style="color:#ff0000"');
    expect(html).toContain("<table>");
    expect(html).not.toContain("javascript:");
  });

  test("Restaurar volta ao Markdown original convertido", async () => {
    const id = await gerarPronto(profA);
    await service.salvarConteudo(ESCOLA, profA, id, "<p>tudo apagado</p>");
    const r = await service.restaurar(ESCOLA, profA, id);
    expect(r.html).toContain("<h1>Plano Anual — Teste</h1>");
    expect((await service.obter(ESCOLA, profA, id)).html).toContain("<table>");
  });

  test("Salvar em plano não pronto → 409", async () => {
    let abrir!: () => void;
    provider.portao = new Promise<void>((r) => (abrir = r));
    const { id } = await service.criar(ESCOLA, profA, "professor", { disciplina: DISCIPLINA, serie: "8EF" });
    expect(await statusDe(service.salvarConteudo(ESCOLA, profA, id, "<p>x</p>"))).toBe(409);
    abrir();
    await service.aguardarGeracao(id);
  });

  test("renomear e listar (ordem por atualização, sem conteúdo)", async () => {
    const id = await gerarPronto(profA);
    await service.renomear(ESCOLA, profA, id, "Meu plano do 8º A");
    const { planos } = await service.listar(ESCOLA, profA);
    expect(planos[0]).toMatchObject({ id, titulo: "Meu plano do 8º A", status: "pronto", serieRotulo: "8º ano" });
    expect(Object.keys(planos[0]!)).not.toContain("html");
  });

  test("excluir apaga linha e objetos", async () => {
    const id = await gerarPronto(profA);
    await service.excluir(ESCOLA, profA, id);
    expect(await prisma.planoDeAula.findUnique({ where: { id } })).toBeNull();
    expect(existsSync(join(dirTemporario, "planos", ESCOLA, id))).toBe(false);
    expect(await statusDe(service.obter(ESCOLA, profA, id))).toBe(404);
  });
});

describe("posse", () => {
  test("professor B não lê, salva, renomeia, restaura nem exclui plano de A (404)", async () => {
    const id = await gerarPronto(profA);
    expect(await statusDe(service.obter(ESCOLA, profB, id))).toBe(404);
    expect(await statusDe(service.salvarConteudo(ESCOLA, profB, id, "<p>x</p>"))).toBe(404);
    expect(await statusDe(service.renomear(ESCOLA, profB, id, "roubado"))).toBe(404);
    expect(await statusDe(service.restaurar(ESCOLA, profB, id))).toBe(404);
    expect(await statusDe(service.excluir(ESCOLA, profB, id))).toBe(404);
    expect((await service.listar(ESCOLA, profB)).planos.find((p) => p.id === id)).toBeUndefined();
    // id malformado é 404, não 500.
    expect(await statusDe(service.obter(ESCOLA, profA, "nao-e-uuid"))).toBe(404);
  });
});

describe("conversão e sanitização", () => {
  test("markdownParaHtml: GFM (tabela) e sem <script> mesmo se a IA emitir", async () => {
    const html = await markdownParaHtml("| a | b |\n|---|---|\n| 1 | 2 |\n\n<script>x()</script>\n\n**ok**");
    expect(html).toContain("<table>");
    expect(html).toContain("<strong>ok</strong>");
    expect(html).not.toContain("<script");
  });

  test("sanitizar preserva formatação do editor (font, alinhamento, realce)", () => {
    const html = sanitizarHtmlDoPlano(
      `<div style="text-align:center"><font color="#123456">a</font><span style="background-color:rgb(255, 255, 0)">b</span></div><a href="https://x.y" target="_blank">l</a>`,
    );
    expect(html).toContain('style="text-align:center"');
    expect(html).toContain('<font color="#123456">');
    expect(html).toContain("background-color:rgb(255, 255, 0)");
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
