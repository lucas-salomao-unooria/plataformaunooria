import { describe, expect, it } from "vitest";
import { iniciarTracesWeb, lerObsConfig } from "./otel-web";

describe("lerObsConfig", () => {
  it("lê config.obs.traceRatio; qualquer coisa fora da forma vira 0", () => {
    expect(lerObsConfig({ obs: { traceRatio: 0.05 } })).toEqual({ traceRatio: 0.05 });
    expect(lerObsConfig({ obs: { traceRatio: "muito" } })).toEqual({ traceRatio: 0 });
    expect(lerObsConfig({ obs: { traceRatio: 7 } })).toEqual({ traceRatio: 0 });
    expect(lerObsConfig({})).toEqual({ traceRatio: 0 });
    expect(lerObsConfig(undefined)).toEqual({ traceRatio: 0 });
  });
});

describe("iniciarTracesWeb", () => {
  it("aceita apiUrl relativa (o BFF do hub) — resolve contra a origem da página", async () => {
    const t = await iniciarTracesWeb({ traceRatio: 1, apiUrl: "/api/plataforma", expId: "hub", versao: "dev", getToken: () => "" });
    expect(t).not.toBeNull();
    await t?.shutdown();
  });

  it("com ratio 0 não liga nada (nem baixa os pacotes)", async () => {
    await expect(iniciarTracesWeb({ traceRatio: 0, apiUrl: "https://api", expId: "exp-01-instanooria", versao: "1", getToken: () => "t" })).resolves.toBeNull();
  });
});
