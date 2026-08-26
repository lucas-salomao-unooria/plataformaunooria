import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

/**
 * Só a seção Unooria do DS (tokens, componentes institucionais, Open Sans e
 * Material Symbols): ferramenta do PROFESSOR, com a identidade da plataforma
 * — mesma escolha da exp-90.
 */
import "@unooria/design-system/unooria.css";
import "./estilos/globals.css";

import { Bootstrap } from "./bootstrap";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);
