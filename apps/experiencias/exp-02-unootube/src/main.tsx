import React from "react";
import { createRoot } from "react-dom/client";

/**
 * A seção Unootube do DS — o disfarce inteiro sai daqui. Nunca o `styles.css`
 * consolidado: ele traria as outras cinco seções e a tipografia da plataforma
 * para dentro do clone.
 */
import "@unooria/design-system/unootube.css";
/**
 * E a seção da PLATAFORMA, que desenha só o que vem DEPOIS da revelação:
 * ranking e os dois diálogos da missão (ver `Ranking.tsx`). Os dois arquivos
 * convivem porque os namespaces não se cruzam — `--uni-*` contra
 * `--unooria-*`, e nenhum dos dois mexe em `html`/`body`.
 */
import "@unooria/design-system/unooria.css";
import "./estilos/globals.css";

import { aplicarAparencia, lerAparencia } from "./lib/tema";
import { Bootstrap } from "./bootstrap";

// Antes do primeiro quadro: sem isto, quem escolheu escuro vê um lampejo claro.
aplicarAparencia(lerAparencia());

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Bootstrap />
  </React.StrictMode>,
);
