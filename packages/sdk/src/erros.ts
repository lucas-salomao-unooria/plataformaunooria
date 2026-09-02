/**
 * Captura de erro não tratado dentro da experiência (ADR-58): `error` e
 * `unhandledrejection` viram UM `POST /observabilidade/erros-cliente` cada —
 * com dedupe por hash da mensagem + primeira linha da stack, teto de 5 envios
 * por sessão e stack cortada em 8 KB. Um laço de erro num `setInterval` gera
 * milhares de eventos por segundo; sem o teto a experiência derrubaria a
 * própria cota (e a api responderia 429 de qualquer jeito).
 *
 * Falha ao REPORTAR é engolida: erro ao reportar erro é o laço clássico.
 *
 * O erro pré-handshake (timeout do `connectToHub`) não passa por aqui: nesse
 * momento não há token. Ele fica no console — e o sinal dele é o hub, que vê
 * o handshake não fechar.
 */
export const MAX_ERROS_POR_SESSAO = 5;
export const MAX_STACK_BYTES = 8_192;
export const MAX_MENSAGEM_BYTES = 2_048;

export interface ErroDeCliente {
  expId: string;
  versao: string;
  mensagem: string;
  stack?: string;
  url: string;
  userAgent?: string;
  sessaoId: string;
  traceId?: string;
  spanId?: string;
}

export interface OpcoesDaCaptura {
  expId: string;
  versao: string;
  sessaoId: string;
  enviar: (erro: ErroDeCliente) => Promise<unknown>;
  /** `exp:erro` para o hub trocar a tela. Opcional: o registro não depende dele. */
  notificarHub?: (resumo: { mensagem: string; hash: string }) => void;
  /** Span ativo no navegador, quando o OTel Web está ligado. */
  traceAtivo?: () => { traceId: string; spanId: string } | undefined;
  alvo?: Window;
}

/** FNV-1a de 32 bits: pequeno, determinístico, sem dependência. */
export function hashCurto(texto: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function descreverErro(bruto: unknown): { mensagem: string; stack?: string } {
  if (bruto instanceof Error) {
    return { mensagem: (bruto.message || bruto.name || "Erro").slice(0, MAX_MENSAGEM_BYTES), stack: bruto.stack?.slice(0, MAX_STACK_BYTES) };
  }
  if (typeof bruto === "string") return { mensagem: bruto.slice(0, MAX_MENSAGEM_BYTES) };
  try {
    return { mensagem: JSON.stringify(bruto).slice(0, MAX_MENSAGEM_BYTES) };
  } catch {
    return { mensagem: "erro não serializável" };
  }
}

export function instalarCapturaDeErros(o: OpcoesDaCaptura): { reportar: (erro: unknown) => void; desinstalar: () => void } {
  const alvo = o.alvo ?? window;
  const vistos = new Set<string>();
  let enviados = 0;

  function reportar(bruto: unknown): void {
    const { mensagem, stack } = descreverErro(bruto);
    const hash = hashCurto(`${mensagem}\n${stack?.split("\n")[1] ?? ""}`);
    o.notificarHub?.({ mensagem: mensagem.slice(0, 256), hash });
    if (vistos.has(hash) || enviados >= MAX_ERROS_POR_SESSAO) return;
    vistos.add(hash);
    enviados += 1;
    const trace = o.traceAtivo?.();
    const erro: ErroDeCliente = {
      expId: o.expId,
      versao: o.versao,
      mensagem,
      stack,
      // Só origem + caminho: a query carrega `hubOrigin` e pode carregar id.
      url: `${alvo.location.origin}${alvo.location.pathname}`.slice(0, 512),
      userAgent: alvo.navigator?.userAgent?.slice(0, 256),
      sessaoId: o.sessaoId,
      ...(trace ? { traceId: trace.traceId, spanId: trace.spanId } : {}),
    };
    void o.enviar(erro).catch(() => undefined);
  }

  const aoErrar = (ev: ErrorEvent) => reportar(ev.error ?? ev.message);
  const aoRejeitar = (ev: PromiseRejectionEvent) => reportar(ev.reason);
  alvo.addEventListener("error", aoErrar);
  alvo.addEventListener("unhandledrejection", aoRejeitar);

  return {
    reportar,
    desinstalar: () => {
      alvo.removeEventListener("error", aoErrar);
      alvo.removeEventListener("unhandledrejection", aoRejeitar);
    },
  };
}
