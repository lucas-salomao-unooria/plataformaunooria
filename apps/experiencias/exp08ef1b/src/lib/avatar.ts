/**
 * As iniciais de uma persona do feed (doc 03 §8), estáveis por handle: as duas
 * primeiras partes do handle (`fatos.da.coroa` → `FD`) ou as duas primeiras
 * letras. O fundo atrás delas é o do `Avatar` do Unoovista — o par de cores por
 * handle do clone antigo saiu junto com a paleta dele. Sem 'server-only' — o
 * cliente também desenha.
 */
export function iniciaisDe(handle: string): string {
  const limpo = handle.replace(/^@/, '');
  const partes = limpo.split(/[._-]/).filter(Boolean);
  return (partes.length > 1 ? (partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '') : limpo.slice(0, 2)).toUpperCase();
}

/** Números no formato pt-BR do feed: 1.234 · 12,4 mil (doc 03 §8). */
export function formatarContagem(valor: number): string {
  if (valor < 1000) return String(valor);
  if (valor < 10000) return valor.toLocaleString('pt-BR');
  const mil = valor / 1000;
  const arredondado = mil >= 100 ? Math.round(mil) : Math.round(mil * 10) / 10;
  return `${arredondado.toLocaleString('pt-BR')} mil`;
}
