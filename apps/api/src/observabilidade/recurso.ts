import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import type { ConfigDoOtel } from "./otel-config";

/**
 * Os atributos de `resource` que todo sinal OpenTelemetry deste processo
 * carrega. Separado do `otel.ts` para ser testável: o `otel.ts` roda antes do
 * Nest e instancia o SDK inteiro só de ser importado.
 *
 * `gcp.project_id` é OBRIGATÓRIO para a ingestão OTLP do Google e o
 * `gcpDetector` não o preenche (ele traz `cloud.account.id`, que a Telemetry
 * API não aceita no lugar) — ver `observabilidade-otel-recurso.spec.ts`.
 */
export function recursoDoOtel(config: ConfigDoOtel): Record<string, string> {
  return {
    [ATTR_SERVICE_NAME]: config.servico,
    [ATTR_SERVICE_VERSION]: config.versao,
    ...(config.projeto ? { "gcp.project_id": config.projeto } : {}),
  };
}
