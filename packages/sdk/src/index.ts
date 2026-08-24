import { connectToHub } from "./bridge";
import { TelemetryClient } from "./telemetry";
import type { ExperienciaHandle } from "./types";
export * from "./types";

/**
 * Ponto de entrada de TODA experiência:
 *   const exp = await createExperiencia({ expId: "exp-01", expVersion: "1.0.0" });
 */
export async function createExperiencia(meta: {
  expId: string;
  expVersion: string;
  /** origin do hub; em dev o template usa http://localhost:3000 */
  hubOrigin?: string;
}): Promise<ExperienciaHandle> {
  const hubOrigin = meta.hubOrigin ?? new URLSearchParams(location.search).get("hubOrigin") ?? "";
  if (!hubOrigin) throw new Error("hubOrigin ausente (query ?hubOrigin= em dev)");

  const { init, send, onMessage } = await connectToHub({ hubOrigin });
  let token = init.token;
  const sessaoId = crypto.randomUUID();

  // renovação de token orquestrada pelo hub
  onMessage((m) => {
    const msg = m as { type?: string; token?: string };
    if (msg?.type === "hub:token" && msg.token) token = msg.token;
  });
  setInterval(() => send({ type: "exp:token-expirando" }), 45 * 60 * 1000);

  const telemetry = new TelemetryClient({
    apiUrl: init.apiUrl, getToken: () => token, aluno: init.aluno,
    expId: meta.expId, expVersion: meta.expVersion, sessaoId,
  });

  async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${init.apiUrl}${path}`, {
      method,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API ${method} ${path} → ${res.status}`);
    return (await res.json()) as T;
  }

  const handlers: Record<string, Array<() => void>> = { pause: [], resume: [] };
  onMessage((m) => {
    const t = (m as { type?: string })?.type;
    if (t === "hub:pause") handlers.pause?.forEach((cb) => cb());
    if (t === "hub:resume") handlers.resume?.forEach((cb) => cb());
  });

  return {
    aluno: init.aluno,
    config: init.config,
    api: {
      get: (p) => call("GET", p),
      post: (p, b) => call("POST", p, b),
    },
    ai: { gerar: (input) => call("POST", "/ai/gerar", { ...input, expId: meta.expId }) },
    track: (verbo, objeto, dados) => telemetry.track({ verbo, objeto, ...dados }),
    progresso: {
      salvar: (dados) => call("POST", `/progresso/${meta.expId}`, { dados }),
      carregar: async <T,>() => {
        const r = await call<{ dados: T | null }>("GET", `/progresso/${meta.expId}`);
        return r.dados;
      },
    },
    concluir: (payload) => {
      telemetry.track({ verbo: "completed", objeto: meta.expId, resultado: payload });
      void telemetry.flush();
      send({ type: "exp:concluir", payload: payload ?? {} });
    },
    on: (evento, cb) => handlers[evento]?.push(cb),
  };
}
