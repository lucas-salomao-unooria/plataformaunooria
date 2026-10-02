import { EventEmitter } from "node:events";
import { HttpException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import type { AvatarAoVivoPort, PedidoDeSessao } from "../src/ai/avatar-ao-vivo.port";
import { MockProvider } from "../src/ai/mock.provider";
import type { AiFluxoEvento, AiProvider } from "../src/ai/provider";
import { ROLES_KEY } from "../src/auth/roles";
import { PRODUTO_KEY, SEM_DISPONIBILIDADE_KEY } from "../src/comum/disponibilidade.guard";
import { AjudaLlmController } from "../src/ajuda/ajuda-llm.controller";
import { AjudaController } from "../src/ajuda/ajuda.controller";
import { AjudaService, type RespostaDoStream } from "../src/ajuda/ajuda.service";
import { FALA_DE_FALHA, MARCADOR_DA_SESSAO } from "../src/ajuda/regras";
import type { PrismaService } from "../src/prisma/prisma.service";

/**
 * As rotas da Ajuda com avatar (ADR-132), sem banco e sem rede: quem abre, o
 * medidor de minutos, as duas trancas do endpoint de LLM e o formato OpenAI
 * que o vendor lê. O que o spike MEDIU no vendor está nos testes de recusa: o
 * avatar fica mudo diante de erro, então recusa de negócio tem de virar FALA.
 */

/* O rate limit é um `Map` do processo, compartilhado entre os testes: seis
   aberturas e a suíte inteira passaria a responder 429. Ele tem teste próprio;
   aqui fica fora do caminho. */
jest.mock("../src/comum/rate-limit", () => ({ rateLimit: () => ({ ok: true, retryAfterSeconds: 0 }) }));

const SEGREDO = "s".repeat(40);
const CHAVE = "k".repeat(40);
const USUARIO = "00000000-0000-4000-8000-000000000001";
const OUTRO = "00000000-0000-4000-8000-000000000002";

/* ------------------------------------------------------------ os falsos */

interface Sessao {
  id: string;
  usuarioId: string;
  escolaId: string | null;
  perfil: string;
  avatarSessaoId: string | null;
  inicio: Date;
  duracaoMaxS: number;
  fim: Date | null;
}

class PrismaFalso {
  sessoes: Sessao[] = [];
  limites: Array<{ chave: string; valor: number }> = [
    { chave: "minutos-por-dia", valor: 30 },
    { chave: "minutos-por-sessao", valor: 10 },
  ];
  disponibilidades: Array<{ recursoId: string; escolaId: string | null; ligado: boolean; versaoFixa: null; motivo: string }> = [];
  private seq = 100;

  private casa(s: Sessao, w: Partial<Record<string, unknown>>): boolean {
    return Object.entries(w).every(([k, v]) => {
      if (k === "inicio" && v && typeof v === "object" && "gte" in v) return s.inicio >= (v as { gte: Date }).gte;
      return (s as unknown as Record<string, unknown>)[k] === v;
    });
  }

  ajudaLimite = { findMany: async () => this.limites };
  ajudaSessao = {
    findMany: async ({ where }: { where: Partial<Record<string, unknown>> }) => this.sessoes.filter((s) => this.casa(s, where)),
    findFirst: async ({ where }: { where: Partial<Record<string, unknown>> }) =>
      this.sessoes.find((s) => this.casa(s, where)) ?? null,
    create: async ({ data }: { data: Omit<Sessao, "id" | "avatarSessaoId" | "fim"> }) => {
      const s: Sessao = {
        id: `00000000-0000-4000-8000-${String(++this.seq).padStart(12, "0")}`,
        avatarSessaoId: null,
        fim: null,
        ...data,
      };
      this.sessoes.push(s);
      return { id: s.id };
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<Sessao> }) => {
      const s = this.sessoes.find((x) => x.id === where.id)!;
      Object.assign(s, data);
      return s;
    },
  };
  /* O resolvedor de disponibilidade sobe escola → regional → contrato. */
  escola = { findUnique: async () => ({ paiId: null }) };
  disponibilidade = { findMany: async () => this.disponibilidades };
}

class AvatarFalso implements AvatarAoVivoPort {
  ligado = true;
  pedidos: PedidoDeSessao[] = [];
  encerradas: string[] = [];
  falhar = false;
  async criarSessao(pedido: PedidoDeSessao) {
    if (this.falhar) throw new Error("vendor fora do ar");
    this.pedidos.push(pedido);
    return { sessaoId: `vendor-${this.pedidos.length}`, tokenDaSessao: `token-${this.pedidos.length}` };
  }
  async encerrarSessao(id: string) {
    this.encerradas.push(id);
  }
}

