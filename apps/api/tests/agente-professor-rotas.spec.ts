import { EventEmitter } from "node:events";
import { ForbiddenException, HttpException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AgenteProfessorMock, FONTE_DO_MOCK, TEXTO_DO_MOCK, TITULO_DO_MOCK } from "../src/ai/agent-engine.client";
import type { AgenteProfessorPort, EventoAgente } from "../src/ai/agente-professor.port";
import type { QuotaService } from "../src/ai/quota.service";
import type { AuthClaims } from "../src/auth/claims";
import { ROLES_KEY } from "../src/auth/roles";
import { DisponibilidadeGuard, Recurso, SEM_DISPONIBILIDADE_KEY } from "../src/comum/disponibilidade.guard";
import { AgenteProfessorController } from "../src/agente-professor/agente-professor.controller";
import { AgenteProfessorService, type RespostaSse } from "../src/agente-professor/agente-professor.service";
import { DADOS_POR_EVENTO, type NomeDoEvento } from "../src/agente-professor/contrato-de-rotas";
import type { PrismaService } from "../src/prisma/prisma.service";

/**
 * As rotas do agente de IA do professor, sem banco e sem rede: posse, 429 ANTES
 * do stream, o SSE completo do modo `mock`, `consumir` no abort e no teto, e o
 * interruptor por PRODUTO (`@Produto`) com o escape só no DELETE.
 *
 * O Prisma é um falso em memória que imita a RLS (só enxerga a escola da
 * transação); a prova no Postgres de verdade é `agente-professor-postgres.spec.ts`.
 */

/* ------------------------------------------------------------ os falsos */

interface Linha {
  id: string;
  escolaId: string;
  usuarioId: string;
  sessaoId: string;
  titulo: string | null;
  criadaEm: Date;
  atualizadaEm: Date;
}

type Onde = Partial<Pick<Linha, "id" | "escolaId" | "usuarioId">>;

class PrismaFalso {
  linhas: Linha[] = [];
  usuarios = new Map<string, string>();
  disponibilidades: Array<{ recursoId: string; escolaId: string | null; ligado: boolean; versaoFixa: null; motivo: string | null }> = [];
  private seq = 0;

  user = {
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.usuarios.has(where.id) ? { displayName: this.usuarios.get(where.id) as string } : null,
  };
  escola = { findUnique: async () => ({ paiId: "regional-1" }) };
  disponibilidade = { findMany: async () => this.disponibilidades };
  experiencia = { findUnique: async () => null };

  async comTenancy<T>(fn: (tx: unknown) => Promise<T>, escola: string): Promise<T> {
    /* A RLS: a transação só enxerga as linhas da escola dela. */
    const visiveis = () => this.linhas.filter((l) => l.escolaId === escola);
    const casa = (l: Linha, w: Onde) =>
      (w.id === undefined || l.id === w.id) &&
      (w.escolaId === undefined || l.escolaId === w.escolaId) &&
      (w.usuarioId === undefined || l.usuarioId === w.usuarioId);
    const tx = {
      agenteProfessorConversa: {
        findMany: async ({ where }: { where: Onde }) =>
          visiveis()
            .filter((l) => casa(l, where))
            .sort((a, b) => b.atualizadaEm.getTime() - a.atualizadaEm.getTime()),
        findFirst: async ({ where }: { where: Onde }) => visiveis().find((l) => casa(l, where)) ?? null,
        create: async ({ data }: { data: Pick<Linha, "escolaId" | "usuarioId" | "sessaoId"> }) => {
          const agora = new Date(Date.now() + this.seq);
          const linha: Linha = {
            id: `00000000-0000-4000-8000-${String(++this.seq).padStart(12, "0")}`,
            titulo: null,
            criadaEm: agora,
            atualizadaEm: agora,
            ...data,
          };
          this.linhas.push(linha);
          return { id: linha.id };
        },
        updateMany: async ({ where, data }: { where: Onde; data: Partial<Linha> }) => {
          const alvo = visiveis().filter((l) => casa(l, where));
          for (const l of alvo) Object.assign(l, data);
          return { count: alvo.length };
        },
        deleteMany: async ({ where }: { where: Onde }) => {
          const antes = this.linhas.length;
          this.linhas = this.linhas.filter((l) => !(l.escolaId === escola && casa(l, where)));
          return { count: antes - this.linhas.length };
        },
      },
    };
    return fn(tx);
  }
}

