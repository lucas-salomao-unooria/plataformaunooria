import type { Desfecho } from '../modelo/tempestade';
import type { RodadaDoModelo } from '../ferramentas';

/**
 * Anexos de mensagem (ADR-0007). Tudo acontece no chat: o que antes era tela
 * com botão vira cartão dentro da conversa, gravado na Transcrição.
 *
 * Sem isto a Missão teria quatro superfícies e o estudante teria que aprender a
 * navegar entre elas antes de aprender qualquer coisa sobre dados.
 */
export type Anexo =
  /** `hora` marca QUANDO a leitura foi feita: cada relatório é de um momento. */
  | { tipo: 'tendencia'; rodada: RodadaDoModelo; hora: string }
  | { tipo: 'alocacao'; alfa: string | null; bravo: string | null }
  /**
   * As duas alternativas que o Cientista pôs na mesa, para virarem botão. Só os
   * slugs: o número que o botão mostra sai do motor, nunca da LLM.
   */
  | {
      tipo: 'opcoes';
      opcoes: { alfa: string; bravo: string }[];
      rodada: RodadaDoModelo;
      hora: string;
    }
  | {
      tipo: 'desfecho';
      desfecho: Desfecho;
      esperado: { media: number; faixa: readonly [number, number] };
      naoConsultados: { nome: string; comoFalar: string; serve: string }[];
    };

export type PassoDerivavel =
  'abertura' | 'orientacao' | 'investigacao' | 'decisao' | 'confirmacao' | 'resultado';

/**
 * Abertura e Orientação são telas, e quem as passa é o clique do estudante — ele
 * está lendo, não conversando. Depois disso só existem dois Passos:
 * Investigação, que dura enquanto a conversa durar, e Resultado, que chega
 * quando a tempestade acontece.
 *
 * Alocar e confirmar acontecem DENTRO da Investigação: virariam passos sem tela,
 * e passo sem tela mente na trilha.
 */
export function passoDerivado(
  estado: { confirmou: boolean },
  passoAtual: PassoDerivavel,
): PassoDerivavel {
  if (passoAtual === 'abertura' || passoAtual === 'orientacao') return passoAtual;
  // Missão encerrada não volta: a tempestade aconteceu uma vez.
  if (passoAtual === 'resultado' || estado.confirmou) return 'resultado';
  return 'investigacao';
}
