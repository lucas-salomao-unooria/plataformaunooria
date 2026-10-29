import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

/**
 * O DS HÍBRIDO (ADR-202, decisão do Lucas de 2026-10-29): o clone é o
 * UnooriaAI (`unooriaai`, `src/app/clone/`) e a mecânica da missão — o
 * painel de deliberação, o ranking, o OCR, a tabela, o editor de protocolo e
 * Amara — é `unooria` (`src/app/mecanica/`). As duas seções, cada uma com a
 * folha de FONTE (os ícones são ligadura). Nunca o `styles.css` consolidado.
 */
import "@unooria/design-system/unooriaai.css";
import "@unooria/design-system/fonts/unooriaai.css";
import "@unooria/design-system/unooria.css";
import "@unooria/design-system/fonts/unooria.css";
import "./estilos/globals.css";

import { Bootstrap } from "./bootstrap";

/* O tema contratual é o CLARO (o escuro é V2). */
document.documentElement.dataset.uaiTheme = "light";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);
