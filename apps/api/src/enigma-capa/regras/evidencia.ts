import type { Nivel } from "../../evidencias/regras";
import { ERROS_POS_AJUDA_NAO_ATINGIU, type Voto } from "../conteudo";

/**
 * A RÉGUA da exp02ef1b — 100% Canal A (one-pager §12a), sem pergunta. Puro: o
 * servidor junta os fatos e chama. Falha técnica é AUSÊNCIA de marca ("Não
 * avaliado"), nunca "não atingiu".
 *
 * Os quatro indicadores (spec, ADR-184):
 *
 * | indicador     | pleno                  | parcial                              | ausente                 |
 * |---------------|------------------------|--------------------------------------|-------------------------|
 * | lupa          | piso com 0 alertas     | 1 alerta                             | 2+ alertas              |
 * | selo          | coerente               | —                                    | incoerente              |
 * | invariantes   | erros < 3 (sem ajuda)  | ajuda acesa e erros pós-ajuda < 3    | erros pós-ajuda ≥ 3     |
 * | transferência | SÓ UM PEDAÇO           | —                                    | MOSTRA TUDO             |
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

export function grauDaTransferencia(voto: Voto): Grau {
  return voto === "so-um-pedaco" ? "pleno" : "ausente";
}

export interface FatosDaCO05 {
  lupa: Grau;
  selo: Grau;
  invariantes: Grau;
  transferencia: Grau;
}

/**
 * EF02CO05 (o FOCO) — marcada no voto da transferência, que conclui.
 *
 * - atingiu: os quatro plenos;
 * - não atingiu: MOSTRA TUDO **e** mais um ausente (selo, lupa ou invariantes);
 * - em processo: o resto.
 *
 * AJUSTE documentado (ADR-184): o PO escreveu o "não atingiu" com "e" entre as
 * quatro faltas. Lido literal, ele seria inalcançável na prática, e a criança
 * que PERSISTE na crença de entrada (MOSTRA TUDO, o descritor central) cairia
 * em "em processo" mesmo com outro sinal ausente. A régua exige a crença MAIS
 * um sinal — MOSTRA TUDO sozinho, com o resto pleno, é "em processo".
 */
export function nivelCO05(f: FatosDaCO05): Nivel {
  if (f.lupa === "pleno" && f.selo === "pleno" && f.invariantes === "pleno" && f.transferencia === "pleno") return "atingiu";
  if (f.transferencia === "ausente" && (f.selo === "ausente" || f.lupa === "ausente" || f.invariantes === "ausente")) return "nao_atingiu";
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
