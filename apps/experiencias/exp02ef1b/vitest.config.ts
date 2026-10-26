import { defineConfig, mergeConfig } from "vitest/config";
import vite from "./vite.config";

/**
 * O vitest desta experiência também RENDERIZA as telas (`src/telas.test.tsx`,
 * cada passo com uma sessão falsa), e para isso o DS precisa passar pelo vite:
 * os módulos do `@unooria/design-system` importam a própria folha
 * (`import "./X.css"`), e o Node puro morre com `Unknown file extension ".css"`.
 * O `jsdom` é pedido por arquivo (`// @vitest-environment jsdom`) e chega pela
 * árvore do pnpm, como na exp04ef1b — os testes de regra continuam no Node.
 */
export default mergeConfig(
  vite,
  defineConfig({
    test: {
      server: { deps: { inline: [/@unooria\/design-system/] } },
    },
  }),
);
