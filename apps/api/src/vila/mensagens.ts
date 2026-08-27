/**
 * Leitura da missão "A Noite Longa" — porte de `lib/perfil/mensagens.ts`.
 *
 * SEPARADO do perfil de valores, de propósito. São dois instrumentos que rodam
 * na mesma partida e não podem se misturar: o de Schwartz lê escolhas com custo
 * dentro do jogo, este lê julgamento sobre mensagens. Nada aqui entra em nenhum
 * dos dez valores — um golpe que custasse fagulha faria a criança que caiu
 * aparecer como menos generosa no retrato, e nada no relatório mostraria a
 * contaminação.
 *
 * A REGRA QUE ATRAVESSA O ARQUIVO: **o nível vem antes do que ela fez.** "Caiu
 * em 2 de 3" sem dizer que ela recebeu o golpe da bolha C faz o professor ler a
 * coisa errada sobre aquela criança — e a leitura errada aqui é a de que ela é
 * ingênua, exatamente o rótulo que este projeto existe para não produzir.
 *
 * Diferença em relação ao app de origem: recebe cartões JÁ CORRIGIDOS
 * (`regras.corrigirCartoes`) em vez de cartões auto-classificados pelo cliente,
 * e a bolha vem da linha da partida em vez do payload.
 */

import { DESCRICAO_BOLHA, type Bolha } from "./catalogo";
import type { CartaoRecebido } from "./regras";

export interface LeituraMensagens {
  bolha: Bolha;
  /** contagens que separam prudência de isolamento */
  golpeAceito: number;
  golpeRecusado: number;
  legitimaAceita: number;
  legitimaRecusada: number;
  /** apareceu e ela nunca chegou a ver as opções */
  nemViu: number;
  /** viu as opções e deixou passar */
  deixouPassar: number;
  cartoes: CartaoRecebido[];
  /** frase única, e nunca sobre quem a criança é */
  leitura: string;
}

/**
 * `null` quando a missão NÃO ACONTECEU nesta partida — nenhum cartão chegou a
 * ser servido (a api estava fora do ar quando o jogo abriu, por exemplo).
 *
 * Isto não é o mesmo que "ela ignorou tudo", e a diferença é a mesma que separa
 * `zero` de `none` no perfil: a tela precisa dizer "as mensagens não chegaram
 * nesta partida", nunca desenhar zeros que parecem escolha.
 */
export function lerMensagens(
  bolha: Bolha,
  cartoes: readonly CartaoRecebido[],
): LeituraMensagens | null {
  if (cartoes.length === 0) return null;

  const golpes = cartoes.filter((x) => !x.legitima);
  const legitimas = cartoes.filter((x) => x.legitima);

  const r: LeituraMensagens = {
    bolha,
    golpeAceito: golpes.filter((x) => x.aceitou === true).length,
    golpeRecusado: golpes.filter((x) => x.aceitou === false).length,
    legitimaAceita: legitimas.filter((x) => x.aceitou === true).length,
    legitimaRecusada: legitimas.filter((x) => x.aceitou === false).length,
    nemViu: cartoes.filter((x) => x.aceitou === null && !x.viuOpcoes).length,
    deixouPassar: cartoes.filter((x) => x.aceitou === null && x.viuOpcoes).length,
    cartoes: [...cartoes],
    leitura: "",
  };
  r.leitura = frase(r);
  return r;
}

/**
 * A frase do topo. Descreve o que aconteceu naquela partida, nunca quem a
 * criança é — e quando ela caiu, NOMEIA O NÍVEL ANTES DO ATO.
 */
function frase(r: LeituraMensagens): string {
  const nivel = DESCRICAO_BOLHA[r.bolha].titulo;

  if (r.nemViu + r.deixouPassar === r.cartoes.length) {
    return r.nemViu > r.deixouPassar
      ? "Não respondeu a nenhuma mensagem, e na maioria delas nem chegou a ver as opções. Confira no debate se ela lembra de ter recebido alguma — pode ser que a mensagem tenha competido com o jogo e perdido."
      : "Viu as mensagens e deixou todas passarem sem responder.";
  }
  if (r.golpeAceito > 0 && r.legitimaRecusada > 0) {
    return `Entregou o que foi pedido no golpe de nível "${nivel}" e recusou uma mensagem que era verdadeira. As duas coisas juntas costumam ser a mesma criança respondendo no automático — o tempo de decisão abaixo diz se foi isso.`;
  }
  if (r.golpeAceito > 0) {
    return `Entregou o que foi pedido no golpe de nível "${nivel}". Leia a descrição do nível antes de tirar qualquer conclusão: no nível C, quase toda a turma entrega.`;
  }
  if (r.legitimaRecusada > 0 && r.legitimaAceita === 0) {
    return "Recusou todas as mensagens, inclusive as verdadeiras — entre elas, o único aviso honesto que recebeu. Não confiar em nada não é estar segura; é ficar sem a ajuda que existia.";
  }

  /* Daqui para baixo ela não caiu em golpe nenhum. O app de origem tinha UMA
     frase para este caso — "Recusou o golpe de nível X e aceitou o que era
     verdadeiro" — e ela afirmava as DUAS coisas mesmo quando só uma tinha
     acontecido. Numa partida curta, em que só o primeiro cartão chegou a
     aparecer, o relatório dizia que a criança aceitou uma mensagem verdadeira
     que ela nunca recebeu.
     É o tipo de erro que este projeto existe para não cometer: uma frase sobre
     uma criança, lida por um adulto que decide sobre ela, afirmando o que o dado
     não sustenta. Cada metade agora só é dita se aconteceu. */
  const recusouGolpe = r.golpeRecusado > 0;
  const aceitouVerdade = r.legitimaAceita > 0;

  if (recusouGolpe && aceitouVerdade) {
    return `Recusou o golpe de nível "${nivel}" e aceitou o que era verdadeiro.`;
  }
  if (recusouGolpe) {
    return `Recusou o golpe de nível "${nivel}". Não chegou a responder nenhuma das mensagens verdadeiras — pode ser que elas não tenham aparecido na partida dela.`;
  }
  if (aceitouVerdade) {
    return "Aceitou a ajuda que era verdadeira. Não chegou a responder ao golpe que recebeu.";
  }
  /* Nem golpe nem legítima respondidos, e nem tudo ficou sem resposta (isso o
     primeiro ramo já teria pegado). Descreve, e não conclui. */
  return `Respondeu a parte das mensagens, sem responder ao golpe de nível "${nivel}" nem às verdadeiras.`;
}

/** Rótulo curto do que ela fez em cada cartão, para a tabela do relatório. */
export function rotuloDoCartao(c: CartaoRecebido): { texto: string; tom: "ruim" | "bom" | "neutro" } {
  if (c.aceitou === null) {
    return c.viuOpcoes
      ? { texto: "deixou passar", tom: "neutro" }
      : { texto: "nem viu as opções", tom: "neutro" };
  }
  if (!c.legitima) {
    return c.aceitou ? { texto: "entregou", tom: "ruim" } : { texto: "recusou", tom: "bom" };
  }
  return c.aceitou ? { texto: "aceitou a ajuda", tom: "bom" } : { texto: "recusou ajuda real", tom: "ruim" };
}

/** Tempo de decisão legível. `—` quando não respondeu. */
export function tempoDecisao(ms: number | null): string {
  return ms === null ? "—" : `${(ms / 1000).toFixed(1)}s`;
}
