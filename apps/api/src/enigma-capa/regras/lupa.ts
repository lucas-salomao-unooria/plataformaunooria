import { PISO_DA_LUPA_MS } from "../conteudo";

/**
 * A LUPA (E2): o piso de exploração e a plausibilidade do que a tela relata.
 *
 * Quem cronometra é a tela (o servidor não vê o dedo); o servidor GUARDA o
 * máximo (monótono: um relato velho que chega atrasado não apaga o novo) e
 * LIMITA ao tempo que passou desde a entrada — uma tela adulterada não ganha
 * dez minutos de lupa em dois segundos de sessão.
 *
 * O piso é do one-pager §4: 3 s sobre CADA foto E a lupa no fundo das DUAS. O
 * avanço sem o piso não passa: conta um alerta ("OLHE O FUNDO"), e os alertas
 * entram na régua da EF02CO05 (0 = pleno, 1 = parcial, 2+ = ausente).
 */

export interface LupaDaSessao {
  foto1Ms: number;
  foto2Ms: number;
  fundo1: boolean;
  fundo2: boolean;
}

export interface RelatoDaLupa extends LupaDaSessao {
  avancar: boolean;
}

/** O novo estado da lupa: o máximo de cada tempo, limitado ao decorrido; o fundo, uma vez visto, fica visto. */
export function acumularLupa(atual: LupaDaSessao, relato: LupaDaSessao, decorridoMs: number): LupaDaSessao {
  const teto = Math.max(0, Math.floor(decorridoMs));
  const ms = (antes: number, agora: number) => Math.min(teto, Math.max(antes, Math.floor(agora)));
  return {
    foto1Ms: Math.max(atual.foto1Ms, ms(atual.foto1Ms, relato.foto1Ms)),
    foto2Ms: Math.max(atual.foto2Ms, ms(atual.foto2Ms, relato.foto2Ms)),
    fundo1: atual.fundo1 || relato.fundo1,
    fundo2: atual.fundo2 || relato.fundo2,
  };
}

export function pisoCumprido(l: LupaDaSessao): boolean {
  return l.foto1Ms >= PISO_DA_LUPA_MS && l.foto2Ms >= PISO_DA_LUPA_MS && l.fundo1 && l.fundo2;
}
