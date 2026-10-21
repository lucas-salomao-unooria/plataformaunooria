import { defineConfig } from "vite";

/**
 * Vila do Lume. SEM plugin de React: esta experiência não tem React nenhum — o
 * jogo é o bundle de scripts clássicos de `public/jogo/`, e o único código que
 * o Vite compila é o shim de `src/` (ver ADR-0001 desta experiência).
 *
 * `public/` é copiado verbatim para o `dist/`, então o jogo chega ao bucket
 * exatamente como está no repo. Consequência do ciclo de dev: mexer em
 * `public/jogo/src/*.js` não tem HMR — o Vite recarrega a página inteira, que
 * é o mesmo ciclo do repo de origem (editar e dar F5).
 */
export default defineConfig({
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
    // server-side (é de lá que sai `permissoes`, e a ausência de `viewport`).
    // Do container ele chega por `host.docker.internal`, e o Vite 5.4+ recusa
    // `Host` que não conheça (proteção a DNS rebinding).
    allowedHosts: ["host.docker.internal"],
    // Rodando em container (docker-compose.dev.yml), o inotify pode não
    // atravessar o bind mount do host; `DEV_POLLING=1` liga o polling.
    watch: process.env.VITE_USE_POLLING ? { usePolling: true, interval: 400 } : undefined,
  },
});
