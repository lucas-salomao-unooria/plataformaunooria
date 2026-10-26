import type { Deslocamento, Imagem, Moldura, Ponto, Retangulo } from "./tipos";

/**
 * A GEOMETRIA da tela — pura, testada em `geometria.test.ts`.
 *
 * Tudo em coordenadas 0–100 da IMAGEM (na panorâmica 16:9: x em % da largura,
 * y em % da altura). Uma "janela" é o pedaço da imagem que uma caixa da tela
 * mostra: a foto N é a janela `geometria.recortes[N]` da panorâmica, a capa é a
 * janela da moldura deslocada dentro dela. UMA imagem serve as duas fotos, a
 * capa e a revelação — o recorte é CSS, nunca um arquivo a mais.
 *
 * `retanguloVisivel` espelha `apps/api/src/enigma-capa/regras/geometria.ts`: a
 * tela desenha a mesma janela que o servidor deriva do deslocamento.
 */

export const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** A moldura de tamanho fixo dentro de um recorte, em unidades da imagem. */
export function molduraDe(recorte: Retangulo, moldura: Moldura): { w: number; h: number } {
  return { w: recorte.w * moldura.w, h: recorte.h * moldura.h };
}

/** A janela VISÍVEL: a moldura deslocada dentro do recorte. Fora de [0, 1] é limitado — nunca mostra vazio. */
export function retanguloVisivel(recorte: Retangulo, deslocamento: Deslocamento, moldura: Moldura): Retangulo {
  const m = molduraDe(recorte, moldura);
  return {
    x: recorte.x + (recorte.w - m.w) * limitar(deslocamento.x, 0, 1),
    y: recorte.y + (recorte.h - m.h) * limitar(deslocamento.y, 0, 1),
    w: m.w,
    h: m.h,
  };
}

/**
 * O ARRASTE da foto dentro da moldura fixa (E3 e E5): o dedo anda `dx`,`dy`
 * pixels numa caixa de `caixa` pixels, a foto acompanha o dedo — a janela anda
 * para o lado OPOSTO — e o deslocamento é limitado à folga (sem vazio). Sem
 * zoom: nada aqui muda o tamanho da janela.
 */
export function arrastarDeslocamento(
  atual: Deslocamento,
  dx: number,
  dy: number,
  caixa: { w: number; h: number },
  recorte: Retangulo,
  moldura: Moldura,
): Deslocamento {
  const m = molduraDe(recorte, moldura);
  const folgaX = recorte.w - m.w;
  const folgaY = recorte.h - m.h;
  const passo = (d: number, caixaPx: number, janela: number, folga: number) =>
    folga > 0 && caixaPx > 0 ? (d * (janela / caixaPx)) / folga : 0;
  return {
    x: limitar(atual.x - passo(dx, caixa.w, m.w, folgaX), 0, 1),
    y: limitar(atual.y - passo(dy, caixa.h, m.h, folgaY), 0, 1),
  };
}

/** As setas do teclado deslocam a foto em décimos da folga (a mesma regra do arraste). */
export function deslocarPorTecla(atual: Deslocamento, tecla: string, passo = 0.1): Deslocamento | null {
  const d: Record<string, [number, number]> = {
    ArrowLeft: [passo, 0],
    ArrowRight: [-passo, 0],
    ArrowUp: [0, passo],
    ArrowDown: [0, -passo],
  };
  const v = d[tecla];
  if (!v) return null;
  /* A seta "para a esquerda" leva a FOTO para a esquerda — a janela anda para a direita. */
  return { x: limitar(atual.x + v[0], 0, 1), y: limitar(atual.y + v[1], 0, 1) };
}

/** A proporção (largura/altura) da caixa que mostra `janela` de uma imagem de proporção `proporcaoDaImagem`. */
export function proporcaoDaJanela(janela: Retangulo, proporcaoDaImagem: number): number {
  return (janela.w / janela.h) * proporcaoDaImagem;
}

/**
 * O estilo do `<img>` (a imagem INTEIRA, absoluta numa caixa com
 * `overflow: hidden`) para que a caixa mostre exatamente `janela`. Em
 * porcentagem da caixa: vale em qualquer tamanho de tela.
 */
export function estiloDaJanela(janela: Retangulo): { width: string; height: string; left: string; top: string } {
  const pct = (v: number) => `${Math.round(v * 1000) / 1000}%`;
  return {
    width: pct((100 / janela.w) * 100),
    height: pct((100 / janela.h) * 100),
    left: pct((-janela.x / janela.w) * 100),
    top: pct((-janela.y / janela.h) * 100),
  };
}

