import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

/**
 * Só a seção Unooria do DS (tokens, componentes institucionais, Open Sans e
 * Material Symbols): esta é uma ferramenta do PROFESSOR, não um clone — vale a
 * identidade da plataforma, ao contrário das experiências do aluno.
 */
import "@unooria/design-system/unooria.css";
import "./estilos/globals.css";

import { Bootstrap } from "./bootstrap";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);
