import type { Estado, Medidor, Sessao } from "./lib/tipos";

/**
 * Toda jogada passa por `executar`: rede caída acende a janela "Módulo de
 * Homologação Offline" e um 401 a "Sessão escolar pausada" (e, com `fila`, a
 * jogada espera em memória até passar); um 409 (a turma andou, a tela ficou
 * velha) relê o estado inteiro. Devolve `null` quando não houve resposta agora.
 */
export type Executar = <T extends Estado>(chamada: () => Promise<T>, fila?: string) => Promise<T | null>;

/** O que toda tela recebe do despachante. */
export interface Contexto {
  /** O pacote, o material fixo e os tempos — da última leitura de `/sessao`. */
  sessao: Sessao;
  /** O estado mais novo (a resposta do último POST, ou a última leitura). */
  estado: Estado;
  /** O medidor agregado da turma, atualizado pelo gate (`null` abaixo de 3 apostas). */
  medidor: Medidor;
  executar: Executar;
  /** A jogada desta chave está na fila em memória? (o latch fica travado enquanto estiver) */
  naFila: (chave: string) => boolean;
}
