import { useEffect, useRef, useState } from "react";
import { Pausa, Play } from "./glifos";

/**
 * (b) COMPENSAÇÃO — o balão de voz com transcrição síncrona.
 *
 * É o único componente que esta missão precisa e não consegue compor com o que
 * a seção `whatsappmobile` publica: `MessageBubble` aceita texto, `.Media`
 * (imagem) e `.Document`, e não há player de áudio no pacote.
 * PEDIDO ao `storybook-unooria`: `ChatAudioBubbleWithTranscript`.
 *
 * Duas decisões que não são estéticas:
 *
 * 1. **A transcrição está SEMPRE na tela**, não atrás de um botão "ver
 *    transcrição". Ela é o canal principal de acessibilidade (RNF-ACES-001) e,
 *    numa sala sem fone, é por ela que metade da turma vai ler o áudio. É
 *    também o que mantém a missão jogável quando a mídia não foi preparada.
 * 2. **A onda é feita de divs com altura fixa**, sem Canvas e sem animação por
 *    quadro. O risco medido no parecer de design era queda de framerate em
 *    Chromebook escolar durante a rolagem do feed; o que se anima aqui é a COR
 *    das barras já desenhadas.
 */

/** Alturas fixas, em px. Pseudoaleatórias e estáveis: uma onda que muda a cada
 *  render pisca, e uma onda real não muda de forma enquanto toca. */
const ONDA = [6, 11, 17, 9, 20, 14, 8, 18, 22, 12, 7, 16, 10, 19, 13, 8, 15, 11, 6, 14];

function mmss(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function BalaoDeVoz({
  url,
  transcricao,
  duracaoSeg,
  aoConcluir,
  rotulo,
}: {
  /** `null` quando a mídia não foi preparada: o play fica inerte e a
   *  transcrição assume — nunca um botão que não faz nada em silêncio. */
  url: string | null;
  transcricao: string;
  duracaoSeg: number;
  /** Chamado quando a faixa chega ao fim. É isso que a api grava, não o toque
   *  no play: começar a ouvir não é ter ouvido. */
  aoConcluir?: () => void;
  rotulo: string;
}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [tocando, setTocando] = useState(false);
  const [progresso, setProgresso] = useState(0);

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    const aoTempo = () => setProgresso(el.duration ? el.currentTime / el.duration : 0);
    const aoFim = () => {
      setTocando(false);
      setProgresso(1);
      aoConcluir?.();
    };
    el.addEventListener("timeupdate", aoTempo);
    el.addEventListener("ended", aoFim);
    return () => {
      el.removeEventListener("timeupdate", aoTempo);
      el.removeEventListener("ended", aoFim);
    };
  }, [aoConcluir]);

  function alternar() {
    const el = audio.current;
    if (!el) return;
    if (tocando) {
      el.pause();
      setTocando(false);
      return;
    }
    void el.play().then(() => setTocando(true)).catch(() => setTocando(false));
  }

  const tocadas = Math.round(progresso * ONDA.length);

  return (
    <div className="voz">
      <div className="voz__linha">
        <button
          type="button"
          className="voz__play"
          onClick={alternar}
          disabled={!url}
          aria-label={tocando ? `Pausar ${rotulo}` : `Reproduzir ${rotulo}`}
        >
          {tocando ? <Pausa /> : <Play />}
        </button>
        <div className="voz__onda" aria-hidden="true">
          {ONDA.map((altura, i) => (
            <span
              key={i}
              className={`voz__barra${i < tocadas ? " voz__barra--tocada" : ""}`}
              style={{ height: altura }}
            />
          ))}
        </div>
        <span className="voz__duracao">{mmss(duracaoSeg)}</span>
      </div>

      {/* Sempre visível: é o canal de acessibilidade e o fallback da mídia. */}
      <p className="voz__transcricao">{transcricao}</p>

      {!url && <p className="voz__aviso">Áudio indisponível. O texto acima é o que foi dito.</p>}

      {url && <audio ref={audio} src={url} preload="none" />}
    </div>
  );
}
