import { describe, expect, it } from "vitest";
import { configDoOtel } from "./otel-config";

/** O gate do OpenTelemetry no hub: mesma regra da api — ratio > 0 E (projeto OU OBS_DEBUG=1). */
describe("configDoOtel (hub)", () => {
  it("desligado por padrão; ligado com ratio e projeto; console com OBS_DEBUG", () => {
    expect(configDoOtel({})).toMatchObject({ ligado: false, servico: "hub", versao: "dev" });
    expect(configDoOtel({ OBS_TRACE_RATIO: "0.02", GCP_PROJECT_ID: "p" }).ligado).toBe(true);
    expect(configDoOtel({ OBS_TRACE_RATIO: "0.02" }).ligado).toBe(false);
    expect(configDoOtel({ OBS_TRACE_RATIO: "0.02", OBS_DEBUG: "1" })).toMatchObject({ ligado: true, debug: true });
  });

  it("satura o ratio e lê K_REVISION", () => {
    expect(configDoOtel({ OBS_TRACE_RATIO: "3", GCP_PROJECT_ID: "p", K_REVISION: "frontend-7" })).toMatchObject({ ratio: 1, versao: "frontend-7" });
    expect(configDoOtel({ OBS_TRACE_RATIO: "x", GCP_PROJECT_ID: "p" }).ligado).toBe(false);
  });
});
