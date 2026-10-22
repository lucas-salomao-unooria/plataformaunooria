import React from "react";
import { createRoot } from "react-dom/client";

/**
 * A seção `unooriaai` do DS — o disfarce inteiro sai daqui (ADR-138). Nunca o
 * `styles.css` consolidado: ele traria as outras seções e a tipografia da
 * plataforma para dentro do clone.
 *
 * Duas folhas, e as duas são necessárias: `unooriaai.css` traz tokens e
 * componentes; `fonts/unooriaai.css` traz o `@font-face` da Open Sans e do
 * Material Symbols Rounded com os `.woff2` do próprio pacote. Sem a segunda,
 * o texto cai na fonte do sistema e — pior — o `Icon` da seção, que é
 * LIGADURA, escreve o nome do ícone ("delete", "forum") no lugar do glifo.
 *
 * E NÃO há `unooria.css` aqui, ao contrário da exp04ef1b. Lá a linha era a
 * REVELAÇÃO, e as telas pós-virada usavam a seção da plataforma. Nesta missão
 * não existe revelação no software: a Lacuna de cada fonte é deliberadamente o
 * material do debate do professor. A marca institucional entra só como chrome
 * do HUB, desenhada acima do iframe.
 */
import "@unooria/design-system/unooriaai.css";
import "@unooria/design-system/fonts/unooriaai.css";
/**
 * E a seção `unoochat`, só para UMA peça: o balão do pedido pelo WhatsApp, no
 * fechamento (`app/pecas/mensagem-do-voluntario.tsx`). É clone dentro de clone
 * (ADR-173, que estende a ADR-117): a tela continua UnooriaAI, e só a mensagem
 * fala na voz do mensageiro. Os tokens `--unc-*` ficam presos no contêiner
 * `.peca-unoochat`, com o tema claro fixado nele.
 */
import "@unooria/design-system/unoochat.css";
import "@unooria/design-system/fonts/unoochat.css";
import "./estilos/globals.css";

import { Bootstrap } from "./bootstrap";

/**
 * Tema fixo em CLARO, antes do primeiro quadro.
 *
 * A seção lê `data-uai-theme` na raiz. Aqui não há escolha do estudante (a exp04ef1b
 * tem, e por isso lembra em `localStorage`): a missão é medida em laboratório e
 * o desenho de origem foi calibrado no tema claro. Fixar antes do render evita
 * o lampejo escuro do primeiro quadro.
 */
document.documentElement.dataset.uaiTheme = "light";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Bootstrap />
  </React.StrictMode>,
);
