import { defineConfig } from "vitest/config";

/** Só lógica pura de `lib/` — telas são cobertas pelo smoke visual (scripts/walkthrough-*.mjs). */
export default defineConfig({
  test: { include: ["lib/**/*.test.ts"], environment: "node" },
});
