/**
 * Girador de carregamento do vídeo.
 *
 * COMPENSAÇÃO REGISTRADA: o `ShortsPlayer` do DS mostra o glifo de reprodução
 * quando está PARADO, mas não distingue "parado" de "ainda carregando" — o
 * arquivo de origem é estático e não desenha esse estado. Enquanto a seção não
 * publicar um, o girador é local; as cores saem de `--uni-*`.
 */
export function IndicadorCarregando() {
  return (
    <span className="video-loading" aria-hidden="true">
      <i className="video-loading-spinner" />
    </span>
  );
}