class QuotaFalsa {
  saldo = true;
  consumos: Array<{ escolaId: string; usuarioId: string; tokens: number }> = [];
  async temSaldo() {
    return this.saldo;
  }
  async consumir(escolaId: string, usuarioId: string, tokens: number) {
    this.consumos.push({ escolaId, usuarioId, tokens });
    return tokens;
  }
}

class RespostaFalsa extends EventEmitter implements RespostaSse {
  statusCode = 0;
  headersSent = false;
  writableEnded = false;
  cabecalhos: Record<string, string> = {};
  escrito = "";
  setHeader(nome: string, valor: string) {
    this.cabecalhos[nome.toLowerCase()] = valor;
  }
  flushHeaders() {
    this.headersSent = true;
  }
  write(pedaco: string) {
    this.escrito += pedaco;
    this.emit("escreveu");
    return true;
  }
  end() {
    this.writableEnded = true;
    this.emit("close");
  }
  /** O professor fechou o painel: o socket cai com a resposta ainda aberta. */
  fecharPeloCliente() {
    this.emit("close");
  }
}

/** O texto SSE → a sequência de `[evento, dados]`, conferindo cada `data:` contra o contrato. */
function lerSse(texto: string): Array<[NomeDoEvento, unknown]> {
  const saida: Array<[NomeDoEvento, unknown]> = [];
  for (const bloco of texto.split("\n\n").filter(Boolean)) {
    if (bloco.startsWith(":")) continue;
    const [linhaEvento, linhaDados, ...resto] = bloco.split("\n");
    expect(resto).toEqual([]);
    const nome = linhaEvento?.replace(/^event: /, "") as NomeDoEvento;
    const dados = JSON.parse(linhaDados?.replace(/^data: /, "") ?? "null") as unknown;
    DADOS_POR_EVENTO[nome].parse(dados);
    saida.push([nome, dados]);
  }
  return saida;
}

/* ------------------------------------------------------------ a montagem */

const ESCOLA = "esc-1";
const OUTRA_ESCOLA = "esc-2";
let contador = 0;

function montar(agente: AgenteProfessorPort = new AgenteProfessorMock()) {
  const prisma = new PrismaFalso();
  const quota = new QuotaFalsa();
  const service = new AgenteProfessorService(
    prisma as unknown as PrismaService,
    agente,
    quota as unknown as QuotaService,
  );
  const controller = new AgenteProfessorController(service);
  /* Um professor NOVO por montagem: o rate limit é um Map de módulo, por usuário. */
  const professor = `11111111-1111-4111-8111-${String(++contador).padStart(12, "0")}`;
  prisma.usuarios.set(professor, "Ana Beatriz Souza");
  const req = (usuarioId = professor, escolaId = ESCOLA) => ({
    auth: { usuarioId, escolaId, perfil: "professor" } as AuthClaims,
  });
  return { prisma, quota, service, controller, professor, req };
}

async function statusDe(p: Promise<unknown>): Promise<{ status: number; corpo: unknown } | null> {
  try {
    await p;
    return null;
  } catch (e) {
    if (e instanceof HttpException) return { status: e.getStatus(), corpo: e.getResponse() };
    throw e;
  }
}

/* ------------------------------------------------------------ as rotas */