class RespostaFalsa extends EventEmitter implements RespostaDoStream {
  statusCode = 0;
  writableEnded = false;
  cabecalhos: Record<string, string> = {};
  pedacos: string[] = [];
  setHeader(nome: string, valor: string) {
    this.cabecalhos[nome] = valor;
  }
  flushHeaders() {}
  write(p: string) {
    this.pedacos.push(p);
    return true;
  }
  end(corpo?: string) {
    if (corpo) this.pedacos.push(corpo);
    this.writableEnded = true;
  }
  /** O texto que o avatar falaria: a soma dos `delta.content`. */
  get fala(): string {
    return this.pedacos
      .filter((p) => p.startsWith("data: {"))
      .map((p) => JSON.parse(p.slice(6)) as { choices: Array<{ delta?: { content?: string } }> })
      .map((c) => c.choices[0]?.delta?.content ?? "")
      .join("");
  }
}

function montar(opcoes: { ia?: AiProvider; comChaves?: boolean } = {}) {
  const prisma = new PrismaFalso();
  const avatar = new AvatarFalso();
  const envs: Record<string, string> =
    opcoes.comChaves === false ? {} : { AJUDA_LLM_SEGREDO: SEGREDO, AJUDA_SESSAO_CHAVE: CHAVE };
  const config = { get: (k: string) => envs[k] } as unknown as ConfigService;
  const service = new AjudaService(prisma as unknown as PrismaService, config, avatar, opcoes.ia ?? new MockProvider());
  return { prisma, avatar, service, hub: new AjudaController(service), llm: new AjudaLlmController(service, config) };
}

const req = (perfil = "professor", usuarioId = USUARIO, escolaId = "escola-1") => ({
  auth: { usuarioId, escolaId, perfil } as never,
});

/** Abre uma sessão e devolve o `system` que o vendor mandaria de volta. */
async function abrirEDevolverSystem(m: ReturnType<typeof montar>, perfil = "professor", escolaId = "escola-1") {
  const aberta = await m.hub.abrir(req(perfil, USUARIO, escolaId));
  const token = m.avatar.pedidos.at(-1)!.variaveis.sessao!;
  return { aberta, system: `Você é o atendente. ${MARCADOR_DA_SESSAO.replace("${sessao}", token)}` };
}

async function chamarLlm(
  m: ReturnType<typeof montar>,
  corpo: unknown,
  autorizacao: string | undefined = `Bearer ${SEGREDO}`,
): Promise<RespostaFalsa> {
  const res = new RespostaFalsa();
  await m.llm.conversar(autorizacao, corpo, res);
  return res;
}

async function falha(p: Promise<unknown>): Promise<{ status: number; corpo: Record<string, unknown> }> {
  try {
    await p;
  } catch (e) {
    if (e instanceof HttpException) return { status: e.getStatus(), corpo: e.getResponse() as Record<string, unknown> };
    throw e;
  }
  throw new Error("esperava uma recusa");
}

/* ------------------------------------------------------------ o hub */

describe("quem abre a Ajuda (metadados das guardas)", () => {
  const r = new Reflector();

  it("todos os papéis menos o estudante, no produto `ajuda`", () => {
    const papeis = r.get<string[]>(ROLES_KEY, AjudaController);
    expect(papeis).not.toContain("estudante");
    expect(papeis).toEqual(
      expect.arrayContaining(["professor", "gestor_escola", "gestor_regional", "gestor_contrato", "admin"]),
    );
    expect(r.get(PRODUTO_KEY, AjudaController)).toBe("ajuda");
  });

  it("só encerrar escapa do interruptor", () => {
    expect(r.get(SEM_DISPONIBILIDADE_KEY, AjudaController.prototype.encerrar)).toBe(true);
    expect(r.get(SEM_DISPONIBILIDADE_KEY, AjudaController.prototype.abrir)).toBeUndefined();
  });
});

