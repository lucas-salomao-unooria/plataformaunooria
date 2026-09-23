import { api } from "./api";

/**
 * Buffer de eventos do MOTOR (doc 04 §1): flush a cada 4s, a cada 10 eventos
 * ou antes de pedir o próximo bloco. O cliente só MEDE — nenhum peso ou score
 * mora aqui.
 *
 * Este canal é TRANSACIONAL e separado da telemetria xAPI da SDK de propósito:
 * o motor lê estes eventos em tempo quase real para curar o próximo bloco;
 * a telemetria analítica vai em batch para o Pub/Sub. Dois pipelines.
 */
export type TipoEventoCliente =
  | "visto"
  | "curtiu"
  | "descurtiu"
  | "salvou"
  | "dessalvou"
  | "abriu_comentarios"
  | "comentou"
  | "compartilhou"
  | "seguiu"
  | "deixou_seguir"
  | "nao_interessa"
  | "denunciou"
  | "enquete"
  | "rever"
  | "abriu_perfil"
  /**
   * Telemetria de imersão e investigação. Não pontuam no motor — só medem.
   * `abriu_busca` e `buscou` são os mais valiosos do conjunto: respondem quem
   * foi atrás do que o feed não dava.
   */
  | "abriu_busca"
  | "buscou"
  | "abriu_da_busca"
  | "expandiu_legenda"
  | "duplo_toque"
  | "abriu_story"
  | "avancou_story"
  | "trocou_aba"
  | "perdeu_foco"
  | "voltou_foco";

export interface EventoCliente {
  tipo: TipoEventoCliente;
  postId?: string | null;
  clientTs: number;
  payload?: Record<string, unknown>;
}

const LIMITE_LOTE = 10;
const INTERVALO_MS = 4000;

export interface BufferDeEventos {
  registrar: (tipo: TipoEventoCliente, postId?: string | null, payload?: Record<string, unknown>) => void;
  flush: () => Promise<void>;
  encerrar: () => void;
}

export function criarBufferDeEventos(runId: string): BufferDeEventos {
  let fila: EventoCliente[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let enviando: Promise<void> = Promise.resolve();

  const enviar = async () => {
    if (fila.length === 0) return;
    const lote = fila;
    fila = [];

    try {
      await api.post(`/runs/${runId}/eventos`, { events: lote });
    } catch {
      // Sem rede: devolve para a fila e tenta no próximo flush.
      fila = [...lote, ...fila].slice(-200);
    }
  };

  const agendar = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      enviando = enviando.then(enviar);
    }, INTERVALO_MS);
  };

  return {
    registrar(tipo, postId, payload) {
      fila.push({ tipo, postId: postId ?? null, clientTs: Date.now(), payload });
      if (fila.length >= LIMITE_LOTE) {
        enviando = enviando.then(enviar);
        return;
      }
      agendar();
    },
    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      enviando = enviando.then(enviar);
      await enviando;
    },
    encerrar() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
