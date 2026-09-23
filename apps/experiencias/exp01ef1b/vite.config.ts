import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: "./", // base relativa p/ servir de qualquer path do bucket
  build: {
    // Sourcemap OCULTO (cap. 17): o `.map` é gerado, mas o bundle não ganha o
    // comentário `sourceMappingURL` — o navegador nunca o pede. O CI sobe os
    // mapas num bucket PRIVADO à parte; no público (acesso uniforme) qualquer
    // objeto é público, e o mapa é o fonte (na exp08ef1b, a revelação). Nunca
    // `true`; nunca `inline`.
    sourcemap: "hidden",
  },
  server: {
    // A porta é contrato com o hub (`apps/hub/lib/experiencias-dev.ts`): sem
    // `strictPort` o Vite pula para a próxima livre e o iframe do hub passa a
    // apontar para a experiência errada.
    strictPort: true,
    // O hub roda em container e lê o `experiencia.json` DESTE dev server
    // server-side (é dele que sai o `viewport`, ou seja: se a experiência é
    // embedada dentro do aparelho). Do container ele chega por
    // `host.docker.internal`, e o Vite 5.4+ recusa `Host` que não conheça
    // (proteção a DNS rebinding) — sem esta linha o manifesto não é lido e a
    // experiência aparece esticada na janela.
    allowedHosts: ["host.docker.internal"],
    // Rodando em container (docker-compose.dev.yml), o inotify pode não
    // atravessar o bind mount do host; `DEV_POLLING=1` liga o polling.
    watch: process.env.VITE_USE_POLLING ? { usePolling: true, interval: 400 } : undefined,
  },
});
