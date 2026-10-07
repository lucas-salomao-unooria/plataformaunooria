import type { Nivel } from "../../evidencias/regras";
import { areaDoProjeto, type Area } from "../vocabulario";
import type { Auditoria } from "./galeria";

/**
 * As RÉGUAS das três ações da ficha (`evidencias/fichas/exp06ef1b.ts`). Puras:
 * a missão calcula o nível AQUI e o entrega pela porta `marcar`, dentro da
 * transação do latch (a revisão do voto) ou da montagem (a cadeia).
 *
 * Quem sai antes de uma ação não tem marca dela — "Não avaliado", a AUSÊNCIA
 * de linha (E14) —, nunca "não atingiu". O "não atingiu" de cada régua é de
 * quem FEZ a ação sem o que ela mede.
 *
 * As duas réguas da galeria (EF06CO10 e EF06CO01) leem o MESMO registro — o que
 * a criança abriu e buscou antes de revisar o voto — e medem coisas DIFERENTES
 * de propósito (pedido do PO, 2026-10-06):
 *
 * - a **EF06CO10** olha a INVESTIGAÇÃO: quantos concorrentes que o feed
 *   escondeu ela foi ver antes de decidir. É a auditoria da mediação
 *   algorítmica — o consumo crítico da plataforma;
 * - a **EF06CO01** olha a CLASSIFICAÇÃO: se ela usou a categoria (a hashtag da
 *   área) como chave para chegar à coleção que o feed não mostrou. Abrir
 *   ocultos ao acaso, sem a hashtag, é investigar sem classificar.
 */

/** Os marcadores de ação da ficha. Os ids são contrato com `fichas/exp06ef1b.ts`. */
export const MARCADOR_DA_AUDITORIA = "auditoria";
export const MARCADOR_DA_CLASSIFICACAO = "classificacao";
export const MARCADOR_DA_CADEIA = "cadeia";

/** Quantos estandes OCULTOS a EF06CO10 pede abertos para "atingiu" (a matriz da spec: "≥ 2 projetos ocultos"). */
export const OCULTOS_PARA_ATINGIR = 2;

/**
 * **EF06CO10** (analisar criticamente o consumo de tecnologia — aqui, a
 * mediação do feed), marcada no LATCH da revisão do voto, sobre o que a
 * criança fez na Galeria Oculta ANTES de manter ou trocar o voto:
 *
 * - atingiu: abriu ao menos DOIS estandes que o feed dela escondeu — ela foi
 *   conferir os concorrentes antes de validar (ou trocar) a escolha;
 * - em processo: entrou na auditoria, mas superficialmente — abriu um oculto
 *   só, abriu só estandes que já tinha visto, ou buscou sem abrir;
 * - não atingiu: revisou o voto sem abrir nem buscar nada (fechou a auditoria
 *   sem inspecionar concorrente nenhum).
 */
export function nivelDaAuditoria(auditoria: Auditoria, ocultos: readonly string[]): Nivel {
  const oculto = new Set(ocultos);
  const ocultosAbertos = auditoria.abertos.filter((id) => oculto.has(id));
  if (ocultosAbertos.length >= OCULTOS_PARA_ATINGIR) return "atingiu";
  if (auditoria.abertos.length > 0 || auditoria.buscas.length > 0) return "em_processo";
  return "nao_atingiu";
}

/**
 * **EF06CO01** (classificar informações em coleções e associar cada uma a um
 * tipo de dado), no mesmo latch:
 *
 * - atingiu: buscou pela HASHTAG de uma área que não a do voto E abriu um
 *   estande oculto DAQUELA área — usou a categoria como chave da coleção;
 * - em processo: buscou alguma coisa (por texto, pela própria área, ou pela
 *   hashtag sem abrir o que ela trouxe);
 * - não atingiu: não buscou — a categoria não entrou na auditoria dela.
 *
 * `areaDoVoto` é a área do voto INICIAL (o lacrado): é a bolha que a galeria
 * confronta.
 */
export function nivelDaClassificacao(auditoria: Auditoria, ocultos: readonly string[], areaDoVoto: Area): Nivel {
  const oculto = new Set(ocultos);
  const areasDosOcultosAbertos = new Set(auditoria.abertos.filter((id) => oculto.has(id)).map(areaDoProjeto));
  const classificou = auditoria.buscas.some(
    (b) => b.tipo === "hashtag" && b.area !== null && b.area !== areaDoVoto && areasDosOcultosAbertos.has(b.area),
  );
  if (classificou) return "atingiu";
  if (auditoria.buscas.length > 0) return "em_processo";
  return "nao_atingiu";
}

/**
 * **EF06CO03** (a cadeia), pelo número de tentativas até a montagem certa — a
 * régua da Chave do Jornal: uma = atingiu; duas ou três = em processo; mais de
 * três = não atingiu.
 */
export function nivelPorTentativas(tentativas: number): Nivel {
  if (tentativas <= 1) return "atingiu";
  if (tentativas <= 3) return "em_processo";
  return "nao_atingiu";
}
