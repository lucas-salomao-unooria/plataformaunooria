import { redirect } from "next/navigation";

import { MISSAO_ATUAL, rotaDaMissao } from "@/lib/entre-redes/catalogo";
import { rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";

/**
 * Rota antiga do guia, de quando a plataforma tinha uma atividade só.
 *
 * O guia passou a viver dentro da missão do Entre Redes. Mantemos o redirect
 * porque o endereço circulou em material do professor e em links salvos —
 * quebrar um link antigo custa mais do que estas quatro linhas.
 */
export default function GuiaLegado() {
  // Se um dia a missão perder o guia, o endereço antigo cai na ficha dela
  // em vez de num 404 — o link circulou em material impresso.
  redirect(rotaDoGuiaDaMissao(MISSAO_ATUAL.expId!) ?? rotaDaMissao(MISSAO_ATUAL));
}