describe("posse da conversa", () => {
  test("criar grava a linha e a sessão nasce com o PRIMEIRO nome do banco", async () => {
    const agente = new AgenteProfessorMock();
    const { controller, req, prisma, professor } = montar(agente);
    const { id } = await controller.criar(req());
    expect(prisma.linhas).toHaveLength(1);
    const linha = prisma.linhas[0] as Linha;
    expect(linha).toMatchObject({ id, escolaId: ESCOLA, usuarioId: professor, titulo: null });
    expect((await agente.lerSessao(professor, linha.sessaoId)).estado).toEqual({ nome_professor: "Ana" });
  });

  test("outro professor → 404 (não 403); outra escola → 404; id que não é UUID → 404", async () => {
    const { controller, req } = montar();
    const { id } = await controller.criar(req());
    const outroProfessor = "22222222-2222-4222-8222-222222222222";
    expect((await statusDe(controller.ler(id, req(outroProfessor))))?.status).toBe(404);
    expect((await statusDe(controller.ler(id, req(undefined, OUTRA_ESCOLA))))?.status).toBe(404);
    expect((await statusDe(controller.ler("nao-e-uuid", req())))?.status).toBe(404);
    expect((await statusDe(controller.apagar(id, req(outroProfessor))))?.status).toBe(404);
    const res = new RespostaFalsa();
    expect((await statusDe(controller.enviar(id, { texto: "oi" }, req(outroProfessor), res)))?.status).toBe(404);
    expect(res.headersSent).toBe(false);
  });

  test("a lista é do professor NA escola ativa, a mais recente primeiro", async () => {
    const { controller, req } = montar();
    const a = await controller.criar(req());
    const b = await controller.criar(req());
    await controller.criar(req(undefined, OUTRA_ESCOLA));
    const lista = await controller.listar(req());
    expect(lista.map((c) => c.id)).toEqual([b.id, a.id]);
  });

  test("apagar tira a sessão do agente e a linha", async () => {
    const agente = new AgenteProfessorMock();
    const { controller, req, prisma, professor } = montar(agente);
    const { id } = await controller.criar(req());
    const sessaoId = (prisma.linhas[0] as Linha).sessaoId;
    await expect(controller.apagar(id, req())).resolves.toBeUndefined();
    expect(prisma.linhas).toHaveLength(0);
    await expect(agente.lerSessao(professor, sessaoId)).rejects.toThrow();
  });
});

describe("antes do stream: tudo que recusa responde JSON", () => {
  test("corpo inválido → 400 (vazio, só espaços, acima de 4.000)", async () => {
    const { controller, req } = montar();
    const { id } = await controller.criar(req());
    for (const corpo of [{}, { texto: "   " }, { texto: "x".repeat(4001) }, { texto: "oi", extra: 1 }]) {
      const res = new RespostaFalsa();
      expect((await statusDe(controller.enviar(id, corpo, req(), res)))?.status).toBe(400);
      expect(res.headersSent).toBe(false);
    }
  });

  test("rate limit: a 11ª mensagem no minuto é 429 RATE_LIMIT, sem abrir o stream", async () => {
    const { controller, req } = montar();
    const { id } = await controller.criar(req());
    for (let i = 0; i < 10; i += 1) await controller.enviar(id, { texto: `pergunta ${i}` }, req(), new RespostaFalsa());
    const res = new RespostaFalsa();
    const r = await statusDe(controller.enviar(id, { texto: "mais uma" }, req(), res));
    expect(r?.status).toBe(429);
    expect(r?.corpo).toMatchObject({ codigo: "RATE_LIMIT" });
    expect(res.headersSent).toBe(false);
    expect(res.escrito).toBe("");
  });

  test("sem saldo: 429 QUOTA, sem abrir o stream e sem chamar o agente", async () => {
    const agente = new AgenteProfessorMock();
    const enviar = jest.spyOn(agente, "enviar");
    const { controller, req, quota } = montar(agente);
    const { id } = await controller.criar(req());
    quota.saldo = false;
    const res = new RespostaFalsa();
    const r = await statusDe(controller.enviar(id, { texto: "oi" }, req(), res));
    expect(r?.status).toBe(429);
    expect(r?.corpo).toMatchObject({ codigo: "QUOTA" });
    expect(res.headersSent).toBe(false);
    expect(enviar).not.toHaveBeenCalled();
  });
});

