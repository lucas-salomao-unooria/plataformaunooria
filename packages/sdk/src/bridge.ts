import { HubInitSchema, PROTOCOL_VERSION, type HubInit } from "./types";

/**
 * Handshake experiência ⇄ hub via postMessage.
 * Segurança: origin do hub é validada; token nunca sai da memória.
 */
export function connectToHub(opts: { hubOrigin: string; timeoutMs?: number }): Promise<{
  init: HubInit;
  send: (msg: Record<string, unknown>) => void;
  onMessage: (cb: (msg: unknown) => void) => void;
}> {
  const { hubOrigin, timeoutMs = 8000 } = opts;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout no handshake com o hub")), timeoutMs);
    const listeners: Array<(m: unknown) => void> = [];

    function handler(ev: MessageEvent) {
      if (ev.origin !== hubOrigin) return; // regra inviolável: valida origin
      const parsed = HubInitSchema.safeParse(ev.data);
      if (parsed.success) {
        clearTimeout(timer);
        resolve({
          init: parsed.data,
          send: (msg) => window.parent.postMessage(msg, hubOrigin),
          onMessage: (cb) => listeners.push(cb),
        });
      } else {
        listeners.forEach((cb) => cb(ev.data));
      }
    }
    window.addEventListener("message", handler);
    window.parent.postMessage({ type: "exp:ready", protocolVersion: PROTOCOL_VERSION }, hubOrigin);
  });
}
