/**
 * O ÁUDIO DO MASCOTE (ADR-158) — portado do PoC `poc-mascote-visemas`.
 *
 * Toca a fala do Gemini (PCM 16-bit, 24 kHz) sem estalos, mede o que se ouve
 * para o lip sync, e captura o microfone em PCM 16 kHz para mandar de volta.
 * Só navegador: nada aqui roda no servidor.
 */

export class AudioDaFala {
  ctx: AudioContext | null = null;
  analisador: AnalyserNode | null = null;
  private entrada: GainNode | null = null;
  private atraso: DelayNode | null = null;
  private readonly fontes = new Set<AudioBufferSourceNode>();
  private proximo = 0;
  private resto: Uint8Array | null = null;
  private antecipacao = 0.06;

  /** Precisa de um gesto da pessoa (o clique em "Ajuda") por causa da política de autoplay. */
  async iniciar(): Promise<void> {
    if (!this.ctx) {
      const ctx = new AudioContext({ latencyHint: "interactive" });
      this.ctx = ctx;
      this.entrada = ctx.createGain();
      this.analisador = ctx.createAnalyser();
      this.analisador.fftSize = 2048;
      this.analisador.smoothingTimeConstant = 0;
      // o analisador mede ANTES do atraso: a boca se mexe um pouco antes do som,
      // como na fala real, e isso compensa a janela da análise
      this.atraso = ctx.createDelay(1);
      this.atraso.delayTime.value = this.antecipacao;
      this.entrada.connect(this.analisador);
      this.entrada.connect(this.atraso).connect(ctx.destination);
    }
    if (this.ctx.state !== "running") await this.ctx.resume();
  }

  definirAntecipacao(segundos: number): void {
    this.antecipacao = segundos;
    if (this.atraso && this.ctx) this.atraso.delayTime.setTargetAtTime(segundos, this.ctx.currentTime, 0.05);
  }

  /** Enfileira um pedaço de PCM 16-bit little-endian que chegou em base64. */
  tocarPcm16(base64: string, taxa = 24000): void {
    const ctx = this.ctx;
    if (!ctx || !this.entrada) return;
    let bytes = base64ParaBytes(base64);
    if (this.resto) {
      const junto = new Uint8Array(this.resto.length + bytes.length);
      junto.set(this.resto);
      junto.set(bytes, this.resto.length);
      bytes = junto;
      this.resto = null;
    }
    if (bytes.length % 2) {
      // amostra partida entre dois pedaços: o byte que sobra vai com o próximo
      this.resto = bytes.slice(-1);
      bytes = bytes.subarray(0, bytes.length - 1);
    }
    const n = bytes.length >> 1;
    if (!n) return;
    const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const amostras = new Float32Array(n);
    for (let i = 0; i < n; i++) amostras[i] = vista.getInt16(i * 2, true) / 32768;
    const buffer = ctx.createBuffer(1, n, taxa);
    buffer.copyToChannel(amostras, 0);
    const fonte = ctx.createBufferSource();
    fonte.buffer = buffer;
    fonte.connect(this.entrada);
    const agora = ctx.currentTime;
    // folga contra a variação da rede: se a fila esvaziou, recomeça um pouco à frente
    if (this.proximo < agora + 0.02) this.proximo = agora + 0.1;
    fonte.start(this.proximo);
    this.proximo += buffer.duration;
    this.fontes.add(fonte);
    fonte.onended = () => this.fontes.delete(fonte);
  }

  /** Para tudo o que está na fila (a pessoa interrompeu, ou começou um turno novo). */
  interromper(): void {
    for (const fonte of this.fontes) {
      try {
        fonte.stop();
      } catch {
        // já tinha parado
      }
    }
    this.fontes.clear();
    this.proximo = 0;
    this.resto = null;
  }

  /** Há fala tocando ou na fila (contando o atraso da antecipação). */
  get falando(): boolean {
    if (!this.ctx || !this.atraso) return false;
    return this.proximo + this.atraso.delayTime.value > this.ctx.currentTime;
  }

