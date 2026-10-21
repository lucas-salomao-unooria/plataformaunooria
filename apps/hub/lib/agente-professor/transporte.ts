import {
  BASE_DO_AGENTE,
  ConversaCriadaSchema,
  ConversaSchema,
  ListaDeConversasSchema,
  RecusaSchema,
  lerEvento,
  type Conversa,
  type ConversaResumo,
  type EventoDoTurno,
  type Recusa,
} from "./contrato";
import { codigoPermiteRepetir } from "./conversa";
import { LeitorDeSse } from "./sse";

/**
 * O NAVEGADOR FALANDO COM O AGENTE — sempre pelo hub (`/api/plataforma/...`),
 * que segura a sessão e assina o token: aqui não há URL interna, token nem
 * prompt (regra 2 da raiz).
 *
 * Funções puras sobre `fetch` (injetável), para o teste conduzir um turno
 * inteiro com um `Response` montado à mão.
 */

type Fetch = typeof fetch;

/** O que a tela mostra quando a api (ou o hub) recusou, e se vale oferecer "Tentar de novo". */
export interface RecusaDaTela {
  status: number;
  codigo?: string;
  mensagem: string;
  podeRepetir: boolean;
}

const SEM_CONEXAO = "Não foi possível falar com a plataforma. Confira a conexão e tente de novo.";

/**
 * Status + corpo `{ codigo, mensagem }` → a frase da tela.
 *
 * A frase da api vale quando ela é para o professor (quota, limite por minuto,
 * agente fora do ar, corpo inválido). Para 401/403/404 a tela tem a sua,
 * porque o que o professor precisa ali é o PRÓXIMO PASSO ("comece uma nova
 * conversa"), e não o diagnóstico.
 */
export function recusaParaTela(status: number, corpo: Recusa | null): RecusaDaTela {
  const codigo = corpo?.codigo;
  const daApi = corpo?.mensagem?.trim() || undefined;
  if (status === 401) {
    return { status, codigo, mensagem: "Sua sessão terminou. Entre de novo para continuar.", podeRepetir: false };
  }
  if (status === 403) {
    return {
      status,
      codigo,
      mensagem:
        codigo === "recurso-indisponivel"
          ? "O agente de IA do professor não está disponível nesta escola."
          : (daApi ?? "Você não tem acesso ao agente de IA do professor."),
      podeRepetir: false,
    };
  }
  if (status === 404) {
    return { status, codigo, mensagem: "Esta conversa não existe mais. Comece uma nova conversa.", podeRepetir: false };
  }
  if (status === 400) {
    return { status, codigo, mensagem: daApi ?? "Escreva uma mensagem de 1 a 4.000 caracteres.", podeRepetir: false };
  }
  if (status === 429) {
    return {
      status,
      codigo,
      mensagem: daApi ?? "Muitas mensagens seguidas. Espere um instante e tente de novo.",
      podeRepetir: codigoPermiteRepetir(codigo),
    };
  }
  return {
    status,
    codigo,
    mensagem: daApi ?? "O agente de IA do professor não respondeu agora. Tente de novo em instantes.",
    podeRepetir: true,
  };
}

async function corpoDaRecusa(resposta: Response): Promise<Recusa | null> {
  try {
    const lido = RecusaSchema.safeParse(await resposta.json());
    return lido.success ? lido.data : null;
  } catch {
    return null;
  }
}

/** Como um turno terminou, do ponto de vista da tela. */
export type DesfechoDoTurno =
  | { tipo: "recusado"; recusa: RecusaDaTela }
  /** Terminou com `fim` ou `erro` — os dois chegaram por `aoEvento`. */
  | { tipo: "terminou"; evento: "fim" | "erro" }
  /** O professor apertou "Parar" (ou o chat foi desmontado). */
  | { tipo: "interrompido" }
  /** A conexão acabou sem `fim` nem `erro`. */
  | { tipo: "caiu" };

/**
 * UM TURNO: `POST .../conversas/:id/mensagens` e a leitura do stream.
 *
 * Os eventos chegam por `aoEvento`, na ordem, já validados. O stream termina em
 * `fim` OU em `erro` (contrato da api); depois do primeiro dos dois a leitura
 * para e a conexão é solta. Recusa ANTES do stream (JSON) não gera evento:
 * volta como `recusado`, com a frase pronta.
 */
