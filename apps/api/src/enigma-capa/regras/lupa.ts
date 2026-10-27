import { FOTOS, INVARIANTES, PISO_DA_LUPA_MS, type FotoId, type InvarianteId } from "../conteudo";

/**
 * A LUPA (E2): o piso de exploração e a plausibilidade do que a tela relata.
 *
 * A lupa ACHA os dois objetos do fundo (os invariantes, os mesmos da E4,
 * ADR-186) EM CADA UMA das duas fotos: com o centro da lente sobre um deles,
 * a lente brilha e um anel de tempo enche em 3 s; cheio, AQUELE objeto
 * NAQUELA foto fica "achado". São quatro tempos, um por par objeto × foto,
 * com a mesma chave dos achados da E4 (`"inv-1:foto-1"`). Até a 2.1.0 era um
 * tempo por objeto, em qualquer foto — e achar o relógio na foto 1 marcava o
 * relógio da foto 2, que a criança nem tinha olhado (ADR-188).
 *
 * Quem cronometra é a tela (o servidor não vê o dedo); o servidor GUARDA o
 * máximo (monótono: um relato velho que chega atrasado não apaga o novo) e
 * LIMITA ao tempo que passou desde a entrada — uma tela adulterada não ganha
 * dez minutos de lupa em dois segundos de sessão. O avanço sem o piso não
 * passa: conta um alerta ("OLHE O FUNDO"), e os alertas entram na régua da
 * EF02CO05 (0 = pleno, 1 = parcial, 2+ = ausente).
 */

/** `"inv-1:foto-1"` — um objeto numa foto. */
export type ChaveDaLupa = `${InvarianteId}:${FotoId}`;
export const CHAVES_DA_LUPA: readonly ChaveDaLupa[] = INVARIANTES.flatMap((i) => FOTOS.map((f) => `${i}:${f}` as ChaveDaLupa));

export type LupaDaSessao = Record<ChaveDaLupa, number>;

export interface RelatoDaLupa {
  tempos: LupaDaSessao;
  avancar: boolean;
}

export const LUPA_ZERADA: LupaDaSessao = Object.fromEntries(CHAVES_DA_LUPA.map((k) => [k, 0])) as LupaDaSessao;

/** O novo estado da lupa: o máximo de cada tempo, limitado ao decorrido desde a entrada. */
export function acumularLupa(atual: LupaDaSessao, relato: LupaDaSessao, decorridoMs: number): LupaDaSessao {
  const teto = Math.max(0, Math.floor(decorridoMs));
  const ms = (antes: number, agora: number) => Math.max(antes, Math.min(teto, Math.floor(agora)));
  return Object.fromEntries(CHAVES_DA_LUPA.map((k) => [k, ms(atual[k], relato[k])])) as LupaDaSessao;
}

/** Os pares objeto × foto já achados (3 s ou mais). */
export function achadosNaLupa(l: LupaDaSessao): ChaveDaLupa[] {
  return CHAVES_DA_LUPA.filter((k) => l[k] >= PISO_DA_LUPA_MS);
}

/** O piso: os DOIS objetos achados nas DUAS fotos. */
export function pisoCumprido(l: LupaDaSessao): boolean {
  return achadosNaLupa(l).length === CHAVES_DA_LUPA.length;
}
