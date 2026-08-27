import { useState } from "react";
import { ShortsPlayer } from "@edu/ui/ds-unootube";

import type { VideoPublico } from "../../lib/tipos";
import { urlDoVideo } from "../../lib/videos";
import { IndicadorCarregando } from "./IndicadorCarregando";

interface Props {
  video: VideoPublico;
  className: string;
  aoAssistir: (id: string) => void;
}

/**
 * Miniatura das telas de coleção. Continua sendo o próprio `<video>` parado em
 * `t=0.1` — não existe poster para estes 21 arquivos, e inventar um seria
 * inventar arte que ninguém desenhou.
 *
 * O `ShortsPlayer` do DS entra em `card` desligado: sem trilha, sem linha do
 * tempo e sem toque para reproduzir, porque aqui o quadro inteiro é um alvo só
 * — clicar leva ao feed. O glifo central de reprodução do DS ocupa o lugar do
 * antigo `.play-chip`.
 */
export function PreviaVideo({ video, className, aoAssistir }: Props) {
  const [carregando, setCarregando] = useState(true);
  return (
    <button
      className={className}
      type="button"
      onClick={() => aoAssistir(video.id)}
      aria-label={`Assistir ${video.titulo}`}
    >
      <ShortsPlayer
        variant="card"
        src={`${urlDoVideo(video.arquivo)}#t=0.1`}
        alt={video.titulo}
        preload="metadata"
        showRail={false}
        showChannel={false}
        showProgress={false}
        tapToToggle={false}
        /*
         * `duration > 0` é o sinal de que os metadados chegaram e o quadro já
         * tem imagem: o `useVideoPlayback` do DS escuta `loadedmetadata` e
         * `durationchange`, então este é o primeiro estado em que o vídeo
         * deixou de ser um retângulo vazio.
         */
        onStateChange={(estado) => setCarregando(estado.duration === 0)}
      />
      {carregando && <IndicadorCarregando />}
    </button>
  );
}