export async function transmitirTurno(opcoes: {
  conversaId: string;
  texto: string;
  signal: AbortSignal;
  aoEvento: (evento: EventoDoTurno) => void;
  fetch?: Fetch;
}): Promise<DesfechoDoTurno> {
  const buscar = opcoes.fetch ?? fetch;
  let resposta: Response;
  try {
    resposta = await buscar(`${BASE_DO_AGENTE}/conversas/${encodeURIComponent(opcoes.conversaId)}/mensagens`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify({ texto: opcoes.texto }),
      signal: opcoes.signal,
    });
  } catch {
    if (opcoes.signal.aborted) return { tipo: "interrompido" };
    return { tipo: "recusado", recusa: { status: 0, mensagem: SEM_CONEXAO, podeRepetir: true } };
  }

  const tipo = resposta.headers.get("content-type") ?? "";
  if (!resposta.ok || !tipo.includes("text/event-stream") || !resposta.body) {
    return { tipo: "recusado", recusa: recusaParaTela(resposta.status, await corpoDaRecusa(resposta)) };
  }

  const leitor = resposta.body.getReader();
  const decodificador = new TextDecoder("utf-8");
  const sse = new LeitorDeSse();
  let terminal: "fim" | "erro" | null = null;

  /** Entrega os frames em ordem; devolve `fim`/`erro` se um deles encerrou o turno (o resto é descartado). */
  const entregar = (frames: ReturnType<LeitorDeSse["empurrar"]>): "fim" | "erro" | null => {
    for (const frame of frames) {
      const evento = lerEvento(frame.evento, frame.dados);
      if (!evento) continue;
      opcoes.aoEvento(evento);
      if (evento.tipo === "fim" || evento.tipo === "erro") return evento.tipo;
    }
    return null;
  };

  try {
    while (terminal === null) {
      const { value, done } = await leitor.read();
      if (done) {
        terminal = entregar([...sse.empurrar(decodificador.decode()), ...sse.terminar()]);
        break;
      }
      terminal = entregar(sse.empurrar(decodificador.decode(value, { stream: true })));
    }
  } catch {
    if (opcoes.signal.aborted) return { tipo: "interrompido" };
    return { tipo: "caiu" };
  } finally {
    // Depois do `fim`/`erro` o resto do corpo não interessa: solta a conexão.
    if (terminal) await leitor.cancel().catch(() => {});
  }
  if (terminal) return { tipo: "terminou", evento: terminal };
  return opcoes.signal.aborted ? { tipo: "interrompido" } : { tipo: "caiu" };
}

/* ---------------------------------------------- as outras rotas (pelo BFF) */

export type Resultado<T> = { ok: true; valor: T } | { ok: false; recusa: RecusaDaTela };

async function pedir<T>(
  caminho: string,
  init: RequestInit,
  ler: (corpo: unknown) => T | null,
  buscar: Fetch = fetch,
): Promise<Resultado<T>> {
  let resposta: Response;
  try {
    resposta = await buscar(`${BASE_DO_AGENTE}${caminho}`, { cache: "no-store", ...init });
  } catch {
    return { ok: false, recusa: { status: 0, mensagem: SEM_CONEXAO, podeRepetir: true } };
  }
  if (!resposta.ok) return { ok: false, recusa: recusaParaTela(resposta.status, await corpoDaRecusa(resposta)) };
  if (resposta.status === 204) return { ok: true, valor: ler(undefined) as T };
  let corpo: unknown;
  try {
    corpo = await resposta.json();
  } catch {
    corpo = undefined;
  }
  const valor = ler(corpo);
  if (valor === null) {
    return { ok: false, recusa: recusaParaTela(502, null) };
  }
  return { ok: true, valor };
}

export function listarConversas(buscar?: Fetch): Promise<Resultado<ConversaResumo[]>> {
  return pedir("/conversas", { method: "GET" }, (c) => {
    const lido = ListaDeConversasSchema.safeParse(c);
    return lido.success ? lido.data : null;
  }, buscar);
}

export function criarConversa(buscar?: Fetch): Promise<Resultado<string>> {
  return pedir("/conversas", { method: "POST" }, (c) => {
    const lido = ConversaCriadaSchema.safeParse(c);
    return lido.success ? lido.data.id : null;
  }, buscar);
}

export function lerConversa(id: string, buscar?: Fetch): Promise<Resultado<Conversa>> {
  return pedir(`/conversas/${encodeURIComponent(id)}`, { method: "GET" }, (c) => {
    const lido = ConversaSchema.safeParse(c);
    return lido.success ? lido.data : null;
  }, buscar);
}

export function apagarConversa(id: string, buscar?: Fetch): Promise<Resultado<true>> {
  return pedir(`/conversas/${encodeURIComponent(id)}`, { method: "DELETE" }, () => true as const, buscar);
}
