import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { configDoOtel } from "../src/observabilidade/otel-config";
import { recursoDoOtel } from "../src/observabilidade/recurso";

/**
 * Regressão medida em dev (2026-09-02): sem `gcp.project_id` no resource, a
 * Telemetry API do Google recusa TODO lote de métrica com
 * `HTTP 400 Resource is missing required attribute "gcp.project_id"` — a cada
 * 60 s, para sempre, enquanto log e trace seguem funcionando. A falha é
 * silenciosa para quem olha o painel: simplesmente não nasce série nenhuma.
 */
describe("recursoDoOtel", () => {
  it("carrega gcp.project_id quando há projeto — é o que a ingestão OTLP exige", () => {
    const attrs = recursoDoOtel(configDoOtel({ OBS_TRACE_RATIO: "0.02", GCP_PROJECT_ID: "entre-redes-dev", K_REVISION: "api-42" }, "api"));
    expect(attrs).toMatchObject({
      [ATTR_SERVICE_NAME]: "api",
      [ATTR_SERVICE_VERSION]: "api-42",
      "gcp.project_id": "entre-redes-dev",
    });
    // e o resource do SDK aceita o mesmo objeto
    expect(resourceFromAttributes(attrs).attributes["gcp.project_id"]).toBe("entre-redes-dev");
  });

  it("sem projeto (dev com OBS_DEBUG) não inventa o atributo", () => {
    const attrs = recursoDoOtel(configDoOtel({ OBS_TRACE_RATIO: "1", OBS_DEBUG: "1" }, "api"));
    expect(attrs).not.toHaveProperty("gcp.project_id");
    expect(attrs[ATTR_SERVICE_NAME]).toBe("api");
  });
});
