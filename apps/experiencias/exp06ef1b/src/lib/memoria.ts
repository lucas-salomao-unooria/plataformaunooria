/**
 * A memória de F5 — `sessionStorage`, só com IDS, NÚMEROS e booleanos, e só
 * conveniência. Molde: `exp07ef1b/src/lib/memoria.ts`.
 *
 * O que VALE mora na api: as curtidas, as pastas, as permanências, o voto
 * lacrado, a revisão, a regra enviada. Aqui fica só o que a api não guarda
 * ANTES de o toque virar latch, e cuja perda num F5 seria injusta com a
 * criança: a dica do carrossel já usada, as permanências já enviadas e as
 * peças da regra tocadas antes de enviar.
 *
 * Três regras, e as três já custaram em outra missão:
 *
 * - **Nunca `localStorage`**: a máquina da escola é compartilhada.
 * - **Nunca texto**: nem a busca da galeria. Texto de menor não fica no
 *   aparelho nem viaja (o `AcaoDaGaleriaSchema` só leva o TIPO da busca).
 * - **A chave leva o estudante, a atividade e a rodada**: "Zerar a turma" e a
 *   atividade nova criam OUTRA sessão, e a separação da rodada anterior não pode
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
  /** As peças da regra tocadas antes de enviar (ids opacos). */
  se: string | null;
  entao: string | null;
}

const VAZIA: Memoria = {
  gestoUsado: false,
  permanencias: [],
  se: null,
  entao: null,
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

/** O que está guardado para esta sessão — ou a memória vazia, nunca exceção. */
export function lerMemoria(c: ChaveDaSessao): Memoria {
  try {
    const bruto = window.sessionStorage.getItem(chave(c));
    if (!bruto) return { ...VAZIA };
    const dado = JSON.parse(bruto) as Record<string, unknown>;
    return {
      gestoUsado: dado.gestoUsado === true,
      permanencias: ids(dado.permanencias),
      se: id(dado.se),
      entao: id(dado.entao),
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
