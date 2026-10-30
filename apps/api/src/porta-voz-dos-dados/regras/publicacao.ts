import { CAMADAS, CAMADAS_DO_COMPOSITOR, type CamadaDoCompositor, type Escala } from "../conteudo";

/**
 * Uma PUBLICAÇÃO confirmada no grupo (a 1ª ou a errata): a escala escolhida e
 * as quatro camadas ligadas ou não — as três corretas e a `projecao`, a
 * incorreta (ADR-203). Puro — a régua lê só isto.
 */
export interface Publicacao {
  escala: Escala;
  explicacao: boolean;
  fonte: boolean;
  contexto: boolean;
  projecao: boolean;
}

/** Quantas das três camadas CORRETAS estão ligadas (a projeção não conta). */
export function camadasAtivas(p: Publicacao): number {
  return CAMADAS.filter((c) => p[c]).length;
}

/**
 * A ordem das quatro camadas no compositor, EMBARALHADA por estudante e
 * atividade (ADR-203): a incorreta não pode morar sempre no mesmo lugar, senão
 * a turma descobre a posição em vez de ler. Determinística pela semente — o
 * F5 e a errata mostram a mesma ordem. FNV-1a + Fisher-Yates com um gerador
 * linear: não precisa ser criptográfico, só estável e espalhado.
 */
export function ordemDasCamadas(semente: string): CamadaDoCompositor[] {
  let h = 0x811c9dc5;
  for (let i = 0; i < semente.length; i += 1) {
    h ^= semente.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const proximo = () => {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    return h / 2 ** 32;
  };
  const ordem: CamadaDoCompositor[] = [...CAMADAS_DO_COMPOSITOR];
  for (let i = ordem.length - 1; i > 0; i -= 1) {
    const j = Math.floor(proximo() * (i + 1));
    [ordem[i], ordem[j]] = [ordem[j]!, ordem[i]!];
  }
  return ordem;
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
 * faltavam, ou DESLIGOU a projeção incorreta (ADR-203).
 */
export function corrigiu(inicial: Publicacao, errata: Publicacao): boolean {
  if (inicial.escala === 80 && errata.escala === 0) return true;
  return (!inicial.fonte && errata.fonte) || (!inicial.contexto && errata.contexto) || (inicial.projecao && !errata.projecao);
}

/** O mesmo conjunto? (a idempotência das rotas de publicar compara por isto) */
export function mesmaPublicacao(a: Publicacao, b: Publicacao): boolean {
  return (
    a.escala === b.escala && a.explicacao === b.explicacao && a.fonte === b.fonte && a.contexto === b.contexto && a.projecao === b.projecao
  );
}
