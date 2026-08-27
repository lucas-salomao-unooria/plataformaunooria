import {
  TETO_DE_PERGUNTAS,
  gastaPergunta,
  perguntasRestantes,
  rotuloDoOrcamento,
} from '../../src/unoogpt/regras/orcamento';
import { classificarTurno, type TipoDeTurno } from '../../src/unoogpt/agente/turno';

const ctx = { temDestino: false, primeiraFala: false, ultimaFalaDoAgente: null };

describe('o orçamento de Perguntas', () => {
  it('investigar custa; conversar, não', () => {
    // Foi assim que o aluno do playtest gastou a Missão inteira: "num intindi",
    // "manda la", "no melio". Cobrar por essas falas seria cobrar por estar
    // perdido.
    const deGraca: TipoDeTurno[] = [
      'abertura',
      'delegacao',
      'nao-entendi',
      'curto',
      'escolha-numerada',
      'nomeia-bairro',
      'confirmacao',
    ];
    for (const t of deGraca) expect(gastaPergunta(t, true)).toBe(false);
    expect(gastaPergunta('pergunta', true)).toBe(true);
  });

  it('pergunta sobre um bairro debita como qualquer outra', () => {
    // Regressão: enquanto citar bairro classificava como ordem, metade das
    // perguntas reais saía de graça — e o aluno terminava a Missão com as três
    // intactas sem entender por quê.
    expect(gastaPergunta(classificarTurno('qual o risco do Morro Alto?', ctx), true)).toBe(true);
    expect(gastaPergunta(classificarTurno('manda a alfa pro morro alto', ctx), true)).toBe(false);
  });

  it('pergunta que ele não conseguiu responder não gasta', () => {
    // Sem consulta não houve leitura: o aluno não recebeu nada. Cobrar aqui
    // ensinaria a não perguntar, que é o contrário do ponto.
    expect(gastaPergunta('pergunta', false)).toBe(false);
  });

  it('o contador não fica negativo, e diz quando acabou', () => {
    expect(perguntasRestantes(0)).toBe(TETO_DE_PERGUNTAS);
    expect(perguntasRestantes(2)).toBe(1);
    expect(perguntasRestantes(TETO_DE_PERGUNTAS)).toBe(0);
    expect(perguntasRestantes(99)).toBe(0);
  });

  it('o rótulo conta o que resta, não o que passou', () => {
    expect(rotuloDoOrcamento(0)).toBe('Perguntas: 3 de 3');
    expect(rotuloDoOrcamento(2)).toBe('Perguntas: 1 de 3');
    expect(rotuloDoOrcamento(3)).toBe('Perguntas: acabaram');
  });
});
