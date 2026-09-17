import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

/**
 * As folhas do design system, e a regra de ouro que decide quais entram.
 *
 * O template nasce só com a seção `unooria` — a da PLATAFORMA — porque é ela
 * que fala na tela de entrada e nas telas pós-revelação de qualquer missão.
 * A seção do CLONE que a missão imita entra aqui ao lado quando a missão for
 * definida: `@unooria/design-system/<secao>.css` + `/fonts/<secao>.css`, e a
 * ponte correspondente em `@edu/ui/ds-<secao>` (`ds-insta`, `ds-unootube`,
 * `ds-chatgpt`, `ds-whatsapp`). As duas famílias NUNCA se cruzam numa mesma
 * tela — `docs/regras/design-system.md`.
 *
 * A folha de FONTE é linha separada e obrigatória (desde a 0.1.17 as folhas de
 * componente não declaram `@font-face`). Na `unooria` ela não é estética: os
 * ícones são fonte de ligadura, e sem ela a tela escreve "search" no lugar da
 * lupa. NUNCA o `styles.css` consolidado — ele arrasta as seis seções para
 * dentro de uma tela só.
 */
import "@unooria/design-system/unooria.css";
import "@unooria/design-system/fonts/unooria.css";
import "./estilos/globals.css";

import { Bootstrap } from "./bootstrap";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);
