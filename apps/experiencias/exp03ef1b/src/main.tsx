import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

/**
 * As DUAS seções do design system — DS HÍBRIDO autorizado pela ADR-197, cada
 * uma pela folha própria (nunca o `styles.css` consolidado):
 *
 * - **o jornal** (`unoojornal`): o topo, as reportagens, a foto ampliada, as
 *   pastilhas do filtro, os selos, o aviso sem sinal, o erro de mídia, as
 *   ferramentas do caso e o Painel da Investigação — pela ponte
 *   `@edu/ui/ds-unoojornal`, SÓ em `src/app/jornal/*`;
 * - **a mecânica** (`unooria`): a Nina, a caixa da escolha, os carimbos, a
 *   ficha e as etiquetas, a esteira de blocos, a espera e a pausa — pela
 *   ponte `@edu/ui/ds`, SÓ em `src/app/mecanica/*`.
 *
 * As folhas de FONTE são linhas separadas e obrigatórias: os ícones das duas
 * seções são ligadura do Material Symbols, e sem a folha o NOME do glifo
 * aparece como texto.
 */
import "@unooria/design-system/unoojornal.css";
import "@unooria/design-system/fonts/unoojornal.css";
import "@unooria/design-system/unooria.css";
import "@unooria/design-system/fonts/unooria.css";
import "./estilos/globals.css";

import { Bootstrap } from "./bootstrap";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);
