import type { ReactNode } from "react";
import { BottomSheetUnv, ButtonUnv, IconUnv, type UnvIconName } from "@edu/ui/ds-unoovista";

/**
 * Os AVISOS do protótipo validado pelo time (ADR-186): "OLHE O FUNDO", "CAPA
 * PUBLICADA!", "AGUARDE O PROFESSOR", "FOTO GUARDADA NO ÁLBUM!". Um ícone, um
 * título, uma frase e, quando há, UMA ação — a carga cognitiva de quem tem 7
 * anos.
 *
 * É o `BottomSheet` MODAL da seção (véu e foco preso), não um diálogo local: o
 * `ConfirmDialog` do pacote tem sempre duas ações, e aviso de uma ação só não
 * existe no DS. Controlado e sem `onOpenChange` quando `aoFechar` não vem: o
 * "AGUARDE O PROFESSOR" não fecha nem com ESC nem com o toque no véu — quem o
 * tira é a virada do professor.
 */
export function Aviso({
  aberto,
  icone,
  titulo,
  texto,
  acao,
  aoAgir,
  aoFechar,
  children,
}: {
  aberto: boolean;
  icone: UnvIconName;
  titulo: string;
  texto?: ReactNode;
  acao?: string;
  aoAgir?: () => void;
  aoFechar?: () => void;
  children?: ReactNode;
}) {
  return (
    <BottomSheetUnv
      open={aberto}
      modal
      title={titulo}
      maxHeight="70%"
      className="aviso"
      onOpenChange={aoFechar ? (aberta) => (aberta ? undefined : aoFechar()) : undefined}
    >
      <div className="aviso__corpo" role="status" aria-live="polite">
        <span className="aviso__icone" aria-hidden="true">
          <IconUnv name={icone} size="lg" />
        </span>
        {texto ? <p className="aviso__texto">{texto}</p> : null}
        {children}
        {acao && aoAgir ? (
          <ButtonUnv size="lg" block onClick={aoAgir}>
            {acao}
          </ButtonUnv>
        ) : null}
      </div>
    </BottomSheetUnv>
  );
}
