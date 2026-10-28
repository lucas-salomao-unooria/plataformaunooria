/**
 * A imagem ampliada (`#print-dialog`) cabendo na tela — porte do script que
 * veio na versão final do material (2026-10-28). Corpo literal.
 *
 * Quem ABRE a janela e liga o "Ver tamanho original" continua sendo o
 * `navegacao.ts`; este módulo só acrescenta, por cima, o que o pacote mudou:
 *  - a imagem é redimensionada para caber na janela visível (`fitPicture`), a
 *    cada carga e a cada mudança de tamanho;
 *  - um toque na área da imagem FECHA a janela;
 *  - a área deixa de ser foco de teclado (o `tabindex` que a marcação traz sai).
 *
 * Ele precisa ser montado DEPOIS do `navegacao.ts`: os dois escutam o clique
 * dos `[data-print]`, e o ajuste só faz sentido com o `src` já trocado.
 */
export function iniciarImagemAmpliada(raiz: HTMLElement): () => void {
  const dialog = raiz.querySelector<HTMLDialogElement>("#print-dialog");
  const picture = raiz.querySelector<HTMLImageElement>("#print-image");
  const viewport = dialog?.querySelector<HTMLElement>(".image-viewport");
  if (!dialog || !picture || !viewport) return () => {};

  const corte = new AbortController();
  const { signal } = corte;
  viewport.removeAttribute("tabindex");
  picture.draggable = false;

  function fitPicture() {
    if (!picture!.naturalWidth || !picture!.naturalHeight) return;
    const w = window.visualViewport?.width || innerWidth,
      h = window.visualViewport?.height || innerHeight;
    const ratio = Math.min(
      (w - 32) / picture!.naturalWidth,
      (h - 76) / picture!.naturalHeight,
    );
    picture!.style.width = `${picture!.naturalWidth * ratio}px`;
    picture!.style.height = `${picture!.naturalHeight * ratio}px`;
  }

  picture.addEventListener("load", fitPicture, { signal });
  addEventListener("resize", fitPicture, { signal });
  window.visualViewport?.addEventListener("resize", fitPicture, { signal });
  raiz
    .querySelectorAll<HTMLElement>("[data-print]")
    .forEach((button) =>
      button.addEventListener(
        "click",
        () => requestAnimationFrame(fitPicture),
        { signal },
      ),
    );
  viewport.addEventListener("click", () => dialog.close(), { signal });

  return () => corte.abort();
}
