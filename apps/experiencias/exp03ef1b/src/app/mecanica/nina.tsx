import { SpeechBubble } from "@edu/ui/ds";
import nina from "../../assets/nina.svg";
import { NINA } from "../../lib/textos";

/**
 * O balão da Nina — a guia da missão (repórter mirim). `SpeechBubble` da
 * seção `unooria` no tom `guide`, com o retrato dela (`assets/nina.svg`,
 * brief `pic-exp03ef1b-07`). `apoio` é a linha logo abaixo da fala (a
 * instrução do filtro, na E3 — spec §7.3).
 */
export function FalaDaNina({ fala, apoio }: { fala: string; apoio?: string }) {
  return (
    <SpeechBubble speaker={NINA.nome} tone="guide" avatarSrc={nina} className="fala-da-nina">
      <span className="fala-da-nina__fala">{fala}</span>
      {apoio ? <span className="fala-da-nina__apoio">{apoio}</span> : null}
    </SpeechBubble>
  );
}

export { nina as RETRATO_DA_NINA };
