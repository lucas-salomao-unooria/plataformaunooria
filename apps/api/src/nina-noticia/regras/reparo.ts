import { CAMPOS, ETIQUETAS, ETIQUETA_DO_LUGAR, type Campo, type Desfecho, type Etiqueta } from "../vocabulario";
import { idsOpacos } from "./ordem";

/**
 * O REPARO da ficha do telão (E4-ALU-03), com o ajuste do PO de 28/10 (spec
 * §7.6, que supera o item 7 da §0): a ficha começa com Quem, Onde e Quando
 * VAZIOS, e as três etiquetas (Pátio, estudantes, sexta) ficam na bandeja. A
 * criança põe qualquer etiqueta em qualquer campo, edita à vontade, e o
 * "Concluir" só habilita com as TRÊS posicionadas — uma por campo.
 *
 * A correção é só no Concluir, e é uma: válido ⇔ Pátio no campo Onde. As
 * outras duas posições são GRAVADAS, não avaliadas.
 */

export type EtiquetaDaSessao = { id: string; etiqueta: Etiqueta };

/** As três etiquetas com ids opacos (`et-xxx`), na ordem da bandeja (Pátio, estudantes, sexta). */
export function etiquetasDaSessao(semente: string): EtiquetaDaSessao[] {
  const ids = idsOpacos(semente, "et", ETIQUETAS.length);
  return ETIQUETAS.map((etiqueta, i) => ({ id: ids[i] as string, etiqueta }));
}

/** A ficha montada como a tela a manda: o id da etiqueta em cada campo. */
export type FichaMontada = Record<Campo, string>;
/** A ficha montada já traduzida — é o que se grava em `reparo_posicoes`. */
export type PosicoesDoReparo = Record<Campo, Etiqueta>;

export type ResultadoDoReparo =
  | { ok: true; posicoes: PosicoesDoReparo; valido: boolean; desfecho: Desfecho }
  | { ok: false; codigo: "reparo-incompleto" | "etiqueta-desconhecida" };

/**
 * Corrige o reparo. Recusa (sem gravar nada) a ficha com etiqueta que a sessão
 * não tem, ou com a mesma etiqueta em dois campos — as três têm de estar
 * posicionadas, uma por campo (`reparo-incompleto`).
 */
export function corrigirReparo(semente: string, ficha: FichaMontada): ResultadoDoReparo {
  const porId = new Map(etiquetasDaSessao(semente).map((e) => [e.id, e.etiqueta]));
  const posicoes = {} as PosicoesDoReparo;
  for (const campo of CAMPOS) {
    const etiqueta = porId.get(ficha[campo]);
    if (!etiqueta) return { ok: false, codigo: "etiqueta-desconhecida" };
    posicoes[campo] = etiqueta;
  }
  if (new Set(Object.values(posicoes)).size !== CAMPOS.length) return { ok: false, codigo: "reparo-incompleto" };
  const valido = reparoValido(posicoes);
  return { ok: true, posicoes, valido, desfecho: valido ? "sucesso" : "erro" };
}

/** A regra, sozinha: Pátio no campo Onde. */
export function reparoValido(posicoes: PosicoesDoReparo): boolean {
  return posicoes.onde === ETIQUETA_DO_LUGAR;
}
