import type { Nivel, TipoDeMarcador } from "../regras";

/**
 * A FICHA PEDAGÓGICA de uma missão (E14): quais habilidades da BNCC ela mede,
 * e por quais MARCADORES.
 *
 * É o contrato entre o desenho pedagógico da missão e a plataforma. A missão
 * diz "o estudante fez X" (`EvidenciasService.marcar`, com o id do marcador);
 * é a ficha que diz que X mede a `EF08CO05`. Por isso ela mora na api, e não
 * no bundle: o gabarito das perguntas está aqui (regra 3).
 */
export interface FichaPedagogica {
  /** A missão (`exp08ef1b`). Tem de existir nos manifestos — o teste cobra. */
  readonly expId: string;
  /** Sobe a cada mudança de marcador ou gabarito. Vai gravada em cada marca. */
  readonly versao: number;
  readonly habilidades: readonly HabilidadeDaFicha[];
  readonly perguntas: readonly PerguntaDaFicha[];
  /**
   * A pergunta respondida DE NOVO na mesma rodada. `primeira` (o padrão): vale a
   * primeira resposta, e a segunda nem é gravada. `melhor`: fica a melhor das
   * respostas — uma marca só, substituída quando a nova é melhor, sem guardar
   * cada resposta. É a régua de missão em que a pergunta reaparece a cada
   * tentativa (a exp02em1b, ADR-154).
   */
  readonly respostas?: "primeira" | "melhor";
  /**
   * `true`: a marca é gravada na hora, mas só VIRA EVIDÊNCIA quando o professor
   * encerra a missão na Sala de Aula (`SalasService.aoEncerrarMissao`). Até lá
   * o painel não mostra nível nenhum. Depois de encerrada, a porta da missão
   * fecha e a pergunta responde 403: o nível fica definitivo. Reliberada, a
   * resposta melhor volta a esperar o próximo encerramento (ADR-154).
   */
  readonly contaAoEncerrarAMissao?: boolean;
}

export interface HabilidadeDaFicha {
  /** O código da BNCC, exatamente como no documento (`EF08CO05`). */
  readonly codigo: string;
  /** Pelo menos um. Dois marcadores da mesma habilidade: vale o MELHOR. */
  readonly marcadores: readonly MarcadorDaFicha[];
  /**
   * O critério de cada nível, em texto para o PROFESSOR (ADR-145): o que a
   * criança faz para chegar a "atingiu", "em processo" ou "não atingiu". O
   * painel mostra no fim da página, para ele consultar sem abrir o guia. É a
   * régua dos marcadores contada em palavras — mudou a régua, muda o texto.
   */
  readonly criterios: CriteriosDaHabilidade;
}

export interface CriteriosDaHabilidade {
  readonly atingiu: string;
  readonly em_processo: string;
  readonly nao_atingiu: string;
  /** Quando há mais de um marcador: de onde vem o nível ("vale o melhor entre…"). */
  readonly observacao?: string;
}

export interface MarcadorDaFicha {
  /** Único na ficha inteira: é por ele que a missão marca. */
  readonly id: string;
  /**
   * `acao`: a missão observa e diz o nível (vale a melhor marca).
   * `multipla_escolha`: o nível sai do GABARITO da pergunta, no servidor, e
   * vale a PRIMEIRA resposta.
   */
  readonly tipo: TipoDeMarcador;
  /** Só na múltipla escolha: a pergunta que este marcador corrige. */
  readonly perguntaId?: string;
}

export interface PerguntaDaFicha {
  readonly id: string;
  readonly enunciado: string;
  /**
   * O `status` de cada alternativa É O GABARITO — e por isso nunca sai para o
   * estudante: `GET /evidencias/:expId/perguntas/:perguntaId` devolve só `id`
   * e `texto`.
   */
  readonly alternativas: readonly { readonly id: string; readonly texto: string; readonly status: Nivel }[];
}
