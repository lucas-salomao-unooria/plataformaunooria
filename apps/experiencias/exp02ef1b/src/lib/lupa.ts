import type { Alvo, ChaveDaLupa, FotoId, InvarianteId, RelatoDaLupa } from "./tipos";

/**
 * O CRONÔMETRO da lupa (E2) — puro, testado em `lupa.test.ts`.
 *
 * A criança procura os DOIS objetos do fundo EM CADA UMA das duas fotos. A
 * cada amostra, o tempo desde a anterior vai para o par objeto × foto que está
 * sob o CENTRO da lente: é o anel que enche em 3 s. Cheio, AQUELE objeto
 * NAQUELA foto está "achado" — a outra foto continua por olhar (2.2.0,
 * ADR-188: até a 2.1.0 o tempo era do objeto, em qualquer foto, e achar na
 * foto 1 marcava a foto 2). O servidor guarda o máximo, limita ao tempo desde a
 * entrada e decide o piso; o piso LOCAL aqui só acende o botão e diz para onde
 * a mãozinha aponta.
 */

/** Uma amostra nunca vale mais que isto: a aba que dormiu não ganha minutos de lupa de uma vez. */
export const AMOSTRA_MAXIMA_MS = 500;

/** A ordem dos achados: o relógio na foto 1, na foto 2, o cartaz na foto 1, na foto 2. */
export const CHAVES_DA_LUPA: readonly ChaveDaLupa[] = ["inv-1:foto-1", "inv-1:foto-2", "inv-2:foto-1", "inv-2:foto-2"];

export const LUPA_VAZIA: RelatoDaLupa = { "inv-1:foto-1": 0, "inv-1:foto-2": 0, "inv-2:foto-1": 0, "inv-2:foto-2": 0 };

export const chaveDe = (inv: InvarianteId, foto: FotoId): ChaveDaLupa => `${inv}:${foto}`;
export const fotoDa = (k: ChaveDaLupa): FotoId => (k.endsWith("foto-1") ? "foto-1" : "foto-2");
export const objetoDa = (k: ChaveDaLupa): InvarianteId => (k.startsWith("inv-1") ? "inv-1" : "inv-2");

/**
 * O objeto sob o ponto (0–100 da panorâmica): dentro da ÁREA que o professor
 * desenhou, com a folga do servidor (`geometria.margemDoAlvo`, em % da
 * largura; na vertical, a mesma distância NA TELA — × a proporção 16:9). O
 * centro da lente é um ponto, e a criança de 7 anos o mantém PERTO, não em cima.
 */
export function alvoSob(alvos: readonly Alvo[], p: { x: number; y: number }, margem: number, proporcao = 16 / 9): Alvo | null {
  const my = margem * proporcao;
  return alvos.find((a) => p.x >= a.x - margem && p.x <= a.x + a.w + margem && p.y >= a.y - my && p.y <= a.y + a.h + my) ?? null;
}

export function registrarAmostra(atual: RelatoDaLupa, sobre: ChaveDaLupa | null, dtMs: number): RelatoDaLupa {
  if (!sobre) return atual;
  const dt = Math.max(0, Math.min(AMOSTRA_MAXIMA_MS, Math.round(dtMs)));
  return { ...atual, [sobre]: atual[sobre] + dt };
}

/** O que o servidor já tem não volta atrás: o relato parte do máximo dos dois. */
export function juntarRelatos(a: RelatoDaLupa, b: RelatoDaLupa): RelatoDaLupa {
  return Object.fromEntries(CHAVES_DA_LUPA.map((k) => [k, Math.max(a[k], b[k])])) as RelatoDaLupa;
}

export function achados(l: RelatoDaLupa, pisoMs: number): ChaveDaLupa[] {
  return CHAVES_DA_LUPA.filter((k) => l[k] >= pisoMs);
}

/** Quantos objetos já achados NESTA foto (o "1 DE 2" do rótulo dela). */
export function achadosNaFoto(l: RelatoDaLupa, pisoMs: number, foto: FotoId): number {
  return achados(l, pisoMs).filter((k) => fotoDa(k) === foto).length;
}

export function pisoLocal(l: RelatoDaLupa, pisoMs: number): boolean {
  return achados(l, pisoMs).length === CHAVES_DA_LUPA.length;
}

/** O par objeto × foto para onde a mãozinha do "OLHE O FUNDO" aponta: o primeiro que ainda falta. */
export function alvoQueFalta(l: RelatoDaLupa, pisoMs: number): ChaveDaLupa | null {
  return CHAVES_DA_LUPA.find((k) => l[k] < pisoMs) ?? null;
}

/** Vale mandar um relato periódico? Só se mudou algo que o servidor ainda não sabe. */
export function relatoMudou(enviado: RelatoDaLupa, atual: RelatoDaLupa, folgaMs = 250): boolean {
  return CHAVES_DA_LUPA.some((k) => atual[k] - enviado[k] >= folgaMs);
}
