import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Só lógica pura de `lib/` — telas são cobertas pelo smoke visual (scripts/walkthrough-*.mjs). */
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
    // `server-only` lança fora de um RSC; ver `lib/stub-server-only.ts`.
    alias: { "server-only": fileURLToPath(new URL("./lib/stub-server-only.ts", import.meta.url)) },
  },
});
