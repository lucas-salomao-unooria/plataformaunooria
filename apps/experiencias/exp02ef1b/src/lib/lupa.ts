import type { Alvo, InvarianteId, RelatoDaLupa } from "./tipos";

/**
 * O CRONÔMETRO da lupa (E2) — puro, testado em `lupa.test.ts`.
 *
 * A criança procura os DOIS objetos do fundo. A cada amostra, o tempo desde a
 * anterior vai para o objeto que está sob o CENTRO da lente (em qualquer das
 * duas fotos): é o anel que enche em 3 s. Cheio, o objeto está "achado". O
 * servidor guarda o máximo, limita ao tempo desde a entrada e decide o piso;
 * o piso LOCAL aqui só acende o botão e diz para onde a mãozinha aponta.
 */

/** Uma amostra nunca vale mais que isto: a aba que dormiu não ganha minutos de lupa de uma vez. */
export const AMOSTRA_MAXIMA_MS = 500;

/**
 * A lente "está sobre" o objeto com uma folga além do raio do alvo: o centro
 * da lente é um ponto, e a criança de 7 anos o mantém PERTO, não em cima.
 */
export const FOLGA_DO_ALVO = 1.25;

export const LUPA_VAZIA: RelatoDaLupa = { alvo1Ms: 0, alvo2Ms: 0 };

const CAMPO: Record<InvarianteId, keyof RelatoDaLupa> = { "inv-1": "alvo1Ms", "inv-2": "alvo2Ms" };

export function msDo(l: RelatoDaLupa, id: InvarianteId): number {
  return l[CAMPO[id]];
}

/** O alvo sob o ponto (0–100 da panorâmica), com a folga — o alvo é redondo na TELA (9/16). */
export function alvoSob(alvos: readonly Alvo[], p: { x: number; y: number }, proporcao = 16 / 9): Alvo | null {
  let melhor: { alvo: Alvo; d: number } | null = null;
  for (const a of alvos) {
    const dx = p.x - a.x;
    const dy = (p.y - a.y) / proporcao;
    const d = Math.hypot(dx, dy);
    if (d <= a.r * FOLGA_DO_ALVO && (!melhor || d < melhor.d)) melhor = { alvo: a, d };
  }
  return melhor?.alvo ?? null;
}

export function registrarAmostra(atual: RelatoDaLupa, sobre: InvarianteId | null, dtMs: number): RelatoDaLupa {
  if (!sobre) return atual;
  const dt = Math.max(0, Math.min(AMOSTRA_MAXIMA_MS, Math.round(dtMs)));
  const campo = CAMPO[sobre];
  return { ...atual, [campo]: atual[campo] + dt };
}

/** O que o servidor já tem não volta atrás: o relato parte do máximo dos dois. */
export function juntarRelatos(a: RelatoDaLupa, b: RelatoDaLupa): RelatoDaLupa {
  return { alvo1Ms: Math.max(a.alvo1Ms, b.alvo1Ms), alvo2Ms: Math.max(a.alvo2Ms, b.alvo2Ms) };
}

export function achados(l: RelatoDaLupa, pisoMs: number): InvarianteId[] {
  return (["inv-1", "inv-2"] as const).filter((id) => msDo(l, id) >= pisoMs);
}

export function pisoLocal(l: RelatoDaLupa, pisoMs: number): boolean {
  return achados(l, pisoMs).length === 2;
}

/** O objeto para onde a mãozinha do "OLHE O FUNDO" aponta: o primeiro que ainda falta. */
export function alvoQueFalta(l: RelatoDaLupa, pisoMs: number): InvarianteId | null {
  return (["inv-1", "inv-2"] as const).find((id) => msDo(l, id) < pisoMs) ?? null;
}

/** Vale mandar um relato periódico? Só se mudou algo que o servidor ainda não sabe. */
export function relatoMudou(enviado: RelatoDaLupa, atual: RelatoDaLupa, folgaMs = 250): boolean {
  return atual.alvo1Ms - enviado.alvo1Ms >= folgaMs || atual.alvo2Ms - enviado.alvo2Ms >= folgaMs;
}
