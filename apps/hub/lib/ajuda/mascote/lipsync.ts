/**
 * O LIP SYNC DO MASCOTE (ADR-158), a partir do áudio — portado do PoC
 * `poc-mascote-visemas` (out/2026) sem mudar a análise.
 *
 * O Gemini Live entrega só o som (PCM), sem visemas nem marcação de tempo;
 * então, a cada quadro, a boca sai do que se está ouvindo:
 *   nível (RMS)            -> quanto a boca abre, e as pausas (boca fechada)
 *   formantes F1/F2 (LPC)  -> qual vogal (a, é, ê, i, ó, ô, u)
 *   energia acima de 4 kHz -> chiados (s, z, x, ch, j) e fricativas (f, v)
 * O resultado é uma distribuição sobre os 15 visemas da Meta/Oculus (soma 1).
 *
 * Duas armadilhas MEDIDAS no PoC com vogais isoladas lidas pelo Gemini (Leda e
 * Charon), e que este código já contorna — não "simplifique" de volta:
 * - Fração de energia LINEAR por banda não detecta nasal: a fundamental domina
 *   (mediana de 98% abaixo de 500 Hz) e i/u/ô viravam "nn". Não há detector de
 *   nasal; m/b/p saem das quedas de nível (PP).
 * - LPC: nas vogais posteriores (ó, u) o F2 funde com o F1, e o "F2" achado é o
 *   F3 — "u" virava "i". O equilíbrio do envelope marca a posterior, e aí
 *   F2 ≈ 1,6·F1. Depois disso, 10/10 vogais certas.
 */

export const VISEMAS = [
  "viseme_sil", "viseme_PP", "viseme_FF", "viseme_TH", "viseme_DD",
  "viseme_kk", "viseme_CH", "viseme_SS", "viseme_nn", "viseme_RR",
  "viseme_aa", "viseme_E", "viseme_I", "viseme_O", "viseme_U",
] as const;
type NomeCurto = (typeof VISEMAS)[number] extends `viseme_${infer N}` ? N : never;

const IX = Object.fromEntries(VISEMAS.map((nome, i) => [nome.slice("viseme_".length), i])) as Record<NomeCurto, number>;

interface Vogal {
  f1: number;
  f2: number;
  alvo: Partial<Record<NomeCurto, number>>;
  l1: number;
  l2: number;
}

// Vogais orais do português brasileiro: F1/F2 médios (Hz) de voz feminina adulta.
// Vozes mais graves são corrigidas em tempo real pela escala do falante.
const VOGAIS: Vogal[] = (
  [
    { f1: 850, f2: 1550, alvo: { aa: 1 } }, // a
    { f1: 620, f2: 2150, alvo: { E: 1 } }, // é
    { f1: 440, f2: 2350, alvo: { E: 0.55, I: 0.45 } }, // ê
    { f1: 320, f2: 2700, alvo: { I: 1 } }, // i
    { f1: 620, f2: 1050, alvo: { O: 1 } }, // ó
    { f1: 440, f2: 920, alvo: { O: 0.55, U: 0.45 } }, // ô
    { f1: 340, f2: 860, alvo: { U: 1 } }, // u
  ] as Array<Omit<Vogal, "l1" | "l2">>
).map((v) => ({ ...v, l1: Math.log(v.f1), l2: Math.log(v.f2) }));
const L2_REFERENCIA = VOGAIS.reduce((soma, v) => soma + v.l2, 0) / VOGAIS.length;
const DESVIO_L1 = 0.22; // largura de cada vogal no espaço log-formante (~22% em F1)
const DESVIO_L2 = 0.17; // (~17% em F2)
// consoante sem formante claro: boca meio aberta, típica de t, d, k, g, l, n
const GENERICA: Partial<Record<NomeCurto, number>> = { DD: 0.45, kk: 0.35, nn: 0.2 };

/** `alvo[i] += v`, que o `noUncheckedIndexedAccess` não aceita direto num índice calculado. */
const somar = (alvo: Float32Array, i: number, v: number) => {
  alvo[i] = (alvo[i] ?? 0) + v;
};

