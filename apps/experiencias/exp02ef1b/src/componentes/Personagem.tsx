import type { ReactNode } from "react";
import { AvatarUnv, MessageBubble } from "@edu/ui/ds-unoovista";
import { ROTULOS } from "../lib/textos";

/**
 * Bento e Iara, a dupla da Rádio Escola.
 *
 * (b) COMPENSAÇÃO local — pedido aberto no storybook-unooria: não existe
 * ilustração dos dois em lugar nenhum do repositório (a exp04ef1b fala pelo
 * Bento só com o `SpeechBubble` da seção `unooria`, sem retrato) nem no DS.
 * Até a arte chegar, cada um é o `AvatarUnv` com as iniciais e a fala é o
 * `MessageBubble` da seção — as duas peças do DS, sem desenho local. A
 * "expressão" (aflito, sorrindo, olhos brilhando) fica com o texto da fala e
 * com um aceno (`.personagem--animado`, desligado em `prefers-reduced-motion`).
 */
const INICIAIS = { bento: "BE", iara: "IA" } as const;

export function Personagem({
  quem,
  fala,
  animado = false,
  anunciar = false,
}: {
  quem: "bento" | "iara";
  fala?: ReactNode;
  animado?: boolean;
  /** A fala chega por causa de algo que a criança fez: o leitor de tela anuncia. */
  anunciar?: boolean;
}) {
  const nome = quem === "bento" ? ROTULOS.bento : ROTULOS.iara;
  return (
    <div className={`personagem${animado ? " personagem--animado" : ""}`} aria-live={anunciar ? "polite" : undefined}>
      <AvatarUnv initials={INICIAIS[quem]} size="lg" ring="story" aria-label={nome} />
      {fala ? (
        <MessageBubble direction="incoming" senderLabel={nome} className="personagem__fala">
          {fala}
        </MessageBubble>
      ) : null}
    </div>
  );
}

/** Bento e Iara juntos — a espera do professor ("arrumando os fones") e a celebração final. */
export function Dupla({ fala, quem = "bento", animado = true }: { fala?: ReactNode; quem?: "bento" | "iara"; animado?: boolean }) {
  return (
    <div className={`dupla${animado ? " dupla--animada" : ""}`}>
      <div className="dupla__retratos" aria-hidden="true">
        <AvatarUnv initials={INICIAIS.bento} size="lg" ring="story" />
        <span className="dupla__fones">🎧</span>
        <AvatarUnv initials={INICIAIS.iara} size="lg" ring="story" />
      </div>
      {fala ? (
        <MessageBubble direction="incoming" senderLabel={quem === "bento" ? ROTULOS.bento : ROTULOS.iara}>
          {fala}
        </MessageBubble>
      ) : null}
    </div>
  );
}
