import { configDoOtel } from "../src/observabilidade/otel-config";

/**
 * O gate do OpenTelemetry: sem ele o SDK subiria no Jest e no `nest start
 * --watch` sem GCP. Ligado = ratio > 0 E (projeto OU OBS_DEBUG=1).
 */
describe("configDoOtel", () => {
  it("sem nada, desligado (o default de dev e teste)", () => {
    expect(configDoOtel({}, "api")).toMatchObject({ ligado: false, ratio: 0, debug: false, servico: "api", versao: "dev" });
  });

  it("ratio > 0 com projeto liga; ratio 0 com projeto não", () => {
    expect(configDoOtel({ OBS_TRACE_RATIO: "0.02", GCP_PROJECT_ID: "p" }, "api").ligado).toBe(true);
    expect(configDoOtel({ OBS_TRACE_RATIO: "0", GCP_PROJECT_ID: "p" }, "api").ligado).toBe(false);
  });

  it("ratio > 0 sem projeto só liga com OBS_DEBUG=1 (console)", () => {
    expect(configDoOtel({ OBS_TRACE_RATIO: "1" }, "api").ligado).toBe(false);
    expect(configDoOtel({ OBS_TRACE_RATIO: "1", OBS_DEBUG: "1" }, "api")).toMatchObject({ ligado: true, debug: true, projeto: undefined });
  });

  it("ratio fora da faixa é saturado; lixo vira 0", () => {
    expect(configDoOtel({ OBS_TRACE_RATIO: "7", GCP_PROJECT_ID: "p" }, "api").ratio).toBe(1);
    expect(configDoOtel({ OBS_TRACE_RATIO: "-1", GCP_PROJECT_ID: "p" }, "api").ratio).toBe(0);
    expect(configDoOtel({ OBS_TRACE_RATIO: "muito", GCP_PROJECT_ID: "p" }, "api")).toMatchObject({ ratio: 0, ligado: false });
  });

  it("K_REVISION é a versão do serviço; GCP_PROJECT_ID vazio conta como ausente", () => {
    expect(configDoOtel({ K_REVISION: "api-00042-abc" }, "api").versao).toBe("api-00042-abc");
    expect(configDoOtel({ OBS_TRACE_RATIO: "0.5", GCP_PROJECT_ID: "" }, "api").ligado).toBe(false);
  });
});