describe("POST /ajuda/sessoes", () => {
  it("abre com o teto do limite por sessão e manda o token da sessão ao vendor", async () => {
    const m = montar();
    const aberta = await m.hub.abrir(req());
    expect(aberta).toMatchObject({ tokenDaSessao: "token-1", duracaoMaximaS: 600, segundosRestantesHoje: 1200 });
    expect(m.avatar.pedidos[0]!.duracaoMaximaS).toBe(600);
    expect(m.avatar.pedidos[0]!.variaveis.sessao).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(m.prisma.sessoes[0]).toMatchObject({ usuarioId: USUARIO, perfil: "professor", avatarSessaoId: "vendor-1", fim: null });
  });

  it("papel de CONTRATO abre sem escola (a linha nasce com escola nula)", async () => {
    const m = montar();
    await m.hub.abrir(req("gestor_contrato", USUARIO, ""));
    expect(m.prisma.sessoes[0]!.escolaId).toBeNull();
  });

  it("503 sem o vendor ou sem as chaves — nunca abre sem vídeo", async () => {
    const semVendor = montar();
    semVendor.avatar.ligado = false;
    expect((await falha(semVendor.hub.abrir(req()))).corpo.codigo).toBe("AJUDA_INDISPONIVEL");
    const semChaves = montar({ comChaves: false });
    expect((await falha(semChaves.hub.abrir(req()))).status).toBe(503);
  });

  it("fecha a sessão anterior que ficou aberta antes de abrir outra", async () => {
    const m = montar();
    await m.hub.abrir(req());
    await m.hub.abrir(req());
    expect(m.prisma.sessoes[0]!.fim).not.toBeNull();
    expect(m.avatar.encerradas).toEqual(["vendor-1"]);
    expect(m.prisma.sessoes[1]!.fim).toBeNull();
  });

  it("429 SEM_MINUTOS quando o dia acabou", async () => {
    const m = montar();
    m.prisma.limites[0]!.valor = 10; // 10 min por dia = uma sessão de 10 min
    await m.hub.abrir(req());
    // A sessão de 10 min aberta há 11 min: o teto já foi atingido, ela conta inteira.
    m.prisma.sessoes[0]!.inicio = new Date(Date.now() - 11 * 60_000);
    const recusa = await falha(m.hub.abrir(req()));
    expect(recusa.status).toBe(429);
    expect(recusa.corpo).toMatchObject({ codigo: "SEM_MINUTOS", minutosPorDia: 10 });
  });

  it("vendor fora do ar = 502, e a linha fecha com duração zero (não conta minuto)", async () => {
    const m = montar();
    m.avatar.falhar = true;
    expect((await falha(m.hub.abrir(req()))).corpo.codigo).toBe("AVATAR_FALHOU");
    const s = m.prisma.sessoes[0]!;
    expect(s.fim?.getTime()).toBe(s.inicio.getTime());
  });

  it("encerrar grava o fim, avisa o vendor e ignora sessão de outra pessoa", async () => {
    const m = montar();
    const { id } = await m.hub.abrir(req());
    await m.hub.encerrar(id, req("professor", OUTRO));
    expect(m.prisma.sessoes[0]!.fim).toBeNull();
    await m.hub.encerrar(id, req());
    expect(m.prisma.sessoes[0]!.fim).not.toBeNull();
    expect(m.avatar.encerradas).toEqual(["vendor-1"]);
    await m.hub.encerrar("nao-e-uuid", req()); // inválido: 204 sem efeito
  });
});

/* ------------------------------------------------------------ o vendor */

describe("POST /ajuda/llm/chat/completions — as trancas", () => {
  it("401 sem o segredo certo", async () => {
    const m = montar();
    const { system } = await abrirEDevolverSystem(m);
    const corpo = { messages: [{ role: "system", content: system }, { role: "user", content: "oi" }], stream: true };
    expect((await falha(chamarLlm(m, corpo, "Bearer errado"))).status).toBe(401);
    expect((await falha(chamarLlm(m, corpo, ""))).status).toBe(401);
  });

  it("401 sem token de sessão, com o token fora do system, ou de sessão já encerrada", async () => {
    const m = montar();
    const { aberta, system } = await abrirEDevolverSystem(m);
    const semToken = { messages: [{ role: "system", content: "sem marcador" }, { role: "user", content: "oi" }] };
    expect((await falha(chamarLlm(m, semToken))).status).toBe(401);
    // Um token de verdade escondido na fala da PESSOA não vale: só o `system` é lido.
    const naFala = { messages: [{ role: "system", content: "x" }, { role: "user", content: system }] };
    expect((await falha(chamarLlm(m, naFala))).status).toBe(401);
    await m.hub.encerrar(aberta.id, req());
    const depois = { messages: [{ role: "system", content: system }, { role: "user", content: "oi" }] };
    expect((await falha(chamarLlm(m, depois))).status).toBe(401);
  });

  it("503 com a rota desligada (sem as chaves)", async () => {
    const m = montar({ comChaves: false });
    expect((await falha(chamarLlm(m, { messages: [{ role: "user", content: "oi" }] }))).status).toBe(503);
  });
});