describe("o SSE", () => {
  test("modo mock: cabeçalhos, `delta…` sem duplicar, `fontes`, `titulo`, `fim` — e a quota dos não parciais", async () => {
    const { controller, req, quota, prisma, professor } = montar();
    const { id } = await controller.criar(req());
    const res = new RespostaFalsa();
    await controller.enviar(id, { texto: "  Como ensinar números naturais?  " }, req(), res);

    expect(res.statusCode).toBe(200);
    expect(res.cabecalhos).toMatchObject({
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      connection: "keep-alive",
    });
    expect(res.writableEnded).toBe(true);

    const eventos = lerSse(res.escrito);
    expect(eventos.map(([nome]) => nome)).toEqual(["delta", "delta", "delta", "fontes", "titulo", "fim"]);
    /* Os deltas remontam o texto UMA vez — o final agregado não foi repassado. */
    const texto = eventos.filter(([n]) => n === "delta").map(([, d]) => (d as { texto: string }).texto).join("");
    expect(texto).toBe(TEXTO_DO_MOCK.join(""));
    expect(eventos[3]?.[1]).toEqual({
      fontes: [{ titulo: FONTE_DO_MOCK.titulo, paginaInicio: FONTE_DO_MOCK.pagina_inicio, paginaFim: FONTE_DO_MOCK.pagina_fim }],
    });
    expect(eventos[4]?.[1]).toEqual({ titulo: TITULO_DO_MOCK });

    /* 120 + 350: os 999 dos parciais ficam de fora. */
    expect(quota.consumos).toEqual([{ escolaId: ESCOLA, usuarioId: professor, tokens: 470 }]);
    /* O título foi espelhado na coluna. */
    expect((prisma.linhas[0] as Linha).titulo).toBe(TITULO_DO_MOCK);

    /* O histórico da conversa vem da sessão: professor (com trim) + agente com fonte. */
    const conversa = await controller.ler(id, req());
    expect(conversa).toEqual({
      id,
      titulo: TITULO_DO_MOCK,
      mensagens: [
        { autor: "professor", texto: "Como ensinar números naturais?" },
        {
          autor: "agente",
          texto: TEXTO_DO_MOCK.join(""),
          fontes: [{ titulo: FONTE_DO_MOCK.titulo, paginaInicio: 300, paginaFim: 301 }],
        },
      ],
    });

    /* O 2º turno não repete o título. */
    const res2 = new RespostaFalsa();
    await controller.enviar(id, { texto: "E depois?" }, req(), res2);
    expect(lerSse(res2.escrito).map(([n]) => n)).toEqual(["delta", "delta", "delta", "fontes", "fim"]);
  });

  test("código de habilidade inexistente citado na resposta vira `aviso` antes do `fim`", async () => {
    const { controller, req } = montar();
    const { id } = await controller.criar(req());
    const res = new RespostaFalsa();
    await controller.enviar(id, { texto: "fale da EF99ZZ99" }, req(), res);
    const eventos = lerSse(res.escrito);
    expect(eventos.slice(-2).map(([n]) => n)).toEqual(["aviso", "fim"]);
    expect(eventos.at(-2)?.[1]).toMatchObject({ codigo: "habilidade-inexistente" });
    expect(JSON.stringify(eventos.at(-2)?.[1])).toContain("EF99ZZ99");
  });

  test("professor fecha o painel: aborta o agente, não escreve `erro`, e `consumir` roda com o que foi pago", async () => {
    let sinal: AbortSignal | undefined;
    const agente: AgenteProfessorPort = {
      modo: "mock",
      criarSessao: async () => ({ sessaoId: "s-abort" }),
      lerSessao: async () => ({ sessaoId: "s-abort", estado: {}, eventos: [] }),
      apagarSessao: async () => undefined,
      async *enviar(_u, _s, _t, signal): AsyncIterable<EventoAgente> {
        sinal = signal;
        yield { autor: "a", parcial: false, textos: [], chamadasDeFerramenta: [{ nome: "buscar_acervo", args: {} }], respostasDeFerramenta: [], tokens: 200 };
        yield { autor: "a", parcial: true, textos: ["Começando…"], chamadasDeFerramenta: [], respostasDeFerramenta: [] };
        await new Promise((_, rejeitar) => signal.addEventListener("abort", () => rejeitar(new Error("AbortError"))));
      },
    };
    const { controller, req, quota, professor } = montar(agente);
    const { id } = await controller.criar(req());
    const res = new RespostaFalsa();
    res.once("escreveu", () => setImmediate(() => res.fecharPeloCliente()));
    await controller.enviar(id, { texto: "oi" }, req(), res);

    expect(sinal?.aborted).toBe(true);
    expect(lerSse(res.escrito).map(([n]) => n)).toEqual(["delta"]);
    expect(quota.consumos).toEqual([{ escolaId: ESCOLA, usuarioId: professor, tokens: 200 }]);
  });

  test("teto do turno: `erro` TEMPO_ESGOTADO, agente abortado, `consumir` roda", async () => {
    const agente: AgenteProfessorPort = {
      modo: "mock",
      criarSessao: async () => ({ sessaoId: "s-tempo" }),
      lerSessao: async () => ({ sessaoId: "s-tempo", estado: {}, eventos: [] }),
      apagarSessao: async () => undefined,
      async *enviar(_u, _s, _t, signal): AsyncIterable<EventoAgente> {
        yield { autor: "a", parcial: false, textos: [], chamadasDeFerramenta: [], respostasDeFerramenta: [], tokens: 90 };
        await new Promise((_, rejeitar) => signal.addEventListener("abort", () => rejeitar(new Error("AbortError"))));
      },
    };
    const { controller, req, quota, service } = montar(agente);
    service.tempos = { pingMs: 5, tetoMs: 30 };
    const { id } = await controller.criar(req());
    const res = new RespostaFalsa();
    await controller.enviar(id, { texto: "oi" }, req(), res);
    /* Os pings do meio saem como comentário `: ping`. */
    expect(res.escrito).toContain(": ping\n\n");
    const eventos = lerSse(res.escrito);
    expect(eventos).toEqual([["erro", expect.objectContaining({ codigo: "TEMPO_ESGOTADO" })]]);
    expect(quota.consumos.map((c) => c.tokens)).toEqual([90]);
  });

  test("agente fora do ar no meio do turno: `erro` AGENTE_INDISPONIVEL e nenhum `fim`", async () => {
    const agente: AgenteProfessorPort = {
      modo: "agent-engine",
      criarSessao: async () => ({ sessaoId: "s-erro" }),
      lerSessao: async () => ({ sessaoId: "s-erro", estado: {}, eventos: [] }),
      apagarSessao: async () => undefined,
      async *enviar(): AsyncIterable<EventoAgente> {
        yield { autor: "a", parcial: true, textos: ["Meio"], chamadasDeFerramenta: [], respostasDeFerramenta: [] };
        yield { autor: "engine", parcial: false, textos: [], chamadasDeFerramenta: [], respostasDeFerramenta: [], erro: { codigo: "INTERNAL" } };
      },
    };
    const { controller, req } = montar(agente);
    const { id } = await controller.criar(req());
    const res = new RespostaFalsa();
    await controller.enviar(id, { texto: "oi" }, req(), res);
    expect(lerSse(res.escrito).map(([n, d]) => [n, (d as { codigo?: string }).codigo])).toEqual([
      ["delta", undefined],
      ["erro", "AGENTE_INDISPONIVEL"],
    ]);
  });
});

