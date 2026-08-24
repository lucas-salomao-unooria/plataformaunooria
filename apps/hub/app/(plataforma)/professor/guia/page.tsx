import { redirect } from "next/navigation";

import { MISSAO_ATUAL, rotaDoGuia } from "@/lib/entre-redes/catalogo";

/**
 * Rota antiga do guia, de quando a plataforma tinha uma atividade só.
 *
 * O guia passou a viver dentro da missão do Entre Redes. Mantemos o redirect
 * porque o endereço circulou em material do professor e em links salvos —
 * quebrar um link antigo custa mais do que estas quatro linhas.
 */
export default function GuiaLegado() {
  redirect(rotaDoGuia(MISSAO_ATUAL));
}
