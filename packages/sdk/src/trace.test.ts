import { describe, expect, it } from "vitest";
import { TRACEPARENT, novoTraceparent } from "./trace";

describe("novoTraceparent", () => {
  it("gera um traceparent W3C válido, não amostrado, e diferente a cada chamada", () => {
    const a = novoTraceparent();
    const b = novoTraceparent();
    expect(a).toMatch(TRACEPARENT);
    expect(a.endsWith("-00")).toBe(true);
    expect(a).not.toBe(b);
  });
});
