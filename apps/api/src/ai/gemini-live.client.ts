import { GoogleAuth } from "google-auth-library";
import { WebSocket } from "ws";
import {
  ErroDaVoz,
  type ConversaDeVoz,
  type EntradaDaVoz,
  type EventoDaVoz,
  type PedidoDeVoz,
  type VozAoVivoPort,
} from "./voz-ao-vivo.port";

/**
 * O cliente do Gemini Live na Vertex (ADR-158) — a ÚNICA peça da api que
 * conhece o `BidiGenerateContent`. Veio do PoC `poc-mascote-visemas` (out/2026),
 * trocando a chave do AI Studio pelo ADC, como todo o resto da IA da api.
 *
 * O que o PoC MEDIU contra a API real e vale aqui:
 * - `responseModalities` e `speechConfig` vão DENTRO de `generationConfig`; a
 *   `systemInstruction` tem de ser um Content (string é recusada).
 * - O servidor valida o JSON do setup antes da credencial: campo errado volta
 *   1007 "Unknown name" mesmo com credencial ruim.
 * - Chega `sessionResumptionUpdate` sem pedir: ignorado.
 * - Na Vertex o texto da pessoa vai em `realtimeInput.text` (o PoC da Vertex,
 *   com o `@google/genai`, mandava assim), e o modelo vai com o caminho
 *   inteiro `projects/<p>/locations/<r>/publishers/google/models/<m>`.
 */

const CAMINHO_DO_LIVE = "/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent";
/** O vendor costuma confirmar o setup em < 1 s (medido no PoC: 0,7 s); a base grande pesa. */
const PRAZO_DO_SETUP_MS = 20_000;
/** O mesmo teto do PoC: uma resposta de áudio longa chega em pedaços, mas cada um pode ser grande. */
const TETO_DA_MENSAGEM = 64 * 1024 * 1024;

const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });

export interface ConfigDoGeminiLive {
  projeto?: string;
  regiao: string;
}

export function urlDoLive(regiao: string): string {
  const host = regiao === "global" ? "aiplatform.googleapis.com" : `${regiao}-aiplatform.googleapis.com`;
  return `wss://${host}${CAMINHO_DO_LIVE}`;
}

/** A primeira mensagem da sessão. Pura — o teste confere o que vai ao vendor. */
export function mensagemDeSetup(config: Required<ConfigDoGeminiLive>, pedido: PedidoDeVoz): Record<string, unknown> {
  const modelo = pedido.modelo.replace(/^.*models\//, "");
  return {
    setup: {
      model: `projects/${config.projeto}/locations/${config.regiao}/publishers/google/models/${modelo}`,
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          languageCode: "pt-BR",
          voiceConfig: { prebuiltVoiceConfig: { voiceName: pedido.voz } },
        },
      },
      systemInstruction: { parts: [{ text: pedido.instrucao }] },
      outputAudioTranscription: {},
      inputAudioTranscription: {},
    },
  };
}

/** O que o navegador manda, no formato do vendor. Puro. */
export function paraOVendor(entrada: EntradaDaVoz): Record<string, unknown> {
  switch (entrada.tipo) {
    case "texto":
      return { realtimeInput: { text: entrada.texto } };
    case "audio":
      return { realtimeInput: { audio: { data: entrada.base64, mimeType: "audio/pcm;rate=16000" } } };
    case "fim-do-audio":
      return { realtimeInput: { audioStreamEnd: true } };
  }
}

const TAXA_PADRAO = 24_000;

function taxaDo(mimeType: unknown): number {
  const m = /rate=(\d+)/i.exec(typeof mimeType === "string" ? mimeType : "");
  return m ? Number(m[1]) : TAXA_PADRAO;
}

type Objeto = Record<string, unknown>;
const ehObjeto = (v: unknown): v is Objeto => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Uma mensagem do vendor vira zero ou mais eventos neutros. Pura.
 * Um mesmo `serverContent` pode trazer áudio E transcrição: tratar todas as partes.
 */
