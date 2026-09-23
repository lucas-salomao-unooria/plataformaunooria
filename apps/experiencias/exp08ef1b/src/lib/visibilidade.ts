/**
 * Visibilidade do APARELHO, ditada pelo hub.
 *
 * Esconder um iframe não dispara `visibilitychange` nele — por isso o hub
 * emite `hub:pause`/`hub:resume` (visibilidade e foco da página dele) e o
 * bootstrap repassa para cá. Quem mede tempo (dwell) e quem descarrega buffer
 * assina aqui. Substitui as mensagens `instanooria:visivel/oculto` da casca
 * same-origin do projeto origem.
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
