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
export function connectToHub(opts: { hubOrigin: string; timeoutMs?: number }): Promise<{
  init: HubInit;
  send: (msg: Record<string, unknown>) => void;
  onMessage: (cb: (msg: HubParaExp) => void) => void;
}> {
  const { hubOrigin, timeoutMs = 8000 } = opts;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout no handshake com o hub")), timeoutMs);
    const listeners: Array<(m: HubParaExp) => void> = [];
    let conectado = false;

    function handler(ev: MessageEvent) {
      if (ev.origin !== hubOrigin) return; // regra inviolável: valida origin

      if (!conectado) {
        const init = HubInitSchema.safeParse(ev.data);
        if (!init.success) return; // antes do init, qualquer outra coisa é ruído
        // Versão MAIOR do protocolo precisa bater — hub e experiência de
        // gerações diferentes falham alto, não silenciosamente.
        if (Math.trunc(init.data.protocolVersion) !== PROTOCOL_VERSION) {
          clearTimeout(timer);
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
        resolve({
          init: init.data,
          send: (msg) => window.parent.postMessage(msg, hubOrigin),
          onMessage: (cb) => listeners.push(cb),
        });
        return;
      }

      const msg = HubParaExpSchema.safeParse(ev.data);
      if (!msg.success) {
        console.warn("[sdk] mensagem do hub descartada (schema):", (ev.data as { type?: string })?.type);
        return;
      }
      listeners.forEach((cb) => cb(msg.data));
    }
    window.addEventListener("message", handler);
    window.parent.postMessage({ type: "exp:ready", protocolVersion: PROTOCOL_VERSION }, hubOrigin);
  });
}
