import { useEffect, useRef, useState } from "react";
import { TEXTOS } from "../../lib/textos";
import { Pausa, Play } from "./glifos";

/**
 * (b) COMPENSAÇÃO — o balão de voz com transcrição.
 *
 * É a única lacuna da seção que não dá para compor: `MessageBubble` aceita
 * texto, `.Media` (imagem) e `.Document`, e não há player de áudio ali.
 * PEDIDO ao `storybook-unooria`: `ChatAudioBubbleWithTranscript`.
 *
 * **A transcrição nasce ABERTA, e o botão só a fecha.** A diferença entre isso
 * e um "ver transcrição" é a diferença entre acessibilidade e fallback: numa
 * sala de informática o estudante SEM FONE é a regra, não a exceção, e ele
 * precisa ler o que o áudio diz para decidir se encaminha. Atrás de um toque, a
 * evidência só chega a quem já desconfiava — que é justamente quem não precisa
 * dela. Quem quiser a tela limpa fecha; ninguém precisa descobrir para abrir.
 *
 * **Não há arquivo de áudio nesta missão, e não é pendência.** O player simula
 * a reprodução no tempo declarado e a transcrição carrega o conteúdo; zero
 * mídia binária foi uma decisão de produto, não um asset que faltou. Se um dia
 * uma locução chegar, ela entra ao lado do texto, nunca no lugar dele.
 */
export function BalaoDeVoz({
  duracaoSeg,
  transcricao,
  aoOuvir,
}: {
  duracaoSeg: number;
  transcricao: string;
  /** Disparado UMA vez, no primeiro play. É o `midiasAbertas` da api. */
  aoOuvir?: () => void;
}) {
  const [tocando, setTocando] = useState(false);
  const [decorrido, setDecorrido] = useState(0);
  const [aberta, setAberta] = useState(true);
  const jaAvisou = useRef(false);

  useEffect(() => {
    if (!tocando) return;
    const id = window.setInterval(() => {
      setDecorrido((s) => {
        const proximo = s + 1;
        if (proximo >= duracaoSeg) {
          setTocando(false);
          return duracaoSeg;
        }
        return proximo;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [tocando, duracaoSeg]);

  function alternar() {
    if (!jaAvisou.current) {
      jaAvisou.current = true;
      aoOuvir?.();
    }
    /* Chegou ao fim: o próximo toque recomeça, como no app real. */
    setDecorrido((s) => (s >= duracaoSeg ? 0 : s));
    setTocando((t) => !t);
  }

  const relogio = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const progresso = duracaoSeg > 0 ? Math.min(100, (decorrido / duracaoSeg) * 100) : 0;

  /*
   * Os DOIS botões daqui param `click` E `pointerdown`, e nenhum dos dois é
   * zelo excessivo — o balão de voz mora dentro do `div[role=button]` de
   * `BalaoSelecionavel`, que é o alvo de seleção da missão.
   *
   * Sem o `stopPropagation` do CLIQUE: a criança já está em seleção, toca ▶
   * para ouvir, e o clique sobe e marca (ou DESMARCA) a mensagem em silêncio.
   * Ela toca "Encaminhar para…" achando que manda 1 e manda 2, para um Mural
   * que o latch não desfaz.
   *
   * Sem o do POINTERDOWN: o `pointerdown` é o que arma o toque longo de 400 ms.
   * Um play segurado meio segundo abria a seleção sozinho — e o `click` do
   * botão ainda disparava `aoOuvir()`, marcando "ouviu o áudio" no painel da
   * professora para quem só estava com o dedo parado na tela.
   *
   * O `CardDeLink` (`balao.tsx`) fazia só a metade do clique; hoje os dois
   * alvos interativos do balão param os dois eventos, pelo mesmo motivo.
   */
  const pararNoPlayer = (e: { stopPropagation: () => void }) => e.stopPropagation();

  return (
    <div className="voz">
      <div className="voz__controles">
        <button
          type="button"
          className="voz__play"
          onPointerDown={pararNoPlayer}
          onClick={(e) => {
            pararNoPlayer(e);
            alternar();
          }}
          aria-label={tocando ? "Pausar áudio" : "Tocar áudio"}
        >
          {tocando ? <Pausa /> : <Play />}
        </button>
        <span className="voz__onda" aria-hidden="true">
          <span className="voz__onda-preenchida" style={{ width: `${progresso}%` }} />
        </span>
        <span className="voz__tempo">
          {relogio(decorrido)} / {relogio(duracaoSeg)}
        </span>
      </div>

      {aberta && <p className="voz__transcricao">{transcricao}</p>}

      <button
        type="button"
        className="voz__alternar"
        aria-expanded={aberta}
        onPointerDown={pararNoPlayer}
        onClick={(e) => {
          pararNoPlayer(e);
          setAberta((a) => !a);
        }}
      >
        {aberta ? TEXTOS.grupo.ocultarTranscricao : TEXTOS.grupo.lerTranscricao}
      </button>
    </div>
  );
}
