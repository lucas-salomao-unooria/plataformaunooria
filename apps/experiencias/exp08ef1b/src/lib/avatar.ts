/**
 * Avatares procedurais consistentes por handle (doc 03 §8): iniciais sobre
 * gradiente, sempre o mesmo par cor/handle. Sem 'server-only' — o cliente
 * também desenha.
 */

const PARES = [
  ['#FF8A80', '#FF5C6E'],
  ['#82B1FF', '#5C6BC0'],
  ['#B9F6CA', '#26A69A'],
  ['#FFE082', '#FFA726'],
  ['#CE93D8', '#7B4DFF'],
  ['#80DEEA', '#0097A7'],
  ['#F48FB1', '#EC407A'],
  ['#C5E1A5', '#7CB342'],
];

function hash(texto: string): number {
  let valor = 0;
  for (let i = 0; i < texto.length; i += 1) {
    valor = (valor * 33 + texto.charCodeAt(i)) % 2147483647;
  }
  return valor;
}

export interface AvatarProcedural {
  gradiente: string;
  iniciais: string;
}

export function avatarProcedural(handle: string): AvatarProcedural {
  const limpo = handle.replace(/^@/, '');
  // `!`: o índice é módulo do tamanho do array — sempre em faixa (strict do repo).
  const [de, para] = PARES[hash(limpo) % PARES.length]!;

  const partes = limpo.split(/[._-]/).filter(Boolean);
  const iniciais = (
    partes.length > 1 ? (partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '') : limpo.slice(0, 2)
  ).toUpperCase();

  return { gradiente: `linear-gradient(135deg, ${de} 0%, ${para} 100%)`, iniciais };
}

/** Números no formato pt-BR do feed: 1.234 · 12,4 mil (doc 03 §8). */
export function formatarContagem(valor: number): string {
  if (valor < 1000) return String(valor);
  if (valor < 10000) return valor.toLocaleString('pt-BR');
  const mil = valor / 1000;
  const arredondado = mil >= 100 ? Math.round(mil) : Math.round(mil * 10) / 10;
  return `${arredondado.toLocaleString('pt-BR')} mil`;
}
