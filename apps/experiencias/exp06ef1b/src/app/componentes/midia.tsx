import { useMemo } from "react";
import { dataUriDeSvg, svgDoEstande, type Formato, type Paleta } from "../../lib/arte";
import type { ImagemPublica, LaminasPublicas } from "../../lib/tipos";

/**
 * A imagem de um estande nos lugares em que ela aparece — o feed, a cédula, a
 * grade e a ficha da Galeria Oculta — e os dois casos que a api manda:
 *
 * 1. **`imagem.url`** — a fotografia que o professor gerou no preparo.
 * 2. **`null`** — a arte procedural do estande (`lib/arte.ts`), em `data:` URI,
 *    com o `alt` que a api escreveu para a fotografia que ainda não existe.
 */

/**
 * A paleta do SVG, lida dos tokens `--unv-*` DO TEMA pedido. Dentro de um
 * `<img>` o SVG não enxerga as variáveis CSS da página, então a cor viaja por
 * parâmetro — e continua vindo do pacote. Para o tema escuro (o fundo das
 * histórias) a leitura é feita num elemento de prova com `data-unv-theme="dark"`,
 * porque a raiz da página está no claro. Os valores de reserva existem só para
 * a folha do DS ainda não ter sido aplicada.
 */
export function lerPaleta(tema: "light" | "dark" = "light"): Paleta {
  let alvo: HTMLElement = document.documentElement;
  let prova: HTMLElement | null = null;
  if (tema === "dark") {
    prova = document.createElement("div");
    prova.setAttribute("data-unv-theme", "dark");
    prova.style.display = "none";
    document.body.appendChild(prova);
    alvo = prova;
  }
  const css = getComputedStyle(alvo);
  const v = (nome: string, reserva: string) => css.getPropertyValue(nome).trim() || reserva;
  const paleta: Paleta = {
    fundo: v("--unv-color-background-tertiary", tema === "dark" ? "#1B1D4A" : "#EFEEF5"),
    superficie: v("--unv-color-background-primary", tema === "dark" ? "#0E1039" : "#FFFFFF"),
    texto: v("--unv-color-text-primary", tema === "dark" ? "#F5F5F5" : "#22272A"),
    secundario: v("--unv-color-text-secondary", tema === "dark" ? "#CBD4D6" : "#475157"),
    destaque: v("--unv-color-action-primary", "#716C98"),
    borda: v("--unv-color-border-default", "#CCC9DE"),
    fonte: v("--unv-font-sans", "system-ui, sans-serif"),
  };
  prova?.remove();
  return paleta;
}

/** A paleta, lida UMA vez por tela: `getComputedStyle` a cada render seria trabalho à toa. */
export function usePaleta(tema: "light" | "dark" = "light"): Paleta {
  return useMemo(() => lerPaleta(tema), [tema]);
}

/** O `src` de um estande: a fotografia, ou o desenho dele. */
export function srcDoEstande(
  estande: { projetoId: string; titulo: string; imagem: ImagemPublica },
  paleta: Paleta,
  formato: Formato = "quadrado",
): string {
  if (estande.imagem.url) return estande.imagem.url;
  return dataUriDeSvg(svgDoEstande(estande.projetoId, estande.titulo, paleta, formato));
}

/**
 * A foto `n` (1 a 3) do carrossel de um post: a 1ª é a do estande; a 2ª (o
 * projeto de perto) e a 3ª (a equipe no estande) são as fotos geradas dessas
 * lâminas (0.8.0, ADR-178) e, sem elas, a arte procedural com outra semente.
 */
export function srcDaFoto(
  estande: { projetoId: string; titulo: string; imagem: ImagemPublica; laminas?: LaminasPublicas },
  n: number,
  paleta: Paleta,
): string {
  if (n <= 1) return srcDoEstande(estande, paleta);
  /* `?.`: o feed gravado de uma sessão antiga não tem `laminas`. */
  const gerada = n === 2 ? estande.laminas?.detalhe : estande.laminas?.equipe;
  return gerada ?? dataUriDeSvg(svgDoEstande(`${estande.projetoId}:foto${n}`, estande.titulo, paleta));
}

/** O `alt` da foto `n` do carrossel: o da api na 1ª; nas geradas, o da lâmina; na arte procedural, o do estande. */
export function altDaFoto(
  estande: { titulo: string; imagem: ImagemPublica; laminas?: LaminasPublicas },
  n: number,
  altDaLamina: (n: number, titulo: string) => string,
): string {
  if (n <= 1) return estande.imagem.alt;
  const gerada = n === 2 ? estande.laminas?.detalhe : estande.laminas?.equipe;
  return gerada ? altDaLamina(n, estande.titulo) : estande.imagem.alt;
}
