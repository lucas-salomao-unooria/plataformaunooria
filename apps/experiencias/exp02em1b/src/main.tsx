import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

/**
 * DUAS seções do design system, ambas de clone, e a fronteira é "quem está
 * falando" (`docs/regras/design-system.md`). Desde a 2.1.0 (ADR-191) a missão
 * não tem tela da escola: abre e fecha dentro dos apps.
 *
 * - `unooriaai` — o assistente: a pauta, o chat, a prévia e o "Publicar no Unoovista";
 * - `unoovista` — a rede social: o relógio, o feed da madrugada, a pausa, os
 *   bastidores e o fim.
 *
 * Os seletores e variáveis de cada uma são prefixados (`--uai-*`, `--unv-*`) e
 * as folhas não têm reset global: carregar as duas não as mistura. A folha de
 * FONTE de cada uma é linha separada e obrigatória: os ícones das duas são
 * ligadura do Material Symbols, e sem a família a tela escreve o NOME do ícone.
 * Nunca o `styles.css` consolidado, e nunca a `unooria.css` (a plataforma não
 * entra no clone).
 */
import "@unooria/design-system/unooriaai.css";
import "@unooria/design-system/fonts/unooriaai.css";
import "@unooria/design-system/unoovista.css";
import "@unooria/design-system/fonts/unoovista.css";
import "./estilos/globals.css";

import { Bootstrap } from "./bootstrap";

/* O tema contratual é o CLARO (handoff §5.2); o Unoovista vira escuro na
   madrugada, no próprio contêiner do feed (`data-unv-theme`). */
document.documentElement.dataset.uaiTheme = "light";
document.documentElement.dataset.unvTheme = "light";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);
