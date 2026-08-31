import type { TipoDeTurno } from '../agente/turno';

/**
 * O orçamento de Perguntas. PURO.
 *
 * Do board: "Investigação livre → até 3 perguntas. O limite obriga a priorizar
 * o que perguntar." Com tudo à mão, o estudante pede uma fonte de cada vez até
 * acabarem e nunca escolhe nada; com três, ele precisa decidir o que quer
 * saber ANTES de perguntar — que é a competência que a Missão treina.
 *
 * Duas regras que impedem o limite de virar punição, e as duas vêm do board:
 *
 * 1. NEM TODA FALA É PERGUNTA. "num intindi", "manda la", "confirmo", o nome de
 *    um bairro — nada disso consulta a cidade, e nada disso debita. Conversar
 *    com o Cientista continua de graça; investigar é que custa.
 * 2. PERGUNTA QUE ELE NÃO CONSEGUE RESPONDER NÃO GASTA. Se nenhuma fonte foi
 *    consultada, o estudante não recebeu leitura nenhuma — cobrar por isso ensinaria
 *    a não perguntar, que é o contrário do ponto.
 *
 * O débito é do CÓDIGO, em transação (regra de ouro 3): a LLM recebe o número
 * pronto e nunca o contradiz.
 */
export const TETO_DE_PERGUNTAS = 3;

/**
 * Esta fala consome uma Pergunta?
 *
 * `houveConsulta` é o que separa uma pergunta respondida de uma que o Cientista
 * não teve como responder: ele só consulta quando tem o que consultar.
 */
export function gastaPergunta(tipo: TipoDeTurno, houveConsulta: boolean): boolean {
  return tipo === 'pergunta' && houveConsulta;
}

export function perguntasRestantes(gastas: number): number {
  return Math.max(0, TETO_DE_PERGUNTAS - gastas);
}

/**
 * Motivo escrito ao lado do campo quando as Perguntas acabam.
 *
 * O campo NÃO fecha: o estudante ainda precisa dizer para onde vai cada equipe, e
 * fechar a conversa aqui o deixaria com uma decisão para tomar e nenhuma forma
 * de tomá-la. O que acabou é a investigação, não a fala.
 */
export const AVISO_SEM_PERGUNTAS =
  'Suas 3 perguntas acabaram. Você ainda pode mandar as equipes — diga para onde vai cada uma, ou escolha no mapa.';

/** Como o contador aparece na tela. Texto fixo. */
export function rotuloDoOrcamento(gastas: number): string {
  const faltam = perguntasRestantes(gastas);
  if (faltam === 0) return 'Perguntas: acabaram';
  return `Perguntas: ${faltam} de ${TETO_DE_PERGUNTAS}`;
}
