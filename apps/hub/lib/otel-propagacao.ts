import { context, propagation } from "@opentelemetry/api";
import { lerTrace, traceparentPara } from "./trace-da-requisicao";

/**
 * O `traceparent` que uma chamada de saída (api) deve levar. Com o SDK ligado,
 * o span ativo do Next é o pai — `propagation.inject` escreve o cabeçalho.
 * Sem SDK (dev, teste), a API do OpenTelemetry é no-op e não escreve nada:
 * aí repassa-se o `traceparent` que a requisição de origem trouxe (do
 * navegador ou do LB), para o trace ainda atravessar hub → api.
 */
export function traceparentDeSaida(cabecalhosDeEntrada: Record<string, string | string[] | undefined> | undefined): string | undefined {
  const injetado: Record<string, string> = {};
  propagation.inject(context.active(), injetado);
  return injetado.traceparent ?? traceparentPara(lerTrace(cabecalhosDeEntrada ?? {}));
}
