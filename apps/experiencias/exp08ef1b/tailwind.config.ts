import type { Config } from "tailwindcss";

/**
 * Tokens do clone — port LITERAL do tailwind.config.ts do projeto origem.
 * A paleta funcional é a do padrão de interface (cinzas, azul de ação,
 * vermelho de curtida); a identidade é só da marca Instanooria (wordmark
 * coral→violeta). Nenhum asset ou fonte proprietária de terceiros, e NADA da
 * marca institucional da plataforma pode entrar aqui.
 */
const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /**
         * Tokens lidos do arquivo Figma (fonte da verdade):
         * color/background/primary, /secondary, /tertiary, color/text/primary,
         * color/icon/primary e /secondary.
         */
        surface: "#FFFFFF", // background/primary — fundo do feed e dos stories
        canvas: "#FAFAFA", // background/secondary — barras (topo e navegação)
        canvasAlt: "#F8F8F8", // background/tertiary
        hairline: "rgba(60, 60, 67, 0.29)", // divisória dos stories no Figma
        hairlineBarra: "#A6A6AA", // sombra de 0.33px das barras no Figma
        ink: "#262626", // text/primary e icon/primary
        inkSecundario: "#8E8E93", // icon/secondary (só ícone: 2.98:1 em texto)
        /**
         * #8E8E93 (Figma) reprova em texto pequeno; #737373 mantém a leitura e
         * entrega 4.74:1 (AA).
         */
        muted: "#737373",
        // ações
        // #0095F6 é o azul do padrão de interface (3.17:1). Para texto pequeno
        // e botões, #0079CC entrega 4.56:1 (AA) mantendo a mesma leitura.
        action: "#0079CC",
        "action-brilhante": "#0095F6", // ícones/decoração (AA de gráficos)
        verificado: "#3897F0", // selo do Figma
        link: "#00376B", // hashtags e menções
        like: "#FF3040", // ícone de curtida (gráfico: 3.65:1 é suficiente)
        "like-texto": "#C3121F", // mesmo vermelho para TEXTO pequeno (5.9:1, AA)
        // marca Instanooria (apenas wordmark)
        brand: {
          coral: "#FF5C6E",
          violet: "#7B4DFF",
        },
        // atmosfera da revelação/dossiê (fora do disfarce)
        night: "#0B0B10",
      },
      fontFamily: {
        sans: [
          // O fallback vai DENTRO do var(): se a variável não existir,
          // `var(--fonte-app)` sem fallback invalida a cadeia inteira.
          "var(--fonte-app, -apple-system)",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        // Grand Hotel é a aproximação livre do logotipo em script.
        wordmark: ['var(--fonte-wordmark, "Brush Script MT")', '"Brush Script MT"', '"Segoe Script"', "cursive"],
      },
      maxWidth: {
        phone: "430px", // coluna central em desktop
      },
      spacing: {
        topbar: "44px",
        stories: "98px",
        postheader: "56px",
        actionbar: "48px",
        bottomnav: "50px",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #FF5C6E 0%, #7B4DFF 100%)",
      },
      aspectRatio: {
        post: "4 / 5", // mídia 1080×1350
      },
    },
  },
  plugins: [],
};

export default config;
