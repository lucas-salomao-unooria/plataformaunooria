import { useEffect, useRef, useState } from "react";
import { Pausa, Play } from "./glifos";

/**
 * (b) COMPENSAÇÃO — o balão de voz com transcrição.
 *
 * É a única lacuna da seção que não dá para compor: `MessageBubble` aceita
 * texto, `.Media` (imagem) e `.Document`, e não há player de áudio ali.
 * PEDIDO ao `storybook-unooria`: `ChatAudioBubbleWithTranscript`.
 *
 * **A transcrição fica SEMPRE visível**, e isso não é fallback de mídia
 * ausente: é acessibilidade (RNF-A11Y-002). O estudante sem fone — que numa
 * sala de informática é a regra, não a exceção — precisa ler o que o áudio diz
 * para auditar a fonte, e um botão "ver transcrição" esconderia a evidência
 * atrás de um toque a mais.
 *
 * **Não há arquivo de áudio ainda.** O `aud-06-*` do brief de assets não foi
 * gravado, e a missão roda igual — o botão simula a reprodução no tempo
 * declarado, e a transcrição carrega o conteúdo. Quando a locução chegar, ela
 * entra ao lado do texto, nunca no lugar dele.
 */
export function BalaoDeVoz({
  duracaoSeg,
  transcricao,
  aoOuvir,
}: {
  duracaoSeg: number;
  transcricao: string;
  /** Disparado uma vez, quando a reprodução chega ao fim. */
  aoOuvir?: () => void;
}) {
  const [tocando, setTocando] = useState(false);
  const [decorrido, setDecorrido] = useState(0);
  const jaAvisou = useRef(false);

  useEffect(() => {
    if (!tocando) return;
    const id = window.setInterval(() => {
      setDecorrido((s) => {
        const proximo = s + 1;
        if (proximo >= duracaoSeg) {
          setTocando(false);
          if (!jaAvisou.current) {
            jaAvisou.current = true;
            aoOuvir?.();
          }
          return duracaoSeg;
        }
        return proximo;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [tocando, duracaoSeg, aoOuvir]);

  const relogio = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="voz">
      <div className="voz__controles">
        <button
          type="button"
          onClick={() => setTocando((t) => !t)}
          aria-label={tocando ? "Pausar áudio" : "Tocar áudio"}
        >
          {tocando ? <Pausa /> : <Play />}
        </button>
        <span className="voz__onda" aria-hidden="true" />
        <span style={{ fontSize: 12 }}>{relogio(decorrido)} / {relogio(duracaoSeg)}</span>
      </div>
      <p className="voz__transcricao">{transcricao}</p>
    </div>
  );
}
