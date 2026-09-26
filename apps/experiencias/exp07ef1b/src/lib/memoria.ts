/**
 * A memória de F5 — `sessionStorage`, só com IDS e NÚMEROS, e só conveniência.
 *
 * O que VALE mora na api: o latch da publicação, a tríade, a legenda, a
 * reflexão, as respostas das enquetes. Aqui fica só o que a api não guarda
 * antes do latch e cuja perda num F5 seria injusta com a criança: os posts que
 * ela salvou no feed, os que desmarcou na aba Salvos, o tempo de feed já
 * contado, o card em que parou na Etapa 5 e qual alternativa ela tocou em cada
 * enquete (para a enquete reabrir travada — a api guarda a primeira resposta de
 * qualquer jeito).
 *
 * Três regras, e as três já custaram em outra missão:
 *
 * - **Nunca `localStorage`**: a máquina da escola é compartilhada, e a próxima
 *   turma abriria o feed com os salvos de outra criança.
 * - **Nunca texto**: nem a legenda, nem a reflexão. Texto de menor fica no
 *   servidor, atrás da RLS (RNF-PRIV-002).
 * - **A chave leva o `sessaoId`**: "Zerar a turma" e tema novo criam OUTRA
 *   sessão, e os salvos da rodada anterior não podem reaparecer na nova.
 *
 * Toda leitura e escrita vai em `try/catch`: em aba anônima ou com o
 * armazenamento bloqueado a chamada lança, e a missão tem de rodar igual.
 */

export interface Memoria {
  salvos: string[];
  desmarcados: string[];
  tempoFeedS: number;
  card: number;
  votos: Record<string, string>;
}

const VAZIA: Memoria = { salvos: [], desmarcados: [], tempoFeedS: 0, card: 0, votos: {} };

function chave(sessaoId: string): string {
  return `exp07ef1b:${sessaoId}`;
}

function ids(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.filter((v): v is string => typeof v === "string") : [];
}

function numero(valor: unknown): number {
  return typeof valor === "number" && Number.isFinite(valor) && valor >= 0 ? Math.floor(valor) : 0;
}

function votos(valor: unknown): Record<string, string> {
  if (!valor || typeof valor !== "object") return {};
  const saida: Record<string, string> = {};
  for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
    if (typeof v === "string") saida[k] = v;
  }
  return saida;
}

/** O que está guardado para esta sessão — ou a memória vazia, nunca exceção. */
export function lerMemoria(sessaoId: string): Memoria {
  try {
    const bruto = window.sessionStorage.getItem(chave(sessaoId));
    if (!bruto) return { ...VAZIA };
    const dado = JSON.parse(bruto) as Record<string, unknown>;
    return {
      salvos: ids(dado.salvos),
      desmarcados: ids(dado.desmarcados),
      tempoFeedS: numero(dado.tempoFeedS),
      card: numero(dado.card),
      votos: votos(dado.votos),
    };
  } catch {
    return { ...VAZIA };
  }
}

/** Funde o pedaço novo no que está guardado. Falhar aqui é silencioso por desenho. */
export function gravarMemoria(sessaoId: string, parte: Partial<Memoria>): void {
  try {
    const atual = lerMemoria(sessaoId);
    window.sessionStorage.setItem(chave(sessaoId), JSON.stringify({ ...atual, ...parte }));
  } catch {
    /* Aba anônima, cota cheia ou armazenamento bloqueado: a missão segue sem F5 amigável. */
  }
}
