import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

/**
 * UMA seção do design system: `unoovista`. A missão inteira acontece dentro do
 * clone — o mural da @radio_escola, a bancada, o feed, a virada, os pares e a
 * horta —, e NÃO há tela da escola: a nomeação dos conceitos (ENQUADRAMENTO,
 * AUTORIA, O QUE FICOU DE FORA) é oral, do professor, com os cartões (one-pager
 * §4, E5). Por isso a seção `unooria` não entra no bundle (e os 5 MB do
 * Material Symbols dela não descem à toa).
 *
 * A folha de FONTE é linha separada e obrigatória: o `Icon` do Unoovista é
 * ligadura do Material Symbols — sem ela, a tela escreve "lock" no lugar do
 * cadeado. Nunca o `styles.css` consolidado.
 */
import "@unooria/design-system/unoovista.css";
import "@unooria/design-system/fonts/unoovista.css";
import "./estilos/globals.css";

import { Bootstrap } from "./bootstrap";

/* O tema é o CLARO: a seção lê `data-unv-theme` na raiz. */
document.documentElement.dataset.unvTheme = "light";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);
