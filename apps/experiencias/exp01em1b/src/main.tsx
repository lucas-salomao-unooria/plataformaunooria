import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

/**
 * DUAS seções do design system, e a fronteira é "quem está falando"
 * (`docs/regras/design-system.md`):
 *
 * - `unooria` — a ESCOLA: o módulo de homologação da comissão (a Zara, as
 *   fichas, a bancada, o reteste, a publicação e o certificado);
 * - `unooriaai` — o ASSISTENTE testado: a bateria de sessões (E4-ALU-01)
 *   inteira, e as PEÇAS dele dentro de telas da escola (a prévia de cada
 *   função na E2, o efeito do reteste na E5) — ADR-117/173, só a peça importa
 *   a ponte.
 *
 * Os seletores e variáveis de cada uma são prefixados (`--unooria-*`,
 * `--uai-*`) e as folhas não têm reset global: carregar as duas não as mistura.
 * A folha de FONTE de cada uma é linha separada e obrigatória: os ícones das
 * duas são ligadura do Material Symbols, e sem a família a tela escreve o NOME
 * do ícone. Nunca o `styles.css` consolidado.
 */
import "@unooria/design-system/unooria.css";
import "@unooria/design-system/fonts/unooria.css";
import "@unooria/design-system/unooriaai.css";
import "@unooria/design-system/fonts/unooriaai.css";
import "./estilos/globals.css";

import { Bootstrap } from "./bootstrap";

/* O tema é o CLARO: a seção do assistente lê `data-uai-theme` na raiz; a da escola recebe `theme` por prop. */
document.documentElement.dataset.uaiTheme = "light";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);
