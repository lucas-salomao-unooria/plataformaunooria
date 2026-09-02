/**
 * A decisão de ligar o OpenTelemetry, isolada do SDK para ser testável e para
 * o `otel.ts` — que roda antes do Zod do ConfigModule — ler o ambiente cru.
 *
 * Ligado = `OBS_TRACE_RATIO > 0` E (há projeto GCP OU `OBS_DEBUG=1`). Em teste
 * e no `nest start --watch` sem as envs, nada é instanciado: nem exportador,
 * nem instrumentação. `OBS_DEBUG=1` sem projeto imprime os spans no console —
 * é como se vê um trace em dev sem GCP.
 */
export interface ConfigDoOtel {
  ligado: boolean;
  ratio: number;
  projeto?: string;
  debug: boolean;
  servico: string;
  versao: string;
}

export function configDoOtel(env: Record<string, string | undefined>, servico: string): ConfigDoOtel {
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
