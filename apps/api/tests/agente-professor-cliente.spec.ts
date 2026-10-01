import {
  AgenteProfessorDesligado,
  AgenteProfessorMock,
  ClienteAgentEngine,
  ParserDeStream,
  enderecosDoEngine,
  enderecosLocais,
  interpretarLinha,
  normalizarEvento,
  normalizarSessao,
} from "../src/ai/agent-engine.client";
import { AgenteIndisponivel, SessaoInexistente, type EventoAgente } from "../src/ai/agente-professor.port";
import { EnvSchema } from "../src/config/env";

/**
 * O cliente do Agent Engine, sem rede: o parser do stream (os DOIS formatos
 * que o `:streamQuery?alt=sse` devolve), a normalização do evento do ADK, os
 * endereços, os modos e as envs. O `fetch` é injetado — nenhum teste sai da
 * máquina.
 */

const ENGINE = "projects/proj-dev/locations/us-central1/reasoningEngines/123456";

describe("parser do stream", () => {
  test("NDJSON puro e linhas `data:` misturadas, no mesmo corpo", () => {
    const p = new ParserDeStream();
    const saida = p.empurrar('{"a":1}\ndata: {"b":2}\n\n{"c":3}\r\ndata:{"d":4}\n');
    expect(saida).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }, { d: 4 }]);
  });

  test("pedaço partido no MEIO da linha fica no buffer até a quebra", () => {
    const p = new ParserDeStream();
    expect(p.empurrar('data: {"texto":"meta')).toEqual([]);
    expect(p.empurrar('de"}\n{"x"')).toEqual([{ texto: "metade" }]);
    expect(p.empurrar(":1}")).toEqual([]);
    /* A última linha sem `\n` só sai no `terminar`. */
    expect(p.terminar()).toEqual([{ x: 1 }]);
  });

  test("linha vazia, comentário, `event:`, `id:` e `[DONE]` não são eventos", () => {
    expect(interpretarLinha("")).toBeUndefined();
    expect(interpretarLinha("   ")).toBeUndefined();
    expect(interpretarLinha(": ping")).toBeUndefined();
    expect(interpretarLinha("event: message")).toBeUndefined();
    expect(interpretarLinha("id: 7")).toBeUndefined();
    expect(interpretarLinha("data: [DONE]")).toBeUndefined();
  });

  test("linha que não é JSON é CONTADA e descartada, sem derrubar as outras", () => {
    const p = new ParserDeStream();
    expect(p.empurrar('isto não é json\n{"ok":true}\n')).toEqual([{ ok: true }]);
    expect(p.descartadas).toBe(1);
  });
});

