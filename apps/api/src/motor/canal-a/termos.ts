import type { Nivel } from "../../evidencias/regras";
import { CLAUSULAS, type ClausulaId, type EfeitoId, type MudancaId } from "./vocabulario";

/**
 * O 6b — OS TERMOS (EF08CO09, ADR-167). Regra PURA, testada sem banco.
 *
 * Três passos numa tela só: LOCALIZAR (marcar as regras que explicam o que
 * aconteceu no feed — nenhuma, algumas ou todas), o EFEITO de cada marcada, e
 * JULGAR (a mudança que daria mais controle). Os termos são fictícios e
 * aparecem pela primeira vez aqui, depois da revelação.
 */

export interface RespostaDosTermos {
  marcadas: readonly ClausulaId[];
  /** O efeito escolhido para cada cláusula MARCADA. */
  efeitos: Readonly<Partial<Record<ClausulaId, EfeitoId>>>;
  mudanca: MudancaId;
}

/**
 * As contas:
 *   - L: julgamentos certos nas 5 cláusulas (a que explica e foi marcada conta
 *     1; a distração deixada sem marca conta 1), de 0 a 5;
 *   - E: efeitos certos nas que explicam e foram marcadas. O efeito escolhido
 *     para uma distração não conta: ela já conta como erro em L.
 *
 * A RÉGUA:
 *   - atingiu: L de 4 ou 5, E de 2 ou mais, e a mudança "controle";
 *   - em processo: L de 4 ou 5 e E de 1 ou mais, sem fechar o "atingiu";
 *   - não atingiu: L de 3 ou menos; ou L de 4 ou 5 sem nenhum efeito certo.
 * Marcar tudo dá L = 3. Todo envio tem um L, um E e uma mudança: cai em um nível.
 */
export function nivelDosTermos(r: RespostaDosTermos): { nivel: Nivel; l: number; e: number } {
  const marcadas = new Set(r.marcadas);
  let l = 0;
  let e = 0;
  for (const c of CLAUSULAS) {
    const marcada = marcadas.has(c.id);
    if (marcada === c.explica) l += 1;
    if (marcada && c.explica && r.efeitos[c.id] === c.efeito) e += 1;
  }
  if (l >= 4 && e >= 2 && r.mudanca === "controle") return { nivel: "atingiu", l, e };
  if (l >= 4 && e >= 1) return { nivel: "em_processo", l, e };
  return { nivel: "nao_atingiu", l, e };
}

/** Faltou o efeito de alguma cláusula marcada, ou veio efeito de cláusula não marcada? */
export function efeitosCoerentes(r: RespostaDosTermos): boolean {
  const marcadas = new Set(r.marcadas);
  if (marcadas.size !== r.marcadas.length) return false;
  const comEfeito = Object.keys(r.efeitos);
  return comEfeito.length === marcadas.size && comEfeito.every((id) => marcadas.has(id as ClausulaId));
}
