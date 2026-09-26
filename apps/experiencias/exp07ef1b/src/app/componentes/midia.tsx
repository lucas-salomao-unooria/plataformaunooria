import { useMemo } from "react";
import { PostCard } from "@edu/ui/ds-insta";
import {
  dataUriDeSvg,
  descricaoDoGrafico,
  svgDoCardProcedural,
  svgDoGrafico,
  type Formato,
  type Paleta,
} from "../../lib/graficos";
import { E2, GLOBAL } from "../../lib/textos";
import type { PostPublico } from "../../lib/tipos";

/**
 * A mídia de um post nos três lugares em que ela aparece — o feed, a grade da
 * aba Salvos e o Story do Mural —, e os três casos que a api manda:
 *
 * 1. **`imagem.url`** — a fotografia que a professora gerou no preparo. No
 *    feed, `PostCard.Media` com `src`: se ela não carregar, o próprio DS mostra
 *    o estado de erro com "Tentar novamente" (`e2.falha.midia_erro`), sem
 *    derrubar a legenda nem o `alt`.
 * 2. **`grafico`** — o SVG desenhado dos números (`lib/graficos.ts`).
 * 3. **nenhum dos dois** — o card procedural com a descrição da imagem. No feed
 *    ele é TEXTO de verdade (o `children` do `PostCard.Media` sem `src`, que o
 *    DS publica para isto): selecionável, ampliável e lido pelo leitor de tela
 *    como texto, e não como imagem. Na grade e no Story, que só aceitam `src`,
 *    ele vira o mesmo desenho em SVG.
 */

/**
 * A paleta do SVG, lida dos tokens `--insta-*` da raiz. Dentro de um `<img>` o
 * SVG não enxerga as variáveis CSS da página, então a cor viaja por parâmetro
 * — e continua vindo do pacote: quando o DS mudar a cor, o desenho muda junto.
 * Os valores de reserva existem só para o caso de a folha do DS ainda não ter
 * sido aplicada (o mesmo papel dos `var(--x, reserva)` do CSS).
 */
export function lerPaleta(): Paleta {
  const css = getComputedStyle(document.documentElement);
  const v = (nome: string, reserva: string) => css.getPropertyValue(nome).trim() || reserva;
  return {
    fundo: v("--insta-color-background-tertiary", "#F8F8F8"),
    superficie: v("--insta-color-background-primary", "#FFFFFF"),
    texto: v("--insta-color-text-primary", "#262626"),
    secundario: v("--insta-color-text-secondary", "#8E8E93"),
    destaque: v("--insta-color-action-primary", "#3897F0"),
    calor: v("--insta-color-brand-like", "#ED4956"),
    borda: v("--insta-color-border-default", "#C7C7CC"),
    fonte: v("--insta-font-sans", "system-ui, sans-serif"),
  };
}

/** A paleta, lida UMA vez por tela: `getComputedStyle` a cada render seria trabalho à toa. */
export function usePaleta(): Paleta {
  return useMemo(() => lerPaleta(), []);
}

/** O texto alternativo de um post: o do desenho, quando o desenho é nosso. */
export function altDoPost(post: PostPublico): string {
  if (!post.imagem.url && post.grafico) return descricaoDoGrafico(post.grafico);
  return post.imagem.alt;
}

/** O `src` de um post para quem só aceita `src` (a grade e o Story). */
export function srcDoPost(post: PostPublico, paleta: Paleta, formato: Formato): string {
  if (post.imagem.url) return post.imagem.url;
  if (post.grafico) return dataUriDeSvg(svgDoGrafico(post.grafico, paleta, formato));
  return dataUriDeSvg(svgDoCardProcedural(post.imagem.alt, paleta, formato));
}

/** A mídia do post dentro do `PostCard` do feed. */
export function MidiaDoPost({
  post,
  paleta,
  aoRecarregar,
}: {
  post: PostPublico;
  paleta: Paleta;
  aoRecarregar: () => void;
}) {
  if (post.imagem.url) {
    /* No erro, o DS tira o `<img>` da árvore — e o `alt` sai junto. A descrição
       da imagem continua na tela, sob o aviso ([D0-1]: "mantendo íntegros a
       manchete, a legenda e o alt text"; RNF-ACES-002): a leitura crítica do
       post não pode depender de a imagem ter carregado. */
    return (
      <PostCard.Media
        src={post.imagem.url}
        alt={post.imagem.alt}
        errorLabel={
          <>
            <span className="midia-com-erro__aviso">{E2.midiaErro}</span>
            <span className="midia-com-erro__descricao">{post.imagem.alt}</span>
          </>
        }
        retryLabel={GLOBAL.tentarNovamente}
        onRetry={aoRecarregar}
      />
    );
  }
  if (post.grafico) {
    return (
      <PostCard.Media
        src={dataUriDeSvg(svgDoGrafico(post.grafico, paleta, "quadrado"))}
        alt={descricaoDoGrafico(post.grafico)}
      />
    );
  }
  /* Sem `alt` no `PostCard.Media`: o conteúdo do slide JÁ é a descrição, e
     rotular o grupo com o mesmo texto faria o leitor de tela lê-lo duas vezes. */
  return (
    <PostCard.Media>
      <div className="card-procedural">
        <p className="card-procedural__texto">{post.imagem.alt}</p>
      </div>
    </PostCard.Media>
  );
}
