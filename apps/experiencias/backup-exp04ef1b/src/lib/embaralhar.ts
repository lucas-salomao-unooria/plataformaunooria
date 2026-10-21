/**
 * Ordem do feed: Fisher-Yates a cada abertura (como no origem). A regra "não
 * repetir o primeiro vídeo da abertura anterior" vive em memória — o origem
 * usava sessionStorage, que em iframe cross-origin é particionado/bloqueado.
 */
export function embaralhar<T>(itens: readonly T[], aleatorio: () => number = Math.random): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(aleatorio() * (i + 1));
    [copia[i], copia[j]] = [copia[j]!, copia[i]!];
  }
  return copia;
}

export function evitarMesmaAbertura<T extends { id: string }>(
  ordenados: T[],
  idAnterior: string | null,
  aleatorio: () => number = Math.random,
): T[] {
  if (ordenados.length < 2 || ordenados[0]?.id !== idAnterior) return ordenados;
  const copia = [...ordenados];
  const troca = 1 + Math.floor(aleatorio() * (copia.length - 1));
  [copia[0], copia[troca]] = [copia[troca]!, copia[0]!];
  return copia;
}
