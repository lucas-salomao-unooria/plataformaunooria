import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

/**
 * As DUAS seções do design system que esta missão usa — cada uma pela folha
 * própria, nunca o `styles.css` consolidado (que arrastaria as seis seções para
 * dentro do disfarce):
 *
 * - **o clone** (`unoovista`): E1 a E5 e as enquetes da DM. A folha de FONTE
 *   é linha separada e obrigatória: Open Sans e o Material Symbols Rounded,
 *   auto-hospedados no pacote. O `Icon` do Unoovista é ligadura — sem ela, o
 *   NOME do glifo aparece no lugar do desenho ("bookmark" onde devia haver a
 *   bandeirinha).
 * - **a escola** (`unooria`): E6 (a reflexão), "Missão concluída!" e a tela de
 *   missão ainda não liberada. A folha de FONTE é linha separada e
 *   obrigatória — sem ela, qualquer ícone da plataforma vira a palavra do
 *   ícone. (Estas telas não usam `Icon` da plataforma de propósito: o
 *   Material Symbols são 5,36 MB que só descem se a família for aplicada.)
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