describe("normalização do evento do ADK", () => {
  test("snake_case do `model_dump`: parcial, texto, tokens, delta de estado", () => {
    const e = normalizarEvento({
      author: "agente_professor",
      partial: true,
      content: { role: "model", parts: [{ text: "Olá" }, { text: "pensando…", thought: true }] },
      usage_metadata: { total_token_count: 42 },
      actions: { state_delta: { titulo_conversa: "Frações" } },
      turn_complete: true,
    });
    expect(e).toEqual<EventoAgente>({
      autor: "agente_professor",
      parcial: true,
      /* O raciocínio (`thought`) NÃO é fala. */
      textos: ["Olá"],
      chamadasDeFerramenta: [],
      respostasDeFerramenta: [],
      estadoDelta: { titulo_conversa: "Frações" },
      tokens: 42,
      fimDeTurno: true,
    });
  });

  test("camelCase da representação REST: chamada e retorno de ferramenta", () => {
    const e = normalizarEvento({
      author: "agente_professor",
      content: {
        parts: [
          { functionCall: { name: "buscar_acervo", args: { texto: "frações" } } },
          { functionResponse: { name: "buscar_acervo", response: { trechos: [] } } },
        ],
      },
      usageMetadata: { totalTokenCount: 10 },
      actions: { stateDelta: {} },
    });
    expect(e?.chamadasDeFerramenta).toEqual([{ nome: "buscar_acervo", args: { texto: "frações" } }]);
    expect(e?.respostasDeFerramenta).toEqual([{ nome: "buscar_acervo", resposta: { trechos: [] } }]);
    expect(e?.tokens).toBe(10);
    /* Delta vazio não vira `estadoDelta`. */
    expect(e?.estadoDelta).toBeUndefined();
    expect(e?.parcial).toBe(false);
  });

  test("evento de erro do ADK e erro de transporte do engine", () => {
    expect(normalizarEvento({ author: "x", error_code: "SAFETY", error_message: "bloqueado" })?.erro).toEqual({
      codigo: "SAFETY",
      mensagem: "bloqueado",
    });
    expect(normalizarEvento({ error: { code: 500, status: "INTERNAL", message: "falhou" } })?.erro).toEqual({
      codigo: "INTERNAL",
      mensagem: "falhou",
    });
  });

  test("o que não é evento vira null", () => {
    expect(normalizarEvento(null)).toBeNull();
    expect(normalizarEvento({})).toBeNull();
    expect(normalizarEvento([1, 2])).toBeNull();
  });

  test("sessão: `id` do ADK ou `name` da API nativa; estado e eventos", () => {
    const s = normalizarSessao({
      id: "999",
      user_id: "u",
      state: { nome_professor: "Ana" },
      events: [{ author: "user", content: { role: "user", parts: [{ text: "oi" }] } }, {}],
    });
    expect(s?.sessaoId).toBe("999");
    expect(s?.estado).toEqual({ nome_professor: "Ana" });
    expect(s?.eventos).toHaveLength(1);
    expect(normalizarSessao({ name: `${ENGINE}/sessions/777`, sessionState: {} })?.sessaoId).toBe("777");
  });
});

describe("endereços", () => {
  test("a região sai do resource name; `global` não tem host regional", () => {
    const e = enderecosDoEngine(ENGINE);
    expect(e.query).toBe(`https://us-central1-aiplatform.googleapis.com/v1/${ENGINE}:query`);
    expect(e.stream).toBe(`https://us-central1-aiplatform.googleapis.com/v1/${ENGINE}:streamQuery?alt=sse`);
    expect(e.sessoes).toBe(`https://us-central1-aiplatform.googleapis.com/v1beta1/${ENGINE}/sessions`);
    const g = enderecosDoEngine("projects/p/locations/global/reasoningEngines/1");
    expect(g.query.startsWith("https://aiplatform.googleapis.com/v1/")).toBe(true);
    expect(() => enderecosDoEngine("123456")).toThrow();
  });

  test("local: o mesmo contrato do container do Agent Engine", () => {
    expect(enderecosLocais("http://localhost:8080/")).toEqual({
      query: "http://localhost:8080/api/reasoning_engine",
      stream: "http://localhost:8080/api/stream_reasoning_engine",
    });
  });
});

/** Um `fetch` falso que devolve respostas em fila e guarda o que recebeu. */
function fetchFalso(respostas: Array<() => Response>) {
  const chamadas: Array<{ url: string; corpo: unknown; metodo?: string; auth?: string }> = [];
  const fn = (async (url: string, init: { body?: string; method?: string; headers?: Record<string, string> }) => {
    chamadas.push({
      url,
      metodo: init.method,
      corpo: init.body ? JSON.parse(init.body) : undefined,
      auth: init.headers?.authorization,
    });
    const proxima = respostas.shift();
    if (!proxima) throw new Error("fetch sem resposta preparada");
    return proxima();
  }) as unknown as ConstructorParameters<typeof ClienteAgentEngine>[0]["fetch"];
  return { fn, chamadas };
}

function corpoEmPedacos(pedacos: string[]): Response {
  const codificador = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      for (const p of pedacos) c.enqueue(codificador.encode(p));
      c.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "content-type": "application/json" } });
}

