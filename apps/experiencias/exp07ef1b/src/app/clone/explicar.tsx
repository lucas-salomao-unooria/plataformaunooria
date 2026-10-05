import { useEffect, useRef, useState } from "react";
import { ButtonUnv, PostCard, TopBar } from "@edu/ui/ds-unoovista";
import { SEGUNDOS_POR_CARD, TOTAL_DE_CARDS } from "../../lib/regras";
import { telemetria } from "../../lib/telemetria";
import { CONTAS } from "../../lib/textos";
import { E5 } from "../../lib/textos-da-explicacao";
import FOTO_DA_AMARA from "../../assets/amara.svg";
import { AcaoDaDm, BalaoDaAmara, DmDaAmara } from "./dm-da-amara";

/**
 * E5-ALU-01 (o carrossel) e E5-ALU-02 (a DM de fechamento da Amara).
 *
 * **O carrossel é um POST do app**, não uma tela da escola: três slides de
 * texto no `PostCard` (a mídia sem `src` recebe o slide como `children`, que é
 * para isso que o DS publica essa variante), com os pontos do carrossel e o
 * contador "1/3". Quem fala ainda é o clone — a revelação já aconteceu no
 * Mural, e é só agora que a palavra "lente" chega, depois de a criança ter
 * visto a coisa.
 *
 * **A trava de 8 s por card** é o que separa ler de passar o dedo: o
 * "Próximo" só acende depois dela, com a contagem na base. A contagem NÃO é
 * região viva: anunciar "7s… 6s…" a cada segundo seria o leitor de tela
 * falando por cima do card que a criança está lendo.
 *
 * O card em que ela parou vai para o `sessionStorage` (`aoChegarNoCard`): um F5
 * no meio da leitura volta ao mesmo card, com a trava de novo.
 *
 * Chega por `React.lazy` (`selecao-app.tsx`): este arquivo e a copy dele
 * (`lib/textos-da-explicacao.ts`) só descem quando a professora libera a
 * conclusão — o card 2 é a lente de cada veículo escrita por extenso.
 */
export default function Explicar({
  cardInicial,
  indo,
  aoChegarNoCard,
  aoIrParaReflexao,
}: {
  cardInicial: number;
  indo: boolean;
  aoChegarNoCard: (card: number) => void;
  aoIrParaReflexao: () => void;
}) {
  const [card, setCard] = useState(Math.min(Math.max(0, cardInicial), TOTAL_DE_CARDS));
  const [restante, setRestante] = useState(SEGUNDOS_POR_CARD);
  const [curtido, setCurtido] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const inicioDoCard = useRef(Date.now());

  useEffect(() => {
    if (card >= TOTAL_DE_CARDS) return;
    inicioDoCard.current = Date.now();
    setRestante(SEGUNDOS_POR_CARD);
    const relogio = window.setInterval(() => {
      setRestante((s) => {
        if (s <= 1) {
          window.clearInterval(relogio);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(relogio);
  }, [card]);

  function proximo() {
    telemetria.leuCard(card + 1, Math.round((Date.now() - inicioDoCard.current) / 1000));
    const seguinte = card + 1;
    setCard(seguinte);
    aoChegarNoCard(seguinte);
  }

  if (card >= TOTAL_DE_CARDS) {
    return (
      <DmDaAmara
        rodape={
          <AcaoDaDm ocupado={indo} aoTocar={aoIrParaReflexao}>
            {E5.irReflexao}
          </AcaoDaDm>
        }
      >
        <BalaoDaAmara>{E5.dmFechamento}</BalaoDaAmara>
      </DmDaAmara>
    );
  }

  const atual = E5.cards[card];
  if (!atual) return null;
  const travado = restante > 0;

  return (
    <div className="tela tela--clara">
      <TopBar title={CONTAS.estudante} withStatusBarInset={false} />
      <div className="rolagem">
        <PostCard className="post">
          <PostCard.Header username={CONTAS.amara} initials="AM" avatarSrc={FOTO_DA_AMARA} />
          {/* Sem `alt`: o título do slide já é o `h2` dentro dele, e rotular o
              grupo com o mesmo texto faria o leitor de tela lê-lo duas vezes. */}
          <PostCard.Media currentIndex={card + 1} totalCount={TOTAL_DE_CARDS}>
            <div className="card-conceitual">
              <h2 className="card-conceitual__titulo">{atual.titulo}</h2>
              <p className="card-conceitual__corpo">{atual.corpo}</p>
            </div>
          </PostCard.Media>
          <PostCard.Actions
            liked={curtido}
            saved={salvo}
            currentIndex={card + 1}
            totalCount={TOTAL_DE_CARDS}
            onLike={() => setCurtido((c) => !c)}
            onSave={() => setSalvo((s) => !s)}
          />
        </PostCard>
        <div className="explicar__avanco">
          {travado && <p className="explicar__trava">{E5.travaTempo(restante)}</p>}
          <ButtonUnv variant="primary" size="lg" block disabled={travado} onClick={proximo}>
            {E5.proximo}
          </ButtonUnv>
        </div>
      </div>
    </div>
  );
}
