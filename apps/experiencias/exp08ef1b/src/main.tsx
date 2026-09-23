import React from "react";
import { createRoot } from "react-dom/client";

/**
 * Só a seção Instanooria do DS (50 KB). O `styles.css` completo traria os
 * tokens, os componentes e a fonte Open Sans da plataforma para dentro do
 * clone — proibido pela regra de disfarce e verificado no teste do origem.
 */
import "@unooria/design-system/instanooria.css";
/**
 * Tipografia self-hosted (@fontsource), empacotada pelo Vite — nenhuma URL
 * externa no bundle. No origem era next/font; o Figma usa SF Pro (Apple, não
 * empacotável) e Inter é o desenho livre mais próximo; Grand Hotel é a
 * aproximação consagrada do logotipo em script.
 */
import "@fontsource-variable/inter";
import "@fontsource/grand-hotel";
import "./estilos/globals.css";

import { Bootstrap } from "./bootstrap";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Bootstrap />
  </React.StrictMode>,
);