/* ------------------------------------------------------------ o interruptor por produto */

function contexto(handler: (...args: never[]) => unknown, classe: object, auth?: AuthClaims): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => classe,
    switchToHttp: () => ({ getRequest: () => ({ auth }) }),
  } as unknown as ExecutionContext;
}

describe("DisponibilidadeGuard por PRODUTO (@Produto)", () => {
  const proto = AgenteProfessorController.prototype;
  const auth = { usuarioId: "u", escolaId: ESCOLA, perfil: "professor" } as AuthClaims;

  function guardCom(linhas: PrismaFalso["disponibilidades"]) {
    const prisma = new PrismaFalso();
    prisma.disponibilidades = linhas;
    return new DisponibilidadeGuard(new Reflector(), prisma as unknown as PrismaService);
  }
  const linha = (escolaId: string | null, ligado: boolean) => ({
    recursoId: "produto:agente-professor",
    escolaId,
    ligado,
    versaoFixa: null,
    motivo: ligado ? null : "não contratado",
  });

  test("produto ligado (sem linha nenhuma) passa", async () => {
    await expect(guardCom([]).canActivate(contexto(proto.criar, AgenteProfessorController, auth))).resolves.toBe(true);
  });

  test("desligado NA ESCOLA → 403 recurso-indisponivel no POST; o DELETE escapa", async () => {
    const guard = guardCom([linha(ESCOLA, false)]);
    const recusa = guard.canActivate(contexto(proto.criar, AgenteProfessorController, auth));
    await expect(recusa).rejects.toBeInstanceOf(ForbiddenException);
    await expect(recusa).rejects.toMatchObject({ response: { codigo: "recurso-indisponivel" } });
    await expect(guard.canActivate(contexto(proto.enviar, AgenteProfessorController, auth))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guard.canActivate(contexto(proto.apagar, AgenteProfessorController, auth))).resolves.toBe(true);
  });

  test("desligado NO CONTRATO → 403; a escola que religa é o escopo mais específico e passa", async () => {
    await expect(guardCom([linha(null, false)]).canActivate(contexto(proto.listar, AgenteProfessorController, auth))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      guardCom([linha(null, false), linha(ESCOLA, true)]).canActivate(contexto(proto.listar, AgenteProfessorController, auth)),
    ).resolves.toBe(true);
    /* A regional da escola (o `paiId` do falso) também é escopo. */
    await expect(
      guardCom([linha("regional-1", false)]).canActivate(contexto(proto.listar, AgenteProfessorController, auth)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  test("produto desligado: POST 403 pelo guard, DELETE passa e responde 204", async () => {
    const { controller, req, prisma } = montar();
    const { id } = await controller.criar(req());
    const guard = guardCom([linha(ESCOLA, false)]);
    await expect(guard.canActivate(contexto(proto.criar, AgenteProfessorController, auth))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guard.canActivate(contexto(proto.apagar, AgenteProfessorController, auth))).resolves.toBe(true);
    await expect(controller.apagar(id, req())).resolves.toBeUndefined();
    expect(Reflect.getMetadata("__httpCode__", proto.apagar)).toBe(204);
    expect(prisma.linhas).toHaveLength(0);
  });

  test("`@SemDisponibilidade` SÓ no DELETE, e a classe é só de `professor`", () => {
    const metodos = Object.getOwnPropertyNames(proto).filter((m) => m !== "constructor" && m !== "quem" && m !== "id");
    const escapam = metodos.filter((m) =>
      Reflect.getMetadata(SEM_DISPONIBILIDADE_KEY, (proto as unknown as Record<string, object>)[m] as object),
    );
    expect(escapam).toEqual(["apagar"]);
    expect(Reflect.getMetadata(ROLES_KEY, AgenteProfessorController)).toEqual(["professor"]);
  });

  test("guard sem @Recurso nem @Produto LANÇA; com os dois também", async () => {
    class SemNada {
      rota() {}
    }
    @Recurso("app-91-bem-estar")
    class ComOsDois {
      rota() {}
    }
    Reflect.defineMetadata("produto-da-rota", "bem-estar", ComOsDois);
    const guard = guardCom([]);
    await expect(guard.canActivate(contexto(SemNada.prototype.rota, SemNada, auth))).rejects.toThrow(/sem @Recurso nem @Produto/);
    await expect(guard.canActivate(contexto(ComOsDois.prototype.rota, ComOsDois, auth))).rejects.toThrow(/declare um só/);
  });

  test("o caminho por EXPERIÊNCIA continua como era", async () => {
    @Recurso("app-91-bem-estar")
    class Ferramenta {
      rota() {}
    }
    const desligada = guardCom([
      { recursoId: "experiencia:app-91-bem-estar", escolaId: ESCOLA, ligado: false, versaoFixa: null, motivo: "x" },
    ]);
    await expect(desligada.canActivate(contexto(Ferramenta.prototype.rota, Ferramenta, auth))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guardCom([]).canActivate(contexto(Ferramenta.prototype.rota, Ferramenta, auth))).resolves.toBe(true);
  });
});
