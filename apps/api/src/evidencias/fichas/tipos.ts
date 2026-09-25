import type { Nivel, TipoDeMarcador } from "../regras";

/**
 * A FICHA PEDAGÓGICA de uma missão (E14): quais habilidades da BNCC ela mede,
 * e por quais MARCADORES.
 *
 * É o contrato entre o desenho pedagógico da missão e a plataforma. A missão
 * diz "o estudante fez X" (`EvidenciasService.marcar`, com o id do marcador);
 * é a ficha que diz que X mede a `EF08CO05`. Por isso ela mora na api, e não
 * no bundle: o gabarito das perguntas está aqui (regra 3).
 *
 * `validadaPor`/`validadaEm` não são enfeite: uma ficha que ninguém do
 * pedagógico conferiu produz um painel que AFIRMA que a criança atingiu uma
 * habilidade da Base — e é esse o texto que vai para o boletim da rede.
 */
export interface FichaPedagogica {
  /** A missão (`exp08ef1b`). Tem de existir nos manifestos — o teste cobra. */
  readonly expId: string;
  /** Sobe a cada mudança de marcador ou gabarito. Vai gravada em cada marca. */
  readonly versao: number;
  /** Quem conferiu a ficha no pedagógico (nome e papel). */
  readonly validadaPor: string;
  /** Quando, em `AAAA-MM-DD`. */
  readonly validadaEm: string;
  readonly habilidades: readonly HabilidadeDaFicha[];
  readonly perguntas: readonly PerguntaDaFicha[];
}

export interface HabilidadeDaFicha {
  /** O código da BNCC, exatamente como no documento (`EF08CO05`). */
  readonly codigo: string;
  /** Pelo menos um. Dois marcadores da mesma habilidade: vale o MELHOR. */
  readonly marcadores: readonly MarcadorDaFicha[];
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
