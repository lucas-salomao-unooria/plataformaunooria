import {
  ALTURA_POR_LARGURA,
  FAIXA_COMUM,
  FORA_MINIMO,
  MARGEM_DO_ALVO,
  MOLDURA_DA_CAPA,
  MOLDURA_DA_SEGUNDA_FOTO,
  NUCLEO_VISIVEL_MINIMO,
  SEGUNDA_FOTO,
  type Alvo,
  type Deslocamento,
  type FotoDaCena,
  type MarcavelDaCena,
  type Ponto,
  type Retangulo,
} from "../conteudo";

/**
 * A GEOMETRIA da missão — o coração dela, e puro. Tudo em coordenadas
 * normalizadas 0–100 da panorâmica 16:9 (x em % da largura, y em % da altura).
 *
 * O estudante só DESLOCA a foto dentro da moldura (tamanho fixo, sem zoom); o
 * servidor deriva daqui o retângulo que a capa mostrou, e é dele que saem a
 * fala da visitante, o "o que ficou fora" e a segunda foto.
 */

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** A moldura de tamanho fixo dentro de um recorte. */
export function molduraDe(recorte: Retangulo, moldura: { w: number; h: number } = MOLDURA_DA_CAPA): { w: number; h: number } {
  return { w: recorte.w * moldura.w, h: recorte.h * moldura.h };
}

/**
 * O retângulo VISÍVEL na panorâmica: a moldura deslocada dentro do recorte.
 * `deslocamento` é a fração da FOLGA (0 = encostado à esquerda/topo, 1 = à
 * direita/base); fora de [0, 1] é limitado — a moldura nunca mostra vazio.
 */
export function retanguloVisivel(
  recorte: Retangulo,
  deslocamento: Deslocamento,
  moldura: { w: number; h: number } = MOLDURA_DA_CAPA,
): Retangulo {
  const m = molduraDe(recorte, moldura);
  const folgaX = recorte.w - m.w;
  const folgaY = recorte.h - m.h;
  return {
    x: recorte.x + folgaX * limitar(deslocamento.x, 0, 1),
    y: recorte.y + folgaY * limitar(deslocamento.y, 0, 1),
    w: m.w,
    h: m.h,
  };
}

export function areaDe(r: Retangulo): number {
  return Math.max(0, r.w) * Math.max(0, r.h);
}

export function intersecao(a: Retangulo, b: Retangulo): Retangulo {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  return { x, y, w: Math.max(0, Math.min(a.x + a.w, b.x + b.w) - x), h: Math.max(0, Math.min(a.y + a.h, b.y + b.h) - y) };
}

/** A fração da área de `area` que cai dentro de `janela` (0 a 1). Área nula = 0. */
export function fracaoDentro(area: Retangulo, janela: Retangulo): number {
  const total = areaDe(area);
  return total === 0 ? 0 : areaDe(intersecao(area, janela)) / total;
}

/** O retângulo `dentro` cabe inteiro em `fora`? (com folga numérica de 1e-9) */
export function contemRetangulo(fora: Retangulo, dentro: Retangulo): boolean {
  const e = 1e-9;
  return dentro.x >= fora.x - e && dentro.y >= fora.y - e && dentro.x + dentro.w <= fora.x + fora.w + e && dentro.y + dentro.h <= fora.y + fora.h + e;
}

export function contemPonto(r: Retangulo, p: Ponto): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

/**
 * A área com a folga do toque: `MARGEM_DO_ALVO` em % da LARGURA dos lados, e
 * a mesma distância NA TELA em cima e embaixo — um ponto de altura vale 9/16
 * de um de largura na panorâmica 16:9, então a margem vertical é 16/9 maior.
 */
export function areaComFolga(alvo: Alvo, margem: number = MARGEM_DO_ALVO): Retangulo {
  const my = margem / ALTURA_POR_LARGURA;
  return { x: alvo.x - margem, y: alvo.y - my, w: alvo.w + 2 * margem, h: alvo.h + 2 * my };
}

