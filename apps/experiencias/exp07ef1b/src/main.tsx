import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

/**
 * As DUAS seções do design system que esta missão usa, e a ordem importa menos
 * que a separação: o mensageiro é o disfarce, a plataforma é a escola.
 *
 * Quatro folhas, e as quatro são necessárias na 0.1.17 — a de FONTE é linha
 * separada e obrigatória, porque as folhas de componente deixaram de declarar
 * `@font-face`. Esquecê-la não quebra nada: só cai no fallback do sistema, o
 * clone perde a cara e ninguém percebe até alguém comparar com o app real.
 *
 * NUNCA o `styles.css` consolidado: ele arrasta as seis seções e os tokens da
 * plataforma para dentro do disfarce.
 */
import "@unooria/design-system/whatsappmobile.css";
import "@unooria/design-system/fonts/whatsappmobile.css";
import "@unooria/design-system/unooria.css";
import "@unooria/design-system/fonts/unooria.css";
import "./estilos/globals.css";

import { Bootstrap } from "./bootstrap";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);