export function doVendor(msg: unknown): EventoDaVoz[] {
  if (!ehObjeto(msg) || !ehObjeto(msg.serverContent)) return [];
  const conteudo = msg.serverContent;
  const eventos: EventoDaVoz[] = [];
  if (conteudo.interrupted === true) eventos.push({ tipo: "interrompido" });
  const turno = ehObjeto(conteudo.modelTurn) ? conteudo.modelTurn : null;
  const partes: unknown[] = turno && Array.isArray(turno.parts) ? turno.parts : [];
  for (const parte of partes) {
    if (!ehObjeto(parte) || !ehObjeto(parte.inlineData)) continue;
    const { data, mimeType } = parte.inlineData;
    if (typeof data === "string" && data && /^audio\/pcm/i.test(typeof mimeType === "string" ? mimeType : "")) {
      eventos.push({ tipo: "audio", base64: data, taxa: taxaDo(mimeType) });
    }
  }
  const saida = ehObjeto(conteudo.outputTranscription) ? conteudo.outputTranscription.text : undefined;
  if (typeof saida === "string" && saida) eventos.push({ tipo: "transcricao-saida", texto: saida });
  const entrada = ehObjeto(conteudo.inputTranscription) ? conteudo.inputTranscription.text : undefined;
  if (typeof entrada === "string" && entrada) eventos.push({ tipo: "transcricao-entrada", texto: entrada });
  if (conteudo.turnComplete === true) eventos.push({ tipo: "fim-do-turno" });
  return eventos;
}

function lerJson(dados: unknown): unknown {
  try {
    const texto = Buffer.isBuffer(dados) ? dados.toString("utf8") : String(dados);
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

class ConversaNoGemini implements ConversaDeVoz {
  private cbEvento: (evento: EventoDaVoz) => void = () => undefined;
  private cbFechar: (info: { codigo: number; motivo: string }) => void = () => undefined;

  constructor(private readonly ws: WebSocket) {
    ws.on("message", (dados) => {
      for (const evento of doVendor(lerJson(dados))) this.cbEvento(evento);
    });
    ws.on("close", (codigo, motivo) => this.cbFechar({ codigo, motivo: motivo.toString("utf8") }));
  }

  enviar(entrada: EntradaDaVoz): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(paraOVendor(entrada)));
  }

  aoEvento(cb: (evento: EventoDaVoz) => void): void {
    this.cbEvento = cb;
  }

  aoFechar(cb: (info: { codigo: number; motivo: string }) => void): void {
    this.cbFechar = cb;
  }

  fechar(): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.close(1000);
    else if (this.ws.readyState === WebSocket.CONNECTING) this.ws.terminate();
  }
}

export class GeminiLiveClient implements VozAoVivoPort {
  readonly ligada: boolean;

  constructor(private readonly config: ConfigDoGeminiLive) {
    this.ligada = Boolean(config.projeto);
  }

  async abrir(pedido: PedidoDeVoz): Promise<ConversaDeVoz> {
    const projeto = this.config.projeto;
    if (!projeto) throw new ErroDaVoz("sem projeto da Vertex");
    let token: string | null | undefined;
    try {
      token = await auth.getAccessToken();
    } catch (erro) {
      throw new ErroDaVoz(`ADC indisponível: ${erro instanceof Error ? erro.message : String(erro)}`);
    }
    if (!token) throw new ErroDaVoz("ADC sem token");

    const ws = new WebSocket(urlDoLive(this.config.regiao), {
      headers: { Authorization: `Bearer ${token}` },
      maxPayload: TETO_DA_MENSAGEM,
    });
    const setup = JSON.stringify(mensagemDeSetup({ projeto, regiao: this.config.regiao }, pedido));

    return new Promise<ConversaDeVoz>((resolver, rejeitar) => {
      let pronto = false;
      const desistir = (motivo: string) => {
        if (pronto) return;
        pronto = true;
        clearTimeout(prazo);
        ws.removeAllListeners();
        ws.on("error", () => undefined);
        if (ws.readyState === WebSocket.OPEN) ws.close(1000);
        else ws.terminate();
        rejeitar(new ErroDaVoz(motivo));
      };
      const prazo = setTimeout(() => desistir("o Gemini não confirmou a sessão a tempo"), PRAZO_DO_SETUP_MS);

      ws.on("open", () => ws.send(setup));
      ws.on("unexpected-response", (_req, res) => desistir(`a Vertex recusou a conexão (HTTP ${res.statusCode})`));
      ws.on("error", (erro) => desistir(`falha na conexão com a Vertex: ${erro.message}`));
      ws.on("close", (codigo, motivo) => desistir(`a Vertex fechou antes do setup: ${codigo} ${motivo.toString("utf8")}`));
      ws.on("message", (dados) => {
        if (pronto) return;
        const msg = lerJson(dados);
        if (!ehObjeto(msg) || !("setupComplete" in msg)) return;
        pronto = true;
        clearTimeout(prazo);
        ws.removeAllListeners();
        // Depois do setup, erro de socket vira `close` — quem escuta é a conversa.
        ws.on("error", () => undefined);
        resolver(new ConversaNoGemini(ws));
      });
    });
  }
}

/** Sem projeto (`AI_PROVIDER=mock` em dev) a porta nasce desligada e o mascote responde 503. */
export function criarVozAoVivo(config: ConfigDoGeminiLive): VozAoVivoPort {
  return new GeminiLiveClient(config);
}
