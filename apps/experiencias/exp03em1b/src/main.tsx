import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

/**
 * DUAS seções do design system, e a fronteira é "quem está falando"
 * (`docs/regras/design-system.md`):
 *
 * - `unoochat` — o mensageiro: a lista, o chat do Assistente de Dados, o
 *   compositor, o grupo da cidade, a pausa e a perícia (E1–E4b, E6-ALU-01/02);
 * - `unooria` — a ESCOLA: o laudo (E5) e a conclusão (E6-ALU-03).
 *
 * QUATRO folhas, a mesma receita da exp05ef1b: componente + FONTE de cada
 * seção. A de fonte é obrigatória nas duas — os ícones são ligadura do
 * Material Symbols, e sem a família a tela escreve o NOME do ícone. Os
 * seletores e tokens são prefixados (`--unc-*`, `--unooria-*`), e as folhas não
 * têm reset global: carregar as duas não as mistura. NUNCA o `styles.css`
 * consolidado.
 */
import "@unooria/design-system/unoochat.css";
import "@unooria/design-system/fonts/unoochat.css";
import "@unooria/design-system/unooria.css";
import "@unooria/design-system/fonts/unooria.css";
import "./estilos/globals.css";

import { Bootstrap } from "./bootstrap";

/* O tema contratual é o CLARO, como a exp05ef1b (ADR-134). */
document.documentElement.dataset.uncTheme = "light";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);