/**
 * O toque (ou o centro da lente) acertou o objeto? Dentro da ÁREA que o
 * professor desenhou, com a folga — a área é o objeto inteiro, do tamanho que
 * ele tiver (2.2.0, ADR-188).
 */
export function acertaAlvo(alvo: Alvo, p: Ponto): boolean {
  return contemPonto(areaComFolga(alvo), p);
}

/** A área cabe na faixa comum às duas fotos (x ≥ 32 e x + w ≤ 68) e na altura da cena: o objeto aparece nas DUAS. */
export function alvoNaFaixaComum(alvo: Alvo): boolean {
  const e = 1e-9;
  return alvo.x >= FAIXA_COMUM.de - e && alvo.x + alvo.w <= FAIXA_COMUM.ate + e && alvo.y >= -e && alvo.y + alvo.h <= 100 + e;
}

/** Duas áreas sobrepostas fariam o mesmo toque valer pelos dois objetos. */
export function alvosSeparados(a: Alvo, b: Alvo): boolean {
  return areaDe(intersecao(a, b)) === 0;
}

/**
 * A fala da VISITANTE (E4, Momento 1): com metade ou mais do núcleo na capa,
 * a fala da foto ("Na foto, vi crianças lendo!"); senão, só o lugar ("Na foto,
 * vi a biblioteca!"). A visitante só conhece o que o recorte mostrou.
 */
export function falaDaVisitante(foto: Pick<FotoDaCena, "nucleo" | "visitante">, visivel: Retangulo, espacoCurto: string) {
  const nucleoVisivel = fracaoDentro(foto.nucleo, visivel) >= NUCLEO_VISIVEL_MINIMO;
  return { nucleoVisivel, fala: nucleoVisivel ? foto.visitante : `Na foto, vi ${espacoCurto.trim()}!` };
}

/**
 * O "o que ficou fora" (E4, Momento 5): os toques do estudante viram os
 * MARCÁVEIS que ele tocou e que ficaram FORA da capa — metade ou mais da área
 * fora do retângulo publicado. O que estava na capa não conta, e o toque no
 * vazio também não. Sem repetição, na ordem do pacote.
 */
export function itensFora(marcaveis: readonly MarcavelDaCena[], visivel: Retangulo, toques: readonly Ponto[]): string[] {
  return marcaveis
    .filter((m) => 1 - fracaoDentro(m.area, visivel) >= FORA_MINIMO && toques.some((t) => contemPonto(m.area, t)))
    .map((m) => m.id);
}

/** Os marcáveis que ficaram fora da capa — o painel mostra "marcou X de Y". */
export function marcaveisFora(marcaveis: readonly MarcavelDaCena[], visivel: Retangulo): string[] {
  return marcaveis.filter((m) => 1 - fracaoDentro(m.area, visivel) >= FORA_MINIMO).map((m) => m.id);
}

/** A imagem inteira da segunda foto, nas coordenadas dela (0–100). */
export const RECORTE_DA_SEGUNDA_FOTO: Retangulo = { x: 0, y: 0, w: 100, h: 100 };

/** E5, a segunda foto: a criança lendo (o núcleo) ficou com metade ou mais dentro da moldura? */
export function essencialVisivelNaSegunda(deslocamento: Deslocamento): boolean {
  const visivel = retanguloVisivel(RECORTE_DA_SEGUNDA_FOTO, deslocamento, MOLDURA_DA_SEGUNDA_FOTO);
  return fracaoDentro(SEGUNDA_FOTO.nucleo, visivel) >= NUCLEO_VISIVEL_MINIMO;
}

/** Arredonda para o banco e para a resposta — 4 casas bastam numa tela de 2.000 px. */
export function arredondar(r: Retangulo): Retangulo {
  const q = (v: number) => Math.round(v * 10_000) / 10_000;
  return { x: q(r.x), y: q(r.y), w: q(r.w), h: q(r.h) };
}
