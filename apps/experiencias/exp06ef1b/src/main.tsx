import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

/**
 * As DUAS seções do design system que esta missão usa — cada uma pela folha
 * própria, nunca o `styles.css` consolidado (que arrastaria as outras seções
 * para dentro do disfarce):
 *
 * - **o clone** (`unoovista`): o crachá, o feed, a cédula, a plenária, a
 *   Galeria Oculta, o caso Mariana, a consulta nos Stories e o fim. A folha de
 *   FONTE é linha separada e obrigatória: Open Sans e o Material Symbols
 *   Rounded, auto-hospedados no pacote. O `Icon` do Unoovista é ligadura — sem
 *   ela, o NOME do glifo aparece no lugar do desenho ("lock" onde devia haver o
 *   cadeado).
 * - **a escola** (`unooria`): os pacotes, a cadeia e a missão ainda não aberta.
 *   A folha de FONTE também é obrigatória: o `PuzzleBlock` desenha o glifo por
 *   ligadura do Material Symbols.
 *
 * As duas nunca se cruzam numa tela. A fronteira é "quem está falando"
 * (`AGENTS.md` desta pasta), não o momento.
 */
import "@unooria/design-system/unoovista.css";
import "@unooria/design-system/fonts/unoovista.css";
import "@unooria/design-system/unooria.css";
import "@unooria/design-system/fonts/unooria.css";
import "./estilos/globals.css";

import { Bootstrap } from "./bootstrap";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);
