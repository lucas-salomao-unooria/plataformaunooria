import type { ExperienciaHandle } from "@edu/sdk";
import type { Bolha, CartaoServido } from "./tipos";

/**
 * A costura com a api (`/vila/*`). O jogo não conhece nem HTTP nem token: ele
 * recebe `window.VILA` pronto e entrega o payload por `concluir`.
 *
 * ## Por que a partida ABRE no servidor
 *
 * O app de origem era um Next.js só, e a partida existia primeiro no navegador:
 * o jogo escolhia o próprio id, cravava o próprio horário de início, decidia a
 * própria bolha (`estudanteSlot % 3`) e classificava as próprias respostas. Quando
 * chegava ao banco, tudo já estava decidido.
 *
 * Aqui a ordem inverte. Abrir uma partida é uma escrita no servidor, e é ela que
 * devolve o que o jogo não tem como saber:
 *
 *   · o **id**, que é a chave de idempotência (o cliente escolhendo a própria
 *     chave era o que fazia duas crianças na mesma máquina colidirem);
 *   · o **início**, cravado pelo servidor (o relógio da máquina de escola
 *     costuma estar errado, e o app de origem documentava isso enquanto
 *     dependia dele);
 *   · a **bolha** e **os cartões dela** — sem gabarito, e sem os das outras
 *     bolhas.
 */

export interface SessaoAberta {
  sessaoId: string;
  bolha: Bolha;
  cartoes: CartaoServido[];
}

interface RespostaAbrir {
  sessaoId: string;
  bolha: string;
  cartoes: CartaoServido[];
}

const BOLHAS: readonly string[] = ["A", "B", "C"];

/**
 * Abre a partida. LANÇA se não conseguir, e o shim não sobe o jogo.
 *
 * A alternativa — jogar sem sessão — foi descartada: a partida não teria onde
 * ser gravada, e uma partida órfã é pior que partida nenhuma, porque desaparece
 * e o professor lê a lista achando que a criança não jogou. Sem cartão nenhum
 * ela também não teria a missão, e a metade do instrumento sumiria em silêncio.
 */
export async function abrirSessao(
  exp: ExperienciaHandle,
  expVersion: string,
): Promise<SessaoAberta> {
  const r = await exp.api.post<RespostaAbrir>("/vila/sessoes", { expVersion });

  /* Validação do que VOLTA, não só do que vai. A api é nossa, mas uma resposta
     malformada aqui viraria `bolha: undefined` no jogo e cartão nenhum na tela —
     e o sintoma seria "a missão não aconteceu", que é indistinguível de uma
     criança que não recebeu mensagem. Falhar aqui é alto; falhar adiante é mudo. */
  if (!r || typeof r.sessaoId !== "string" || !BOLHAS.includes(r.bolha) || !Array.isArray(r.cartoes)) {
    throw new Error("resposta de /vila/sessoes fora do contrato");
  }
  return { sessaoId: r.sessaoId, bolha: r.bolha as Bolha, cartoes: r.cartoes };
}

/**
 * Fecha a partida. NUNCA lança para o jogo.
 *
 * Erro de envio não vira alerta na tela da criança: a tela final dela monta de
 * qualquer jeito. Interromper o fim do jogo com uma falha de rede seria trocar a
 * experiência dela por uma preocupação que é do adulto. Mesma regra do app de
 * origem — só o destino mudou.
 */
export function concluirSessao(
  exp: ExperienciaHandle,
  sessaoId: string,
  payload: unknown,
): void {
  void exp.api
    .post(`/vila/sessoes/${encodeURIComponent(sessaoId)}/concluir`, payload)
    .then(() => console.info("[vila] partida gravada"))
    /* `console.error` e não silêncio: quem abre o console é o adulto, e uma
       partida que não gravou precisa aparecer para alguém. */
    .catch((erro: unknown) => console.error("[vila] a partida NÃO foi gravada:", erro));
}
