import { CAMADAS, type Escala } from "../conteudo";

/**
 * Uma PUBLICAÇÃO confirmada no grupo (a 1ª ou a errata): a escala escolhida e
 * as três camadas ligadas ou não. Puro — a régua lê só isto.
 */
export interface Publicacao {
  escala: Escala;
  explicacao: boolean;
  fonte: boolean;
  contexto: boolean;
}

export function camadasAtivas(p: Publicacao): number {
  return CAMADAS.filter((c) => p[c]).length;
}

/** "Adequada" (decisão 4): a mesma regra do atingiu da EM13CO12 — eixo em 0 E fonte ligada. */
export function adequada(p: Publicacao): boolean {
  return p.escala === 0 && p.fonte;
}

/** A publicação que VALE para a régua do conjunto final: a errata, se houve; senão a 1ª. */
export function publicacaoFinal(inicial: Publicacao, errata: Publicacao | null): Publicacao {
  return errata ?? inicial;
}

/** Regressão: a errata levou o eixo de 0 para 80. */
export function regrediu(inicial: Publicacao, errata: Publicacao): boolean {
  return inicial.escala === 0 && errata.escala === 80;
}

/**
 * A errata CORRIGIU alguma coisa? O eixo de 80 para 0 (o centro: conta mesmo
 * tirando a fonte, decisão 4), ou acrescentou a fonte ou o contexto que
 * faltavam.
 */
export function corrigiu(inicial: Publicacao, errata: Publicacao): boolean {
  if (inicial.escala === 80 && errata.escala === 0) return true;
  return (!inicial.fonte && errata.fonte) || (!inicial.contexto && errata.contexto);
}

/** O mesmo conjunto? (a idempotência das rotas de publicar compara por isto) */
export function mesmaPublicacao(a: Publicacao, b: Publicacao): boolean {
  return a.escala === b.escala && a.explicacao === b.explicacao && a.fonte === b.fonte && a.contexto === b.contexto;
}
