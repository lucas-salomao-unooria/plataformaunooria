import type { ReactNode } from "react";
import { MessageBubble } from "@edu/ui/ds-unoovista";
import { ROTULOS } from "../lib/textos";

/**
 * O Bento falando — o balão do protótipo ("BENTO LEMBRA: VAMOS INVESTIGAR?",
 * "ERA O MESMO LUGAR!"), SÓ a mensagem (ADR-186): o retrato com iniciais que a
 * 1.0.0 desenhava enquanto não havia arte dele parecia um avatar do estudante,
 * e o time pediu a tela limpa. O balão é o `MessageBubble` da seção, com o
 * nome do Bento como remetente; a "expressão" fica com o texto da fala e com
 * um aceno (`.personagem--animado`, desligado em `prefers-reduced-motion`).
 */
export function Personagem({
  fala,
  animado = false,
  anunciar = false,
}: {
  fala: ReactNode;
  animado?: boolean;
  /** A fala chega por causa de algo que a criança fez: o leitor de tela anuncia. */
  anunciar?: boolean;
}) {
  return (
    <div className={`personagem${animado ? " personagem--animado" : ""}`} aria-live={anunciar ? "polite" : undefined}>
      <MessageBubble direction="incoming" senderLabel={ROTULOS.bento} className="personagem__fala">
        {fala}
      </MessageBubble>
    </div>
  );
}
