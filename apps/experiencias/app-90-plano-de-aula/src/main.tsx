import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

/**
 * Só a seção Unooria do DS (tokens, componentes institucionais, Open Sans e
 * Material Symbols): esta é uma ferramenta do PROFESSOR, não um clone — vale a
 * identidade da plataforma, ao contrário das experiências do estudante.
 */
import "@unooria/design-system/unooria.css";
// Obrigatória: os ícones da plataforma são fonte de ligadura — sem ela o glifo
// vira o NOME do ícone escrito na tela.
import "@unooria/design-system/fonts/unooria.css";
import "./estilos/globals.css";

import { Bootstrap } from "./bootstrap";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);
