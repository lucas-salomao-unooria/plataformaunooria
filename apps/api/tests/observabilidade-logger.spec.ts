import pino from "pino";
import { criarOpcoesDoPino, opcoesDoAmbiente } from "../src/observabilidade/logger";
import { abrirContexto } from "../src/tenancy/tenancy-context";

/**
 * O formato que o Cloud Logging entende: `severity` textual, `message` como
 * chave da mensagem, `logging.googleapis.com/trace` só quando há projeto, e o
 * contexto da requisição (requestId/escolaId) em toda linha sem que quem loga
 * o passe. E a redaction aplicada ao objeto E à mensagem.
 */
function loggerEmMemoria(extra: Partial<Parameters<typeof criarOpcoesDoPino>[0]> = {}) {
  const linhas: string[] = [];
  const destino = { write: (chunk: string) => { linhas.push(chunk); return true; } };
  const log = pino(
    criarOpcoesDoPino({ nivel: "trace", servico: "api", versao: "teste", formato: "json", ...extra }),
    destino as unknown as pino.DestinationStream,
  );
  const ultima = () => JSON.parse(linhas[linhas.length - 1] ?? "{}") as Record<string, unknown>;
  return { log, linhas, ultima };
}

describe("logger (pino → Cloud Logging)", () => {
  it("mapeia nível para severity e usa `message` como chave", () => {
    const { log, ultima } = loggerEmMemoria();
    log.warn("cuidado");
    expect(ultima()).toMatchObject({ severity: "WARNING", message: "cuidado" });
    log.error("falhou");
    expect(ultima().severity).toBe("ERROR");
    log.fatal("morreu");
    expect(ultima().severity).toBe("CRITICAL");
    log.debug("detalhe");
    expect(ultima().severity).toBe("DEBUG");
    expect(ultima()).not.toHaveProperty("level");
  });

  it("carrega serviceContext e um `time` RFC 3339, sem pid/hostname", () => {
    const { log, ultima } = loggerEmMemoria();
    log.info("x");
    const linha = ultima();
    expect(linha.serviceContext).toEqual({ service: "api", version: "teste" });
    expect(typeof linha.time).toBe("string");
    expect(linha).not.toHaveProperty("pid");
    expect(linha).not.toHaveProperty("hostname");
  });

  it("fora de requisição não inventa contexto", () => {
    const { log, ultima } = loggerEmMemoria();
    log.info("x");
    expect(ultima()).not.toHaveProperty("requestId");
    expect(ultima()).not.toHaveProperty("logging.googleapis.com/trace");
  });

  it("dentro do contexto da requisição, toda linha sai com requestId e escolaId", () => {
    const { log, ultima } = loggerEmMemoria({ gcpProjectId: "entre-redes" });
    abrirContexto({ requestId: "r1", traceId: "t".repeat(32), spanId: "s".repeat(16), amostrado: true, escolaId: "e1", perfil: "professor" }, () => {
      log.info("dentro");
    });
    expect(ultima()).toMatchObject({
      requestId: "r1",
      escolaId: "e1",
      perfil: "professor",
      "logging.googleapis.com/trace": `projects/entre-redes/traces/${"t".repeat(32)}`,
      "logging.googleapis.com/spanId": "s".repeat(16),
      "logging.googleapis.com/trace_sampled": true,
    });
  });

  it("sem GCP_PROJECT_ID não monta o campo de trace (dev)", () => {
    const { log, ultima } = loggerEmMemoria();
    abrirContexto({ requestId: "r1", traceId: "t".repeat(32) }, () => log.info("x"));
    expect(ultima()).toHaveProperty("requestId", "r1");
    expect(ultima()).not.toHaveProperty("logging.googleapis.com/trace");
  });

  it("erro com `message` só-leitura e getter com marca (o jeito do DOMException) é logado, não estoura", () => {
    /* O `DOMException` real vem de outro realm no Jest (\`instanceof Error\`
       dá falso e a redação nem roda). Este imita o que importa dele: `name` e
       `message` são getters do PROTÓTIPO, sem setter, que recusam um `this`
       que não seja o objeto original. */
    const marca = new WeakSet<object>();
    class ErroDePlataforma extends Error {
      constructor(readonly texto: string) {
        super();
        marca.add(this);
      }
    }
    for (const chave of ["message", "name"] as const) {
      Object.defineProperty(ErroDePlataforma.prototype, chave, {
        enumerable: true,
        get(this: ErroDePlataforma) {
          if (!marca.has(this)) throw new TypeError('Value of "this" must be of ErroDePlataforma');
          return chave === "name" ? "TimeoutError" : this.texto;
        },
      });
    }
    const { log, ultima } = loggerEmMemoria();
    const timeout = new ErroDePlataforma("aborted due to timeout joao@a.com");
    expect(() => log.error({ err: timeout }, "chamada externa")).not.toThrow();
    const linha = ultima() as { err: { message: string; type: string } };
    expect(linha.err.type).toBe("ErroDePlataforma");
    expect(linha.err.message).toBe("aborted due to timeout [redigido]");
  });

  it("redige o objeto (por chave) e a mensagem (por padrão)", () => {
    const { log, ultima } = loggerEmMemoria();
    log.info({ usuario: { cpf: "12345678909", username: "maria" }, escolaId: "e1" }, "login de maria@escola.gov.br");
    const linha = ultima() as { usuario: { cpf: string; username: string }; escolaId: string; message: string };
    expect(linha.usuario.cpf).toBe("[redigido]");
    expect(linha.usuario.username).toBe("[redigido]");
    expect(linha.escolaId).toBe("e1");
    expect(linha.message).not.toContain("maria@");
  });

  it("um `err` vira `stack_trace` (o que o Error Reporting agrupa) e a mensagem dele é redigida", () => {
    const { log, ultima } = loggerEmMemoria();
    log.error({ err: new Error("falhou para joao@x.com") }, "erro");
    const linha = ultima() as { stack_trace: string; err: { message: string; type: string } };
    expect(linha.stack_trace).toContain("Error: falhou para [redigido]");
    expect(linha.err.message).toBe("falhou para [redigido]");
    expect(linha.err.type).toBe("Error");
  });

  it("um child com `requestId` nos bindings não duplica a chave", () => {
    const { log, linhas } = loggerEmMemoria();
    abrirContexto({ requestId: "r1", escolaId: "e1" }, () => log.child({ requestId: "r1" }).info("x"));
    const bruto = linhas[linhas.length - 1] ?? "";
    expect(bruto.match(/"requestId"/g)).toHaveLength(1);
    expect(JSON.parse(bruto)).toMatchObject({ requestId: "r1", escolaId: "e1" });
  });
});

describe("opcoesDoAmbiente", () => {
  it("em produção e em teste o formato é json; no terminal, pretty", () => {
    expect(opcoesDoAmbiente({ NODE_ENV: "production" }).formato).toBe("json");
    expect(opcoesDoAmbiente({ NODE_ENV: "test" }).formato).toBe("json");
    expect(opcoesDoAmbiente({ NODE_ENV: "development" }).formato).toBe("pretty");
    expect(opcoesDoAmbiente({ NODE_ENV: "development", LOG_FORMATO: "json" }).formato).toBe("json");
  });

  it("LOG_LEVEL inválido cai em info; K_REVISION vira a versão", () => {
    expect(opcoesDoAmbiente({ LOG_LEVEL: "verboso" }).nivel).toBe("info");
    expect(opcoesDoAmbiente({ LOG_LEVEL: "warn" }).nivel).toBe("warn");
    expect(opcoesDoAmbiente({ K_REVISION: "api-00042-abc" }).versao).toBe("api-00042-abc");
    expect(opcoesDoAmbiente({}).versao).toBe("dev");
    expect(opcoesDoAmbiente({ GCP_PROJECT_ID: "" }).gcpProjectId).toBeUndefined();
  });
});
