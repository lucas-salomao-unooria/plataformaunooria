import React from "react";
import { createRoot } from "react-dom/client";

/**
 * A seção `chatgpt` do DS — o disfarce inteiro sai daqui. Nunca o `styles.css`
 * consolidado: ele traria as outras cinco seções e a tipografia da plataforma
 * para dentro do clone.
 *
 * Duas folhas, e as duas são necessárias na 0.1.17: `chatgpt.css` traz tokens e
 * componentes; `fonts/chatgpt.css` traz o `@font-face` da Inter apontando para
 * os `.woff2` do próprio pacote. Sem a segunda, o texto cai na fonte do sistema
 * e o clone deixa de parecer o que imita.
 *
 * E NÃO há `unooria.css` aqui, ao contrário da exp04ef1b. Lá a linha era a
 * REVELAÇÃO, e as telas pós-virada usavam a seção da plataforma. Nesta missão
 * não existe revelação no software: a Lacuna de cada fonte é deliberadamente o
 * material do debate do professor. A marca institucional entra só como chrome
 * do HUB, desenhada acima do iframe.
 */
import "@unooria/design-system/chatgpt.css";
import "@unooria/design-system/fonts/chatgpt.css";
import "./estilos/globals.css";

import { Bootstrap } from "./bootstrap";

/**
 * Tema fixo em CLARO, antes do primeiro quadro.
 *
 * A seção lê `data-gpt-theme` na raiz. Aqui não há escolha do estudante (a exp04ef1b
 * tem, e por isso lembra em `localStorage`): a missão é medida em laboratório e
 * o desenho de origem foi calibrado no tema claro. Fixar antes do render evita
 * o lampejo escuro do primeiro quadro.
 */
document.documentElement.dataset.gptTheme = "light";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Bootstrap />
  </React.StrictMode>,
);
