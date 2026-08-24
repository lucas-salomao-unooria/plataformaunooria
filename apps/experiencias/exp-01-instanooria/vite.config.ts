import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./", // base relativa p/ servir de qualquer path do bucket
  optimizeDeps: {
    /**
     * O `@unooria/design-system` publica ESM que importa DIRETÓRIOS
     * (`import * as UnooriaUI from "./unooria"`, e o mesmo dentro de cada
     * marca). ESM não faz resolução de diretório, então o esbuild da
     * pré-otimização do Vite falha com "Could not resolve ./unooria" e o dev
     * server MORRE na subida (o `vite build` passa: o Rollup resolve).
     *
     * Excluir da pré-otimização faz o Vite servir o pacote pelo resolver
     * próprio, que resolve `diretório → index.mjs`. Correção definitiva é no
     * pacote (emitir `./unooria/index.mjs` nos imports) — quando sair, esta
     * exclusão pode cair.
     */
    exclude: ["@unooria/design-system"],
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // O @edu/ui carrega 'use client' (para o hub/Next); no Vite é inerte.
        if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
        warn(warning);
      },
    },
  },
});
