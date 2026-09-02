import pino from "pino";
import { describe, expect, it } from "vitest";
import { contextoDaRequisicao, criarOpcoesDoPino, opcoesDoAmbiente, redigirObjeto, redigirTexto } from "./log";

function loggerEmMemoria(gcpProjectId?: string) {
  const linhas: string[] = [];
  const destino = { write: (chunk: string) => { linhas.push(chunk); return true; } };
  const log = pino(
    criarOpcoesDoPino({ nivel: "trace", servico: "hub", versao: "teste", formato: "json", gcpProjectId }),
    destino as unknown as pino.DestinationStream,
  );
  return { log, ultima: () => JSON.parse(linhas[linhas.length - 1] ?? "{}") as Record<string, unknown> };
}

const TRACE = "4bf92f3577b34da6a3ce929d0e0e4736";

describe("log do hub (pino → Cloud Logging)", () => {
  it("severity, message, serviceContext e time RFC 3339", () => {
    const { log, ultima } = loggerEmMemoria();
    log.warn("cuidado");
    expect(ultima()).toMatchObject({ severity: "WARNING", message: "cuidado", serviceContext: { service: "hub", version: "teste" } });
    expect(typeof ultima().time).toBe("string");
    expect(ultima()).not.toHaveProperty("pid");
  });

  it("redige por chave e por padrão, no objeto e na mensagem", () => {
    const { log, ultima } = loggerEmMemoria();
    log.info({ usuario: { cpf: "12345678909" }, rota: "/x" }, "de maria@escola.gov.br");
    const linha = ultima() as { usuario: { cpf: string }; message: string };
    expect(linha.usuario.cpf).toBe("[redigido]");
    expect(linha.message).not.toContain("maria@");
  });

  it("err vira stack_trace com o tipo real", () => {
    const { log, ultima } = loggerEmMemoria();
    log.error({ err: new TypeError("x joao@a.com") }, "erro");
    const linha = ultima() as { stack_trace: string; err: { type: string; message: string } };
    expect(linha.stack_trace).toContain("TypeError");
    expect(linha.err.type).toBe("TypeError");
    expect(linha.err.message).toBe("x [redigido]");
  });

  it("contextoDaRequisicao monta o trace do Cloud Logging só com projeto", () => {
    const cab = { traceparent: `00-${TRACE}-00f067aa0ba902b7-01` };
    expect(contextoDaRequisicao(cab, "entre-redes")).toEqual({
      requestId: TRACE,
      "logging.googleapis.com/trace": `projects/entre-redes/traces/${TRACE}`,
      "logging.googleapis.com/spanId": "00f067aa0ba902b7",
      "logging.googleapis.com/trace_sampled": true,
    });
    expect(contextoDaRequisicao(cab, "")["logging.googleapis.com/trace"]).toBeUndefined();
    expect(contextoDaRequisicao({}, "p")).toEqual({});
  });

  it("redigirObjeto/redigirTexto são as mesmas regras da api", () => {
    expect(redigirObjeto({ a: { token: "t", nome: "n" }, b: 1 })).toEqual({ a: { token: "[redigido]", nome: "[redigido]" }, b: 1 });
    expect(redigirTexto("Bearer abc.def /r?x=1")).toBe("Bearer [redigido] /r?[redigido]");
  });

  it("opcoesDoAmbiente: json em produção/teste, pretty no terminal, K_REVISION como versão", () => {
    expect(opcoesDoAmbiente({ NODE_ENV: "production", K_REVISION: "frontend-00012-x" })).toMatchObject({ formato: "json", versao: "frontend-00012-x", servico: "hub" });
    expect(opcoesDoAmbiente({ NODE_ENV: "test" }).formato).toBe("json");
    expect(opcoesDoAmbiente({ NODE_ENV: "development" }).formato).toBe("pretty");
    expect(opcoesDoAmbiente({ LOG_LEVEL: "warn" }).nivel).toBe("warn");
    expect(opcoesDoAmbiente({ LOG_LEVEL: "gritando" }).nivel).toBe("info");
  });
});