  async fechar(): Promise<void> {
    this.interromper();
    const ctx = this.ctx;
    this.ctx = null;
    this.analisador = null;
    this.entrada = null;
    this.atraso = null;
    if (ctx && ctx.state !== "closed") await ctx.close().catch(() => undefined);
  }
}

// Roda na thread de áudio: reamostra o microfone para 16 kHz e converte para PCM 16-bit.
const CODIGO_CAPTURA = `
class Captura16k extends AudioWorkletProcessor {
  constructor(opcoes) {
    super();
    this.razao = opcoes.processorOptions.taxa / 16000;
    this.pos = 0;
    this.ultimo = 0;
    this.saida = new Int16Array(1600); // 100 ms por mensagem
    this.n = 0;
  }
  process(entradas) {
    const x = entradas[0] && entradas[0][0];
    if (!x || !x.length) return true;
    while (this.pos < x.length - 1) {
      let v;
      if (this.pos < 0) {
        v = this.ultimo + (x[0] - this.ultimo) * (this.pos + 1);
      } else {
        const i = Math.floor(this.pos);
        v = x[i] + (x[i + 1] - x[i]) * (this.pos - i);
      }
      v = Math.max(-1, Math.min(1, v));
      this.saida[this.n++] = v < 0 ? v * 0x8000 : v * 0x7fff;
      if (this.n === this.saida.length) {
        const pedaco = this.saida.slice(0);
        this.port.postMessage(pedaco.buffer, [pedaco.buffer]);
        this.n = 0;
      }
      this.pos += this.razao;
    }
    this.pos -= x.length;
    this.ultimo = x[x.length - 1];
    return true;
  }
}
registerProcessor("captura-16k", Captura16k);
`;

export class Microfone {
  ativo = false;
  private moduloCarregado = false;
  private stream: MediaStream | null = null;
  private fonte: MediaStreamAudioSourceNode | null = null;
  private no: AudioWorkletNode | null = null;
  private mudo: GainNode | null = null;

  constructor(private readonly audio: AudioDaFala) {}

  /** Liga o microfone; `aoPedaco(base64)` recebe 100 ms de PCM 16 kHz por vez. */
  async ligar(aoPedaco: (base64: string) => void): Promise<void> {
    const ctx = this.audio.ctx;
    if (!ctx) throw new Error("o áudio não foi iniciado");
    if (!this.moduloCarregado) {
      const url = URL.createObjectURL(new Blob([CODIGO_CAPTURA], { type: "text/javascript" }));
      try {
        await ctx.audioWorklet.addModule(url);
      } finally {
        URL.revokeObjectURL(url);
      }
      this.moduloCarregado = true;
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.fonte = ctx.createMediaStreamSource(this.stream);
    this.no = new AudioWorkletNode(ctx, "captura-16k", { processorOptions: { taxa: ctx.sampleRate } });
    this.no.port.onmessage = (ev: MessageEvent<ArrayBuffer>) => aoPedaco(bytesParaBase64(new Uint8Array(ev.data)));
    // ganho zero até a saída: mantém o nó sendo processado sem tocar o microfone
    this.mudo = ctx.createGain();
    this.mudo.gain.value = 0;
    this.fonte.connect(this.no).connect(this.mudo).connect(ctx.destination);
    this.ativo = true;
  }

  desligar(): void {
    this.fonte?.disconnect();
    this.no?.disconnect();
    this.mudo?.disconnect();
    if (this.no) this.no.port.onmessage = null;
    for (const trilha of this.stream?.getTracks() ?? []) trilha.stop();
    this.fonte = null;
    this.no = null;
    this.mudo = null;
    this.stream = null;
    this.ativo = false;
  }
}

export function base64ParaBytes(base64: string): Uint8Array {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

export function bytesParaBase64(bytes: Uint8Array): string {
  let binario = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binario);
}
