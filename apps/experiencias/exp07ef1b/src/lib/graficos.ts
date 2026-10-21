import type { Grafico } from "./tipos";

/**
 * O desenho dos posts que NÃO têm fotografia — puro, testável, sem DOM.
 *
 * Dois casos, e os dois vêm da api:
 *
 * - **`grafico` preenchido** (o bloco C do banco curado): o SVG sai dos
 *   NÚMEROS, nunca de um modelo de imagem. Um modelo erra número, e um gráfico
 *   com o número errado seria um veículo mentindo — exatamente o que a missão
 *   diz que nenhum deles faz (`catalogo.ts` da api).
 * - **`imagem.url` nula** (a professora ainda não gerou as imagens): o card
 *   procedural, com a DESCRIÇÃO da imagem escrita nele. **Todos iguais em
 *   forma** — mesma moldura, mesma cor, mesmo corpo de letra para os três
 *   veículos. O critério 1 do brief de assets reprova a categoria adivinhável
 *   pela forma: se o card da Voz Coletiva tivesse outra cor, a cor seria a
 *   ficha técnica antes da hora.
 *
 * O resultado é uma STRING SVG, que vira `data:` URI para os três lugares que
 * pedem `src` (o `PostCard.Media` do gráfico, o `MediaGrid` da aba Salvos e o
 * `StoryViewer` do Mural). Dentro de um `<img>` o SVG não enxerga as variáveis
 * CSS da página — por isso a cor chega por PARÂMETRO (`Paleta`), lida dos
 * tokens `--unv-*` em tempo de execução (`componentes/midia.tsx`), e nunca
 * escrita aqui.
 *
 * Todo texto que entra no SVG passa por `escaparXml`: o rótulo da série e a
 * descrição da imagem podem ter sido escritos pelo gerador de IA do preparo,
 * e um `<` solto quebraria o desenho (ou, pior, viraria marcação).
 */

export interface Paleta {
  /** O fundo do card. */
  fundo: string;
  /** As áreas internas (a trilha das barras, as ruas do mapa). */
  superficie: string;
  texto: string;
  secundario: string;
  /** Barras e linhas. */
  destaque: string;
  /** As manchas do mapa de calor. */
  calor: string;
  borda: string;
  fonte: string;
}

/** Quadrado para o feed e a grade; vertical (9:16 do Story) para o Mural. */
export type Formato = "quadrado" | "story";

const LARGURA = 375;
const ALTURA: Record<Formato, number> = { quadrado: 375, story: 667 };

/** A altura útil do desenho, que no Story fica centralizado na vertical. */
const QUADRO = 375;

export function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Quebra um texto em linhas de até `maxChars` (por palavra), no máximo
 * `maxLinhas`. O que sobra vira reticências na última — o SVG não quebra linha
 * sozinho, e um texto que vaza da moldura é pior que um cortado com aviso.
 */
export function quebrarEmLinhas(texto: string, maxChars: number, maxLinhas: number): string[] {
  const palavras = texto.trim().split(/\s+/).filter(Boolean);
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of palavras) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if ([...tentativa].length <= maxChars || !atual) {
      atual = tentativa;
    } else {
      linhas.push(atual);
      atual = palavra;
    }
  }
  if (atual) linhas.push(atual);
  if (linhas.length <= maxLinhas) return linhas;
  const cortadas = linhas.slice(0, maxLinhas);
  const ultima = [...(cortadas[maxLinhas - 1] ?? "")];
  cortadas[maxLinhas - 1] = `${ultima.slice(0, Math.max(1, maxChars - 1)).join("").trimEnd()}…`;
  return cortadas;
}

/** "R$ 420", "22 min", "35%", "1.500" — a unidade no lugar em que se lê em português. */
export function formatarValor(valor: number, unidade: string): string {
  const n = valor.toLocaleString("pt-BR");
  const u = unidade.trim();
  if (!u) return n;
  if (u === "R$") return `R$ ${n}`;
  if (u === "%") return `${n}%`;
  return `${n} ${u}`;
}

