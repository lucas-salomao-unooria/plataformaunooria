import type { Nivel } from "../../evidencias/regras";
import { areaDoProjeto, type Area } from "../vocabulario";
import type { Auditoria } from "./galeria";

/**
 * As RÉGUAS das três ações da ficha (`evidencias/fichas/exp06ef1b.ts`, versão
 * 4 — PRD v2 §14.2 com a melhoria 3). Puras: a missão calcula o nível AQUI e o
 * entrega pela porta `marcar`, dentro da transação do latch (a revisão do
 * voto) ou da montagem (a cadeia).
 *
 * Quem sai antes de uma ação não tem marca dela — "Não avaliado", a AUSÊNCIA
 * de linha (E14) —, nunca "não atingiu". E quem revisa o voto sem explorar a
 * galeria também fica SEM marca de ação (ficha versão 3): a régua devolve
 * `null`, e o nível sai da pergunta da habilidade (vale o melhor).
 *
 * As duas réguas da galeria leem o MESMO registro e medem coisas DIFERENTES:
 *
 * - a **EF06CO10** olha a INVESTIGAÇÃO: abriu concorrentes que o feed escondeu
 *   E fez busca ativa (PRD §14.2: `abertos ≥ 2 AND buscas ≥ 1`);
 * - a **EF06CO01** olha a CLASSIFICAÇÃO: usou a hashtag de uma categoria que
 *   FICOU FORA da bolha como chave para chegar à coleção dela.
 */

/** Os marcadores de ação da ficha. Os ids são contrato com `fichas/exp06ef1b.ts`. */
export const MARCADOR_DA_AUDITORIA = "auditoria";
export const MARCADOR_DA_CLASSIFICACAO = "classificacao";
export const MARCADOR_DA_CADEIA = "cadeia";

/** Quantos estandes OCULTOS a EF06CO10 pede abertos para "atingiu" (PRD §14.1: "≥ 2 projetos ocultos"). */
export const OCULTOS_PARA_ATINGIR = 2;

/**
 * **EF06CO10** (PRD v2 §14.2), no LATCH da revisão do voto:
 *
 * - atingiu: abriu ao menos DOIS estandes que o feed escondeu E buscou ao
 *   menos uma vez (hashtag ou texto);
 * - em processo: abriu algum estande (oculto ou não) sem fechar o par;
 * - sem marca (`null`): não abriu nada. Buscar sem abrir também fica sem
 *   marca AQUI (o PRD só conta a abertura no "em processo") — a busca conta na
 *   EF06CO01.
 */
export function nivelDaAuditoria(auditoria: Auditoria, ocultos: readonly string[]): Nivel | null {
  const oculto = new Set(ocultos);
  const ocultosAbertos = auditoria.abertos.filter((id) => oculto.has(id));
  if (ocultosAbertos.length >= OCULTOS_PARA_ATINGIR && auditoria.buscas.length >= 1) return "atingiu";
  if (auditoria.abertos.length >= 1) return "em_processo";
  return null;
}

/**
 * **EF06CO01** — a régua da melhoria 3 (2026-10-10), no mesmo latch:
 *
 * - atingiu: buscou pela HASHTAG de uma categoria que ficou FORA do feed dele
 *   E abriu um projeto dessa categoria;
 * - em processo: buscou qualquer coisa, ou abriu algum estande oculto;
 * - sem marca (`null`): nada.
 *
 * "Ficou fora do feed": a abertura do feed mostra UM estande de cada área, então
 * nenhuma categoria fica literalmente ausente. A categoria fora é qualquer uma
 * que NÃO é a que dominou o feed (`areaDominante`: a líder, ou a de mais posts)
 * — é a coleção que a bolha escondeu.
 */
export function nivelDaClassificacao(
  auditoria: Auditoria,
  ocultos: readonly string[],
  areaDoFeed: Area | null,
): Nivel | null {
  const areasAbertas = new Set(auditoria.abertos.map(areaDoProjeto));
  const classificou = auditoria.buscas.some(
    (b) => b.tipo === "hashtag" && b.area !== null && b.area !== areaDoFeed && areasAbertas.has(b.area),
  );
  if (classificou) return "atingiu";
  const oculto = new Set(ocultos);
  if (auditoria.buscas.length > 0 || auditoria.abertos.some((id) => oculto.has(id))) return "em_processo";
  return null;
}

/**
 * **EF06CO03** (a cadeia), pelo número de tentativas até a montagem certa: uma
 * = atingiu; duas ou três = em processo; mais de três = não atingiu.
 */
export function nivelPorTentativas(tentativas: number): Nivel {
  if (tentativas <= 1) return "atingiu";
  if (tentativas <= 3) return "em_processo";
  return "nao_atingiu";
}
