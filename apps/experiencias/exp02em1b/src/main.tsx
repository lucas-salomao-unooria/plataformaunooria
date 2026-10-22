import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

/**
 * TRÊS seções do design system, e a fronteira é "quem está falando"
 * (`docs/regras/design-system.md`):
 *
 * - `unooria` — a ESCOLA: a abertura (a pauta do grêmio) e a conclusão;
 * - `unooriaai` — o assistente, do primeiro prompt ao "Publicar no Unoovista";
 * - `unoovista` — a rede social: o feed da madrugada e os bastidores (Etapa 5).
 *
 * Os seletores e variáveis de cada uma são prefixados (`--unooria-*`, `--uai-*`,
 * `--unv-*`) e as folhas não têm reset global: carregar as três não as mistura.
 * A folha de FONTE de cada uma é linha separada e obrigatória: os ícones das
 * três são ligadura do Material Symbols, e sem a família a tela escreve o NOME
 * do ícone. Nunca o `styles.css` consolidado.
 */
import "@unooria/design-system/unooria.css";
import "@unooria/design-system/fonts/unooria.css";
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
