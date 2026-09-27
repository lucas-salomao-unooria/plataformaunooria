import { defineConfig, mergeConfig } from "vitest/config";
import vite from "./vite.config";

/**
 * O vitest desta experiência RENDERIZA as telas (o fluxo inteiro, com uma api
 * falsa — `src/app/fluxo.test.tsx`), e para isso precisa de duas coisas que o
 * `vite.config.ts` não tem:
 *
 * - **o DS processado pelo vite, não pelo Node.** Os módulos do
 *   `@unooria/design-system` importam a própria folha (`import "./X.css"`), e o
 *   Node puro morre com `Unknown file extension ".css"`. `inline` faz o pacote
 *   passar pelo pipeline do vite, que trata o CSS.
 * - **o `jsdom`**, pedido por arquivo com `// @vitest-environment jsdom` (os
 *   testes de regra continuam no Node). O `jsdom` NÃO está declarado no
 *   `package.json` desta pasta: ele chega pela árvore do pnpm (é devDependency
 *   do `@edu/sdk`, e o vitest o resolve pelo `node_modules/.pnpm` içado). Declará-lo
 *   aqui exige `pnpm install` e o lockfile no mesmo commit — pendência registrada
 *   no `AGENTS.md` desta pasta.
 */
export default mergeConfig(
  vite,
  defineConfig({
    test: {
      server: { deps: { inline: [/@unooria\/design-system/] } },
    },
  }),
);
