import type { ReactNode } from "react";
import { ButtonUnv, DirectThread, MessageBubble } from "@edu/ui/ds-unoovista";
import { CONTAS } from "../../lib/textos";
/* Ilustração em SVG, importada pelo Vite: entra no bundle versionado (abaixo
   de 4 KB vira data URI), e a missão continua sem mídia binária (ADR-146). */
import FOTO_DA_AMARA from "../../assets/amara.svg";

/**
 * A conversa com a Amara — a mesma DM nas três vezes em que ela fala: o
 * desafio (E1), o fechamento da explicação (E5-ALU-02) e as enquetes.
 *
 * É a PERSONAGEM falando, e por isso é o clone (`DirectThread`), não a escola:
 * a Amara é uma colega do grêmio, e uma caixa de diálogo institucional com a
 * voz dela quebraria as duas coisas ao mesmo tempo. O rodapé é um botão só — a
 * ação única da tela —, e não um compositor: não há o que responder por
 * escrito à Amara (a ausência de texto livre na DM é deliberada: a legenda e a
 * reflexão são os dois únicos textos da criança, e os dois têm lugar próprio).
 */
export function DmDaAmara({ children, rodape }: { children: ReactNode; rodape?: ReactNode }) {
  return (
    <div className="tela">
      <DirectThread
        username={CONTAS.amara}
        avatarSrc={FOTO_DA_AMARA}
        subtitle={CONTAS.amaraSubtitulo}
        withStatusBarInset={false}
        footer={rodape}
      >
        {children}
      </DirectThread>
    </div>
  );
}

/** Um balão da Amara. Quem fecha o grupo leva o avatar, como no app. */
export function BalaoDaAmara({
  children,
  posicao = "single",
  bare = false,
}: {
  children: ReactNode;
  posicao?: "single" | "first" | "middle" | "last";
  bare?: boolean;
}) {
  return (
    <MessageBubble
      direction="incoming"
      position={posicao}
      senderLabel={CONTAS.amaraParaLeitor}
      bare={bare}
      avatarSrc={posicao === "single" || posicao === "last" ? FOTO_DA_AMARA : undefined}
    >
      {children}
    </MessageBubble>
  );
}

/** O botão do rodapé da DM: a largura toda, a ação primária do app. */
export function AcaoDaDm({
  children,
  aoTocar,
  ocupado = false,
}: {
  children: ReactNode;
  aoTocar: () => void;
  ocupado?: boolean;
}) {
  return (
    <ButtonUnv variant="primary" size="lg" block disabled={ocupado} aria-busy={ocupado || undefined} onClick={aoTocar}>
      {children}
    </ButtonUnv>
  );
}
