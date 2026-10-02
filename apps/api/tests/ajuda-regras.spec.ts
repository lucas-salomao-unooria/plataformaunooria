import { readFileSync } from "node:fs";
import { join } from "node:path";
import { corpoDoToken, AVATAR_DO_SANDBOX, type ConfigDoLiveAvatar } from "../src/ai/liveavatar.client";
import { lerSseDoVertex, endpointVertexEmFluxo } from "../src/ai/vertex.provider";
import { PERFIS } from "../src/auth/claims";
import { PREFIXO_DO_PROMPT, promptDoAtendente } from "../src/ajuda/prompt";
import {
  CHAVES_DE_LIMITE,
  duracaoDaProximaSessao,
  extrairTokenDaSessao,
  MARCADOR_DA_SESSAO,
  paraHistorico,
  pedacoSse,
  PERFIS_DA_AJUDA,
  segundosUsadosNoDia,
  SESSAO_MINIMA_S,
} from "../src/ajuda/regras";
import { assinarTokenDaSessao, verificarTokenDaSessao } from "../src/ajuda/token-da-sessao";

/**
 * As regras puras da Ajuda com avatar (ADR-132): o medidor de minutos, a
 * identidade que viaja dentro do prompt, a tradução do histórico OpenAI e o que
 * vai ao vendor. Sem banco, sem rede.
 */

const FUSO = "America/Sao_Paulo";
const CHAVE = "c".repeat(40);
const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("quem abre a Ajuda", () => {
  it("é todo papel MENOS o estudante", () => {
    expect(PERFIS_DA_AJUDA).not.toContain("estudante");
    expect([...PERFIS_DA_AJUDA].sort()).toEqual(PERFIS.filter((p) => p !== "estudante").sort());
  });

  it("o CHECK da migration espelha as duas tuplas", () => {
    const sql = readFileSync(
      join(__dirname, "../prisma/migrations/20261002120000_ajuda_com_avatar/migration.sql"),
      "utf8",
    );
    expect(sql).toContain(`CHECK ("perfil" IN (${PERFIS_DA_AJUDA.map((p) => `'${p}'`).join(", ")}))`);
    expect(sql).toContain(`CHECK ("chave" IN (${CHAVES_DE_LIMITE.map((c) => `'${c}'`).join(", ")}))`);
  });
});

describe("minutos do dia", () => {
  // 2026-10-02 10:00 em São Paulo (13:00 UTC).
  const agora = new Date("2026-10-02T13:00:00Z");

  it("sessão encerrada conta o tempo real; aberta conta o teto inteiro", () => {
    const usados = segundosUsadosNoDia(
      [
        { inicio: new Date("2026-10-02T12:00:00Z"), duracaoMaxS: 600, fim: new Date("2026-10-02T12:02:00Z") },
        { inicio: new Date("2026-10-02T12:30:00Z"), duracaoMaxS: 300, fim: null },
      ],
      agora,
      FUSO,
    );
    expect(usados).toBe(120 + 300);
  });

  it("nunca conta mais que o teto, mesmo com o fim gravado tarde", () => {
    const usados = segundosUsadosNoDia(
      [{ inicio: new Date("2026-10-02T12:00:00Z"), duracaoMaxS: 60, fim: new Date("2026-10-02T12:30:00Z") }],
      agora,
      FUSO,
    );
    expect(usados).toBe(60);
  });

  it("o dia é o do FUSO: 22h de ontem em São Paulo não conta hoje", () => {
    // 2026-10-02T01:00Z é 22h de 01/10 em São Paulo.
    const usados = segundosUsadosNoDia(
      [{ inicio: new Date("2026-10-02T01:00:00Z"), duracaoMaxS: 600, fim: null }],
      agora,
      FUSO,
    );
    expect(usados).toBe(0);
  });

  it("o teto da próxima sessão é o menor entre a sessão e o que sobra do dia", () => {
    const limites = { "minutos-por-dia": 30, "minutos-por-sessao": 10 };
    expect(duracaoDaProximaSessao(limites, 0)).toBe(600);
    expect(duracaoDaProximaSessao(limites, 30 * 60 - 200)).toBe(200);
    expect(duracaoDaProximaSessao(limites, 30 * 60 - (SESSAO_MINIMA_S - 1))).toBeNull();
    expect(duracaoDaProximaSessao(limites, 30 * 60)).toBeNull();
  });
});

describe("o token da sessão", () => {
  const claims = { sub: UUID(1), escola: "escola-1", perfil: "professor" as const, sid: UUID(2) };

  it("volta igual com a chave certa", async () => {
    const token = await assinarTokenDaSessao(claims, 600, CHAVE);
    await expect(verificarTokenDaSessao(token, CHAVE)).resolves.toEqual(claims);
  });

  it("recusa chave errada e token adulterado", async () => {
    const token = await assinarTokenDaSessao(claims, 600, CHAVE);
    await expect(verificarTokenDaSessao(token, "x".repeat(40))).resolves.toBeNull();
    const [a, b, c] = token.split(".");
    const adulterado = `${a}.${Buffer.from(JSON.stringify({ ...claims, perfil: "admin" })).toString("base64url")}.${c}`;
    expect(b).not.toBe(adulterado.split(".")[1]);
    await expect(verificarTokenDaSessao(adulterado, CHAVE)).resolves.toBeNull();
  });

  it("recusa token vencido", async () => {
    // Duração negativa além da folga de 60 s: o `exp` já passou.
    const token = await assinarTokenDaSessao(claims, -120, CHAVE);
    await expect(verificarTokenDaSessao(token, CHAVE)).resolves.toBeNull();
  });

  it("recusa estudante mesmo assinado (o perfil é fechado)", async () => {
    const token = await assinarTokenDaSessao({ ...claims, perfil: "estudante" as never }, 600, CHAVE);
    await expect(verificarTokenDaSessao(token, CHAVE)).resolves.toBeNull();
  });

  it("cabe no marcador do contexto e sai da mensagem system", async () => {
    const token = await assinarTokenDaSessao(claims, 600, CHAVE);
    expect(token.length).toBeLessThan(1000); // teto do vendor para `dynamic_variables`
    const system = `Você é o atendente. ${MARCADOR_DA_SESSAO.replace("${sessao}", token)}`;
    expect(extrairTokenDaSessao(system)).toBe(token);
    expect(extrairTokenDaSessao("Você é o atendente.")).toBeNull();
  });
});

