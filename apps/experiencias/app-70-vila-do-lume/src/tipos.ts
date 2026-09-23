/**
 * O contrato entre o shim (TypeScript, compilado pelo Vite) e o jogo (scripts
 * clássicos em `public/jogo/`, não compilados por nada — ver ADR-0001).
 *
 * `window.VILA` é a ÚNICA porta entre os dois. O jogo nunca importa o SDK, nunca
 * fala com a api e nunca sabe que existe um hub: ele lê identidade daqui e
 * devolve a partida por `concluir`. Se um dia o jogo precisar de mais alguma
 * coisa da plataforma, o campo nasce aqui — e não como um global solto, que é
 * como um bundle de 10 mil linhas fica impossível de auditar.
 */

/** As três bolhas da missão "A Noite Longa". Quem decide é a api (regra: o
 *  cliente não escolhe a condição do próprio instrumento). */
export type Bolha = "A" | "B" | "C";

/**
 * Um cartão como a api o serve: SEM gabarito. Não há `legitima`, não há `nivel`,
 * e as opções não dizem qual delas aceita o que a mensagem pede — o jogo registra
 * o índice que a criança escolheu e a api corrige (regra inviolável nº 3).
 *
 * `gatilho` é o que o jogo avalia, porque só ele conhece o estado da partida. E
 * nenhum valor de gatilho revela legitimidade: `aposCartao:3` diz posição na
 * lista, onde antes havia `aposGolpe`, que dizia qual cartão era o golpe.
 */
export interface CartaoServido {
  id: string;
  gatilho: string;
  tag: string;
  beats: Array<{ name: string; text: string }>;
  options: Array<{ text: string; reply?: string }>;
}

export interface IdentidadeDoJogo {
  /** Como o Lume chama a criança e o que ela grava na Pedra dos Nomes.
   *  PRIMEIRO nome só: a pedra é lida por outras crianças da turma. */
  primeiroNome: string;
}

export interface PontePlataforma {
  identidade: IdentidadeDoJogo;
  /** Nível do golpe da batida 3 que ESTA criança recebe. Decidido pela api. */
  bolha: Bolha;
  /** Os cartões desta criança, na ordem em que devem chegar. Vinham de uma
   *  constante no bundle (`AMBIENT_DMS`), com os três golpes divergentes e o
   *  gabarito dentro. */
  cartoes: CartaoServido[];
  /**
   * Abre uma partida NOVA — o "JOGAR DE NOVO" da tela final.
   *
   * Sem isto a segunda partida seria enviada para o id da primeira, que já está
   * concluída: a api responderia `jaEstava` e a partida dela desapareceria, com
   * a criança tendo jogado inteiro. No app de origem o replay sobrescrevia a
   * chave do localStorage, então também era gravado — mesmo comportamento,
   * destino diferente.
   *
   * Não bloqueia: quem chama é o `restart()`, e a criança ainda passa pelos
   * cartões da intro antes de a partida começar. O `sessaoId` só é usado no fim.
   */
  reabrir(): void;
  /** Registra um evento no canal analítico (telemetria do SDK). */
  registrar(verbo: string, objeto: string, dados?: Record<string, unknown>): void;
  /** Fecha a partida: o jogo entrega o payload bruto e não sabe o que acontece
   *  depois. Nunca lança para o jogo — falha de rede não interrompe o fim da
   *  experiência da criança. */
  concluir(payload: unknown): void;
}

declare global {
  interface Window {
    VILA?: PontePlataforma;
    /** Definidos por `public/jogo/src/18-plataforma.js`, que é script clássico
     *  e por isso alcança os globais do jogo (`playing`, `controls`). */
    vilaPausar?: () => void;
    vilaRetomar?: () => void;
  }
}
