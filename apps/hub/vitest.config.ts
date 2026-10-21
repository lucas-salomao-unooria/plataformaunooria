import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Só lógica pura de `lib/` — telas são cobertas pelo smoke visual (scripts/walkthrough-*.mjs). */
export default defineConfig({
  /* O `tsconfig.json` diz `"jsx": "preserve"` (quem compila JSX é o Next), e o
     esbuild do Vitest herdaria isso — o teste que renderiza um componente
     (o markdown do agente) morreria com "React is not defined". */
  esbuild: { jsx: "automatic" },
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
    // `server-only` lança fora de um RSC; ver `lib/stub-server-only.ts`.
    // `@/` é o mesmo do `tsconfig.json`: é por ele que o teste alcança um route
    // handler (`app/api/**/route.ts`), que importa tudo com `@/lib/...`.
    alias: {
      "server-only": fileURLToPath(new URL("./lib/stub-server-only.ts", import.meta.url)),
      // A chave é "@" (sem a barra): o alias do Vite casa "@" + "/…", e não
      // pega `@edu/*` nem `@unooria/*`, em que o caractere seguinte é letra.
      "@": fileURLToPath(new URL(".", import.meta.url)).replace(/\/$/, ""),
    },
  },
});
