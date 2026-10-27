import type { Nivel } from "../../evidencias/regras";
import { ERROS_POS_AJUDA_NAO_ATINGIU } from "../conteudo";

/**
 * A RÉGUA da exp02ef1b — 100% Canal A (one-pager §12a), sem pergunta. Puro: o
 * servidor junta os fatos e chama. Falha técnica é AUSÊNCIA de marca ("Não
 * avaliado"), nunca "não atingiu".
 *
 * Os quatro indicadores (régua v2, ADR-186):
 *
 * | indicador   | pleno                                        | parcial                           | ausente              |
 * |-------------|----------------------------------------------|-----------------------------------|----------------------|
 * | lupa        | piso com 0 alertas                           | 1 alerta                          | 2+ alertas           |
 * | selo        | coerente                                     | —                                 | incoerente           |
 * | invariantes | erros < 3 (sem ajuda)                        | ajuda acesa e erros pós-ajuda < 3 | erros pós-ajuda ≥ 3  |
 * | fora        | marcou ≥ 1 marcável que ficou fora da capa   | —                                 | nenhum               |
 *
 * O "fora" (E4, Momento 5: "Marque na biblioteca o que ficou fora da sua
 * foto") mede, por ação e corrigido no servidor (`itensFora`), o
 * reconhecimento de que a foto mostra só um pedaço do lugar.
 */
export type Grau = "pleno" | "parcial" | "ausente";

export function grauDaLupa(alertas: number): Grau {
  return alertas <= 0 ? "pleno" : alertas === 1 ? "parcial" : "ausente";
}

export function grauDoSelo(coerente: boolean): Grau {
  return coerente ? "pleno" : "ausente";
}

export function grauDosInvariantes(f: { ajuda: boolean; errosPosAjuda: number }): Grau {
  if (!f.ajuda) return "pleno";
  return f.errosPosAjuda < ERROS_POS_AJUDA_NAO_ATINGIU ? "parcial" : "ausente";
}

/** `itensFora` = os marcáveis que a criança tocou E que ficaram fora da capa publicada. */
export function grauDoFora(itensFora: number): Grau {
  return itensFora >= 1 ? "pleno" : "ausente";
}

export interface FatosDaCO05 {
  lupa: Grau;
  selo: Grau;
  invariantes: Grau;
  fora: Grau;
}

/**
 * EF02CO05 (o FOCO) — marcada no "Pronto" da cena inteira (`POST /fora`).
 *
 * - atingiu: os quatro plenos;
 * - não atingiu: `fora` ausente **e** mais um ausente (selo, lupa ou invariantes);
 * - em processo: o resto.
 *
 * AJUSTE documentado (ADR-184, mantido na ADR-186): o PO escreveu o "não
 * atingiu" com "e" entre as quatro faltas. Lido literal, ele seria inalcançável
 * na prática. A régua exige a falta CENTRAL (não marcar nada fora da foto) MAIS
 * um sinal — o "fora" ausente sozinho, com o resto pleno, é "em processo".
 */
export function nivelCO05(f: FatosDaCO05): Nivel {
  if (f.lupa === "pleno" && f.selo === "pleno" && f.invariantes === "pleno" && f.fora === "pleno") return "atingiu";
  if (f.fora === "ausente" && (f.selo === "ausente" || f.lupa === "ausente" || f.invariantes === "ausente")) return "nao_atingiu";
  return "em_processo";
}

/**
 * EF02CO01 (associada) — marcada quando os quatro achados completam.
 *
 * - atingiu: achou sem a ajuda (menos de 3 erros);
 * - em processo: achou com a ajuda acesa e menos de 3 erros depois dela;
 * - não atingiu: 3+ erros depois da ajuda — o "precisou de apontamento do
 *   professor" do PO, medido (o fluxo segue: o professor aponta, ela acha).
 */
export function nivelCO01(f: { ajuda: boolean; errosPosAjuda: number }): Nivel {
  const g = grauDosInvariantes(f);
  return g === "pleno" ? "atingiu" : g === "parcial" ? "em_processo" : "nao_atingiu";
}

/** Os ids dos marcadores da ficha (`evidencias/fichas/exp02ef1b.ts`). */
export const MARCADOR_CO05 = "recorte-da-capa";
export const MARCADOR_CO01 = "invariantes-do-fundo";