describe("ClienteAgentEngine (fetch injetado)", () => {
  const cliente = (respostas: Array<() => Response>, token: string | null = "tk") => {
    const f = fetchFalso(respostas);
    const c = new ClienteAgentEngine({
      modo: "agent-engine",
      enderecos: enderecosDoEngine(ENGINE),
      token: async () => token,
      fetch: f.fn,
    });
    return { c, chamadas: f.chamadas };
  };

  test("criar sessão: corpo `{class_method, input}`, token do ADC e o `output`", async () => {
    const { c, chamadas } = cliente([() => Response.json({ output: { id: "s-1", user_id: "u-1", state: {} } })]);
    const r = await c.criarSessao("u-1", { nome_professor: "Ana" }, new Date("2036-01-01T00:00:00Z"));
    expect(r).toEqual({ sessaoId: "s-1" });
    expect(chamadas[0]).toMatchObject({
      url: expect.stringMatching(/:query$/),
      auth: "Bearer tk",
      corpo: {
        class_method: "async_create_session",
        input: { user_id: "u-1", state: { nome_professor: "Ana" }, expire_time: "2036-01-01T00:00:00.000Z" },
      },
    });
  });

  test("engine que recusa `expire_time` → segunda tentativa sem ele", async () => {
    const { c, chamadas } = cliente([
      () => new Response("unexpected keyword argument 'expire_time'", { status: 500 }),
      () => Response.json({ output: { id: "s-2" } }),
    ]);
    expect(await c.criarSessao("u", {}, new Date())).toEqual({ sessaoId: "s-2" });
    expect((chamadas[1]?.corpo as { input: Record<string, unknown> }).input).not.toHaveProperty("expire_time");
  });

  test("ler sessão inexistente → SessaoInexistente; 5xx genérico → AgenteIndisponivel", async () => {
    const { c } = cliente([
      () => new Response("Session not found", { status: 500 }),
      () => Response.json({ output: null }),
      () => new Response("boom", { status: 503 }),
    ]);
    await expect(c.lerSessao("u", "s")).rejects.toBeInstanceOf(SessaoInexistente);
    await expect(c.lerSessao("u", "s")).rejects.toBeInstanceOf(SessaoInexistente);
    await expect(c.lerSessao("u", "s")).rejects.toBeInstanceOf(AgenteIndisponivel);
  });

  test("apagar é idempotente: 'não existe' dito pelo engine não é erro", async () => {
    const { c, chamadas } = cliente([() => new Response("NOT_FOUND", { status: 404 })]);
    await expect(c.apagarSessao("u", "s")).resolves.toBeUndefined();
    expect(chamadas[0]?.corpo).toEqual({ class_method: "async_delete_session", input: { user_id: "u", session_id: "s" } });
  });

  test("stream: corpo com `run_config` SSE, pedaços partidos e os dois formatos", async () => {
    const { c, chamadas } = cliente([
      () =>
        corpoEmPedacos([
          'data: {"author":"a","partial":true,"content":{"parts":[{"text":"Ol',
          'á"}]}}\n\n{"author":"a","content":{"parts":[{"text":"Olá"}]},',
          '"usage_metadata":{"total_token_count":7}}',
        ]),
    ]);
    const eventos: EventoAgente[] = [];
    for await (const e of c.enviar("u", "s", "oi", new AbortController().signal)) eventos.push(e);
    expect(eventos.map((e) => [e.parcial, e.textos.join(""), e.tokens])).toEqual([
      [true, "Olá", undefined],
      [false, "Olá", 7],
    ]);
    expect(chamadas[0]).toMatchObject({
      url: expect.stringMatching(/:streamQuery\?alt=sse$/),
      corpo: {
        class_method: "async_stream_query",
        input: { user_id: "u", session_id: "s", message: "oi", run_config: { streaming_mode: "sse" } },
      },
    });
  });

  test("renovar usa a API NATIVA de sessões (PATCH expireTime)", async () => {
    const { c, chamadas } = cliente([() => Response.json({})]);
    await c.renovarSessao("s-9", new Date("2036-01-01T00:00:00Z"));
    expect(chamadas[0]).toMatchObject({
      metodo: "PATCH",
      url: `https://us-central1-aiplatform.googleapis.com/v1beta1/${ENGINE}/sessions/s-9?updateMask=expireTime`,
      corpo: { expireTime: "2036-01-01T00:00:00.000Z" },
    });
  });

  test("modo local não manda `authorization`", async () => {
    const f = fetchFalso([() => Response.json({ output: { id: "l-1" } })]);
    const c = new ClienteAgentEngine({ modo: "local", enderecos: enderecosLocais("http://shim"), token: async () => null, fetch: f.fn });
    await c.criarSessao("u", {});
    expect(f.chamadas[0]?.auth).toBeUndefined();
    expect(f.chamadas[0]?.url).toBe("http://shim/api/reasoning_engine");
  });
});

