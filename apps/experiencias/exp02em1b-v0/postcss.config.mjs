/**
 * Tailwind 3 + autoprefixer. A experiência usa Tailwind para LAYOUT e nada
 * mais: o `tailwind.config.ts` ao lado não define uma única cor própria — só
 * apelidos que apontam para os tokens `--uai-*` do design system.
 */
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
