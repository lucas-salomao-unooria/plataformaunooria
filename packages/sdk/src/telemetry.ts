import type { Estudante, TelemetryEvent } from "./types";
import { novoTraceparent } from "./trace";

export const FLUSH_INTERVAL_MS = 10_000;
export const MAX_BATCH = 50;
/** Teto do buffer em memória: acima disto o mais ANTIGO sai. Sem teto, uma api fora do ar por uma aula inteira acumularia a sessão toda na aba. */
export const MAX_BUFFER = 500;
export const BACKOFF_INICIAL_MS = 1_000;
export const BACKOFF_MAXIMO_MS = 60_000;

/**
 * Buffer local + flush em lote + `sendBeacon` no `pagehide`/`hidden`.
 *
 * Resiliência (cap. 17, fase 1 da SDK): teto de 500 eventos, backoff
 * exponencial entre tentativas (1 s → 60 s, zerado no sucesso), uma tentativa
 * em voo por vez, e o retorno do `sendBeacon` conferido — `false` significa que
 * o navegador recusou (fila cheia) e o lote volta ao buffer em vez de sumir.
 * Offline de verdade a fila continua em memória (IndexedDB é o próximo passo).
 *
 * Toda chamada leva um `traceparent` novo quando o OpenTelemetry Web está
 * desligado: a api ganha `traceId` em 100% dos logs deste caminho.
 */
export class TelemetryClient {
  private buffer: Array<Record<string, unknown>> = [];
  private timer: ReturnType<typeof setInterval>;
  private emVoo = false;
  private backoffMs = 0;
  private proximaTentativaEm = 0;
  /** Quantos eventos o teto derrubou nesta sessão — só em memória, para diagnóstico. */
  descartadosNoCliente = 0;

  constructor(
    private readonly cfg: {
      apiUrl: string;
      getToken: () => string;
      estudante: Estudante;
      expId: string;
      expVersion: string;
      sessaoId: string;
      /** `true` = o OTel Web injeta o cabeçalho; a SDK não gera o próprio. */
      traceparentPeloOtel?: () => boolean;
      fetch?: typeof fetch;
      agora?: () => number;
    },
  ) {
    this.timer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", () => this.flushBeacon());
      // Esconder a ABA (troca de aba, tela bloqueada) não dispara `pagehide`;
      // e é exatamente quando a sessão pode morrer sem aviso.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") this.flushBeacon();
      });
    }
  }

  private agora(): number {
    return (this.cfg.agora ?? Date.now)();
  }

  track(ev: TelemetryEvent): void {
    this.buffer.push({
      eventId: crypto.randomUUID(),
      ts: new Date().toISOString(),
      estudanteId: this.cfg.estudante.id,
      escolaId: this.cfg.estudante.escolaId,
      expId: this.cfg.expId,
      expVersion: this.cfg.expVersion,
      sessaoId: this.cfg.sessaoId,
      ...ev,
    });
    if (this.buffer.length > MAX_BUFFER) {
      this.buffer.splice(0, this.buffer.length - MAX_BUFFER);
      this.descartadosNoCliente += 1;
    }
    if (this.buffer.length >= MAX_BATCH) void this.flush();
  }

  /** Tamanho atual do buffer (diagnóstico e testes). */
  get pendentes(): number {
    return this.buffer.length;
  }

  private cabecalhos(): Record<string, string> {
    const h: Record<string, string> = { "content-type": "application/json", authorization: `Bearer ${this.cfg.getToken()}` };
    if (!this.cfg.traceparentPeloOtel?.()) h.traceparent = novoTraceparent();
    return h;
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0 || this.emVoo) return;
    if (this.agora() < this.proximaTentativaEm) return;
    const batch = this.buffer.splice(0, MAX_BATCH);
    this.emVoo = true;
    try {
      const res = await (this.cfg.fetch ?? fetch)(`${this.cfg.apiUrl}/telemetry/batch`, {
        method: "POST",
        headers: this.cabecalhos(),
        body: JSON.stringify({ eventos: batch }),
        keepalive: true,
      });
      if (!res.ok) {
        this.devolver(batch);
        this.recuar();
      } else {
        this.backoffMs = 0;
        this.proximaTentativaEm = 0;
      }
    } catch {
      this.devolver(batch);
      this.recuar();
    } finally {
      this.emVoo = false;
    }
  }

  private devolver(batch: Array<Record<string, unknown>>): void {
    this.buffer.unshift(...batch);
    if (this.buffer.length > MAX_BUFFER) {
      this.descartadosNoCliente += this.buffer.length - MAX_BUFFER;
      this.buffer.length = MAX_BUFFER;
    }
  }

  private recuar(): void {
    this.backoffMs = this.backoffMs === 0 ? BACKOFF_INICIAL_MS : Math.min(BACKOFF_MAXIMO_MS, this.backoffMs * 2);
    this.proximaTentativaEm = this.agora() + this.backoffMs;
  }

  /** Espera atual entre tentativas (diagnóstico e testes). */
  get backoffAtualMs(): number {
    return this.backoffMs;
  }

  flushBeacon(): void {
    if (this.buffer.length === 0 || typeof navigator === "undefined" || !navigator.sendBeacon) return;
    const lote = this.buffer.slice(0, MAX_BATCH);
    const blob = new Blob([JSON.stringify({ eventos: lote, beacon: true, token: this.cfg.getToken() })], { type: "application/json" });
    // `false` = o navegador recusou (fila de beacons cheia). O lote fica para o próximo flush.
    if (navigator.sendBeacon(`${this.cfg.apiUrl}/telemetry/beacon`, blob)) {
      this.buffer.splice(0, lote.length);
    }
  }

  destroy(): void {
    clearInterval(this.timer);
  }
}
