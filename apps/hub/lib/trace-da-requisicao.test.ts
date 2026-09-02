import { describe, expect, it } from "vitest";
import { lerTrace, traceparentPara } from "./trace-da-requisicao";

const TRACE = "4bf92f3577b34da6a3ce929d0e0e4736";

describe("lerTrace", () => {
  it("lê traceparent W3C", () => {
    expect(lerTrace({ traceparent: `00-${TRACE}-00f067aa0ba902b7-01` })).toEqual({
      traceId: TRACE,
      spanId: "00f067aa0ba902b7",
      amostrado: true,
    });
  });

  it("lê X-Cloud-Trace-Context com span decimal", () => {
    const t = lerTrace({ "x-cloud-trace-context": `${TRACE}/1234567890123456789;o=0` });
    expect(t?.traceId).toBe(TRACE);
    expect(t?.spanId).toBe((1234567890123456789n).toString(16).padStart(16, "0"));
    expect(t?.amostrado).toBe(false);
  });

  it("W3C vence; malformado cai no Google; nada → undefined", () => {
    expect(lerTrace({ traceparent: `00-${TRACE}-00f067aa0ba902b7-00`, "x-cloud-trace-context": `${"a".repeat(32)}/1` })?.traceId).toBe(TRACE);
    expect(lerTrace({ traceparent: "lixo", "x-cloud-trace-context": `${TRACE}/1;o=1` })?.traceId).toBe(TRACE);
    expect(lerTrace({})).toBeUndefined();
  });
});

describe("traceparentPara", () => {
  it("remonta o cabeçalho para repassar à api, preservando a flag", () => {
    expect(traceparentPara({ traceId: TRACE, spanId: "00f067aa0ba902b7", amostrado: true })).toBe(`00-${TRACE}-00f067aa0ba902b7-01`);
    expect(traceparentPara({ traceId: TRACE, spanId: "00f067aa0ba902b7", amostrado: false })).toBe(`00-${TRACE}-00f067aa0ba902b7-00`);
  });

  it("sem span (X-Cloud-Trace-Context só com trace) não inventa um", () => {
    expect(traceparentPara({ traceId: TRACE, amostrado: false })).toBeUndefined();
    expect(traceparentPara(undefined)).toBeUndefined();
  });
});
