import { useState } from "react";
import { StoryViewer } from "@edu/ui/ds-unoovista";
import { E4, ESPERA } from "../../lib/textos";
import type { PostPublico } from "../../lib/tipos";
import { altDoPost, srcDoPost, usePaleta } from "../componentes/midia";

/**
 * E3-SIS-01 — a espera depois do latch.
 *
 * A prévia é o PRÓPRIO Story que a criança publicou (a tríade e a legenda),
 * navegável pelos toques de sempre: é o que a jornada pede ("relê a própria
 * legenda publicada") e é o jeito honesto de dizer que a publicação foi feita
 * — a tela mostra o que está no ar, não um "enviado com sucesso" abstrato.
 *
 * **Não há contador da sala** ("18 de 25 colegas enviaram", o
 * `e3.feedback.contador_sala` do sheet): a rota de gate é magra de propósito
 * (ADR-93) e não traz contagem, e inventar um número aqui seria a tela
 * mentindo. Quem vê a contagem é a professora, no painel.
 *
 * **Não há volta.** Nenhum botão leva ao feed ou à aba Salvos: o latch é
 * irreversível, e a api recusa (`latch-ja-confirmado`) qualquer pedido de
 * passo para trás. Quem tira a criança daqui é o polling de 5 s, quando a
 * professora libera o Mural.
 */
export function Espera({ posts, legenda }: { posts: PostPublico[]; legenda: string }) {
  const paleta = usePaleta();
  const [indice, setIndice] = useState(0);
  const total = posts.length;
  const post = posts[Math.min(indice, total - 1)];
  if (!post) return null;

  return (
    <div className="tela tela--story" data-unv-theme="dark">
      <div className="espera__status" role="status">
        <p className="espera__titulo">{ESPERA.publicado}</p>
        <p className="espera__descricao">{ESPERA.descricao}</p>
      </div>
      <div className="story">
        <StoryViewer
          mediaSrc={srcDoPost(post, paleta, "story")}
          mediaAlt={altDoPost(post)}
          username={E4.voce}
          segments={total}
          currentSegment={indice + 1}
          segmentProgress={1}
          onNext={() => setIndice((i) => Math.min(total - 1, i + 1))}
          onPrev={() => setIndice((i) => Math.max(0, i - 1))}
          footer={<p className="legenda-do-story">{legenda}</p>}
        />
      </div>
    </div>
  );
}
