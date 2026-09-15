import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

/**
 * Só a seção Unooria do DS: esta é ferramenta do PROFESSOR, não um clone. A
 * regra das duas famílias vale ao contrário aqui — dentro do iframe de uma
 * experiência do estudante a marca institucional quebraria a ilusão; nesta,
 * a marca institucional é exatamente o que se espera de um documento oficial
 * que a coordenação vai arquivar.
 */
import "@unooria/design-system/unooria.css";
// Obrigatória: os ícones são fonte de ligadura — sem ela o glifo vira o NOME
// do ícone escrito na tela.
import "@unooria/design-system/fonts/unooria.css";
import "./estilos/globals.css";

import { Bootstrap } from "./bootstrap";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);