const limitar = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const suave = (a: number, b: number, x: number) => {
  const t = limitar((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** O pedaço do `AnalyserNode` que o lip sync lê — o teste o imita. */
export interface Analisador {
  fftSize: number;
  frequencyBinCount: number;
  context: { sampleRate: number };
  getFloatTimeDomainData(destino: Float32Array<ArrayBuffer>): void;
  getFloatFrequencyData(destino: Float32Array<ArrayBuffer>): void;
}

export interface AjustesDoLipSync {
  /** 0 a 1: quantos dB abaixo do pico ainda abrem a boca. */
  sensibilidade: number;
  /** 0 a 1: o quanto a boca demora para abrir e fechar. */
  suavizacao: number;
}

export class LipSync {
  readonly pesos = new Float32Array(VISEMAS.length);
  private readonly alvo = new Float32Array(VISEMAS.length);
  private pico = -30; // dBFS do trecho mais alto recente
  private l2Falante = L2_REFERENCIA; // média de ln F2 de quem está falando
  private tempo = 0;
  private ultimaFala = -10;
  private amostras = new Float32Array(0);
  private espectro = new Float32Array(0);
  private dizimado = new Float32Array(0);
  private envelope = new Float32Array(160);
  ajustes: AjustesDoLipSync = { sensibilidade: 0.5, suavizacao: 0.5 };
  /** O nível da fala no último quadro (0 a 1) — vira o aceno da cabeça. */
  nivel = 0;

  constructor() {
    this.pesos[IX.sil] = 1;
  }

  /** Lê o analisador e devolve os pesos dos 15 visemas (somam 1). */
  quadro(analisador: Analisador, dt: number): Float32Array {
    this.tempo += dt;
    this.preparar(analisador);
    analisador.getFloatTimeDomainData(this.amostras);
    analisador.getFloatFrequencyData(this.espectro);
    const fs = analisador.context.sampleRate;

    const nivel = this.medirNivel(dt);
    const bandas = this.medirBandas(fs);
    const [f1, f2, clareza] = nivel > 0.08 && bandas.agudo < 0.4 ? this.formantes(fs) : [0, 0, 0];
    this.montarAlvo(nivel, bandas, f1, f2, clareza, dt);
    this.suavizar(dt);
    this.nivel = nivel;
    return this.pesos;
  }

  /** Volta ao repouso na hora (ex.: o mascote foi interrompido). */
  zerar(): void {
    this.pesos.fill(0);
    this.pesos[IX.sil] = 1;
    this.nivel = 0;
  }

  private preparar(analisador: Analisador): void {
    if (this.amostras.length === analisador.fftSize) return;
    this.amostras = new Float32Array(analisador.fftSize);
    this.espectro = new Float32Array(analisador.frequencyBinCount);
    this.dizimado = new Float32Array(analisador.fftSize);
  }

  /** Nível de 0 a 1, relativo ao trecho mais alto recente: independe do volume da voz. */
  private medirNivel(dt: number): number {
    let soma = 0;
    for (let i = 0; i < this.amostras.length; i++) soma += this.amostras[i]! * this.amostras[i]!;
    const db = 10 * Math.log10(soma / this.amostras.length + 1e-12);
    this.pico = Math.max(db, this.pico - 2.5 * dt, -45);
    const faixa = 22 + 16 * this.ajustes.sensibilidade; // quantos dB abaixo do pico ainda abrem a boca
    const piso = Math.max(this.pico - faixa, -62);
    return limitar((db - piso) / Math.max(this.pico - 5 - piso, 1), 0, 1);
  }

  /** Fração da energia acima de 4 kHz (chiados) e o centroide acima de 1 kHz. */
  private medirBandas(fs: number): { agudo: number; centroide: number } {
    const hz = fs / (2 * this.espectro.length);
    let total = 0;
    let agudo = 0;
    let ponderado = 0;
    let acima1k = 0;
    for (let k = 1; k < this.espectro.length; k++) {
      const f = k * hz;
      if (f < 80) continue;
      if (f > 10000) break;
      const p = 10 ** (this.espectro[k]! / 10);
      total += p;
      if (f >= 4000) agudo += p;
      if (f > 1000) {
        ponderado += f * p;
        acima1k += p;
      }
    }
    return { agudo: agudo / (total + 1e-20), centroide: acima1k > 0 ? ponderado / acima1k : 0 };
  }

  /** F1 e F2 pelos picos do envelope LPC (sem achar raízes) e a clareza deles (0 a 1). */
  private formantes(fs: number): [number, number, number] {
    const d = Math.max(1, Math.round(fs / 11025)); // ~11-12 kHz bastam para F1/F2
    const fsd = fs / d;
    const n = Math.floor(this.amostras.length / d);
    const x = this.dizimado;
    let anterior = 0;
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < d; j++) s += this.amostras[i * d + j]!;
      s /= d;
      const enfatizado = s - 0.97 * anterior; // pré-ênfase
      anterior = s;
      x[i] = enfatizado * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1))); // Hamming
    }
    const ordem = 12;
    const r = new Float64Array(ordem + 1);
    for (let k = 0; k <= ordem; k++) {
      let s = 0;
      for (let i = k; i < n; i++) s += x[i]! * x[i - k]!;
      r[k] = s;
    }
    if (r[0]! < 1e-9) return [0, 0, 0];
    r[0] = r[0]! * 1.0001;
    // Levinson-Durbin: A(z) = 1 + a1 z^-1 + ... + ap z^-p
    const a = new Float64Array(ordem + 1);
    const copia = new Float64Array(ordem + 1);
    a[0] = 1;
    let erro = r[0]!;
    for (let i = 1; i <= ordem; i++) {
      let acc = r[i]!;
      for (let j = 1; j < i; j++) acc += a[j]! * r[i - j]!;
      const k = -acc / erro;
      copia.set(a);
      for (let j = 1; j < i; j++) a[j] = copia[j]! + k * copia[i - j]!;
      a[i] = k;
      erro *= 1 - k * k;
      if (erro <= 0) return [0, 0, 0];
    }
    // envelope 1/|A(e^jw)|^2 de 150 Hz a 4 kHz
    const env = this.envelope;
    const fMin = 150;
    const fMax = Math.min(4000, fsd / 2 - 50);
    const passo = (fMax - fMin) / (env.length - 1);
    let media = 0;
    for (let m = 0; m < env.length; m++) {
      const w = (2 * Math.PI * (fMin + m * passo)) / fsd;
      let re = 1;
      let im = 0;
      for (let j = 1; j <= ordem; j++) {
        re += a[j]! * Math.cos(w * j);
        im -= a[j]! * Math.sin(w * j);
      }
      env[m] = -10 * Math.log10(re * re + im * im + 1e-12);
      media += env[m]!;
    }
    media /= env.length;
    // energia média do envelope por faixa (dB): aberta x fechada, anterior x posterior
    const faixa = (de: number, ate: number) => {
      let soma = 0;
      let cont = 0;
      for (let m = Math.ceil((de - fMin) / passo); m <= Math.floor((ate - fMin) / passo); m++) {
        soma += env[m]!;
        cont++;
      }
      return soma / cont;
    };
    const baixo = faixa(200, 450);
    const f1alto = faixa(550, 1100);
    const central = faixa(1200, 1800);
    const frente = faixa(1900, 3000);
    const picos: Array<{ f: number; db: number }> = [];
    for (let m = 1; m < env.length - 1; m++) {
      if (env[m]! > env[m - 1]! && env[m]! >= env[m + 1]!) picos.push({ f: fMin + m * passo, db: env[m]! });
    }
    let i1 = picos.findIndex((p) => p.f >= 220 && p.f <= 1300);
    if (i1 < 0) return [0, 0, 0];
    // espectro aberto com "F1" baixo: esse pico é a fundamental da voz, não o F1
    if (f1alto - baixo > 4 && picos[i1]!.f < 450) {
      const j = picos.findIndex((p, k) => k > i1 && p.f >= 450 && p.f <= 1300);
      if (j >= 0) i1 = j;
    }
    const f1 = picos[i1]!;
    let f2 = picos.find((p) => p.f > f1.f + 250 && p.f >= 650 && p.f <= 3200)?.f ?? 0;
    // Vogal posterior (ó, ô, u): quase nada acima de 1,9 kHz e o F2 colado no F1, os dois
    // num pico só; o "F2" achado acima de 1,7 kHz é o F3. Era isso que fazia "u" virar "i".
    const posterior = central - frente > -5 && frente - Math.max(baixo, f1alto) < -10;
    if (posterior && (!f2 || f2 > 1700)) f2 = Math.max(f1.f * 1.6, 800);
    if (!f2) return [f1.f, 0, 0];
    return [f1.f, f2, limitar((f1.db - media) / 10, 0, 1)];
  }

  private montarAlvo(
    nivel: number,
    bandas: { agudo: number; centroide: number },
    f1: number,
    f2: number,
    clareza: number,
    dt: number,
  ): void {
    const alvo = this.alvo.fill(0);
    if (nivel < 0.06) {
      // queda curta no meio da fala = lábios fechados (p, b, m, ~120 ms); depois, repouso
      alvo[this.tempo - this.ultimaFala < 0.12 ? IX.PP : IX.sil] = 1;
      return;
    }
    this.ultimaFala = this.tempo;

    const chiado = suave(0.16, 0.4, bandas.agudo);
    const vozeado = 1 - chiado;

    if (chiado > 0) {
      const fraco = 1 - suave(0.25, 0.5, nivel); // f/v: chiado fraco e difuso
      const sibilante = suave(4200, 6000, bandas.centroide); // s/z mais agudo que x/ch/j
      somar(alvo, IX.SS, chiado * (1 - fraco) * sibilante);
      somar(alvo, IX.CH, chiado * (1 - fraco) * (1 - sibilante));
      somar(alvo, IX.FF, chiado * fraco);
    }
    if (vozeado > 0) {
      const vogal = clareza > 0 ? this.vogal(f1, f2, dt) : null;
      const certeza = vogal ? clareza * vogal.qualidade : 0;
      if (vogal) {
        for (const [nome, peso] of Object.entries(vogal.pesos) as Array<[NomeCurto, number]>) {
          somar(alvo, IX[nome], vozeado * certeza * peso);
        }
      }
      for (const [nome, peso] of Object.entries(GENERICA) as Array<[NomeCurto, number]>) {
        somar(alvo, IX[nome], vozeado * (1 - certeza) * peso);
      }
    }
    // fala baixa abre menos: mistura com a boca em repouso
    const abertura = Math.pow(nivel, 0.6);
    for (let i = 0; i < alvo.length; i++) alvo[i] = alvo[i]! * abertura;
    somar(alvo, IX.sil, 1 - abertura);
  }

  /** Distribuição sobre as vogais, com os formantes normalizados pela voz de quem fala. */
  private vogal(f1: number, f2: number, dt: number): { pesos: Partial<Record<NomeCurto, number>>; qualidade: number } | null {
    this.l2Falante += (Math.log(f2) - this.l2Falante) * (1 - Math.exp(-dt / 4));
    const escala = limitar(Math.exp(this.l2Falante - L2_REFERENCIA), 0.75, 1.35);
    const l1 = Math.log(f1 / escala);
    const l2 = Math.log(f2 / escala);
    const pesos: Partial<Record<NomeCurto, number>> = {};
    let soma = 0;
    for (const v of VOGAIS) {
      const d1 = (l1 - v.l1) / DESVIO_L1;
      const d2 = (l2 - v.l2) / DESVIO_L2;
      const w = Math.exp(-0.5 * (d1 * d1 + d2 * d2));
      for (const [nome, peso] of Object.entries(v.alvo) as Array<[NomeCurto, number]>) {
        pesos[nome] = (pesos[nome] ?? 0) + w * peso;
      }
      soma += w;
    }
    if (soma < 1e-4) return null;
    for (const nome of Object.keys(pesos) as NomeCurto[]) pesos[nome] = pesos[nome]! / soma;
    return { pesos, qualidade: limitar(soma / 0.3, 0, 1) };
  }

  /** Abre rápido e fecha um pouco mais devagar, como a boca de verdade. */
  private suavizar(dt: number): void {
    const fator = 0.5 + this.ajustes.suavizacao; // 0,5 a 1,5
    const sobe = 1 - Math.exp(-dt / (0.04 * fator));
    const desce = 1 - Math.exp(-dt / (0.08 * fator));
    let soma = 0;
    for (let i = 0; i < this.pesos.length; i++) {
      const a = this.alvo[i]!;
      const p = this.pesos[i]!;
      this.pesos[i] = p + (a - p) * (a > p ? sobe : desce);
      soma += this.pesos[i]!;
    }
    for (let i = 0; i < this.pesos.length; i++) this.pesos[i] = this.pesos[i]! / (soma || 1);
  }
}
