import { MOTIVOS, POR_QUADRANTE, quadranteDe, type Motivo, type Tom, type Veracidade } from "../catalogo";

/**
 * O TERMÔMETRO DA TURMA — o telão da revelação — calculado de verdade (os
 * 68%/54% dos artefatos eram wireframe). Puro: recebe as UNIDADES já
 * colapsadas (uma por computador quando há equipe, `equipes/regras.ts#
 * colapsarEmUnidades`) e o gabarito do pacote.
 *
 * NENHUM NOME entra aqui — a assinatura não tem lugar para ele. É o que se
 * projeta na parede.
 */

/** Uma unidade (um computador) como a conta a vê. `selecao: null` = não confirmou o Mural. */
export interface UnidadeDaConta {
  entrou: boolean;
  /** As três do Mural, SÓ depois do latch 1. Antes, `null`: escolha que ainda podia mudar não conta. */
  selecao: readonly string[] | null;
  motivo: Motivo | null;
  /** Enviou o cartão de frases (EF05CO03). */
  respondeuCartao: boolean;
  /** Enviou a regra do tio (EF05CO04). */
  enviouRegra: boolean;
  concluiu: boolean;
}

export type GabaritoDaConta = ReadonlyMap<string, { veracidade: Veracidade; tom: Tom }>;

/** Inteiro de 0 a 100. Sem ninguém na base, 0 — nunca `NaN` no telão. */
export function percentual(parte: number, todo: number): number {
  return todo <= 0 ? 0 : Math.round((100 * parte) / todo);
}

export interface Progresso {
  unidades: number;
  entraram: number;
  confirmaram: number;
  votaram: number;
  responderamCartao: number;
  enviaramRegra: number;
  concluiram: number;
}

/**
 * O progresso da turma. As duas contagens do Canal A são o que o professor
 * olha antes de avançar: o cartão de frases aparece com os crachás, e quem
 * ainda não o respondeu vai responder na reflexão, antes da regra.
 */
export function progresso(unidades: readonly UnidadeDaConta[]): Progresso {
  return {
    unidades: unidades.length,
    entraram: unidades.filter((u) => u.entrou).length,
    confirmaram: unidades.filter((u) => u.selecao !== null).length,
    votaram: unidades.filter((u) => u.motivo !== null).length,
    responderamCartao: unidades.filter((u) => u.respondeuCartao).length,
    enviaramRegra: unidades.filter((u) => u.enviouRegra).length,
    concluiram: unidades.filter((u) => u.concluiu).length,
  };
}

export interface Termometro {
  /** A base: unidades que CONFIRMARAM o Mural (N). */
  unidades: number;
  /** Unidades que encaminharam pelo menos UMA falsa neutra. */
  falsaNeutra: { unidades: number; percentual: number };
  /** Das 2·N verdadeiras emocionais disponíveis, quantas ficaram de fora: (2·N − ΣVE) / (2·N). */
  verdadeiraEmocionalDescartada: { descartadas: number; total: number; percentual: number };
  /** O cruzamento motivo × "encaminhou falsa neutra", sobre quem VOTOU. */
  motivos: { motivo: Motivo; unidades: number; comFalsaNeutra: number }[];
}

/**
 * As três contas do telão (a especificação, §Painel):
 *
 *   - % das unidades que encaminharam ≥ 1 falsa neutra;
 *   - % das verdadeiras emocionais NÃO encaminhadas — (2·N − ΣVE) / (2·N),
 *     porque cada Mural tinha duas VE à disposição;
 *   - motivo declarado × encaminhou falsa neutra.
 *
 * Id que não está no gabarito (pacote trocado no meio) é ignorado, e não
 * contado como verdadeiro nem como falso.
 */
export function termometro(unidades: readonly UnidadeDaConta[], gabarito: GabaritoDaConta): Termometro {
  const confirmadas = unidades.filter((u): u is UnidadeDaConta & { selecao: readonly string[] } => u.selecao !== null);
  const quadrantesDe = (selecao: readonly string[]) =>
    selecao.flatMap((id) => {
      const g = gabarito.get(id);
      return g ? [quadranteDe(g)] : [];
    });

  const comFalsaNeutra = (u: { selecao: readonly string[] }) => quadrantesDe(u.selecao).includes("FN");
  const n = confirmadas.length;
  const fn = confirmadas.filter(comFalsaNeutra).length;
  const veEncaminhadas = confirmadas.reduce((acc, u) => acc + quadrantesDe(u.selecao).filter((q) => q === "VE").length, 0);
  const total = POR_QUADRANTE * n;
  const descartadas = Math.max(0, total - veEncaminhadas);

  return {
    unidades: n,
    falsaNeutra: { unidades: fn, percentual: percentual(fn, n) },
    verdadeiraEmocionalDescartada: { descartadas, total, percentual: percentual(descartadas, total) },
    motivos: MOTIVOS.map((motivo) => {
      const doMotivo = confirmadas.filter((u) => u.motivo === motivo);
      return { motivo, unidades: doMotivo.length, comFalsaNeutra: doMotivo.filter(comFalsaNeutra).length };
    }),
  };
}
