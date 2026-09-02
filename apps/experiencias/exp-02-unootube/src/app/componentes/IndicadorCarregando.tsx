/**
 * Girador de carregamento do vídeo.
 *
 * COMPENSAÇÃO REGISTRADA: o `ShortsPlayer` do DS mostra o glifo de reprodução
 * quando está PARADO, mas não distingue "parado" de "ainda carregando" — o
 * arquivo de origem é estático e não desenha esse estado. Enquanto a seção não
 * publicar um, o girador é local; as cores saem de `--uni-*`.
 *
 * `detalhado` é a forma do FEED (Figma `7:76`): o girador ganha o rótulo em
 * palavras e um esqueleto no lugar da legenda, para que a espera pareça uma
 * espera e não um vídeo preto. As miniaturas das coleções e da bandeja usam a
 * forma curta — ali o quadro tem 100px e um rótulo não caberia.
 */
export function IndicadorCarregando({ detalhado = false }: { detalhado?: boolean }) {
  return (
    <span className={`video-loading ${detalhado ? "video-loading--detalhado" : ""}`} aria-hidden="true">
      <span className="video-loading-centro">
        <i className="video-loading-spinner" />
        {detalhado && <span className="video-loading-rotulo">Carregando o vídeo…</span>}
      </span>
      {detalhado && (
        <span className="video-loading-esqueleto">
          <i style={{ width: "40%" }} />
          <i style={{ width: "82%" }} />
          <i style={{ width: "64%" }} />
          <i style={{ width: "30%" }} />
        </span>
      )}
    </span>
  );
}

/**
 * O vídeo não vai chegar.
 *
 * COMPENSAÇÃO REGISTRADA, irmã da de cima: a seção `unootube` não publica
 * estado de erro do reprodutor — o `ShortsPlayer` deriva `waiting` só de
 * `waiting`/`playing` e ignora `error`. Sem este aviso, um mp4 em 404 fica no
 * girador para sempre e a criança acha que a internet dela está ruim.
 *
 * A fala não culpa nem manda tentar de novo: recarregar não traz um arquivo que
 * não está no bucket. Ela diz o que aconteceu e o que ainda dá para fazer, que é
 * seguir para o próximo — a missão continua concluível.
 */
export function VideoIndisponivel() {
  return (
    <span className="video-loading video-loading--detalhado" role="status">
      <span className="video-loading-centro">
        <span className="video-loading-rotulo">
          Este vídeo não carregou. Você pode seguir para o próximo.
        </span>
      </span>
    </span>
  );
}