describe("o histórico que vai ao modelo", () => {
  it("descarta o system, junta falas seguidas e começa na pessoa", () => {
    const h = paraHistorico([
      { role: "system", content: "prompt do vendor" },
      { role: "assistant", content: "Olá! Como posso ajudar?" },
      { role: "user", content: "Como libero uma missão?" },
      { role: "user", content: [{ type: "text", text: "para o 8º ano" }] },
      { role: "assistant", content: "Na sala da turma…" },
      { role: "user", content: "   " },
    ]);
    expect(h).toEqual([
      { papel: "pessoa", texto: "Como libero uma missão?\npara o 8º ano" },
      { papel: "agente", texto: "Na sala da turma…" },
    ]);
  });

  it("corta mensagens longas demais", () => {
    const h = paraHistorico([{ role: "user", content: "a".repeat(5000) }]);
    expect(h[0]!.texto).toHaveLength(2000);
  });
});

describe("o formato OpenAI que volta ao vendor", () => {
  it("é um chat.completion.chunk em linha SSE", () => {
    const linha = pedacoSse({ id: "chatcmpl-1", criado: 1, modelo: "unooria-ajuda" }, { content: "Oi" }, null);
    expect(linha.startsWith("data: ")).toBe(true);
    expect(linha.endsWith("\n\n")).toBe(true);
    expect(JSON.parse(linha.slice(6))).toMatchObject({
      object: "chat.completion.chunk",
      choices: [{ index: 0, delta: { content: "Oi" }, finish_reason: null }],
    });
  });
});

describe("o pedido de sessão ao vendor", () => {
  const config: ConfigDoLiveAvatar = {
    apiKey: "k",
    apiUrl: "https://api.liveavatar.com",
    avatarId: UUID(9),
    voiceId: UUID(8),
    contextId: UUID(7),
    llmConfigId: UUID(6),
    sandbox: false,
  };

  it("leva o NOSSO LLM, o contexto, o português e o teto", () => {
    const corpo = corpoDoToken(config, { duracaoMaximaS: 600, variaveis: { sessao: "t" } });
    expect(corpo).toMatchObject({
      mode: "FULL",
      avatar_id: UUID(9),
      is_sandbox: false,
      max_session_duration: 600,
      llm_configuration_id: UUID(6),
      avatar_persona: { context_id: UUID(7), language: "pt", voice_id: UUID(8) },
      dynamic_variables: { sessao: "t" },
    });
  });

  it("no sandbox troca para o avatar de testes e não manda a voz", () => {
    const corpo = corpoDoToken({ ...config, sandbox: true }, { duracaoMaximaS: 60, variaveis: {} });
    expect(corpo.avatar_id).toBe(AVATAR_DO_SANDBOX);
    expect((corpo.avatar_persona as Record<string, unknown>).voice_id).toBeUndefined();
  });
});

describe("o fluxo do Vertex", () => {
  it("o endereço é o do streamGenerateContent em SSE", () => {
    expect(endpointVertexEmFluxo({ project: "p", location: "global", model: "m" })).toBe(
      "https://aiplatform.googleapis.com/v1/projects/p/locations/global/publishers/google/models/m:streamGenerateContent?alt=sse",
    );
  });

  it("costura linhas cortadas no meio do pedaço de rede e ignora lixo", async () => {
    const enc = new TextEncoder();
    const um = JSON.stringify({ candidates: [{ content: { parts: [{ text: "Olá" }] } }] });
    const dois = JSON.stringify({ candidates: [{ finishReason: "STOP" }], usageMetadata: { totalTokenCount: 10 } });
    async function* corpo() {
      yield enc.encode(`data: ${um.slice(0, 10)}`);
      yield enc.encode(`${um.slice(10)}\n\ndata: nao-e-json\n\n`);
      yield enc.encode(`data: ${dois}`);
    }
    const lidos = [];
    for await (const d of lerSseDoVertex(corpo())) lidos.push(d);
    expect(lidos).toHaveLength(2);
    expect(lidos[0]!.candidates![0]!.content!.parts![0]!.text).toBe("Olá");
    expect(lidos[1]!.usageMetadata!.totalTokenCount).toBe(10);
  });
});

describe("o prompt do atendente", () => {
  it("tem o MESMO prefixo para todo papel (é o que o cache implícito reaproveita)", () => {
    for (const perfil of PERFIS_DA_AJUDA) expect(promptDoAtendente(perfil).startsWith(PREFIXO_DO_PROMPT)).toBe(true);
    expect(promptDoAtendente("professor")).not.toBe(promptDoAtendente("admin"));
  });

  it("carrega a base e manda falar sem jargão", () => {
    expect(PREFIXO_DO_PROMPT).toContain("CONHECIMENTO");
    expect(PREFIXO_DO_PROMPT).toContain("Liberar uma missão para a turma");
    expect(PREFIXO_DO_PROMPT).toMatch(/Não use linguagem técnica/);
  });
});
