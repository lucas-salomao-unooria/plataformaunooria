import { SpeechBubble } from "@edu/ui/ds";
import nina from "../../assets/nina.svg";
import { NINA } from "../../lib/textos";

/**
 * A espera da turma (E3-SIS-01) e a PAUSA da professora: a tela de baixo
 * fica velada e inerte, e uma faixa fixa no rodapé traz a Nina com o título e
 * o apoio. SEM botão — quem solta é a professora (o polling de 3 s).
 *
 * O `SpeechBubble` é do DS; a faixa (posição fixa, véu) é
 * (b) COMPENSAÇÃO — sem par no DS: nenhuma das duas seções tem "barra de
 * aviso fixa com personagem". Só posição e cor de token (`.espera`).
 */
export function Espera({ titulo, apoio }: { titulo: string; apoio: string }) {
  return (
    <div className="espera" role="status" aria-live="polite">
      <div className="espera__veu" />
      <div className="espera__faixa">
        <SpeechBubble speaker={NINA.nome} tone="guide" avatarSrc={nina} className="espera__fala">
          <strong className="espera__titulo">{titulo}</strong>
          <span className="espera__apoio">{apoio}</span>
        </SpeechBubble>
      </div>
    </div>
  );
}