/**
 * O texto alternativo do gráfico, escrito a partir do que o desenho MOSTRA.
 * Não é o `imagem.alt` da api: esse descreve a imagem que o brief pediu ("mapa
 * do bairro em tons de cinza…"), e o leitor de tela tem de ouvir os números
 * que estão na tela, não os de uma imagem que não foi desenhada.
 */
export function descricaoDoGrafico(g: Grafico): string {
  const dados = g.series.map((s) => `${s.rotulo}, ${formatarValor(s.valor, g.unidade)}`).join("; ");
  const fim = g.destaque ? ` ${g.destaque.replace(/[.!?]?$/, ".")}` : "";
  return `${g.titulo}: ${dados}.${fim}`;
}

export function dataUriDeSvg(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// ───────────────────────────────────────────────────────────── primitivas

interface Estilo {
  tamanho: number;
  peso?: number;
  cor: string;
  ancora?: "start" | "middle" | "end";
}

function texto(x: number, y: number, conteudo: string, e: Estilo): string {
  return `<text x="${r(x)}" y="${r(y)}" font-size="${e.tamanho}" font-weight="${e.peso ?? 400}" fill="${escaparXml(e.cor)}" text-anchor="${e.ancora ?? "middle"}">${escaparXml(conteudo)}</text>`;
}

function linhasDeTexto(x: number, y: number, linhas: string[], alturaDaLinha: number, e: Estilo): string {
  return linhas.map((l, i) => texto(x, y + i * alturaDaLinha, l, e)).join("");
}

/** Arredonda a coordenada: dez casas decimais num `data:` URI são peso sem ganho. */
function r(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

function envelope(formato: Formato, p: Paleta, titulo: string, corpo: string): string {
  const h = ALTURA[formato];
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LARGURA} ${h}" width="${LARGURA}" height="${h}" font-family="${escaparXml(p.fonte)}">` +
    `<title>${escaparXml(titulo)}</title>` +
    `<rect width="${LARGURA}" height="${h}" fill="${escaparXml(p.fundo)}"/>` +
    corpo +
    `</svg>`
  );
}

/** O deslocamento vertical que centraliza o quadro de 375 no Story de 667. */
function topoDo(formato: Formato): number {
  return (ALTURA[formato] - QUADRO) / 2;
}

// ─────────────────────────────────────────────────────────────── os gráficos

const ESQUERDA = 28;
const DIREITA = LARGURA - 28;

function cabecalho(g: Grafico, topo: number, p: Paleta): string {
  const linhas = quebrarEmLinhas(g.titulo, 30, 2);
  return linhasDeTexto(LARGURA / 2, topo + 44, linhas, 24, { tamanho: 19, peso: 700, cor: p.texto });
}

function rodape(g: Grafico, topo: number, p: Paleta): string {
  if (!g.destaque) return "";
  return texto(LARGURA / 2, topo + 356, g.destaque, { tamanho: 14, peso: 700, cor: p.texto });
}

function maximo(g: Grafico): number {
  return Math.max(0, ...g.series.map((s) => s.valor)) || 1;
}

