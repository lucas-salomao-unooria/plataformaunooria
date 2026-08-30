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

/**
 * Reduz o `hubOrigin` recebido a uma ORIGEM confiável — ou falha alto.
 *
 * Ele chega da query string (`?hubOrigin=`), e o bundle da experiência é
 * PÚBLICO: quem abrir `https://cdn/.../index.html?hubOrigin=https://evil.tld`
 * dentro de um iframe próprio escolhe, com essa string, de quem esta
 * experiência aceita `hub:init` (`ev.origin !== hubOrigin`) e para onde vai
 * TUDO que ela envia depois (`targetOrigin`). Sem filtro, o parâmetro é a
 * política de confiança da regra 4 escrita pelo atacante.
 *
 * Três travas, nesta ordem:
 *
 * 1. `new URL(...).origin` — o valor vira uma origem canônica (esquema + host
 *    + porta), nunca uma string com caminho, credencial ou query. Não é só
 *    higiene: `postMessage` compara só a origem, mas a comparação de igualdade
 *    do `handler` NUNCA casaria, e o sintoma seria timeout de handshake em vez
 *    de "o parâmetro está errado".
 * 2. Experiência servida por https exige hub em https — mesma regra do JWKS
 *    ("em produção, https ou nada"). Em dev tudo é http e a trava não incomoda.
 * 3. `location.ancestorOrigins`, quando o navegador publica: é a origem REAL de
 *    quem embedou, e ela VENCE a query string. Firefox não implementa; lá
 *    valem as duas primeiras.
 */
export function normalizarHubOrigin(bruto: string): string {
  let url: URL;
  try {
    url = new URL(bruto);
  } catch {
    throw new Error(`hubOrigin inválido: não é uma URL absoluta (${bruto})`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`hubOrigin inválido: esquema ${url.protocol} não é http(s)`);
  }
  if (url.username || url.password) throw new Error("hubOrigin inválido: traz credencial");

  const origem = url.origin;
  if (origem === "null") throw new Error(`hubOrigin inválido: origem opaca (${bruto})`);

  if (typeof location !== "undefined" && location.protocol === "https:" && url.protocol !== "https:") {
    throw new Error(`hubOrigin inválido: experiência em https não fala com hub em http (${origem})`);
  }

  const ancestrais = typeof location !== "undefined" ? location.ancestorOrigins : undefined;
  // Índice 0 é o ancestral IMEDIATO — o mesmo `window.parent` para quem esta
  // bridge posta. O último da lista é o topo, que numa aninhada seria outro.
  const embedador = ancestrais && ancestrais.length > 0 ? ancestrais[0] : undefined;
  if (embedador && embedador !== origem) {
    throw new Error(
      `hubOrigin (${origem}) não é quem embedou esta experiência (${embedador}) — recusado`,
    );
  }
  return origem;
}

export function connectToHub(opts: { hubOrigin: string; timeoutMs?: number }): Promise<{
  init: HubInit;
  send: (msg: Record<string, unknown>) => void;
  onMessage: (cb: (msg: HubParaExp) => void) => void;
}> {
  // Normaliza aqui também, e não só em createExperiencia: esta é a função que
  // usa o valor como targetOrigin e como filtro de ev.origin. É idempotente.
  const hubOrigin = normalizarHubOrigin(opts.hubOrigin);
  const { timeoutMs = 8000 } = opts;
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
