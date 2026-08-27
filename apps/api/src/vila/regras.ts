/**
 * Regras puras da exp-70: correção dos cartões e escolha da bolha.
 *
 * PURO — sem Prisma, sem `Date`, sem `Math.random`. Quem faz I/O é o service; o
 * que decide vive aqui, e é isso que permite testar o balanceamento da bolha sem
 * banco e a correção sem uma partida.
 */

import { acharCartao, cartoesDaBolha, BOLHAS, type Bolha } from "./catalogo";
import type { PayloadVilaV1 } from "./contrato";

/* ==========================================================================
   A BOLHA
   ========================================================================== */

/**
 * Séries em que a bolha B não é servida.
 *
 * Vem de uma nota de aplicação do desenho da missão: *"Faixa 10–14. Para 8–10,
 * corte a bolha B — o contraste A × C já divide a sala, e 'suporte' exige
 * entender o que é suporte."* A criança de 8 anos não tem o conceito de suporte
 * técnico contra o qual o golpe B se apoia; para ela ele não é um golpe difícil,
 * é uma mensagem sem sentido, e o dado sai ruído.
 *
 * No app de origem essa nota era impossível de aplicar: a bolha saía de
 * `nº do aluno mod 3` no navegador, que não sabe a série de ninguém. A api sabe.
 */
const SERIES_SEM_BOLHA_B: readonly string[] = ["1EF", "2EF", "3EF", "4EF", "5EF"];

export function bolhasElegiveis(serie: string | null | undefined): readonly Bolha[] {
  if (serie && SERIES_SEM_BOLHA_B.includes(serie)) return ["A", "C"];
  return BOLHAS;
}

/**
 * Qual bolha dar ao próximo aluno da turma: a MENOS USADA entre as elegíveis.
 *
 * O que precisa ficar equilibrado é a TURMA, porque é ela que faz o debate
 * funcionar — o roteiro conta com a bolha A dizendo que era óbvio, a C não
 * conseguindo explicar por que caiu, e a B dizendo "mas parecia ser o Lume".
 * Uma sala que caia 20/3/2 não tem esse momento.
 *
 * Determinístico, sem sorteio: com as mesmas contagens devolve sempre a mesma
 * bolha (e `Math.random` nem existe neste arquivo). O desempate é a ordem de
 * `bolhasElegiveis`, o que torna o resultado testável.
 *
 * Hash do uuid do aluno daria terços na MÉDIA DA REDE e podia dar 14/6/5 numa
 * sala de 25. Contar a turma custa uma query e acerta a sala.
 */
export function escolherBolha(
  jaAtribuidas: Readonly<Partial<Record<Bolha, number>>>,
  serie: string | null | undefined,
): Bolha {
  const elegiveis = bolhasElegiveis(serie);
  let escolhida = elegiveis[0] as Bolha;
  let menor = Number.POSITIVE_INFINITY;
  for (const b of elegiveis) {
    const quantas = jaAtribuidas[b] ?? 0;
    if (quantas < menor) {
      menor = quantas;
      escolhida = b;
    }
  }
  return escolhida;
}

/* ==========================================================================
   A CORREÇÃO DOS CARTÕES
   ========================================================================== */

/**
 * Um cartão depois de corrigido: o que a criança fez, mais o que aquilo
 * significa. `nivel`, `legitima` e `aceitou` NÃO vêm do cliente — são o gabarito
 * de `catalogo.ts` aplicado à escolha que ela mandou (regra inviolável nº 3).
 */
export interface CartaoRecebido {
  id: string;
  nivel: "comum" | Bolha;
  legitima: boolean;
  emMs: number;
  viuOpcoes: boolean;
  escolha: number | null;
  /** null = não respondeu. Derivado da escolha, nunca recebido. */
  aceitou: boolean | null;
  decisaoMs: number | null;
}

export type ResultadoCorrecao =
  | { ok: true; cartoes: CartaoRecebido[] }
  | { ok: false; motivo: string; detalhes: string[] };

/**
 * Corrige o que o cliente mandou contra o catálogo, conferindo que cada cartão
 * PERTENCE À BOLHA daquela partida.
 *
 * Essa conferência substitui o `bolha` que o app de origem recebia no payload, e
 * é mais forte: o cliente já não declara em que bolha estava — os ids dos
 * cartões que ele respondeu provam isso. Um bundle que reporte o golpe da bolha
 * C numa partida atribuída à A é recusado, em vez de gravar uma leitura que abre
 * pelo nível errado.
 */
export function corrigirCartoes(
  respondidos: PayloadVilaV1["seguranca"]["cartoes"],
  bolha: Bolha,
): ResultadoCorrecao {
  const permitidos = new Map(cartoesDaBolha(bolha).map((c) => [c.id, c]));
  const cartoes: CartaoRecebido[] = [];
  const problemas: string[] = [];
  const vistos = new Set<string>();

  for (const r of respondidos) {
    const cartao = acharCartao(r.id);
    if (!cartao) {
      problemas.push(`cartão desconhecido: ${r.id}`);
      continue;
    }
    if (!permitidos.has(r.id)) {
      problemas.push(`cartão ${r.id} não pertence à bolha ${bolha}`);
      continue;
    }
    if (vistos.has(r.id)) {
      problemas.push(`cartão ${r.id} apareceu mais de uma vez`);
      continue;
    }
    vistos.add(r.id);

    /* `escolha` é índice 1-3; fora da lista de opções é payload inválido, não
       "não respondeu" — silenciar isso viraria um `deixouPassar` inventado. */
    let aceitou: boolean | null = null;
    if (r.escolha !== null) {
      const opcao = cartao.options[r.escolha - 1];
      if (!opcao) {
        problemas.push(`cartão ${r.id}: opção ${r.escolha} não existe`);
        continue;
      }
      aceitou = opcao.aceita;
    }

    cartoes.push({
      id: cartao.id,
      nivel: cartao.nivel,
      legitima: cartao.legitima,
      emMs: r.emMs,
      viuOpcoes: r.viuOpcoes,
      escolha: r.escolha,
      aceitou,
      decisaoMs: r.decisaoMs,
    });
  }

  if (problemas.length > 0) {
    return { ok: false, motivo: "cartões não conferem com o catálogo", detalhes: problemas };
  }
  /* Ordem de chegada, não a ordem em que o cliente listou: o relatório mostra a
     sequência da partida, e `decisaoMs` só faz sentido em sequência. */
  cartoes.sort((a, b) => a.emMs - b.emMs);
  return { ok: true, cartoes };
}