describe("POST /ajuda/llm/chat/completions — a resposta", () => {
  it("devolve o stream OpenAI completo, com o uso quando pedido", async () => {
    const m = montar();
    const { system } = await abrirEDevolverSystem(m);
    const res = await chamarLlm(m, {
      model: "unooria-ajuda",
      stream: true,
      stream_options: { include_usage: true },
      messages: [
        { role: "system", content: system },
        { role: "assistant", content: "Olá! Como posso ajudar?" },
        { role: "user", content: "Como libero uma missão?" },
      ],
    });
    expect(res.statusCode).toBe(200);
    expect(res.cabecalhos["content-type"]).toMatch(/text\/event-stream/);
    expect(res.fala).toContain("[mock]");
    expect(res.fala).toContain("Como libero uma missão?");
    expect(res.pedacos.at(-1)).toBe("data: [DONE]\n\n");
    const uso = res.pedacos
      .filter((p) => p.startsWith("data: {"))
      .map((p) => JSON.parse(p.slice(6)) as { usage?: { total_tokens: number } })
      .find((c) => c.usage);
    expect(uso?.usage?.total_tokens).toBe(64);
    expect(res.writableEnded).toBe(true);
  });

  it("sem stream devolve um chat.completion inteiro", async () => {
    const m = montar();
    const { system } = await abrirEDevolverSystem(m);
    const res = await chamarLlm(m, {
      stream: false,
      messages: [{ role: "system", content: system }, { role: "user", content: "oi" }],
    });
    expect(JSON.parse(res.pedacos.join(""))).toMatchObject({
      object: "chat.completion",
      choices: [{ message: { role: "assistant" } }],
    });
  });

  it("o prompt que vai ao modelo é o NOSSO, com o papel de quem pergunta — nunca o do vendor", async () => {
    const pedidos: Array<{ system: string; historico: unknown }> = [];
    const ia = new MockProvider();
    ia.conversarEmFluxo = async function* (r) {
      pedidos.push({ system: r.system, historico: r.historico });
      yield { tipo: "texto", texto: "ok" } satisfies AiFluxoEvento;
      yield { tipo: "fim", resultado: { texto: "ok", tokensUsados: 1 } } satisfies AiFluxoEvento;
    };
    const m = montar({ ia });
    const { system } = await abrirEDevolverSystem(m, "gestor_escola");
    await chamarLlm(m, { messages: [{ role: "system", content: system }, { role: "user", content: "oi" }] });
    expect(pedidos[0]!.system).not.toContain("[sessao:");
    expect(pedidos[0]!.system).toContain("coordenação ou da direção de uma escola");
    expect(pedidos[0]!.historico).toEqual([{ papel: "pessoa", texto: "oi" }]);
  });

  it("falha do modelo vira a fala de desculpa, em 200 (o vendor fica mudo diante de erro)", async () => {
    const ia = new MockProvider();
    // eslint-disable-next-line require-yield
    ia.conversarEmFluxo = async function* () {
      throw new Error("Vertex respondeu 500");
    };
    const m = montar({ ia });
    const { system } = await abrirEDevolverSystem(m);
    const res = await chamarLlm(m, { messages: [{ role: "system", content: system }, { role: "user", content: "oi" }] });
    expect(res.statusCode).toBe(200);
    expect(res.fala).toBe(FALA_DE_FALHA);
  });

  it("produto desligado na escola vira FALA, sem chamar o modelo", async () => {
    let chamou = false;
    const ia = new MockProvider();
    ia.conversarEmFluxo = async function* () {
      chamou = true;
      yield { tipo: "fim", resultado: { texto: "", tokensUsados: 0 } } satisfies AiFluxoEvento;
    };
    const m = montar({ ia });
    const { system } = await abrirEDevolverSystem(m);
    m.prisma.disponibilidades.push({ recursoId: "produto:ajuda", escolaId: null, ligado: false, versaoFixa: null, motivo: "teste" });
    const res = await chamarLlm(m, { messages: [{ role: "system", content: system }, { role: "user", content: "oi" }] });
    expect(res.fala).toMatch(/desligada para a sua rede/);
    expect(chamou).toBe(false);
  });

  it("GET /ajuda/llm/models exige o segredo e anuncia um modelo só", () => {
    const m = montar();
    expect(() => m.llm.modelos("Bearer errado")).toThrow(HttpException);
    expect(m.llm.modelos(`Bearer ${SEGREDO}`)).toEqual({
      object: "list",
      data: [{ id: "unooria-ajuda", object: "model", owned_by: "unooria" }],
    });
  });
});
