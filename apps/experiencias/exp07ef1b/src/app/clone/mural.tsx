import { Suspense, useEffect, useRef, useState } from "react";
import { PostCard, SegmentedTabs, StoryViewer } from "@edu/ui/ds-unoovista";
import { avancar, nomeDaConta, voltar, type Lado, type PosicaoNoMural } from "../../lib/regras";
import { telemetria } from "../../lib/telemetria";
import { E4 } from "../../lib/textos";
import type { RespostaMural, Triade } from "../../lib/tipos";
import { altDoPost, srcDoPost, usePaleta } from "../componentes/midia";
import { preguicoso } from "../preguica";

/** A ficha técnica e a copy dela só descem quando a professora acende as fichas. */
const FichaTecnica = preguicoso(() => import("./ficha-tecnica"));

/**
 * E4-ALU-01 (o PICO) e E4-ALU-02 (a revelação) — a mesma tela, duas etapas.
 *
 * **O pico é nu, de propósito** (o não-negociável 2 do brief): a barra de
 * pareamento ("Sua publicação" / "Publicação de {rótulo}", as abas e o nome
 * no Story dizem a mesma coisa: de quem é o que está na tela), os segmentos da
 * tríade, o POST — a imagem com a legenda do veículo por cima — e a legenda
 * crua da criança no rodapé. Sem tag, sem botão analítico, sem a Amara, sem
 * "há 2 horas": o choque tem de ser social antes de ser analítico.
 *
 * **A legenda do post vai sobre a imagem** (ADR-146). Antes o Story levava só
 * a imagem, e o PO viu o pico murchar: comparar com a Malu é comparar o que
 * cada veículo CONTOU, e a imagem sozinha não conta nada. É texto sobre a
 * mídia, não controle: os toques de avançar e voltar passam por ele.
 *
 * **Abre no Story do PAR** (ADR-146). A própria publicação a criança acabou
 * de ver na espera; abrir nela deixava o colega numa aba que quem não a nota
 * nunca abre — e o pico é justamente o do colega.
 *
 * **A revelação acende sobre o Story que a criança já está olhando** — a
 * gaveta da ficha (`ficha-tecnica.tsx`), e não uma troca de tela: trocar de
 * tela no instante da revelação faria ela perder o post em que estava.
 *
 * O toque segue o app: direita avança, esquerda volta, e depois do último
 * segmento da própria publicação vem a do colega (`regras.ts#avancar`). Sem
 * avanço automático: um Story que anda sozinho tiraria a imagem da tela no
 * meio da conversa da sala (e WCAG 2.2.2 pede que o que se move possa parar).
 */
export function Mural({ mural }: { mural: RespostaMural }) {
  const paleta = usePaleta();
  const [posicao, setPosicao] = useState<PosicaoNoMural>({ lado: "par", indice: 0 });
  const [fichaAberta, setFichaAberta] = useState(true);
  const avisouFichas = useRef(false);

  useEffect(() => {
    if (mural.fichasReveladas && !avisouFichas.current) {
      avisouFichas.current = true;
      setFichaAberta(true);
      telemetria.viuAsFichas();
    }
  }, [mural.fichasReveladas]);

  const rotuloDoPar = E4.colega(mural.par.rotulo);
  const triade: Triade = posicao.lado === "minha" ? mural.minha : mural.par;
  const total = triade.posts.length;
  const indice = Math.min(posicao.indice, total - 1);
  const post = triade.posts[indice];

  function irPara(nova: PosicaoNoMural) {
    if (nova.lado !== posicao.lado) telemetria.alternou(nova.lado);
    setPosicao(nova);
  }

  if (!post) return null;
  const ficha = triade.fichas?.find((f) => f.postId === post.id) ?? null;

  return (
    <div className="tela tela--story" data-unv-theme="dark">
      <h1 className="so-leitor">{E4.titulo}</h1>
      <SegmentedTabs
        theme="dark"
        ariaLabel={E4.titulo}
        items={[
          { id: "minha", label: E4.voce },
          { id: "par", label: rotuloDoPar },
        ]}
        activeId={posicao.lado}
        onChange={(id) => {
          const lado: Lado = id === "par" ? "par" : "minha";
          if (lado !== posicao.lado) irPara({ lado, indice: 0 });
        }}
      />
      <div className="story">
        <StoryViewer
          mediaSrc={srcDoPost(post, paleta, "story")}
          mediaAlt={altDoPost(post)}
          username={posicao.lado === "minha" ? E4.voce : rotuloDoPar}
          segments={total}
          currentSegment={indice + 1}
          segmentProgress={1}
          onNext={() => irPara(avancar({ lado: posicao.lado, indice }, total))}
          onPrev={() => irPara(voltar({ lado: posicao.lado, indice }, total))}
          footer={<p className="legenda-do-story">{triade.legenda}</p>}
        >
          <div className="legenda-do-post" data-unv-theme="dark">
            <PostCard.Caption username={nomeDaConta(post.perfil)}>{post.legenda}</PostCard.Caption>
          </div>
          {mural.fichasReveladas ? (
            <Suspense fallback={null}>
              <FichaTecnica
                aberta={fichaAberta}
                ficha={ficha}
                minha={mural.minha.equilibrio}
                par={mural.par.equilibrio}
                rotuloDaMinha={E4.voce}
                rotuloDoPar={rotuloDoPar}
                aoMudar={setFichaAberta}
              />
            </Suspense>
          ) : null}
        </StoryViewer>
      </div>
    </div>
  );
}
