import type { Tarefa } from './canal-a';

/**
 * AS DUAS RÉGUAS DE AGREGAÇÃO do Canal A da Tempestade (ADR-172). PURO.
 *
 * - **Primeira da rodada** (a Saúde, o alerta, o "E se…", o WhatsApp e a
 *   moradora): escolha fechada que uma devolutiva pode ensinar, ou com mais de
 *   uma opção defensável. Vale a PRIMEIRA resposta da rodada da turma; a
 *   missão confere `EvidenciasService.jaMarcou` antes de `marcar`, na mesma
 *   transação, sob o lock da sessão. Repetir com "Tentar de novo" não muda nada.
 * - **Melhor tentativa com o relógio aberto** (a leitura dos dados e as
 *   fontes): sem devolutiva, então tentar de novo não ensina a resposta — a
 *   marca de AÇÃO já guarda a melhor. A tentativa que COMEÇOU com o relógio já
 *   fechado não marca: sem isso, a volta depois do fim, sem pressa nenhuma,
 *   viraria a melhor. A primeira tentativa normal manda depois do fim do
 *   relógio — "O professor encerrou a investigação. Mande as equipes" — e
 *   continua valendo, porque começou com ele aberto.
 *
 * Entre marcadores da mesma habilidade vale o melhor (a plataforma), e nada
 * conta antes de o professor encerrar a missão na Sala de Aula
 * (`contaAoEncerrarAMissao`).
 */
export type Agregacao = 'primeira-da-rodada' | 'melhor-tentativa';

export const AGREGACAO: Record<Tarefa, Agregacao> = {
  leitura: 'melhor-tentativa',
  fontes: 'melhor-tentativa',
  alerta: 'primeira-da-rodada',
  saude: 'primeira-da-rodada',
  'e-se': 'primeira-da-rodada',
  whatsapp: 'primeira-da-rodada',
  moradora: 'primeira-da-rodada',
};

/** A tarefa marca agora? */
export function deveMarcar(
  tarefa: Tarefa,
  estado: { jaMarcouNaRodada: boolean; inicioComRelogioAberto: boolean },
): boolean {
  if (AGREGACAO[tarefa] === 'primeira-da-rodada') return !estado.jaMarcouNaRodada;
  return estado.inicioComRelogioAberto;
}
