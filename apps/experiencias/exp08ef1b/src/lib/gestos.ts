/**
 * Tradução de mouse e teclado para os gestos do celular.
 *
 * O estudante navega com teclado e mouse, mas a gramática da interface é de toque.
 * Nada disto aparece como dica na tela (regra de ouro 3): é memória muscular de
 * quem já usa app de celular no navegador.
 */

/** Rola o feed por post, como um "flick" do dedo. */
export function instalarRolagemPorTeclado(): () => void {
  const alturaDePasso = () => Math.round(window.innerHeight * 0.82);

  const aoTeclar = (evento: KeyboardEvent) => {
    if (evento.metaKey || evento.ctrlKey || evento.altKey) return;

    // Digitando num campo (comentário, compositor)? O teclado é do campo.
    const alvo = evento.target as HTMLElement | null;
    if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;

    /**
     * Com um botão focado, Espaço e Enter ATIVAM o botão — é o comportamento
     * padrão e a base da navegação por teclado (WCAG 2.1.1). Roubar essa tecla
     * para rolar o feed quebraria quem navega sem mouse.
     */
    const focado = document.activeElement as HTMLElement | null;
    const focoInterativo =
      focado &&
      (focado.tagName === 'BUTTON' ||
        focado.tagName === 'A' ||
        focado.tagName === 'INPUT' ||
        focado.tagName === 'TEXTAREA' ||
        focado.getAttribute('role') === 'button' ||
        focado.isContentEditable);

    if (focoInterativo && (evento.key === ' ' || evento.key === 'Enter')) return;

    const passo = alturaDePasso();
    const rolar = (delta: number) => {
      evento.preventDefault();
      window.scrollBy({ top: delta, behavior: 'smooth' });
    };

    switch (evento.key) {
      case 'ArrowDown':
      case 'PageDown':
      case ' ':
        rolar(passo);
        break;
      case 'ArrowUp':
      case 'PageUp':
        rolar(-passo);
        break;
      case 'Home':
        evento.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      default:
        break;
    }
  };

  window.addEventListener('keydown', aoTeclar, { passive: false });
  return () => window.removeEventListener('keydown', aoTeclar);
}

export type Direcao = 'cima' | 'baixo' | 'esquerda' | 'direita';

export interface OpcoesDeSwipe {
  /** Distância mínima em px para valer como gesto. */
  limite?: number;
  aoDeslizar: (direcao: Direcao) => void;
}

/**
 * Arrastar com o botão pressionado = swipe. Usa Pointer Events com captura,
 * porque sem `setPointerCapture` o navegador dispara `pointercancel` no primeiro
 * movimento de toque e o `pointerup` nunca chega — foi o que deixava o story sem
 * fechar no arraste.
 */
export function criarSwipe({ limite = 70, aoDeslizar }: OpcoesDeSwipe) {
  let inicioX: number | null = null;
  let inicioY: number | null = null;

  const encerrar = (x: number, y: number) => {
    if (inicioX === null || inicioY === null) return;

    const deltaX = x - inicioX;
    const deltaY = y - inicioY;
    inicioX = null;
    inicioY = null;

    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < limite) return;

    if (Math.abs(deltaY) >= Math.abs(deltaX)) aoDeslizar(deltaY > 0 ? 'baixo' : 'cima');
    else aoDeslizar(deltaX > 0 ? 'direita' : 'esquerda');
  };

  return {
    onPointerDown: (evento: React.PointerEvent) => {
      inicioX = evento.clientX;
      inicioY = evento.clientY;
      (evento.currentTarget as HTMLElement).setPointerCapture?.(evento.pointerId);
    },
    onPointerUp: (evento: React.PointerEvent) => encerrar(evento.clientX, evento.clientY),
    onPointerCancel: () => {
      inicioX = null;
      inicioY = null;
    },
    onTouchStart: (evento: React.TouchEvent) => {
      inicioX = evento.touches[0]?.clientX ?? null;
      inicioY = evento.touches[0]?.clientY ?? null;
    },
    onTouchEnd: (evento: React.TouchEvent) =>
      encerrar(evento.changedTouches[0]?.clientX ?? 0, evento.changedTouches[0]?.clientY ?? 0),
  };
}
