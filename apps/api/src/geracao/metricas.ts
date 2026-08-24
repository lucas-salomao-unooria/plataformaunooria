import type { Intensidade, Lado } from '../comum/insta/tipos';

/**
 * Etapa 2 do doc 05: métricas fake coerentes, sem IA. "O raso engaja mais" —
 * isso vira dado no dossiê. Porte verbatim de `lib/geracao/metricas.ts`.
 */

function inteiroEntre(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

const FAIXAS_LIKES: Record<string, [number, number]> = {
  '1': [300, 900],
  '2': [1200, 3000],
  '3': [4000, 9000],
  neutro: [200, 6000],
};

export function likesDoPost(lado: Lado, intensidade: Intensidade): number {
  // `!`: as chaves '1'|'2'|'3'|'neutro' existem na tabela (noUncheckedIndexedAccess).
  const [min, max] = lado === 'neutro' ? FAIXAS_LIKES.neutro! : FAIXAS_LIKES[String(intensidade)]!;
  return inteiroEntre(min, max);
}

/** Decrescente pela ordem (1º: 40–300), caindo ~50% por posição, ruído ±30%. */
export function likesDosComentarios(quantidade: number): number[] {
  const base = inteiroEntre(40, 300);
  return Array.from({ length: quantidade }, (_, indice) => {
    const decaimento = base * 0.5 ** indice;
    const ruido = 0.7 + Math.random() * 0.6;
    return Math.max(0, Math.round(decaimento * ruido));
  });
}

const ROTULOS_RECENTES = ['há 12 min', 'há 20 min', 'há 43 min', 'há 1 h', 'há 2 h', 'há 3 h'];
const ROTULOS_ANTIGOS = ['há 5 h', 'há 8 h', 'há 14 h', 'há 1 dia', 'há 2 dias'];

/** int.3 aparece mais recente (sensação de "está acontecendo agora"). */
export function rotuloDeTempo(intensidade: Intensidade, lado: Lado): string {
  const pesoRecente = lado === 'neutro' ? 0.5 : intensidade === 3 ? 0.85 : intensidade === 2 ? 0.6 : 0.4;
  const lista = Math.random() < pesoRecente ? ROTULOS_RECENTES : ROTULOS_ANTIGOS;
  // `!`: o índice sai de `inteiroEntre(0, length - 1)`, sempre dentro da faixa.
  return lista[inteiroEntre(0, lista.length - 1)]!;
}

/** Rótulo de tempo dos comentários: sempre depois do post. */
export function rotuloDeTempoComentario(): string {
  const opcoes = ['há 8 min', 'há 25 min', 'há 40 min', 'há 1 h', 'há 2 h', 'há 4 h'];
  return opcoes[inteiroEntre(0, opcoes.length - 1)]!;
}

/** ~1 em cada 4 perfis com selo, para o card ter variedade (doc 03). */
export function sorteiaVerificado(): boolean {
  return Math.random() < 0.25;
}
