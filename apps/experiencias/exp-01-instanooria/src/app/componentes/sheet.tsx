import { useEffect, useId, useRef } from 'react';

import { criarSwipe } from '../../lib/gestos';

/**
 * Bottom sheet do padrão de interface: sobe de baixo, arrastável no gesto de
 * fechar, fundo escurecido. Usado por comentários, compartilhar e opções.
 */
export function Sheet({
  aberto,
  aoFechar,
  altura = '75%',
  titulo,
  children,
}: {
  aberto: boolean;
  aoFechar: () => void;
  altura?: string;
  titulo?: string;
  children: React.ReactNode;
}) {
  const painel = useRef<HTMLDivElement | null>(null);
  const idTitulo = useId();
  // Bottom sheet de verdade fecha no arraste para baixo.
  const swipe = criarSwipe({ limite: 60, aoDeslizar: (direcao) => direcao === 'baixo' && aoFechar() });

  useEffect(() => {
    if (!aberto) return;

    // Acessibilidade: com aria-modal o foco PRECISA entrar no diálogo, senão o
    // teclado continua tabulando pelo conteúdo escondido atrás do overlay.
    const anterior = document.activeElement as HTMLElement | null;
    painel.current?.focus();

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        aoFechar();
        return;
      }
      if (evento.key !== 'Tab' || !painel.current) return;

      const focaveis = painel.current.querySelectorAll<HTMLElement>(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focaveis.length === 0) return;

      const primeiro = focaveis[0]!;
      const ultimo = focaveis[focaveis.length - 1]!;

      if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
      if (evento.shiftKey && (document.activeElement === primeiro || document.activeElement === painel.current)) {
        evento.preventDefault();
        ultimo.focus();
      }
    };

    // Trava o scroll do feed atrás do sheet (o app nativo faz isso; sem trava,
    // o conteúdo desliza sob um painel parado).
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = overflowAnterior;
      anterior?.focus();
    };
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titulo ? idTitulo : undefined}
    >
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-black/40"
        onClick={aoFechar}
      />
      <div
        ref={painel}
        tabIndex={-1}
        className="relative flex w-full max-w-phone flex-col rounded-t-2xl bg-surface outline-none"
        style={{ height: altura }}
      >
        <div className="flex cursor-grab items-center justify-center py-3 active:cursor-grabbing" {...swipe}>
          <span className="h-1 w-10 rounded-full bg-hairline" />
        </div>
        {titulo ? (
          <div
            id={idTitulo}
            className="border-b border-hairline pb-3 text-center text-[15px] font-semibold text-ink"
          >
            {titulo}
          </div>
        ) : null}
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}
