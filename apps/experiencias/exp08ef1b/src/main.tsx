import React from "react";
import { createRoot } from "react-dom/client";

/**
 * Só a seção Unoovista do DS: tokens `--unv-*` e as folhas dos componentes. O
 * `styles.css` completo traria os tokens, os componentes e a tipografia da
 * plataforma para dentro do disfarce.
 */
import "@unooria/design-system/unoovista.css";
/**
 * A folha de FONTE é uma linha separada e obrigatória: Open Sans e o Material
 * Symbols Rounded, auto-hospedados no pacote (nenhuma URL externa no bundle).
 * Sem ela, o `Icon` do Unoovista — que é ligadura — escreve o NOME do glifo no
 * lugar do desenho ("favorite" onde devia haver um coração).
 */
import "@unooria/design-system/fonts/unoovista.css";
import "./estilos/globals.css";

import { Bootstrap } from "./bootstrap";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Bootstrap />
  </React.StrictMode>,
);
