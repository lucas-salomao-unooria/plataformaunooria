import type { Nivel } from "../../evidencias/regras";
import { areaDoProjeto, type Area } from "../vocabulario";
import type { Auditoria } from "./galeria";

/**
 * As RÉGUAS das três ações da ficha (`evidencias/fichas/exp06ef1b.ts`). Puras:
 * a missão calcula o nível AQUI e o entrega pela porta `marcar`, dentro da
 * transação do latch (a revisão do voto) ou da montagem (pacotes, cadeia).
 *
 * Quem sai antes de uma ação não tem marca dela — "Não avaliado", a AUSÊNCIA
 * de linha (E14) —, nunca "não atingiu". O "não atingiu" de cada régua é de
 * quem FEZ a ação sem o que ela mede.
 */

/** Os marcadores de ação da ficha. Os ids são contrato com `fichas/exp06ef1b.ts`. */
export const MARCADOR_DA_AUDITORIA = "auditoria";
export const MARCADOR_DOS_PACOTES = "pacotes";
export const MARCADOR_DA_CADEIA = "cadeia";

/** Quantas áreas ocultas, fora a do voto, a EF06CO01 pede para "atingiu" quando a criança não buscou. */
export const AREAS_OCULTAS_PARA_ATINGIR = 2;

/**
 * **EF06CO01** (classificar a informação), marcada no LATCH da revisão do voto,
 * sobre o que a criança fez na Galeria Oculta ANTES de decidir:
 *
 * - atingiu: abriu estandes OCULTOS de ao menos duas áreas que não a do voto,
 *   OU buscou por outra área E abriu ao menos um oculto — ela usou a categoria
 *   do estande para procurar o que o feed escondeu;
 * - em processo: abriu ou buscou alguma coisa;
 * - não atingiu: revisou o voto sem abrir nem buscar nada.
 *
 * `areaDoVoto` é a área do voto INICIAL (o lacrado): é a bolha que a galeria
 * confronta.
 */
export function nivelDaAuditoria(auditoria: Auditoria, ocultos: readonly string[], areaDoVoto: Area): Nivel {
  const oculto = new Set(ocultos);
  const ocultosAbertos = auditoria.abertos.filter((id) => oculto.has(id));
  const areasForaDoVoto = new Set(ocultosAbertos.map(areaDoProjeto).filter((a) => a !== areaDoVoto));
  const buscouOutraArea = auditoria.buscas.some((b) => b.area !== null && b.area !== areaDoVoto);

  if (areasForaDoVoto.size >= AREAS_OCULTAS_PARA_ATINGIR) return "atingiu";
  if (buscouOutraArea && ocultosAbertos.length > 0) return "atingiu";
  if (auditoria.abertos.length > 0 || auditoria.buscas.length > 0) return "em_processo";
  return "nao_atingiu";
}

/**
 * **EF06CO07** (pacotes) e **EF06CO03** (a cadeia), pelo número de tentativas
 * até a montagem certa — a régua da Chave do Jornal: uma = atingiu; duas ou
 * três = em processo; mais de três = não atingiu.
 */
export function nivelPorTentativas(tentativas: number): Nivel {
  if (tentativas <= 1) return "atingiu";
  if (tentativas <= 3) return "em_processo";
  return "nao_atingiu";
}
