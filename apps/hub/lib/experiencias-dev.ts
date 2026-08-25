/**
 * DEV sem manifesto: onde o dev server do Vite de cada experiência está no ar.
 * Usado SÓ quando a tabela `experiencias` não tem a exp e `NODE_ENV !==
 * "production"`. Em produção a URL vem do manifesto (bucket/CDN versionado).
 *
 * A `expOrigin` do postMessage é derivada desta URL — se divergir do `src`
 * do iframe, o hub descarta o `exp:ready` por origin e o handshake expira.
 */
export const EXPERIENCIAS_DEV: Readonly<Record<string, string>> = {
  "exp-01-instanooria": "http://localhost:5173",
  "exp-02-unootube": "http://localhost:5174",
  /** Ferramenta do professor — embedada em /professor/plano-de-aula. */
  "exp-90-plano-de-aula": "http://localhost:5175",
};

export function baseDevDaExperiencia(expId: string, fallback: string): string {
  return EXPERIENCIAS_DEV[expId] ?? fallback;
}
