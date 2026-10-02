/**
 * A porta do AVATAR AO VIVO — o atendente em vídeo da Ajuda (ADR-132).
 *
 * O vendor (LiveAvatar, da HeyGen) faz a escuta (ASR), a voz (TTS) e o vídeo;
 * o LLM é NOSSO: o LiveAvatar chama `POST /ajuda/llm/chat/completions` desta api,
 * que responde pelo `AiProvider`. Por isso esta porta não gera texto nenhum —
 * ela só abre e fecha a sessão de vídeo.
 *
 * Mora em `src/ai` pela mesma regra do `AiProvider` e do Agent Engine: nenhum
 * vendor de IA fora daqui. É porta própria, e não método do `AiProvider`,
 * porque não é uma chamada de modelo: é a reserva de um recurso que cobra por
 * MINUTO, com ciclo de vida (abrir, encerrar).
 */
export const AVATAR_AO_VIVO = "AVATAR_AO_VIVO";

export interface SessaoDeAvatar {
  /** O id da sessão no vendor — é com ele que a api encerra a sessão. */
  sessaoId: string;
  /**
   * O token que o NAVEGADOR usa para entrar na sala de vídeo. Vale só para
   * esta sessão; a chave da conta (`LIVEAVATAR_API_KEY`) nunca sai da api.
   */
  tokenDaSessao: string;
}

export interface PedidoDeSessao {
  /** Teto da sessão em segundos — o vendor derruba a sala ao atingi-lo. */
  duracaoMaximaS: number;
  /**
   * Valores que o vendor substitui nos `${nome}` do prompt do contexto. É por
   * aqui que o token da sessão da Ajuda chega ao nosso endpoint de LLM.
   */
  variaveis: Record<string, string>;
}

export interface AvatarAoVivoPort {
  /** `false` quando a stack não tem a chave: a Ajuda responde 503, nunca abre sem vídeo. */
  readonly ligado: boolean;
  criarSessao(pedido: PedidoDeSessao): Promise<SessaoDeAvatar>;
  /** Encerrar uma sessão que já acabou não é erro. */
  encerrarSessao(sessaoId: string): Promise<void>;
}

export class ErroDoAvatar extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ErroDoAvatar";
  }
}
