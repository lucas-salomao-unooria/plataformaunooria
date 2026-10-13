/**
 * A porta da VOZ AO VIVO — o mascote da Ajuda (ADR-158).
 *
 * O segundo atendente da Ajuda, ao lado do avatar em vídeo do LiveAvatar
 * (`avatar-ao-vivo.port.ts`). Aqui o vendor é o Gemini Live da Vertex: uma
 * conversa de VOZ bidirecional (o navegador manda microfone ou texto, o modelo
 * devolve áudio PCM e a transcrição). O rosto é nosso — o mascote 3D do hub,
 * com a boca tirada do próprio áudio.
 *
 * Mora em `src/ai` pela regra de sempre: nenhum vendor de IA fora daqui. A
 * porta fala um protocolo NEUTRO (`EventoDaVoz`, `EntradaDaVoz`): o módulo
 * `ajuda` e o navegador nunca veem o formato do `BidiGenerateContent`, e trocar
 * de vendor é escrever outro cliente.
 *
 * A instrução do sistema entra AQUI, na abertura, e nunca chega ao navegador
 * (regra 2): o navegador só manda texto da pessoa e áudio do microfone.
 */
export const VOZ_AO_VIVO = "VOZ_AO_VIVO";

export interface PedidoDeVoz {
  /** Modelo do Live, sem prefixo (ex.: `gemini-3.8-live`). */
  modelo: string;
  /** Uma das vozes pré-definidas do Gemini (ex.: `Leda`). */
  voz: string;
  /** A instrução do sistema — o prompt do atendente, com a base. */
  instrucao: string;
}

/** O que o navegador pode mandar. Nada além disto atravessa a api. */
export type EntradaDaVoz =
  | { tipo: "texto"; texto: string }
  /** 100 ms de microfone: PCM 16-bit little-endian, 16 kHz, em base64. */
  | { tipo: "audio"; base64: string }
  /** O microfone desligou: o modelo fecha o que ouviu e responde. */
  | { tipo: "fim-do-audio" };

/** O que volta ao navegador. */
export type EventoDaVoz =
  /** Fala do atendente: PCM 16-bit little-endian em base64, na taxa dada (24 kHz). */
  | { tipo: "audio"; base64: string; taxa: number }
  | { tipo: "transcricao-saida"; texto: string }
  | { tipo: "transcricao-entrada"; texto: string }
  /** A pessoa falou por cima: o navegador descarta o áudio na fila. */
  | { tipo: "interrompido" }
  | { tipo: "fim-do-turno" };

export interface ConversaDeVoz {
  enviar(entrada: EntradaDaVoz): void;
  /** Um callback só por conversa (o proxy da Ajuda). */
  aoEvento(cb: (evento: EventoDaVoz) => void): void;
  /** `motivo` é de LOG, não de tela: pode trazer texto do vendor. */
  aoFechar(cb: (info: { codigo: number; motivo: string }) => void): void;
  fechar(): void;
}

export interface VozAoVivoPort {
  /** `false` sem projeto da Vertex (`AI_PROVIDER=mock`): o mascote responde 503. */
  readonly ligada: boolean;
  /** Resolve quando o vendor confirma o setup; rejeita com `ErroDaVoz`. */
  abrir(pedido: PedidoDeVoz): Promise<ConversaDeVoz>;
}

export class ErroDaVoz extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErroDaVoz";
  }
}
