import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

/**
 * As DUAS seções do design system que esta missão usa — cada uma pela folha
 * própria, nunca o `styles.css` consolidado (que arrastaria as seis seções para
 * dentro do disfarce):
 *
 * - **o clone** (`instanooria`): E1 a E5 e as enquetes da DM. A seção NÃO tem
 *   folha de fonte: a tipografia do Instagram é a do sistema (SF Pro no iOS),
 *   e o `--insta-font-sans` já cai nela. A exp01ef1b traz Inter/Grand Hotel por
 *   `@fontsource`; esta missão não, porque não mostra o logotipo manuscrito.
 * - **a escola** (`unooria`): E6 (a reflexão), "Missão concluída!" e a tela de
 *   missão ainda não liberada. A folha de FONTE é linha separada e
 *   obrigatória — sem ela, qualquer ícone da plataforma vira a palavra do
 *   ícone. (Estas telas não usam `Icon` da plataforma de propósito: o
 *   Material Symbols são 5,36 MB que só descem se a família for aplicada.)
 *
 * As duas nunca se cruzam numa tela. A fronteira é "quem está falando"
 * (`AGENTS.md` desta pasta), não o momento.
 */
import "@unooria/design-system/instanooria.css";
import "@unooria/design-system/unooria.css";
import "@unooria/design-system/fonts/unooria.css";
import "./estilos/globals.css";

import { Bootstrap } from "./bootstrap";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);
