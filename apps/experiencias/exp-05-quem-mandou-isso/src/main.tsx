import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

/**
 * As DUAS seções do design system que esta missão usa — e a separação importa
 * mais que a ordem: o mensageiro é o disfarce, a plataforma é a escola.
 *
 * QUATRO folhas, e as quatro são necessárias. A de FONTE é linha separada e
 * obrigatória desde a 0.1.17, quando as folhas de componente deixaram de
 * declarar `@font-face`. Esquecê-la não quebra nada visível de imediato: cai no
 * fallback do sistema, o clone perde a cara, e ninguém percebe até comparar com
 * o app real lado a lado. Na `unooria` é pior que estética — os ícones são
 * fonte de ligadura, e sem ela a tela escreve "search" no lugar da lupa.
 *
 * NUNCA o `styles.css` consolidado: ele arrasta as seis seções e os tokens da
 * plataforma para dentro do disfarce, e o balão do grupo passa a herdar cor de
 * botão institucional.
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
