/**
 * Visibilidade da experiência, ditada pelo hub.
 *
 * Esconder um iframe não dispara `visibilitychange` nele — por isso o hub
 * emite `hub:pause`/`hub:resume` e o bootstrap repassa para cá. O feed pausa o
 * vídeo ativo quando o hub some e retoma quando volta.
 */
type Ouvinte = (visivel: boolean) => void;

const ouvintes = new Set<Ouvinte>();
let visivelAgora = true;

export function aoMudarVisibilidade(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function marcarVisibilidade(visivel: boolean) {
  if (visivel === visivelAgora) return;
  visivelAgora = visivel;
  for (const ouvinte of ouvintes) ouvinte(visivel);
}

export function estaVisivel(): boolean {
  return visivelAgora;
}
