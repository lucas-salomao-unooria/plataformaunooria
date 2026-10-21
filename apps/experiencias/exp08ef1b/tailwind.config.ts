import type { Config } from "tailwindcss";

/**
 * A cor de um token do Unoovista com o modificador de opacidade do Tailwind
 * (`text-ink/70`) funcionando. O valor é `var(--unv-*)`, que o Tailwind não sabe
 * decompor em canais, então a opacidade entra por `color-mix` — o mesmo piso de
 * navegador do `:has()` que os componentes do DS já exigem.
 */
const token = (nome: string) =>
  `color-mix(in srgb, var(${nome}) calc(<alpha-value> * 100%), transparent)`;

/**
 * Os nomes de cor da experiência, agora apontando para os tokens do Unoovista
 * (`@unooria/design-system/unoovista.css`). Os NOMES ficaram (`surface`, `ink`,
 * `action`…) porque estão em todas as telas, inclusive nas pós-revelação; o que
 * mudou é a fonte: nenhum hexadecimal do clone antigo sobrou aqui.
 *
 * As camadas são as do Unoovista: a tela é `canvas` (background-secondary) e o
 * conteúdo, `surface` (background-primary). O tema vem do `data-unv-theme` do
 * `<html>`; a experiência só usa o claro.
 *
 * As únicas cores literais são `night` e `brand.coral`, a atmosfera da revelação
 * e da reflexão — que falam FORA do disfarce e não são o app.
 */
const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: token("--unv-color-background-primary"),
        canvas: token("--unv-color-background-secondary"),
        canvasAlt: token("--unv-color-background-tertiary"),
        elevated: token("--unv-color-background-elevated"),
        field: token("--unv-color-fill-field"),
        hairline: token("--unv-color-border-subtle"),
        hairlineBarra: token("--unv-color-border-default"),
        controle: token("--unv-color-border-control"),
        ink: token("--unv-color-text-primary"),
        inkSecundario: token("--unv-color-icon-secondary"),
        muted: token("--unv-color-text-secondary"),
        action: token("--unv-color-action-primary"),
        "on-action": token("--unv-color-text-on-action"),
        link: token("--unv-color-text-link"),
        like: token("--unv-color-brand-like"),
        // O vermelho do curtir como TEXTO: o token puro (#E31A1A) dava 4,4:1 no
        // fundo da tela. Misturado a 18% de preto ele passa (~5,9:1) e continua
        // derivado do token, sem hexadecimal de interface (ADR-162).
        "like-texto": `color-mix(in srgb, color-mix(in srgb, var(--unv-color-brand-like) 82%, black) calc(<alpha-value> * 100%), transparent)`,
        // atmosfera da revelação/dossiê (fora do disfarce)
        night: "#0B0B10",
        // acento da reflexão, sobre `night` (fora do disfarce)
        brand: {
          coral: "#FF5C6E",
        },
      },
      fontFamily: {
        sans: ["var(--unv-font-sans)", '"Open Sans"', "sans-serif"],
      },
      borderRadius: {
        cartao: "var(--unv-radius-l)",
        midia: "var(--unv-radius-m)",
        bloco: "var(--unv-radius-s)",
      },
      maxWidth: {
        phone: "430px", // coluna central em desktop
      },
      spacing: {
        gutter: "var(--unv-gutter)",
        /** Altura da doca flutuante + o afastamento dela da borda inferior. */
        doca: "calc(var(--unv-touch-target) + 2 * var(--unv-spacing-xxs) + 2 * var(--unv-spacing-l))",
      },
      aspectRatio: {
        post: "4 / 5", // mídia 1080×1350
      },
    },
  },
  plugins: [],
};

export default config;
