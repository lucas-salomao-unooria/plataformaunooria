import type { Nivel } from "../../evidencias/regras";
import { BLOCOS, SLOTS_DO_PROTOCOLO, type BlocoId, type Caminho, type Criterio, type ProjetoId } from "../conteudo";

/**
 * A RÉGUA do Canal A das duas habilidades (one-pager v5 §12a, com as
 * correções do PO de 28 e 29/10 e o plano aprovado de 2026-10-29). Puro: o
 * servidor junta os fatos e chama. Toda função tem o ramo RESIDUAL; quem não
 * chega ao gesto não é marcado ("Não avaliado", a ausência de linha).
 *
 * Quando cada uma é marcada (na transação do gesto):
 *   - EF09CO08 no "Registrar Decisão" (o caminho A1/A2 já é "atingiu": a
 *     investigação veio antes da escolha) e no "Confirmar Decisão Final" (o
 *     conjunto: caminho, troca de projeto e os dois rankings). A porta
 *     `marcar` guarda a MELHOR marca;
 *   - EF09CO07 no "Enviar Proposta" do Editor de Protocolo.
 */

// ─────────────────────────────────────────── o caminho da investigação (E2)

/** A1: perguntou e digitalizou antes da escolha; A2: perguntou e não digitalizou; B: não perguntou. */
export function caminhoDe(f: { cadernosOferecidos: boolean; digitalizouNaE2: boolean }): Caminho {
  if (f.digitalizouNaE2) return "A1";
  return f.cadernosOferecidos ? "A2" : "B";
}

// ─────────────────────────────────────────── EF09CO08 (E2 a E4)

export interface FatosDaCO08 {
  caminho: Caminho;
  projetoInicial: ProjetoId;
  rankingInicial: readonly Criterio[];
  /** `null` = ainda não revotou (a marca do "Registrar Decisão"). */
  projetoFinal: ProjetoId | null;
  rankingFinal: readonly Criterio[] | null;
}

/** A urgência social ficou ACIMA da regularidade documental no ranking? */
export function urgenciaAcimaDaRegularidade(ranking: readonly Criterio[]): boolean {
  const u = ranking.indexOf("urgencia");
  const r = ranking.indexOf("regularidade");
  return u >= 0 && r >= 0 && u < r;
}

export function mesmoRanking(a: readonly Criterio[], b: readonly Criterio[]): boolean {
  return a.length === b.length && a.every((c, i) => c === b[i]);
}

/**
 * EF09CO08 (one-pager §12a, Canal A):
 *   - atingiu: investigou a lacuna (caminho A1 ou A2) OU, no 2º voto, pôs a
 *     urgência social acima da regularidade documental;
 *   - em processo: caminho B e o 2º voto mudou ALGO — o projeto ou o ranking
 *     (a régua do PO cobre "mudou de projeto com o ranking idêntico"; a
 *     mudança do ranking sem cumprir o atingiu cai aqui também — plano G4,
 *     [PROPOSTA] para o PO);
 *   - não atingiu: caminho B, o mesmo projeto e o mesmo ranking.
 * Sem o 2º voto, só o caminho A marca (atingiu); o B espera o 2º voto.
 */
export function nivelCO08(f: FatosDaCO08): Nivel | null {
  if (f.caminho !== "B") return "atingiu";
  if (f.projetoFinal === null || f.rankingFinal === null) return null;
  if (urgenciaAcimaDaRegularidade(f.rankingFinal)) return "atingiu";
  const mudouProjeto = f.projetoFinal !== f.projetoInicial;
  const mudouRanking = !mesmoRanking(f.rankingInicial, f.rankingFinal);
  return mudouProjeto || mudouRanking ? "em_processo" : "nao_atingiu";
}

// ─────────────────────────────────────────── EF09CO07 (E5, o protocolo)

/** O gabarito: a verificação de cada bloco no fluxo, e a prática danosa. Nunca desce ao cliente. */
export const GABARITO_DO_PROTOCOLO: readonly BlocoId[] = ["auditar-fontes", "normalizar-impacto", "sinalizar-pendencias"];
export const BLOCO_DANOSO: BlocoId = "desclassificar-sem-pdf";

export interface Protocolo {
  /** As três verificações, na ordem; `null` = vazia. */
  slots: readonly (BlocoId | null)[];
  /** Os blocos na Área de Descarte. */
  descarte: readonly BlocoId[];
}

/** O protocolo é bem-formado? (≥ 1 bloco na esteira, nenhum bloco repetido.) A régua é outra coisa. */
export function problemasDoProtocolo(p: Protocolo): string[] {
  const problemas: string[] = [];
  if (p.slots.length !== SLOTS_DO_PROTOCOLO) problemas.push(`A esteira tem exatamente ${SLOTS_DO_PROTOCOLO} verificações.`);
  const usados = [...p.slots.filter((b): b is BlocoId => b !== null), ...p.descarte];
  if (p.slots.every((b) => b === null)) problemas.push("Posicione pelo menos um bloco na esteira.");
  if (new Set(usados).size !== usados.length) problemas.push("Cada bloco entra uma vez só.");
  if (usados.some((b) => !(BLOCOS as readonly string[]).includes(b))) problemas.push("Bloco desconhecido.");
  return problemas;
}

/** Quantos blocos estão na verificação certa. */
export function blocosCorretos(p: Protocolo): number {
  return GABARITO_DO_PROTOCOLO.filter((b, i) => p.slots[i] === b).length;
}

/**
 * EF09CO07 (correção do PO de 28/10, régua ternária no servidor):
 *   - atingiu: A, B e C nas verificações certas E o D na lixeira;
 *   - em processo: 2 dos 3 certos, ou os 3 certos sem o D na lixeira;
 *   - não atingiu: qualquer outra combinação.
 */
export function nivelCO07(p: Protocolo): Nivel {
  const certos = blocosCorretos(p);
  const descartou = p.descarte.includes(BLOCO_DANOSO);
  if (certos === 3 && descartou) return "atingiu";
  if (certos === 2 || certos === 3) return "em_processo";
  return "nao_atingiu";
}

/** Os ids dos marcadores da ficha (`evidencias/fichas/exp09ef1b.ts`). */
export const MARCADOR_CO07 = "protocolo_assistente";
export const MARCADOR_CO08 = "investigacao_e_revisao";
