import { Glifo } from '@edu/ui/ds-insta';

/**
 * Barra superior, medida no Figma (node 0:1752 — "Top Bar" do tema claro):
 * altura 44px, fundo `background/secondary` (#FAFAFA), divisória de 0.33px
 * (#A6A6AA), câmera 24×22 a 12px da esquerda, wordmark centralizado numa caixa
 * de 105×28 e, à direita, IGTV (22×24,5 com o ponto de 8px) e o avião de papel
 * (22,7×19,8).
 *
 * O wordmark é o único elemento que NÃO vem do arquivo: o logotipo de lá é a
 * marca do Instagram, e este app se chama Instanooria — então o nome é
 * composto tipograficamente, no mesmo lugar e no mesmo tamanho.
 */
export function TopBar({
  aoAbrirCompositor,
  aoTocarIgtv,
  naoLidas,
}: {
  aoAbrirCompositor: () => void;
  aoTocarIgtv: () => void;
  naoLidas: number;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-topbar items-center justify-between bg-canvas px-3 shadow-[0px_0.33px_0px_0px_theme(colors.hairlineBarra)]">
      <button
        type="button"
        aria-label="Câmera"
        onClick={aoAbrirCompositor}
        className="flex h-11 w-11 items-center justify-center -ml-2 active:opacity-50"
      >
        <Glifo name="camera" size={22} />
      </button>

      <span className="instanooria-wordmark absolute left-1/2 -translate-x-1/2 text-[28px] leading-none">
        Instanooria
      </span>

      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="Vídeos"
          onClick={aoTocarIgtv}
          className="relative flex h-11 w-8 items-center justify-center active:opacity-50"
        >
          <Glifo name="igtv" size={24} />
          {naoLidas > 0 ? (
            <span className="absolute right-0 top-[9px] h-2 w-2 rounded-full bg-like" />
          ) : null}
        </button>

        <span className="relative flex h-11 w-8 items-center justify-center" aria-hidden>
          <Glifo name="share" size={20} />
          <span className="absolute -right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-like px-1 text-[10px] font-semibold text-white">
            3
          </span>
        </span>
      </div>
    </header>
  );
}
