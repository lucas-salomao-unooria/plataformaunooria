import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

/**
 * As TRÊS seções do design system que esta missão usa — a primeira vez que três
 * seções aparecem na MESMA tela (a gaveta da mesa), e cada uma numa peça só
 * (ADR-117):
 *
 * - **`unooria`** — a redação inteira: mesa, gaveta, página, Bento, leitores,
 *   Chave, o desafio final e os avisos. A folha de FONTE é linha separada e
 *   obrigatória: os ícones da seção são fonte de LIGADURA (o `NewsCard`, o
 *   `RevealClue` e o `PuzzleBlock` desenham o meio e a pista por ela), e sem a
 *   família a tela escreveria "account_balance" no lugar do ícone. O custo
 *   medido do Material Symbols (5,36 MB, `packages/ui/AGENTS.md`) aqui é
 *   download de verdade: a mesa usa ícone desde a primeira tela.
 * - **`instanooria`** — só o `PostCard` do post de rede social, na gaveta. A
 *   seção não tem folha de fonte (a tipografia é a do sistema).
 * - **`whatsappmobile`** — só o `MessageBubble` da mensagem encaminhada, na
 *   gaveta e no boato do desafio final. Com a folha de fonte (PT Sans), para o
 *   balão não cair no fallback.
 *
 * **Verificado ao escrever (2026-09-27, DS 0.2.8): nenhuma das três vaza.** As
 * folhas agregadas e as de cada componente só declaram seletores com o prefixo
 * da própria seção (`.unooria-*`, `.insta-*`, `.wa-*`); os blocos `:root` só
 * definem variáveis do próprio namespace (`--unooria-*`, `--insta-*`, `--wa-*`);
 * não há reset de `body`, `html`, `*` nem de elemento solto; e as famílias das
 * folhas de fonte não colidem (Open Sans/Material Symbols × PT Sans/Poppins).
 * O único ponto de tema é o do Instanooria — `@media (prefers-color-scheme:
 * dark) { :root:not([data-insta-theme=light]) }` escurece os `--insta-*` com o
 * sistema em modo escuro —, e o `PostCard theme="light"` o neutraliza no próprio
 * cartão. O WhatsApp só publica tema escuro: o balão vai num contêiner escuro
 * próprio (`pecas/mensagem-encaminhada.tsx`).
 *
 * NUNCA o `styles.css` consolidado: ele arrasta as seis seções.
 */
import "@unooria/design-system/unooria.css";
import "@unooria/design-system/fonts/unooria.css";
import "@unooria/design-system/instanooria.css";
import "@unooria/design-system/whatsappmobile.css";
import "@unooria/design-system/fonts/whatsappmobile.css";
import "./estilos/globals.css";

import { Bootstrap } from "./bootstrap";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);
