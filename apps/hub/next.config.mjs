/** @type {import('next').NextConfig} */
export default {
  output: "standalone",
  transpilePackages: ["@edu/sdk", "@edu/ui"],
  // Build de produção SEM derrubar o dev server: `pnpm build:isolado` escreve
  // em .next-prod em vez de sobrescrever o .next do `next dev` (sintoma do
  // conflito: tela branca/CSS bugado no dev). Padrão herdado do projeto origem.
  distDir: process.env.HUB_DIST_DIR ?? ".next",
};
