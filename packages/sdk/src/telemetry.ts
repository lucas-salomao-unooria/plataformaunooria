import type { Estudante, TelemetryEvent } from "./types";

const FLUSH_INTERVAL_MS = 10_000;
const MAX_BATCH = 50;

/** Buffer local + flush em lote + sendBeacon no unload. Offline: fila em memória
 *  (IndexedDB é o próximo passo — ver TODO). */
export class TelemetryClient {
  private buffer: Array<Record<string, unknown>> = [];
  private timer: ReturnType<typeof setInterval>;

  constructor(
    private readonly cfg: {
      apiUrl: string;
      getToken: () => string;
      estudante: Estudante;
      expId: string;
      expVersion: string;
      sessaoId: string;
    },
  ) {
    this.timer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
    window.addEventListener("pagehide", () => this.flushBeacon());
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
    if (this.buffer.length >= MAX_BATCH) void this.flush();
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0, MAX_BATCH);
    try {
      const res = await fetch(`${this.cfg.apiUrl}/telemetry/batch`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.cfg.getToken()}` },
        body: JSON.stringify({ eventos: batch }),
        keepalive: true,
      });
      if (!res.ok) this.buffer.unshift(...batch); // devolve pro buffer; TODO: IndexedDB p/ offline real
    } catch {
      this.buffer.unshift(...batch);
    }
  }

  private flushBeacon(): void {
    if (this.buffer.length === 0) return;
    const blob = new Blob(
      [JSON.stringify({ eventos: this.buffer, beacon: true, token: this.cfg.getToken() })],
      { type: "application/json" },
    );
    navigator.sendBeacon(`${this.cfg.apiUrl}/telemetry/beacon`, blob);
    this.buffer = [];
  }

  destroy(): void { clearInterval(this.timer); }
}
