import {
  HubInitSchema,
  HubParaExpSchema,
  PROTOCOL_VERSION,
  type HubInit,
  type HubParaExp,
} from "./types";

/**
 * Handshake experiência ⇄ hub via postMessage.
 * Segurança: origin do hub é validada; token nunca sai da memória; mensagem
 * pós-init que não passa no schema é DESCARTADA com aviso — nunca despachada
 * crua aos listeners (regra: Zod em todo postMessage recebido).
 */
/** Intervalo de reenvio do exp:ready enquanto o hub não responde. */
export const READY_RETRY_MS = 400;

export function connectToHub(opts: { hubOrigin: string; timeoutMs?: number }): Promise<{
  init: HubInit;
  send: (msg: Record<string, unknown>) => void;
  onMessage: (cb: (msg: HubParaExp) => void) => void;
}> {
  const { hubOrigin, timeoutMs = 8000 } = opts;
  return new Promise((resolve, reject) => {
    const listeners: Array<(m: HubParaExp) => void> = [];
    let conectado = false;

    /**
     * `exp:ready` é REENVIADO até o hub responder: com os assets em cache (F5),
     * a experiência fica pronta antes de o ExpFrame do hub hidratar o listener,
     * e um único disparo se perderia — o handshake expiraria sem culpa de ninguém.
     * O hub responde a cada um com hub:init; só o primeiro conta.
     */
    const anunciar = () =>
      window.parent.postMessage({ type: "exp:ready", protocolVersion: PROTOCOL_VERSION }, hubOrigin);
    const reenvio = setInterval(anunciar, READY_RETRY_MS);
    const timer = setTimeout(() => {
      clearInterval(reenvio);
      window.removeEventListener("message", handler);
      reject(new Error("Timeout no handshake com o hub"));
    }, timeoutMs);

    function handler(ev: MessageEvent) {
      if (ev.origin !== hubOrigin) return; // regra inviolável: valida origin

      if (!conectado) {
        const init = HubInitSchema.safeParse(ev.data);
        if (!init.success) return; // antes do init, qualquer outra coisa é ruído
        // Versão MAIOR do protocolo precisa bater — hub e experiência de
        // gerações diferentes falham alto, não silenciosamente.
        if (Math.trunc(init.data.protocolVersion) !== PROTOCOL_VERSION) {
          clearTimeout(timer);
          clearInterval(reenvio);
          window.removeEventListener("message", handler);
          reject(
            new Error(
              `Protocolo incompatível: hub v${init.data.protocolVersion}, experiência v${PROTOCOL_VERSION}`,
            ),
          );
          return;
        }
        conectado = true;
        clearTimeout(timer);
        clearInterval(reenvio);
        resolve({
          init: init.data,
          send: (msg) => window.parent.postMessage(msg, hubOrigin),
          onMessage: (cb) => listeners.push(cb),
        });
        return;
      }

      // hub:init repetido (resposta a um exp:ready reenviado) não é ruído nem erro.
      if ((ev.data as { type?: unknown })?.type === "hub:init") return;
      const msg = HubParaExpSchema.safeParse(ev.data);
      if (!msg.success) {
        console.warn("[sdk] mensagem do hub descartada (schema):", (ev.data as { type?: string })?.type);
        return;
      }
      listeners.forEach((cb) => cb(msg.data));
    }
    window.addEventListener("message", handler);
    anunciar();
  });
}
