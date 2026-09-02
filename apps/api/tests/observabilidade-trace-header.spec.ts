import { lerTrace } from "../src/observabilidade/trace-da-requisicao";

/**
 * O `traceId` precisa existir em 100% das requisições atrás do load balancer,
 * com ou sem exportador de spans — é o que liga a linha de log ao request log
 * do Cloud Run. Dois formatos, e o W3C vence.
 */
const TRACE = "4bf92f3577b34da6a3ce929d0e0e4736";

describe("lerTrace", () => {
  it("lê traceparent W3C, com flag de amostragem", () => {
    const t = lerTrace({ traceparent: `00-${TRACE}-00f067aa0ba902b7-01` });
    expect(t).toEqual({ traceId: TRACE, spanId: "00f067aa0ba902b7", amostrado: true });
  });

  it("flag 00 = não amostrado", () => {
    expect(lerTrace({ traceparent: `00-${TRACE}-00f067aa0ba902b7-00` })?.amostrado).toBe(false);
  });

  it("lê X-Cloud-Trace-Context e converte o span DECIMAL para 16 hex", () => {
    const t = lerTrace({ "x-cloud-trace-context": `${TRACE}/1234567890123456789;o=1` });
    expect(t?.traceId).toBe(TRACE);
    expect(t?.spanId).toBe((1234567890123456789n).toString(16).padStart(16, "0"));
    expect(t?.amostrado).toBe(true);
  });

  it("X-Cloud-Trace-Context sem span nem opção ainda vale como trace", () => {
    expect(lerTrace({ "x-cloud-trace-context": TRACE })).toEqual({ traceId: TRACE, spanId: undefined, amostrado: false });
  });

  it("com os dois cabeçalhos, o W3C vence", () => {
    const t = lerTrace({
      traceparent: `00-${TRACE}-00f067aa0ba902b7-01`,
      "x-cloud-trace-context": `${"a".repeat(32)}/1;o=0`,
    });
    expect(t?.traceId).toBe(TRACE);
  });

  it("recusa traceparent malformado ou zerado e cai no cabeçalho do Google", () => {
    expect(lerTrace({ traceparent: "lixo" })).toBeUndefined();
    expect(lerTrace({ traceparent: `00-${"0".repeat(32)}-00f067aa0ba902b7-01` })).toBeUndefined();
    expect(
      lerTrace({ traceparent: "lixo", "x-cloud-trace-context": `${TRACE}/1;o=0` })?.traceId,
    ).toBe(TRACE);
  });

  it("sem cabeçalho nenhum devolve undefined (dev, curl)", () => {
    expect(lerTrace({})).toBeUndefined();
  });

  it("aceita cabeçalho repetido (array) e normaliza para minúsculas", () => {
    const t = lerTrace({ traceparent: [`00-${TRACE.toUpperCase()}-00F067AA0BA902B7-01`] });
    expect(t?.traceId).toBe(TRACE);
    expect(t?.spanId).toBe("00f067aa0ba902b7");
  });
});