/** Um toque em (`px`, `py`) pixels de uma caixa que mostra `janela` → o ponto da IMAGEM (0–100). */
export function pontoNaImagem(janela: Retangulo, px: number, py: number, caixa: { w: number; h: number }): Ponto {
  return {
    x: limitar(janela.x + (px / caixa.w) * janela.w, 0, 100),
    y: limitar(janela.y + (py / caixa.h) * janela.h, 0, 100),
  };
}

/** O inverso: onde o ponto da imagem cai na caixa, como FRAÇÃO (0–1) — fora de [0, 1] = fora da caixa. */
export function posicaoNaCaixa(janela: Retangulo, p: Ponto): Ponto {
  return { x: (p.x - janela.x) / janela.w, y: (p.y - janela.y) / janela.h };
}

export function contemPonto(r: Retangulo, p: Ponto): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

/** O maior retângulo de proporção `proporcao` que cabe em `disponivel` (sem distorcer). */
export function encaixar(disponivel: { w: number; h: number }, proporcao: number): { w: number; h: number } {
  if (disponivel.w <= 0 || disponivel.h <= 0) return { w: 0, h: 0 };
  const w = Math.min(disponivel.w, disponivel.h * proporcao);
  return { w: Math.floor(w), h: Math.floor(w / proporcao) };
}

/**
 * A LUPA (E2): a lente de raio `raio` px, centrada em `centro` (px na caixa da
 * foto), mostra a imagem ampliada `ampliacao` vezes. Devolve o ponto da imagem
 * sob o centro e o tamanho/posição do `<img>` (a imagem inteira) dentro da lente.
 * A ampliação é FIXA (2×, one-pager §4): a criança move a lente, nunca o zoom.
 */
export function lente(
  janela: Retangulo,
  caixa: { w: number; h: number },
  centro: Ponto,
  raio: number,
  ampliacao = 2,
): { ponto: Ponto; img: { w: number; h: number; left: number; top: number } } {
  const ponto = pontoNaImagem(janela, centro.x, centro.y, caixa);
  const w = ((ampliacao * caixa.w) / janela.w) * 100;
  const h = ((ampliacao * caixa.h) / janela.h) * 100;
  return { ponto, img: { w, h, left: raio - (ponto.x / 100) * w, top: raio - (ponto.y / 100) * h } };
}

/**
 * A REVELAÇÃO (E4, Momento 5): as duas fotos lado a lado, na mesma escala, se
 * fundem na panorâmica. Com `t` = 0 a foto da direita começa onde a da
 * esquerda acaba; com `t` = 1 ela está na posição dela na panorâmica, e a
 * faixa comum se sobrepõe sem emenda (é a MESMA imagem). A escala nunca muda.
 * Devolve, em unidades da panorâmica, onde a foto da direita começa e a
 * largura total do conjunto.
 */
export function revelacao(esquerda: Retangulo, direita: Retangulo, t: number): { inicioDaDireita: number; largura: number } {
  const separado = esquerda.w;
  const junto = direita.x - esquerda.x;
  const inicioDaDireita = separado + (junto - separado) * limitar(t, 0, 1);
  return { inicioDaDireita, largura: inicioDaDireita + direita.w };
}

/**
 * "Marque na biblioteca o que ficou fora da sua foto." — o artigo vem do
 * `espacoCurto` ("a biblioteca" → "na biblioteca", "o museu" → "no museu").
 * Espelha `fraseDoFora` de `apps/api/src/enigma-capa/conteudo.ts`.
 */
export function fraseDoFora(espacoCurto: string): string {
  const t = espacoCurto.trim();
  const m = /^(a|o|as|os)\s+(.+)$/i.exec(t);
  const contracao: Record<string, string> = { a: "na", o: "no", as: "nas", os: "nos" };
  const lugar = m ? `${contracao[m[1]!.toLowerCase()]} ${m[2]}` : `em ${t}`;
  return `Marque ${lugar} o que ficou fora da sua foto.`;
}

/**
 * O endereço de uma imagem do pacote: `bundle` é um arquivo do `public/` desta
 * experiência (relativo à base do bundle, que muda por versão no bucket);
 * `url` é absoluta (a cena da IA, no bucket de mídia) e vai como veio.
 */
export function urlDaImagem(imagem: Imagem, base: string): string {
  if (imagem.tipo === "url") return imagem.url;
  const b = base.endsWith("/") ? base : `${base}/`;
  return `${b}${imagem.nome.replace(/^\/+/, "")}`;
}