function barras(g: Grafico, topo: number, p: Paleta): string {
  const n = g.series.length;
  const base = topo + 280;
  const alturaMax = 140;
  const vao = n <= 3 ? 28 : 14;
  const larg = Math.min(90, (DIREITA - ESQUERDA - vao * (n - 1)) / n);
  const total = n * larg + vao * (n - 1);
  const x0 = (LARGURA - total) / 2;
  const max = maximo(g);
  const porRotulo = Math.max(8, Math.floor((larg + vao) / 6.4));
  const partes: string[] = [];
  g.series.forEach((s, i) => {
    const h = Math.max(3, (alturaMax * s.valor) / max);
    const x = x0 + i * (larg + vao);
    const centro = x + larg / 2;
    partes.push(`<rect x="${r(x)}" y="${r(base - h)}" width="${r(larg)}" height="${r(h)}" rx="4" fill="${escaparXml(p.destaque)}"/>`);
    partes.push(texto(centro, base - h - 8, formatarValor(s.valor, g.unidade), { tamanho: 15, peso: 700, cor: p.texto }));
    partes.push(linhasDeTexto(centro, base + 20, quebrarEmLinhas(s.rotulo, porRotulo, 2), 15, { tamanho: 12, cor: p.texto }));
  });
  partes.push(`<line x1="${r(x0 - 6)}" y1="${r(base)}" x2="${r(x0 + total + 6)}" y2="${r(base)}" stroke="${escaparXml(p.borda)}" stroke-width="1"/>`);
  return partes.join("");
}

function linhas(g: Grafico, topo: number, p: Paleta): string {
  const n = g.series.length;
  const base = topo + 280;
  const alturaMax = 140;
  const inicio = ESQUERDA + 24;
  const fim = DIREITA - 24;
  const passo = n > 1 ? (fim - inicio) / (n - 1) : 0;
  const max = maximo(g);
  const pontos = g.series.map((s, i) => ({
    x: n > 1 ? inicio + i * passo : LARGURA / 2,
    y: base - (alturaMax * s.valor) / max,
    s,
  }));
  const porRotulo = Math.max(8, Math.floor((n > 1 ? passo : fim - inicio) / 6.4));
  const partes: string[] = [];
  partes.push(`<line x1="${r(ESQUERDA)}" y1="${r(base)}" x2="${r(DIREITA)}" y2="${r(base)}" stroke="${escaparXml(p.borda)}" stroke-width="1"/>`);
  partes.push(
    `<polyline points="${pontos.map((q) => `${r(q.x)},${r(q.y)}`).join(" ")}" fill="none" stroke="${escaparXml(p.destaque)}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`,
  );
  for (const q of pontos) {
    partes.push(`<circle cx="${r(q.x)}" cy="${r(q.y)}" r="5" fill="${escaparXml(p.destaque)}" stroke="${escaparXml(p.fundo)}" stroke-width="2"/>`);
    partes.push(texto(q.x, q.y - 12, formatarValor(q.s.valor, g.unidade), { tamanho: 15, peso: 700, cor: p.texto }));
    partes.push(linhasDeTexto(q.x, base + 20, quebrarEmLinhas(q.s.rotulo, porRotulo, 2), 15, { tamanho: 12, cor: p.texto }));
  }
  return partes.join("");
}

/**
 * O mapa de calor: um mapa pequeno do bairro por série (quarteirões cinza,
 * ruas claras) com manchas nos cruzamentos, a intensidade proporcional ao
 * valor. É o que a descrição do post pede ("mapa simplificado do bairro em
 * tons de cinza, com manchas vermelhas nos cruzamentos") e o que a ficha
 * técnica dele diz ("mapa de calor") — o critério 2 do brief reprova a ficha
 * que não bate com a imagem que a criança viu.
 */
