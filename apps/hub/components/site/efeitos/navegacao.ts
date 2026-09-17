/**
 * Rolagem, trilho de capítulos, revelações e os dois diálogos — porte do
 * script inline de `index.html`. Corpo literal pelas razões do cabeçalho de
 * `atmosfera.ts`.
 *
 * DUAS classes de estado mudaram de dono, e é a única diferença de
 * comportamento em relação ao original:
 *
 *  - `js` e `at-opening` moravam em `<html>`/`<body>`. Aqui elas nascem no
 *    container do site, RENDERIZADAS PELO SERVIDOR. O CSS as usa como ancestral
 *    (`.js .reveal`, `.at-opening .floating-cta`), então o efeito é idêntico —
 *    e, posto no `useEffect`, `js` só chegaria depois da hidratação: o texto
 *    apareceria inteiro e SUMIRIA quando a classe entrasse, porque `.js .reveal`
 *    começa com `opacity:0`. O flash é visível em conexão lenta.
 *  - `locked` continua no `<body>`: ali o seletor é de elemento (`body.locked`)
 *    e o que ele trava é a rolagem da página, que é do documento.
 */
import { ATRIBUTO_DE_ABERTURA, ID_DA_JANELA } from "../formulario-de-cadastro";

export function iniciarNavegacao(raiz: HTMLElement): () => void {
  const corte = new AbortController();
  const { signal } = corte;

  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const sections = Array.from(raiz.querySelectorAll("main > section"));
  const railLinks = Array.from(raiz.querySelectorAll(".chapter-rail a"));
  const progress = raiz.querySelector<HTMLElement>(".progress");
  const header = raiz.querySelector<HTMLElement>(".header");
  const opening = raiz.querySelector<HTMLElement>("#inicio");
  const menuOpen = raiz.querySelector<HTMLElement>("#menu-open");
  const indexDialog = raiz.querySelector<HTMLDialogElement>("#index-dialog");
  const printDialog = raiz.querySelector<HTMLDialogElement>("#print-dialog");
  /* A janela do cadastro (2026-09-17) é renderizada pelo React, e não pela
     marcação estática — por isso ela não entra na checagem obrigatória abaixo:
     um `null` aqui não pode derrubar a rolagem, o trilho e as revelações do
     site inteiro. Sem ela, os botões simplesmente não abrem nada. */
  const cadastroDialog = raiz.querySelector<HTMLDialogElement>(`#${ID_DA_JANELA}`);
  const backTop = raiz.querySelector<HTMLElement>("#back-top");
  if (!progress || !header || !opening || !menuOpen || !indexDialog || !printDialog || !backTop) return () => {};

  let pending = false;
  function updateScroll() {
    pending = false;
    const y = window.scrollY;
    header!.classList.toggle("is-scrolled", y > 24);
    raiz.classList.toggle("at-opening", opening!.getBoundingClientRect().bottom > innerHeight * 0.5);
    const total = document.documentElement.scrollHeight - innerHeight;
    progress!.style.transform = `scaleX(${total > 0 ? Math.min(1, Math.max(0, y / total)) : 0})`;
    let current = 0;
    sections.forEach((s, i) => { if (s.getBoundingClientRect().top <= innerHeight * 0.36) current = i; });
    railLinks.forEach((a, i) => (i === current ? a.setAttribute("aria-current", "location") : a.removeAttribute("aria-current")));
  }
  addEventListener("scroll", () => { if (!pending) { pending = true; requestAnimationFrame(updateScroll); } }, { passive: true, signal });
  addEventListener("resize", updateScroll, { signal });
  updateScroll();

  const reveals = Array.from(raiz.querySelectorAll(".reveal"));
  let observador: IntersectionObserver | null = null;
  if ("IntersectionObserver" in window) {
    observador = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observador!.unobserve(entry.target);
          }
        }),
      { threshold: 0, rootMargin: "0px 0px 30px 0px" },
    );
    reveals.forEach((el) => observador!.observe(el));
  } else reveals.forEach((el) => el.classList.add("visible"));

  const dialogs = [indexDialog, printDialog, cadastroDialog].filter(
    (dialog): dialog is HTMLDialogElement => dialog !== null,
  );
  function openDialog(dialog: HTMLDialogElement) {
    dialog.showModal();
    document.body.classList.add("locked");
    if (dialog === indexDialog) menuOpen!.setAttribute("aria-expanded", "true");
  }
  dialogs.forEach((dialog) => {
    /* TODOS os `[data-close]`, não o primeiro: a janela do cadastro tem dois —
       o × discreto do topo e o "Cancelar" ao lado de "Enviar". Com
       `querySelector` no singular, o Cancelar era um botão que não fazia nada e
       nada acusava. */
    dialog.querySelectorAll("[data-close]").forEach((botao) =>
      botao.addEventListener("click", () => dialog.close(), { signal }),
    );
    dialog.addEventListener("close", () => {
      document.body.classList.remove("locked");
      if (dialog === indexDialog) menuOpen!.setAttribute("aria-expanded", "false");
    }, { signal });
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) {
        const r = dialog.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
      }
    }, { signal });
  });
  menuOpen.addEventListener("click", () => openDialog(indexDialog), { signal });
  /* Os TRÊS convites do site — cabeçalho, fechamento e a seção do cadastro —
     abrem a mesma janela. O seletor vem da constante que o componente exporta:
     um atributo escrito à mão aqui e lá é um botão morto sem nada no console. */
  if (cadastroDialog) {
    raiz.querySelectorAll<HTMLElement>(`[${ATRIBUTO_DE_ABERTURA}]`).forEach((botao) =>
      botao.addEventListener("click", () => openDialog(cadastroDialog), { signal }),
    );
  }
  indexDialog.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => indexDialog.close(), { signal }));
  backTop.addEventListener("click", () => {
    location.hash = "inicio";
    opening!.scrollIntoView({ behavior: reduced.matches ? "auto" : "smooth" });
  }, { signal });

  const printImage = raiz.querySelector<HTMLImageElement>("#print-image")!;
  const printViewport = raiz.querySelector<HTMLElement>(".image-viewport")!;
  const zoomControl = raiz.querySelector<HTMLElement>("#print-zoom")!;
  const printTitle = raiz.querySelector<HTMLElement>("#print-title")!;
  const printHelp = raiz.querySelector<HTMLElement>("#print-help")!;
  function setImageZoom(zoomed: boolean) {
    printViewport.classList.toggle("is-zoomed", zoomed);
    zoomControl.setAttribute("aria-pressed", String(zoomed));
    zoomControl.textContent = zoomed ? "Ajustar à tela" : "Ver tamanho original";
    printHelp.textContent = zoomed ? "Arraste a imagem para explorar os detalhes." : "Você também pode usar o gesto de pinça para ampliar.";
  }
  raiz.querySelectorAll<HTMLElement>("[data-print]").forEach((button) =>
    button.addEventListener("click", () => {
      const original = button.querySelector("img")!;
      printImage.src = original.src;
      printImage.alt = original.alt;
      printImage.style.setProperty("--natural-width", original.getAttribute("width") + "px");
      printTitle.textContent = button.dataset.title ?? "";
      setImageZoom(false);
      openDialog(printDialog);
      printViewport.scrollTop = 0;
      printViewport.scrollLeft = 0;
    }, { signal }),
  );
  zoomControl.addEventListener("click", () => setImageZoom(zoomControl.getAttribute("aria-pressed") !== "true"), { signal });

  return () => {
    corte.abort();
    observador?.disconnect();
    // Sair da landing com um diálogo aberto deixaria a rolagem do hub travada.
    document.body.classList.remove("locked");
  };
}
