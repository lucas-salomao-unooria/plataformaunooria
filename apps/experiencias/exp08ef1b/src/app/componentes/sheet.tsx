import { useEffect } from 'react';

import { BottomSheetUnv } from '@edu/ui/ds-unoovista';

/**
 * Folha inferior: o `BottomSheet` modal do Unoovista (véu, foco preso, ESC e
 * toque no véu fecham). Usada por comentários, compartilhar, opções e o menu da
 * conta.
 *
 * O que fica aqui é só o que o componente não faz por ser de DS:
 * - **A camada.** O véu do DS é `position: absolute` sobre o contêiner
 *   posicionado mais próximo (no Storybook, o `PhoneFrame`); aqui esse
 *   contêiner é uma camada `fixed` do tamanho da coluna do aparelho.
 * - **A trava da rolagem do feed atrás** (o app nativo faz isso; sem trava, o
 *   conteúdo desliza sob um painel parado).
 * - **A altura fixa**, quando pedida: a folha do DS cresce até `maxHeight`, e os
 *   comentários precisam da altura inteira para o campo ficar preso embaixo.
 *
 * A folha do DS não tem arraste para fechar (decisão do Unoovista: a alça é só
 * visual); fecha pelo véu, pelo ESC ou pela ação da própria folha.
 */
export function Sheet({
  aberto,
  aoFechar,
  altura = '75%',
  titulo,
  rotulo,
  children,
}: {
  aberto: boolean;
  aoFechar: () => void;
  /** Altura fixa da folha, ou `auto` para crescer com o conteúdo. */
  altura?: string;
  titulo?: string;
  /** Nome acessível quando a folha não tem título visível. */
  rotulo?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!aberto) return;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflowAnterior;
    };
  }, [aberto]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 mx-auto w-full max-w-phone">
      <BottomSheetUnv
        open
        onOpenChange={(aberta) => {
          if (!aberta) aoFechar();
        }}
        title={titulo}
        aria-label={titulo ? undefined : rotulo}
        style={altura === 'auto' ? undefined : { height: altura }}
      >
        {children}
      </BottomSheetUnv>
    </div>
  );
}
