/**
 * Copiado verbatim do projeto origem (`lib/geracao/arte-fallback.ts`) no porte
 * da tela da atividade do professor — a api devolve `imageStatus`, e o card
 * desenha a arte procedural localmente quando a imagem não está `ok`.
 *
 * Fallback obrigatório do doc 05 §2 (etapa 3): quando a imagem falha, o card é
 * desenhado proceduralmente. Determinístico por post — o mesmo post rende
 * sempre a mesma arte. Sem 'server-only': o cliente também renderiza a arte.
 */

const PALETAS = [
  '#F4C9C0',
  '#CFE0F2',
  '#D9E7C9',
  '#F0DCA8',
  '#E3D2F2',
  '#F7D7E8',
  '#CDE7E3',
  '#EFE0CE',
];

const EMOJIS_POR_CATEGORIA: Record<string, string> = {
  tema: '📜🕰️',
  'memes de escola': '😂📚',
  curiosidades: '🤔💡',
  esportes: '⚽🏀',
  comida: '🍕🍫',
  animais: '🐶🐱',
  música: '🎧🎶',
  humor: '😹✨',
};

function hash(texto: string): number {
  let valor = 0;
  for (let i = 0; i < texto.length; i += 1) {
    valor = (valor * 31 + texto.charCodeAt(i)) % 2147483647;
  }
  return valor;
}

export interface ArteFallback {
  corFundo: string;
  emojis: string;
}

export function arteFallback(postId: string, categoria: string): ArteFallback {
  const indice = hash(postId) % PALETAS.length;
  // `!`: índice sempre dentro de PALETAS (noUncheckedIndexedAccess do monorepo).
  const emojis = EMOJIS_POR_CATEGORIA[categoria] ?? EMOJIS_POR_CATEGORIA.curiosidades!;
  return { corFundo: PALETAS[indice]!, emojis };
}
