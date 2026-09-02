/**
 * A decisão de ligar o OpenTelemetry no hub, isolada do SDK para ser testável
 * e para o `instrumentation.ts` ler o ambiente cru. Mesma regra da api
 * (`apps/api/src/observabilidade/otel-config.ts`): ligado = ratio > 0 E (há
 * projeto GCP OU `OBS_DEBUG=1`).
 */
export interface ConfigDoOtel {
  ligado: boolean;
  ratio: number;
  projeto?: string;
  debug: boolean;
  servico: string;
  versao: string;
}

export function configDoOtel(env: Record<string, string | undefined>, servico = "hub"): ConfigDoOtel {
  const bruto = Number(env.OBS_TRACE_RATIO ?? "0");
  const ratio = Number.isFinite(bruto) ? Math.min(1, Math.max(0, bruto)) : 0;
  const projeto = env.GCP_PROJECT_ID || undefined;
  const debug = env.OBS_DEBUG === "1";
  return {
    ligado: ratio > 0 && (Boolean(projeto) || debug),
    ratio,
    projeto,
    debug,
    servico,
    versao: env.K_REVISION ?? "dev",
  };
}
