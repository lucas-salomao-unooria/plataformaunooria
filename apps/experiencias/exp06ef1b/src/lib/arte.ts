/**
 * A ARTE PROCEDURAL dos estandes sem fotografia — pura, testável, sem DOM.
 * Molde: `exp07ef1b/src/lib/graficos.ts`.
 *
 * A missão não tem acervo padrão (decisão de 2026-10-02): as imagens dos
 * quarenta estandes são geradas pelo professor no preparo, quatro por vez. Até
 * lá — ou quando uma geração falha — `imagem.url` chega `null`, e a tela
 * desenha aqui um estande em formas simples: o painel do projeto, a mesa e o
 * protótipo. **A forma sai do id do projeto** (a mesma num F5, diferente entre
 * vizinhos), e a cor sai dos tokens do DS — nunca da área: a área já está na
 * hashtag, e uma cor por área viraria a chave da bolha antes da galeria.
 *
 * O resultado é uma STRING SVG, que vira `data:` URI para os lugares que pedem
 * `src` (`PostCard.Media`, `MediaGrid`, `StoryViewer`, `AvatarUnv`). Dentro de
 * um `<img>` o SVG não enxerga as variáveis CSS da página, então a cor chega
 * por PARÂMETRO (`Paleta`, lida dos tokens `--unv-*` em tempo de execução em
 * `app/componentes/midia.tsx`).
 *
 * Todo texto que entra no SVG passa por `escaparXml`: o título do projeto foi
 * escrito por IA no preparo, e um `<` solto quebraria o desenho.
 */

export interface Paleta {
  fundo: string;
  superficie: string;
  texto: string;
  secundario: string;
  destaque: string;
  borda: string;
  fonte: string;
}

export type Formato = "quadrado" | "story";

const LARGURA = 375;
const ALTURA: Record<Formato, number> = { quadrado: 375, story: 667 };

export function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function dataUriDeSvg(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Um número estável de 32 bits a partir de um texto (FNV-1a). */
export function semente(texto: string): number {
  let h = 2166136261;
  for (const c of texto) {
    h ^= c.codePointAt(0) ?? 0;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Um gerador pequeno e determinístico (mulberry32). */
function sorteador(seed: number): () => number {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Quebra um texto em linhas de até `maxChars` (por palavra), no máximo
 * `maxLinhas`; o que sobra vira reticências na última. O SVG não quebra linha.
 */
export function quebrarEmLinhas(texto: string, maxChars: number, maxLinhas: number): string[] {
  const palavras = texto.trim().split(/\s+/).filter(Boolean);
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of palavras) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if ([...tentativa].length <= maxChars || !atual) atual = tentativa;
    else {
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

function envelope(formato: Formato, paleta: Paleta, titulo: string, corpo: string): string {
  const h = ALTURA[formato];
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LARGURA} ${h}" width="${LARGURA}" height="${h}" role="img">` +
    `<title>${escaparXml(titulo)}</title>` +
    `<rect width="${LARGURA}" height="${h}" fill="${escaparXml(paleta.fundo)}"/>` +
    corpo +
    `</svg>`
  );
}

/** As três formas do protótipo — nenhuma diz a área. */
function prototipo(tipo: number, cx: number, cy: number, r: number, cor: string): string {
  const c = escaparXml(cor);
  if (tipo === 0) return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}"/>`;
  if (tipo === 1) {
    const pts = Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join(" ");
    return `<polygon points="${pts}" fill="${c}"/>`;
  }
  return `<rect x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" rx="${(r / 3).toFixed(1)}" fill="${c}"/>`;
}

/**
 * O estande de um projeto: o painel com o título, a mesa e o protótipo em
 * cima dela. A posição e a forma variam pela semente do projeto; as cores, só
 * pelos tokens.
 */
export function svgDoEstande(projetoId: string, titulo: string, paleta: Paleta, formato: Formato = "quadrado"): string {
  const h = ALTURA[formato];
  const sorte = sorteador(semente(projetoId));
  const dy = (h - 375) / 2;
  const painelX = 48 + Math.round(sorte() * 40);
  const painelL = 375 - 2 * painelX;
  const linhas = quebrarEmLinhas(titulo, Math.max(12, Math.floor(painelL / 11)), 3);
  const tamanho = 18;
  const texto = linhas
    .map(
      (l, i) =>
        `<text x="${375 / 2}" y="${dy + 92 + i * 24}" text-anchor="middle" font-family="${escaparXml(paleta.fonte)}" font-size="${tamanho}" font-weight="700" fill="${escaparXml(paleta.texto)}">${escaparXml(l)}</text>`,
    )
    .join("");
  const bolinhas = Array.from({ length: 3 }, (_, i) => {
    const x = painelX + 24 + i * 22;
    return `<circle cx="${x}" cy="${dy + 58}" r="5" fill="${escaparXml(i === 0 ? paleta.destaque : paleta.borda)}"/>`;
  }).join("");
  const tipo = Math.floor(sorte() * 3);
  const cx = 120 + Math.round(sorte() * 135);
  const r = 22 + Math.round(sorte() * 14);
  const mesaY = dy + 268;
  const corpo =
    // o painel do projeto
    `<rect x="${painelX}" y="${dy + 36}" width="${painelL}" height="150" rx="14" fill="${escaparXml(paleta.superficie)}" stroke="${escaparXml(paleta.borda)}" stroke-width="1.5"/>` +
    bolinhas +
    texto +
    `<rect x="${painelX + 24}" y="${dy + 160}" width="${Math.round(painelL * (0.35 + sorte() * 0.3))}" height="8" rx="4" fill="${escaparXml(paleta.borda)}"/>` +
    // os pés do painel
    `<rect x="${painelX + 20}" y="${dy + 186}" width="6" height="${mesaY - dy - 186}" fill="${escaparXml(paleta.borda)}"/>` +
    `<rect x="${375 - painelX - 26}" y="${dy + 186}" width="6" height="${mesaY - dy - 186}" fill="${escaparXml(paleta.borda)}"/>` +
    // o protótipo sobre a mesa
    prototipo(tipo, cx, mesaY - r - 2, r, paleta.destaque) +
    // a mesa
    `<rect x="40" y="${mesaY}" width="295" height="14" rx="7" fill="${escaparXml(paleta.secundario)}"/>` +
    `<rect x="64" y="${mesaY + 14}" width="8" height="64" fill="${escaparXml(paleta.secundario)}"/>` +
    `<rect x="303" y="${mesaY + 14}" width="8" height="64" fill="${escaparXml(paleta.secundario)}"/>`;
  return envelope(formato, paleta, titulo, corpo);
}

/**
 * O fundo das três histórias da consulta (tema escuro): o brasão da comissão
 * em anéis, na base. A figurinha da enquete fica por cima, no centro, e o
 * desenho não disputa com ela; o título da ata vai no rodapé da história, em
 * texto de verdade (um texto dentro do SVG ficaria sob o véu do topo e sem a
 * fonte do app, que um `<img>` não carrega).
 */
export function svgDaConsulta(titulo: string, paleta: Paleta): string {
  const h = ALTURA.story;
  const aneis = [150, 118, 86]
    .map(
      (r, i) =>
        `<circle cx="${375 / 2}" cy="${h - 120}" r="${r}" fill="none" stroke="${escaparXml(i === 2 ? paleta.destaque : paleta.borda)}" stroke-width="2" opacity="${(0.35 + i * 0.2).toFixed(2)}"/>`,
    )
    .join("");
  return envelope("story", paleta, titulo, aneis);
}
