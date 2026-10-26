import type { Estado, Imagem, Sessao } from "./lib/tipos";

/**
 * Toda jogada passa por `executar`: rede caída acende a faixa "SEM SINAL NA
 * RÁDIO" (e, com `fila`, a jogada espera a conexão voltar, em memória); um 409
 * (a turma andou, a tela ficou velha) relê o estado inteiro. Devolve `null`
 * quando não houve resposta agora.
 */
export type Executar = <T extends Estado>(chamada: () => Promise<T>, fila?: string) => Promise<T | null>;

/** O que toda tela recebe do despachante. */
export interface Contexto {
  /** A cena, a geometria, o material fixo, os textos e os tempos — da última leitura de `/sessao`. */
  sessao: Sessao;
  /** O estado mais novo (a resposta do último POST, ou a última leitura). */
  estado: Estado;
  executar: Executar;
  /** A jogada desta chave está na fila em memória, esperando a conexão? (o latch fica travado enquanto estiver) */
  naFila: (chave: string) => boolean;
  url: (imagem: Imagem) => string;
  /** O crachá escolhido, como a tela o mostra ("FONE AZUL"). */
  cracha: { rotulo: string; emoji: string } | null;
}
