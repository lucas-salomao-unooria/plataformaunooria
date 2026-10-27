import { PISO_DA_LUPA_MS } from "../conteudo";

/**
 * A LUPA (E2): o piso de exploração e a plausibilidade do que a tela relata.
 *
 * A lupa ACHA os dois objetos do fundo (os invariantes, os mesmos da E4,
 * ADR-186): com o centro da lente sobre um deles, a lente brilha e um anel de
 * tempo enche em 3 s; cheio, o objeto fica "achado". O piso é 3 s em CADA um
 * dos dois (`alvo1Ms` = o tempo sobre `inv-1`, em qualquer das duas fotos;
 * `alvo2Ms`, sobre `inv-2`).
 *
 * Quem cronometra é a tela (o servidor não vê o dedo); o servidor GUARDA o
 * máximo (monótono: um relato velho que chega atrasado não apaga o novo) e
 * LIMITA ao tempo que passou desde a entrada — uma tela adulterada não ganha
 * dez minutos de lupa em dois segundos de sessão. O avanço sem o piso não
 * passa: conta um alerta ("OLHE O FUNDO"), e os alertas entram na régua da
 * EF02CO05 (0 = pleno, 1 = parcial, 2+ = ausente).
 */

export interface LupaDaSessao {
  alvo1Ms: number;
  alvo2Ms: number;
}

export interface RelatoDaLupa extends LupaDaSessao {
  avancar: boolean;
}

/** O novo estado da lupa: o máximo de cada tempo, limitado ao decorrido desde a entrada. */
export function acumularLupa(atual: LupaDaSessao, relato: LupaDaSessao, decorridoMs: number): LupaDaSessao {
  const teto = Math.max(0, Math.floor(decorridoMs));
  const ms = (antes: number, agora: number) => Math.max(antes, Math.min(teto, Math.floor(agora)));
  return { alvo1Ms: ms(atual.alvo1Ms, relato.alvo1Ms), alvo2Ms: ms(atual.alvo2Ms, relato.alvo2Ms) };
}

export function pisoCumprido(l: LupaDaSessao): boolean {
  return l.alvo1Ms >= PISO_DA_LUPA_MS && l.alvo2Ms >= PISO_DA_LUPA_MS;
}
