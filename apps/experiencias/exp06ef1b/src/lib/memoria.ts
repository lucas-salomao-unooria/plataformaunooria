/**
 * A memória de F5 — `sessionStorage`, só com IDS, NÚMEROS e booleanos, e só
 * conveniência. Molde: `exp07ef1b/src/lib/memoria.ts`.
 *
 * O que VALE mora na api: as curtidas, as permanências, o voto lacrado, a
 * revisão, a ordem conferida dos pacotes e da cadeia, os cartões, as respostas
 * das enquetes. Aqui fica só o que a api não guarda ANTES de o toque virar
 * latch, e cuja perda num F5 seria injusta com a criança: a dica do carrossel
 * já usada, as permanências já enviadas, a calha dos pacotes e da cadeia montada
 * pela metade, os cartões tocados antes de "Registrar", e qual alternativa ela
 * tocou em cada enquete (para a enquete reabrir travada — a api guarda a
 * primeira resposta de qualquer jeito).
 *
 * Três regras, e as três já custaram em outra missão:
 *
 * - **Nunca `localStorage`**: a máquina da escola é compartilhada.
 * - **Nunca texto**: nem a busca da galeria. Texto de menor não fica no
 *   aparelho nem viaja (o `AcaoDaGaleriaSchema` só leva o TIPO da busca).
 * - **A chave leva o estudante, a atividade e a rodada**: "Zerar a turma" e a
 *   atividade nova criam OUTRA sessão, e a calha da rodada anterior não pode
 *   reaparecer na nova; o estudante seguinte na mesma aba não herda nada.
 *
 * Toda leitura e escrita vai em `try/catch`: em aba anônima ou com o
 * armazenamento bloqueado a chamada lança, e a missão tem de rodar igual.
 */

export interface Memoria {
  /** A criança já deslizou o carrossel: a dica do gesto não volta. */
  gestoUsado: boolean;
  /** Os posts cuja permanência já foi enviada (o servidor deduplica; isto poupa a ida). */
  permanencias: string[];
  ordemDosPacotes: string[];
  ordemDaCadeia: string[];
  mecanismo: string | null;
  atitude: string | null;
  /** A alternativa tocada em cada enquete (`p1` → id). */
  votos: Record<string, string>;
}

const VAZIA: Memoria = {
  gestoUsado: false,
  permanencias: [],
  ordemDosPacotes: [],
  ordemDaCadeia: [],
  mecanismo: null,
  atitude: null,
  votos: {},
};

export interface ChaveDaSessao {
  estudanteId: string;
  pacoteId: string;
  rodada: number;
}

function chave(c: ChaveDaSessao): string {
  return `exp06ef1b:${c.estudanteId}:${c.pacoteId}:${c.rodada}`;
}

/** Um id curto e sem espaço: o que não tem cara de id não entra (nem por engano). */
const ID_RE = /^[A-Za-z0-9:_-]{1,40}$/;

function ids(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.filter((v): v is string => typeof v === "string" && ID_RE.test(v)) : [];
}

function id(valor: unknown): string | null {
  return typeof valor === "string" && ID_RE.test(valor) ? valor : null;
}

function votos(valor: unknown): Record<string, string> {
  if (!valor || typeof valor !== "object") return {};
  const saida: Record<string, string> = {};
  for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
    const alternativa = id(v);
    if (ID_RE.test(k) && alternativa) saida[k] = alternativa;
  }
  return saida;
}

/** O que está guardado para esta sessão — ou a memória vazia, nunca exceção. */
export function lerMemoria(c: ChaveDaSessao): Memoria {
  try {
    const bruto = window.sessionStorage.getItem(chave(c));
    if (!bruto) return { ...VAZIA };
    const dado = JSON.parse(bruto) as Record<string, unknown>;
    return {
      gestoUsado: dado.gestoUsado === true,
      permanencias: ids(dado.permanencias),
      ordemDosPacotes: ids(dado.ordemDosPacotes),
      ordemDaCadeia: ids(dado.ordemDaCadeia),
      mecanismo: id(dado.mecanismo),
      atitude: id(dado.atitude),
      votos: votos(dado.votos),
    };
  } catch {
    return { ...VAZIA };
  }
}

/** Funde o pedaço novo no que está guardado. Falhar aqui é silencioso por desenho. */
export function gravarMemoria(c: ChaveDaSessao, parte: Partial<Memoria>): void {
  try {
    const atual = lerMemoria(c);
    window.sessionStorage.setItem(chave(c), JSON.stringify({ ...atual, ...parte }));
  } catch {
    /* Aba anônima, cota cheia ou armazenamento bloqueado: a missão segue sem F5 amigável. */
  }
}
