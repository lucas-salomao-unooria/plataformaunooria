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
 * - **`unoovista`** — só o `PostCard` do post de rede social, na gaveta
 *   (ADR-136; até a 2.0.0 era o `instanooria`).
 * - **`unoochat`** — só o `MessageBubble` da mensagem encaminhada, na gaveta e
 *   no boato do desafio final (ADR-136; até a 2.0.0 era o `whatsappmobile`).
 *
 * As duas folhas de FONTE novas são obrigatórias pela regra das pontes (o
 * `Icon` das duas seções é ligadura do Material Symbols). No DS 0.2.11 elas
 * declaram as MESMAS faces da `fonts/unooria.css`, com as mesmas URLs: a
 * repetição do `@font-face` não baixa nada a mais, e a linha fica para o dia em
 * que uma seção trocar de família.
 *
 * **Verificado ao escrever (2026-10-02, DS 0.2.11): nenhuma das três vaza.** As
 * folhas agregadas e as de cada componente só declaram seletores com o prefixo
 * da própria seção (`.unooria-*`, `.unv-*`, `.unc-*`); os blocos `:root` só
 * definem variáveis do próprio namespace (`--unooria-*`, `--unv-*`, `--unc-*`);
 * não há reset de `body`, `html`, `*` nem de elemento solto. As duas seções
 * novas têm dois temas e o `:root` é o CLARO — nenhuma segue o modo escuro do
 * sistema —, e cada peça fixa o claro no próprio contêiner (`PostCard
 * theme="light"`, `data-unc-theme="light"`), porque a redação em volta é clara.
 *
 * NUNCA o `styles.css` consolidado: ele arrasta as seis seções.
 */
import "@unooria/design-system/unooria.css";
import "@unooria/design-system/fonts/unooria.css";
import "@unooria/design-system/unoovista.css";
import "@unooria/design-system/fonts/unoovista.css";
import "@unooria/design-system/unoochat.css";
import "@unooria/design-system/fonts/unoochat.css";
import "./estilos/globals.css";

import { Bootstrap } from "./bootstrap";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);
