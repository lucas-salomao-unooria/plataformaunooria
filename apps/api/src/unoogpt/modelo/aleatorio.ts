/**
 * Sorteio com SEMENTE. Puro e reprodutível.
 *
 * Semente porque uma rodada precisa poder ser reproduzida — o professor abre a
 * mesma rodada de um aluno e vê os mesmos números. O que NÃO é reprodutível é a
 * próxima rodada: cada uma sorteia de novo, e é aí que mora a lição.
 *
 * mulberry32: 32 bits, distribuição uniforme suficiente para simular chuva.
 */
export function aleatorio(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Semente estável a partir de um texto (id da sessão + número da rodada). */
export function sementeDe(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Ruído simétrico em [-amplitude, +amplitude]. */
export function ruido(sorteio: () => number, amplitude: number): number {
  return (sorteio() * 2 - 1) * amplitude;
}
