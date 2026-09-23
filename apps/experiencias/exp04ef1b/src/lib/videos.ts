/**
 * Os 21 mp4 (~52 MB) ficam FORA do git e do bundle. Em dev, `public/videos/`
 * (gitignorado) é servido pelo Vite em `./videos`; em produção o build recebe
 * `VITE_VIDEOS_BASE_URL` apontando para o bucket de assets via CDN
 * (docs/INFRA.md). `base: "./"` do Vite mantém o caminho relativo válido em
 * qualquer path do bucket.
 */
export function urlDoVideo(arquivo: string, base: string | undefined = import.meta.env.VITE_VIDEOS_BASE_URL): string {
  const raiz = (base && base.trim()) || "./videos";
  return `${raiz.replace(/\/+$/, "")}/${arquivo}`;
}