describe("modos mock e desligado", () => {
  test("desligado: toda chamada é AgenteIndisponivel", async () => {
    const d = new AgenteProfessorDesligado();
    await expect(d.criarSessao()).rejects.toBeInstanceOf(AgenteIndisponivel);
    await expect(d.lerSessao()).rejects.toBeInstanceOf(AgenteIndisponivel);
    await expect(d.apagarSessao()).rejects.toBeInstanceOf(AgenteIndisponivel);
    const it = d.enviar()[Symbol.asyncIterator]();
    await expect(it.next()).rejects.toBeInstanceOf(AgenteIndisponivel);
  });

  test("mock: sessão de outro usuário não existe para quem pede", async () => {
    const m = new AgenteProfessorMock();
    const { sessaoId } = await m.criarSessao("u-1", {});
    await expect(m.lerSessao("u-2", sessaoId)).rejects.toBeInstanceOf(SessaoInexistente);
  });
});

describe("envs do agente", () => {
  const base = {
    DATABASE_URL: "postgresql://x@y/z",
    OIDC_ISSUER: "http://hub",
    OIDC_JWKS_URI: "http://hub/.well-known/jwks.json",
    AI_PROVIDER: "mock",
  };

  test("sem AGENTE_PROFESSOR_MODO o padrão é `desligado` — também em produção", () => {
    expect(EnvSchema.parse(base).AGENTE_PROFESSOR_MODO).toBe("desligado");
    expect(EnvSchema.parse({ ...base, NODE_ENV: "production" }).AGENTE_PROFESSOR_MODO).toBe("desligado");
  });

  test("agent-engine exige o resource name completo; local exige a URL", () => {
    expect(EnvSchema.safeParse({ ...base, AGENTE_PROFESSOR_MODO: "agent-engine" }).success).toBe(false);
    expect(
      EnvSchema.safeParse({ ...base, AGENTE_PROFESSOR_MODO: "agent-engine", AGENTE_PROFESSOR_ENGINE: "123" }).success,
    ).toBe(false);
    expect(
      EnvSchema.safeParse({ ...base, AGENTE_PROFESSOR_MODO: "agent-engine", AGENTE_PROFESSOR_ENGINE: ENGINE }).success,
    ).toBe(true);
    expect(EnvSchema.safeParse({ ...base, AGENTE_PROFESSOR_MODO: "local" }).success).toBe(false);
  });

  test("mock e local não sobem em produção", () => {
    expect(EnvSchema.safeParse({ ...base, NODE_ENV: "production", AGENTE_PROFESSOR_MODO: "mock" }).success).toBe(false);
    expect(
      EnvSchema.safeParse({
        ...base,
        NODE_ENV: "production",
        AGENTE_PROFESSOR_MODO: "local",
        AGENTE_PROFESSOR_URL_LOCAL: "http://shim",
      }).success,
    ).toBe(false);
  });
});
