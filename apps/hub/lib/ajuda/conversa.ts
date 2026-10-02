/**
 * A CONVERSA DA AJUDA na tela — montada dos eventos do avatar (ADR-132).
 *
 * O texto não vem da nossa api: a pergunta (falada ou escrita) e a resposta
 * passam pelo vendor do avatar, que devolve TRANSCRIÇÕES pela sala de vídeo.
 * Este redutor puro transforma esses eventos no histórico do chat embaixo do
 * vídeo. Ordem MEDIDA no spike (sandbox, 2026-10-02), para uma resposta:
 * `avatar.transcription.chunk` × N → `avatar.speak_started` →
 * `avatar.transcription` (o texto inteiro) → `avatar.speak_ended`.
 *
 * A pergunta ESCRITA volta como `user.transcription` com `source_event_id`
 * igual ao id que o `session.message()` devolveu — é por esse id que ela não
 * aparece duas vezes.
 */

export type AutorDaMensagem = "pessoa" | "atendente";
export type EstadoDaMensagem = "pronta" | "transmitindo" | "erro";

export interface MensagemDaAjuda {
  id: string;
  autor: AutorDaMensagem;
  texto: string;
  estado: EstadoDaMensagem;
}

export interface ConversaDaAjuda {
  mensagens: MensagemDaAjuda[];
  /** A resposta que está chegando agora (id da mensagem), se houver. */
  respostaAtual: string | null;
  /** Ids das perguntas escritas aqui — o eco delas é ignorado. */
  enviadas: string[];
  /** `true` entre uma pergunta e o primeiro pedaço da resposta: o relógio do "não respondeu". */
  aguardando: boolean;
}

export type EventoDaConversa =
  | { tipo: "pergunta-escrita"; id: string; texto: string }
  | { tipo: "pergunta-falada"; texto: string; origem?: string | null }
  | { tipo: "resposta-pedaco"; texto: string }
  | { tipo: "resposta-inteira"; texto: string }
  | { tipo: "resposta-fim" }
  | { tipo: "sem-resposta" };

export const CONVERSA_VAZIA: ConversaDaAjuda = { mensagens: [], respostaAtual: null, enviadas: [], aguardando: false };

/** O que a tela diz quando o atendente fica mudo (o vendor não avisa — medido no spike). */
export const SEM_RESPOSTA = "O atendente não respondeu. Pergunte de novo, por favor.";

/** Quanto esperar o primeiro pedaço da resposta antes de dizer que ele não veio. */
export const ESPERA_DA_RESPOSTA_MS = 20_000;

let sequencia = 0;
const novoId = (prefixo: string) => `${prefixo}-${Date.now().toString(36)}-${(sequencia += 1)}`;

function fecharAtual(c: ConversaDaAjuda): MensagemDaAjuda[] {
  return c.mensagens.map((m) => (m.id === c.respostaAtual && m.estado === "transmitindo" ? { ...m, estado: "pronta" } : m));
}

export function reduzirConversa(c: ConversaDaAjuda, e: EventoDaConversa): ConversaDaAjuda {
  switch (e.tipo) {
    case "pergunta-escrita": {
      const texto = e.texto.trim();
      if (!texto) return c;
      return {
        mensagens: [...fecharAtual(c), { id: e.id, autor: "pessoa", texto, estado: "pronta" }],
        respostaAtual: null,
        enviadas: [...c.enviadas, e.id].slice(-50),
        aguardando: true,
      };
    }
    case "pergunta-falada": {
      // O eco de uma pergunta escrita: já está na tela.
      if (e.origem && c.enviadas.includes(e.origem)) return c;
      const texto = e.texto.trim();
      if (!texto) return c;
      return {
        ...c,
        mensagens: [...fecharAtual(c), { id: novoId("voz"), autor: "pessoa", texto, estado: "pronta" }],
        respostaAtual: null,
        aguardando: true,
      };
    }
    case "resposta-pedaco": {
      if (c.respostaAtual) {
        return {
          ...c,
          aguardando: false,
          mensagens: c.mensagens.map((m) => (m.id === c.respostaAtual ? { ...m, texto: m.texto + e.texto } : m)),
        };
      }
      const id = novoId("resposta");
      return {
        ...c,
        aguardando: false,
        respostaAtual: id,
        mensagens: [...c.mensagens, { id, autor: "atendente", texto: e.texto, estado: "transmitindo" }],
      };
    }
    case "resposta-inteira": {
      const texto = e.texto.trim();
      if (!texto) return c;
      // O texto inteiro substitui o que os pedaços montaram (é a mesma fala, já costurada pelo vendor).
      if (c.respostaAtual) {
        return {
          ...c,
          aguardando: false,
          mensagens: c.mensagens.map((m) => (m.id === c.respostaAtual ? { ...m, texto } : m)),
        };
      }
      const id = novoId("resposta");
      return {
        ...c,
        aguardando: false,
        respostaAtual: id,
        mensagens: [...c.mensagens, { id, autor: "atendente", texto, estado: "transmitindo" }],
      };
    }
    case "resposta-fim":
      return { ...c, mensagens: fecharAtual(c), respostaAtual: null };
    case "sem-resposta":
      if (!c.aguardando) return c;
      return {
        ...c,
        aguardando: false,
        mensagens: [...c.mensagens, { id: novoId("falha"), autor: "atendente", texto: SEM_RESPOSTA, estado: "erro" }],
      };
  }
}

/** `m:ss` do tempo que sobra na sessão — o relógio do modal. */
export function relogio(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
