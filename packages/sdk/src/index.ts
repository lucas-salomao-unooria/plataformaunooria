import { connectToHub, normalizarHubOrigin } from "./bridge";
import { TelemetryClient } from "./telemetry";
import type { ExperienciaHandle, OpcoesDeChamada } from "./types";
export * from "./types";

type MetodoHttp = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

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
  const bruto = meta.hubOrigin ?? new URLSearchParams(location.search).get("hubOrigin") ?? "";
  if (!bruto) throw new Error("hubOrigin ausente (query ?hubOrigin= em dev)");
  // A query string é ATACANTE-CONTROLÁVEL e decide de quem esta experiência
  // aceita o hub:init — ver normalizarHubOrigin.
  const hubOrigin = normalizarHubOrigin(bruto);

  const { init, send, onMessage } = await connectToHub({ hubOrigin });
  let token = init.token;
  const sessaoId = crypto.randomUUID();

  const handlers: Record<"pause" | "resume", Array<() => void>> = { pause: [], resume: [] };

  // Mensagens pós-init já chegam validadas pelo schema (bridge.ts).
  onMessage((msg) => {
    if (msg.type === "hub:token") token = msg.token;
    if (msg.type === "hub:pause") handlers.pause.forEach((cb) => cb());
    if (msg.type === "hub:resume") handlers.resume.forEach((cb) => cb());
  });
  setInterval(() => send({ type: "exp:token-expirando" }), 10 * 60 * 1000); // TTL do token é 15min

  const telemetry = new TelemetryClient({
    apiUrl: init.apiUrl, getToken: () => token, aluno: init.aluno,
    expId: meta.expId, expVersion: meta.expVersion, sessaoId,
  });

  /**
   * Fetch com timeout e retry: GET tenta de novo em falha de rede/5xx
   * (idempotente); POST/PUT/PATCH/DELETE NUNCA — o caller decide se reenvia.
   *
   * O timeout default segue 10s. Rota que espera geração de texto passa
   * `timeoutMs` explícito (ver `OpcoesDeChamada`) — é decisão de QUEM CHAMA,
   * porque só ela sabe se o que está do outro lado é um SELECT ou um modelo.
   */
  const TIMEOUT_PADRAO_MS = 10_000;

  async function call<T>(
    method: MetodoHttp,
    path: string,
    body?: unknown,
    opcoes?: OpcoesDeChamada,
  ): Promise<T> {
    const tentativas = method === "GET" ? 2 : 1;
    let ultimoErro: unknown;
    for (let i = 0; i < tentativas; i += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), opcoes?.timeoutMs ?? TIMEOUT_PADRAO_MS);
      try {
        const res = await fetch(`${init.apiUrl}${path}`, {
          method,
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        });
        if (!res.ok) {
          if (method === "GET" && res.status >= 500 && i + 1 < tentativas) {
            ultimoErro = new Error(`API ${method} ${path} → ${res.status}`);
            continue;
          }
          throw new Error(`API ${method} ${path} → ${res.status}`);
        }
        return (await res.json()) as T;
      } catch (erro) {
        ultimoErro = erro;
        if (method !== "GET" || i + 1 >= tentativas) throw erro;
      } finally {
        clearTimeout(timer);
      }
    }
    throw ultimoErro;
  }

  return {
    aluno: init.aluno,
    config: init.config,
    api: {
      get: (p, o) => call("GET", p, undefined, o),
      post: (p, b, o) => call("POST", p, b, o),
      put: (p, b, o) => call("PUT", p, b, o),
      patch: (p, b, o) => call("PATCH", p, b, o),
      delete: (p, o) => call("DELETE", p, undefined, o),
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
    enviarEstado: (estado) => send({ type: "exp:estado", estado }),
  };
}
