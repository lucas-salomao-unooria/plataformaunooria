import { Button } from "@edu/ui/ds";

import type { Aparencia } from "../../lib/tema";
import type { VideoPublico } from "../../lib/tipos";
import { PreviaVideo } from "./PreviaVideo";

/**
 * Bandeja "Meus favoritos" — a faixa de largura cheia sob o feed (Figma `3:26`).
 *
 * Existe porque a escolha da missão era INVISÍVEL: até aqui o único sinal de
 * que um vídeo tinha sido salvo era um toast de 2,6 s, e a criança que
 * piscasse ficava sem saber quantos já tinha. A bandeja mostra os três lugares
 * o tempo todo — cheios ou vazios — e é por ela que se desfaz uma escolha.
 *
 * "Concluir missão" é o ÚNICO elemento daqui no DS da plataforma, pelo critério
 * de `Dialogos.tsx`: quem diz "missão" fala pela Unooria. O resto é cromo do
 * app e continua no clone.
 *
 * O botão só habilita com exatamente `limite` favoritos: menos que isso não há
 * o que comparar no ranking, e o servidor recusaria de qualquer forma
 * (`RANKING_BLOQUEADO`).
 */

interface Props {
  aparencia: Aparencia;
  salvos: VideoPublico[];
  limite: number;
  podeConcluir: boolean;
  aoAssistir: (id: string) => void;
  aoRemover: (id: string) => void;
  aoConcluir: () => void;
}

export function BandejaFavoritos({
  aparencia,
  salvos,
  limite,
  podeConcluir,
  aoAssistir,
  aoRemover,
  aoConcluir,
}: Props) {
  const tema = aparencia === "escuro" ? "dark" : "light";
  const slots = Array.from({ length: limite }, (_, i) => salvos[i] ?? null);

  return (
    <section className="bandeja" aria-label="Meus favoritos">
      <div className="bandeja-titulo">
        <strong>Meus favoritos</strong>
        <span>
          {salvos.length} de {limite} escolhidos
        </span>
      </div>

      <ol className="bandeja-slots">
        {slots.map((video, indice) => (
          <li className="bandeja-slot" key={video?.id ?? `vazio-${indice}`}>
            {video ? (
              <>
                <PreviaVideo video={video} className="bandeja-previa" aoAssistir={aoAssistir} />
                {/*
                 * O glifo é o caractere `✕`, e não um `Icon`: a seção do clone
                 * não publica "fechar" — o próprio `Modal` dela resolve assim,
                 * e a doc do componente registra a escolha.
                 */}
                <button
                  type="button"
                  className="bandeja-remover"
                  aria-label={`Remover ${video.titulo} dos favoritos`}
                  onClick={() => aoRemover(video.id)}
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </>
            ) : (
              <span className="empty-slot" aria-label={`Espaço ${indice + 1} vazio`}>
                {indice + 1}
              </span>
            )}
          </li>
        ))}
      </ol>

      <Button
        theme={tema}
        variant="primary"
        size="lg"
        className="bandeja-concluir"
        disabled={!podeConcluir}
        onClick={aoConcluir}
      >
        Concluir missão
      </Button>
    </section>
  );
}
