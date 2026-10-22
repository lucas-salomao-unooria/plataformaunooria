import type { Nivel } from "../../evidencias/regras";

/**
 * A RÉGUA do Canal A das quatro habilidades (one-pager §12a, contrato de
 * evidência). Puro: o servidor junta os fatos e chama. Sem Canal B (decisão do
 * PO, 2026-10-22): toda habilidade é medida pelo que o estudante FAZ.
 *
 * Quem não teve a oportunidade fica "Não avaliado" — a AUSÊNCIA de marca —,
 * nunca "não atingiu": CO14 e CO26 marcam no PUBLICAR; CO24 e CO08 marcam a
 * cada ação no feed (vale a melhor) e, se nada foi feito, no momento em que o
 * feed fecha para o estudante (a abertura do Explicar).
 */

/**
 * EM13CO14 — confiabilidade: PERGUNTOU a fonte E corrigiu/tirou a estatística.
 * Uma das duas: em processo (perguntou e publicou o dado; ou tirou sem checar).
 */
export function nivelCO14(f: { pediuFonte: boolean; dadoResolvido: boolean }): Nivel {
  if (f.pediuFonte && f.dadoResolvido) return "atingiu";
  if (f.pediuFonte || f.dadoResolvido) return "em_processo";
  return "nao_atingiu";
}

/** EM13CO26 — direito digital: o crédito ao veículo E o colega fora do post. Um dos dois: em processo. */
export function nivelCO26(f: { plagioResolvido: boolean; lgpdResolvido: boolean }): Nivel {
  const n = Number(f.plagioResolvido) + Number(f.lgpdResolvido);
  return n === 2 ? "atingiu" : n === 1 ? "em_processo" : "nao_atingiu";
}

/**
 * EM13CO24 (o foco) — saúde: abriu relatos das DUAS dimensões (física e
 * mental) E executou uma moderação. Qualquer combinação intermediária
 * registrada é em processo; nenhuma ação registrada (nem comentário aberto,
 * nem métrica, nem moderação), não atingiu.
 */
export function nivelCO24(f: { fisica: boolean; mental: boolean; moderou: boolean; metricas: boolean }): Nivel {
  if (f.fisica && f.mental && f.moderou) return "atingiu";
  if (f.fisica || f.mental || f.moderou || f.metricas) return "em_processo";
  return "nao_atingiu";
}

/** EM13CO08 — segurança: preservar privacidade, reportar e buscar ajuda, VOLUNTARIAMENTE. Os três: atingiu. */
export function nivelCO08(f: { privacidade: boolean; denunciou: boolean; ajuda: boolean }): Nivel {
  const n = Number(f.privacidade) + Number(f.denunciou) + Number(f.ajuda);
  return n === 3 ? "atingiu" : n >= 1 ? "em_processo" : "nao_atingiu";
}

/** Os ids dos marcadores da ficha (`evidencias/fichas/exp02em1b.ts`). */
export const MARCADOR_CO14 = "auditoria-da-fonte";
export const MARCADOR_CO26 = "direito-digital-no-post";
export const MARCADOR_CO24 = "cuidado-com-a-saude";
export const MARCADOR_CO08 = "protecao-na-rede";
