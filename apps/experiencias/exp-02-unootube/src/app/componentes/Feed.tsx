import { useEffect, useRef, useState } from "react";

import type { VideoPublico } from "../../lib/tipos";
import { urlDoVideo } from "../../lib/videos";
import { aoMudarVisibilidade, estaVisivel } from "../../lib/visibilidade";
import { Descricao } from "./Descricao";
import { IndicadorCarregando } from "./IndicadorCarregando";

interface Props {
  videos: VideoPublico[];
  ativoId: string;
  somLigado: boolean;
  salvos: string[];
  curtidos: string[];
  descricaoExpandida: string | null;
  indiceAtivo: number;
  aoMudarAtivo: (id: string) => void;
  aoAlternarSom: () => void;
  aoSalvar: (id: string) => void;
  aoCurtir: (id: string) => void;
  aoExpandirDescricao: (id: string | null) => void;
  aoMover: (direcao: number) => void;
}

/**
 * Scroll-snap vertical de <video> nativos; o ativo é o mais visível
 * (IntersectionObserver com root no próprio feed — não depende da janela, por
 * isso a experiência dispensa `viewport`/DispositivoFrame). Autoplay só
 * funciona porque começa mudo e porque o hub delega `allow="autoplay"`.
 */
export function Feed(props: Props) {
  const { videos, ativoId, somLigado, aoMudarAtivo } = props;
  const feedRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef(new Map<string, HTMLVideoElement>());
  const [carregando, setCarregando] = useState<Set<string>>(() => new Set(videos.map((v) => v.id)));
  const [visivel, setVisivel] = useState(estaVisivel());

  useEffect(() => aoMudarVisibilidade(setVisivel), []);

  useEffect(() => {
    const itens = feedRef.current?.querySelectorAll<HTMLElement>(".short-item") ?? [];
    const observer = new IntersectionObserver(
      (entradas) => {
        const maisVisivel = entradas
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const alvo = maisVisivel?.target as HTMLElement | undefined;
        if (alvo?.dataset.videoId) aoMudarAtivo(alvo.dataset.videoId);
      },
      { root: feedRef.current, threshold: [0.55, 0.75] },
    );
    itens.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [videos, aoMudarAtivo]);

  useEffect(() => {
    videoRefs.current.forEach((video, id) => {
      video.muted = !somLigado;
      if (visivel && id === ativoId) video.play().catch(() => undefined);
      else video.pause();
    });
  }, [ativoId, somLigado, visivel]);

  function marcarCarregando(id: string, estado: boolean) {
    setCarregando((atual) => {
      if (atual.has(id) === estado) return atual;
      const proximo = new Set(atual);
      if (estado) proximo.add(id);
      else proximo.delete(id);
      return proximo;
    });
  }

  function alternarReproducao(id: string) {
    const video = videoRefs.current.get(id);
    if (!video) return;
    if (video.paused) video.play().catch(() => undefined);
    else video.pause();
  }

  return (
    <>
      <div className="feed-scroll" ref={feedRef} aria-label="Feed de vídeos curtos">
        {videos.map((video, indice) => {
          const curtido = props.curtidos.includes(video.id);
          const salvo = props.salvos.includes(video.id);
          const expandida = props.descricaoExpandida === video.id;
          return (
            <article
              className="short-item"
              id={`short-${video.id}`}
              data-video-id={video.id}
              key={video.id}
              aria-label={`Vídeo ${indice + 1} de ${videos.length}`}
            >
              <div className="short-stage">
                <div className="video-card" onClick={() => alternarReproducao(video.id)}>
                  <video
                    ref={(node) => {
                      if (node) videoRefs.current.set(video.id, node);
                      else videoRefs.current.delete(video.id);
                    }}
                    src={urlDoVideo(video.arquivo)}
                    muted={!somLigado}
                    loop
                    playsInline
                    preload={indice < 2 ? "auto" : "metadata"}
                    aria-label={video.titulo}
                    onLoadStart={() => marcarCarregando(video.id, true)}
                    onWaiting={() => marcarCarregando(video.id, true)}
                    onStalled={() => marcarCarregando(video.id, true)}
                    onCanPlay={() => marcarCarregando(video.id, false)}
                    onPlaying={() => marcarCarregando(video.id, false)}
                  />
                  {carregando.has(video.id) && <IndicadorCarregando />}
                  <div className="video-shade" />
                  <button
                    className="sound-control"
                    type="button"
                    aria-label={somLigado ? "Desativar som" : "Ativar som"}
                    onClick={(evento) => {
                      evento.stopPropagation();
                      props.aoAlternarSom();
                    }}
                  >
                    <span aria-hidden="true">{somLigado ? "♪" : "×"}</span>
                  </button>
                  <div className="video-copy">
                    <div className="channel-row">
                      <div className={`channel-avatar ${video.accent}`}>{video.avatar}</div>
                      <strong>{video.handle}</strong>
                      <span>{video.inscritosRotulo}</span>
                    </div>
                    <h1>{video.titulo}</h1>
                    <div
                      className={`video-description ${expandida ? "expanded" : ""}`}
                      onClick={(evento) => evento.stopPropagation()}
                    >
                      <p><Descricao texto={video.descricao} /></p>
                      <button
                        type="button"
                        aria-expanded={expandida}
                        aria-label={expandida ? "Mostrar menos da descrição" : "Mostrar descrição completa"}
                        onClick={() => props.aoExpandirDescricao(expandida ? null : video.id)}
                      >
                        {expandida ? "mostrar menos" : "…mais"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="action-rail" aria-label="Ações do vídeo">
                  <button
                    className={`save-action ${salvo ? "pressed saved" : ""}`}
                    type="button"
                    aria-label={salvo ? "Remover dos salvos" : "Salvar vídeo"}
                    aria-pressed={salvo}
                    onClick={() => props.aoSalvar(video.id)}
                  >
                    <span className="action-circle" aria-hidden="true"><i className="bookmark-glyph" /></span>
                    <small>{salvo ? "Salvo" : "Salvar"}</small>
                  </button>
                  <button
                    className={`like-action ${curtido ? "pressed" : ""}`}
                    type="button"
                    aria-label={curtido ? "Remover curtida" : "Curtir vídeo"}
                    aria-pressed={curtido}
                    onClick={() => props.aoCurtir(video.id)}
                  >
                    <span className="action-circle heart-glyph" aria-hidden="true">{curtido ? "♥" : "♡"}</span>
                    <small>{curtido ? "Curtido" : "Curtir"}</small>
                  </button>
                  <span className="video-position">{indice + 1}/{videos.length}</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="feed-arrows" aria-label="Navegar entre vídeos">
        <button type="button" aria-label="Vídeo anterior" disabled={props.indiceAtivo === 0} onClick={() => props.aoMover(-1)}>↑</button>
        <button type="button" aria-label="Próximo vídeo" disabled={props.indiceAtivo === videos.length - 1} onClick={() => props.aoMover(1)}>↓</button>
      </div>
    </>
  );
}