function mapaDeCalor(g: Grafico, topo: number, p: Paleta): string {
  const n = g.series.length;
  const colunas = n <= 2 ? n : 3;
  const filas = Math.ceil(n / colunas);
  const vaoX = 16;
  const rotuloH = 44;
  const areaTopo = topo + 84;
  const areaAltura = 250;
  const lado = Math.min(
    (DIREITA - ESQUERDA - vaoX * (colunas - 1)) / colunas,
    (areaAltura - filas * rotuloH - (filas - 1) * 10) / filas,
  );
  const totalX = colunas * lado + vaoX * (colunas - 1);
  const x0 = (LARGURA - totalX) / 2;
  const max = maximo(g);
  const porRotulo = Math.max(8, Math.floor(lado / 6.4));
  const partes: string[] = [];
  g.series.forEach((s, i) => {
    const col = i % colunas;
    const fila = Math.floor(i / colunas);
    const x = x0 + col * (lado + vaoX);
    const y = areaTopo + fila * (lado + rotuloH + 10);
    const rua = lado * 0.08;
    const bloco = (lado - 4 * rua) / 3;
    partes.push(`<rect x="${r(x)}" y="${r(y)}" width="${r(lado)}" height="${r(lado)}" rx="8" fill="${escaparXml(p.superficie)}" stroke="${escaparXml(p.borda)}" stroke-width="1"/>`);
    for (let bi = 0; bi < 3; bi += 1) {
      for (let bj = 0; bj < 3; bj += 1) {
        const bx = x + rua + bi * (bloco + rua);
        const by = y + rua + bj * (bloco + rua);
        partes.push(`<rect x="${r(bx)}" y="${r(by)}" width="${r(bloco)}" height="${r(bloco)}" rx="2" fill="${escaparXml(p.borda)}"/>`);
      }
    }
    const intensidade = 0.15 + 0.75 * (s.valor / max);
    for (let ci = 1; ci <= 2; ci += 1) {
      for (let cj = 1; cj <= 2; cj += 1) {
        const cx = x + ci * (bloco + rua) + rua / 2;
        const cy = y + cj * (bloco + rua) + rua / 2;
        partes.push(`<circle cx="${r(cx)}" cy="${r(cy)}" r="${r(lado * 0.15)}" fill="${escaparXml(p.calor)}" fill-opacity="${intensidade.toFixed(2)}"/>`);
      }
    }
    const centro = x + lado / 2;
    partes.push(texto(centro, y + lado + 20, formatarValor(s.valor, g.unidade), { tamanho: 16, peso: 700, cor: p.texto }));
    partes.push(linhasDeTexto(centro, y + lado + 36, quebrarEmLinhas(s.rotulo, porRotulo, 1), 14, { tamanho: 12, cor: p.texto }));
  });
  return partes.join("");
}

/** O SVG do gráfico de um post de métricas. */
export function svgDoGrafico(g: Grafico, paleta: Paleta, formato: Formato): string {
  const topo = topoDo(formato);
  const corpo =
    g.tipo === "linhas" ? linhas(g, topo, paleta) : g.tipo === "mapa-de-calor" ? mapaDeCalor(g, topo, paleta) : barras(g, topo, paleta);
  return envelope(formato, paleta, descricaoDoGrafico(g), cabecalho(g, topo, paleta) + corpo + rodape(g, topo, paleta));
}

/**
 * O card procedural de um post sem fotografia: a descrição da imagem, na
 * moldura neutra — IGUAL para todos os veículos (ver o cabeçalho).
 */
export function svgDoCardProcedural(alt: string, paleta: Paleta, formato: Formato): string {
  const h = ALTURA[formato];
  const story = formato === "story";
  const tamanho = story ? 21 : 17;
  const entrelinha = story ? 30 : 24;
  const linhas = quebrarEmLinhas(alt, story ? 26 : 30, story ? 12 : 9);
  const y0 = h / 2 - ((linhas.length - 1) * entrelinha) / 2 + tamanho / 3;
  /* A moldura só no quadrado (feed e grade). O Story é de sangria total, e o
     `object-fit: cover` do `StoryViewer` corta o topo e a base conforme a
     altura do palco — a moldura sairia com dois lados só. */
  const moldura = story
    ? ""
    : `<rect x="16" y="16" width="${LARGURA - 32}" height="${h - 32}" rx="12" fill="none" stroke="${escaparXml(paleta.borda)}" stroke-width="1.5"/>`;
  return envelope(formato, paleta, alt, moldura + linhasDeTexto(LARGURA / 2, y0, linhas, entrelinha, { tamanho, cor: paleta.texto }));
}
