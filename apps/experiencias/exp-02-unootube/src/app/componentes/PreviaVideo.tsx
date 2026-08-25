import { useState } from "react";

import type { VideoPublico } from "../../lib/tipos";
import { urlDoVideo } from "../../lib/videos";
import { IndicadorCarregando } from "./IndicadorCarregando";

interface Props {
  video: VideoPublico;
  className: string;
  aoAssistir: (id: string) => void;
}

/** Thumbnail = o próprio <video> parado em t=0.1 (não há poster). */
export function PreviaVideo({ video, className, aoAssistir }: Props) {
  const [carregando, setCarregando] = useState(true);
  return (
    <button className={className} type="button" onClick={() => aoAssistir(video.id)} aria-label={`Assistir ${video.titulo}`}>
      <video
        src={`${urlDoVideo(video.arquivo)}#t=0.1`}
        muted
        playsInline
        preload="metadata"
        onLoadStart={() => setCarregando(true)}
        onWaiting={() => setCarregando(true)}
        onStalled={() => setCarregando(true)}
        onLoadedMetadata={() => setCarregando(false)}
        onCanPlay={() => setCarregando(false)}
      />
      {carregando && <IndicadorCarregando />}
      <span className="play-chip" aria-hidden="true">▶</span>
    </button>
  );
}
