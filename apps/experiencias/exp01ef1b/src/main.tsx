import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

/**
 * As DUAS famílias, cada uma pela folha própria — nunca o `styles.css`
 * consolidado (traria as seis seções para dentro do disfarce):
 * - clone: seção Instanooria (E2–E4). Não há `fonts/instanooria.css` no
 *   pacote; a tipografia do clone é @fontsource (Inter + Grand Hotel),
 *   self-hosted, o mesmo desenho da exp08ef1b.
 * - casca: seção Unooria (E1, E5, E6, ERR), com a folha de fonte separada —
 *   a linha obrigatória desde a 0.1.17.
 */
import "@unooria/design-system/instanooria.css";
import "@fontsource-variable/inter";
import "@fontsource/grand-hotel";
import "@unooria/design-system/unooria.css";
import "@unooria/design-system/fonts/unooria.css";
import "./estilos/globals.css";

import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
