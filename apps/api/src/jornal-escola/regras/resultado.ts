import type { NoticiaParaARegua } from "../invariantes";
import { TAMANHO_DA_EDICAO, type IdDeNoticia, type Layout } from "../vocabulario";

/**
 * O RESULTADO de uma edição — puro, e calculado NO SERVIDOR a partir do
 * gabarito do pacote (regra inviolável nº 3). O cliente manda três ids; quantas
 * estão verificadas, e o que cada uma causou nos leitores, sai daqui.
 *
 * PDF §6: três notícias de PESO IGUAL, e os resultados possíveis são 0 %, 33 %,
 * 67 % e 100 %. O percentual descreve a SELEÇÃO na simulação — não é
 * probabilidade de verdade nem nota sobre a criança.
 */

type ComGabarito = Pick<NoticiaParaARegua, "id" | "gabarito" | "consequencia">;

/** Quantas das vagas estão verificadas (publicáveis). Id fora do pacote não conta. */
export function verificadasDa(slots: readonly string[], noticias: readonly ComGabarito[]): number {
  const porId = new Map(noticias.map((n) => [n.id, n]));
  return slots.filter((id) => porId.get(id)?.gabarito.publicavel === true).length;
}

/** 0, 33, 67 ou 100 — o arredondamento de `verificadas / 3`. */
export function percentualDe(verificadas: number): number {
  return Math.round((verificadas / TAMANHO_DA_EDICAO) * 100);
}

export interface Reacao {
  noticiaId: IdDeNoticia;
  leitor: string;
  fala: string;
  /** O `SpeechBubble.mood` do DS: a notícia verificada alegra, a outra incomoda. */
  humor: "happy" | "upset";
}

/**
 * As reações dos leitores, UMA POR VAGA e na ordem das vagas (PDF §7: "as
 * consequências precisam corresponder às notícias efetivamente escolhidas").
 * A reação é a da própria notícia (pareamento 1:1 do brief §1) — nunca uma
 * frase sobre quem escolheu.
 */
export function reacoesDa(slots: readonly IdDeNoticia[], noticias: readonly ComGabarito[]): Reacao[] {
  const porId = new Map(noticias.map((n) => [n.id, n]));
  const reacoes: Reacao[] = [];
  for (const id of slots) {
    const n = porId.get(id);
    if (!n) continue;
    reacoes.push({
      noticiaId: id,
      leitor: n.consequencia.leitor,
      fala: n.consequencia.fala,
      humor: n.gabarito.publicavel ? "happy" : "upset",
    });
  }
  return reacoes;
}

/** Uma edição com o que ela causou — o `GET resultado` e cada metade do comparativo. */
export function edicaoComResultado(
  edicao: { slots: readonly IdDeNoticia[]; layout: Layout },
  noticias: readonly ComGabarito[],
) {
  const verificadas = verificadasDa(edicao.slots, noticias);
  return {
    slots: [...edicao.slots],
    layout: edicao.layout,
    verificadas,
    percentual: percentualDe(verificadas),
    reacoes: reacoesDa(edicao.slots, noticias),
  };
}

/**
 * O marcador de cada vaga — o pilar que falta na notícia, ou `null` quando ela
 * está verificada. É o que a Chave do Editor põe sobre a primeira página na
 * revisão, e o que o comparativo explica no fim.
 */
export function vagasMarcadas(
  ids: readonly IdDeNoticia[],
  noticias: readonly Pick<NoticiaParaARegua, "id" | "gabarito">[],
): Array<{ noticiaId: IdDeNoticia; pilarEmFalta: NoticiaParaARegua["gabarito"]["pilarEmFalta"] }> {
  const porId = new Map(noticias.map((n) => [n.id, n]));
  const vagas: Array<{ noticiaId: IdDeNoticia; pilarEmFalta: NoticiaParaARegua["gabarito"]["pilarEmFalta"] }> = [];
  for (const id of ids) {
    const n = porId.get(id);
    if (n) vagas.push({ noticiaId: id, pilarEmFalta: n.gabarito.publicavel ? null : n.gabarito.pilarEmFalta });
  }
  return vagas;
}
