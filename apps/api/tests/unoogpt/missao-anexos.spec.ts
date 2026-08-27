import { passoDerivado } from '../../src/unoogpt/regras/anexos';

/**
 * O Passo deixa de ser clicado da Investigação em diante: quem move é a
 * conversa. Se este teste cair, a trilha volta a mentir sobre onde o aluno está.
 */
describe('o Passo é derivado do que aconteceu na conversa', () => {
  const base = { confirmou: false };

  it('Abertura e Orientação são telas: a conversa não as atropela', () => {
    expect(passoDerivado(base, 'abertura')).toBe('abertura');
    expect(passoDerivado({ confirmou: true }, 'orientacao')).toBe('orientacao');
  });

  it('alocar não muda de Passo: a decisão acontece dentro da Investigação', () => {
    expect(passoDerivado(base, 'investigacao')).toBe('investigacao');
  });

  it('confirmar leva ao Resultado, e de lá não se volta', () => {
    expect(passoDerivado({ ...base, confirmou: true }, 'investigacao')).toBe('resultado');
    expect(passoDerivado(base, 'resultado')).toBe('resultado');
  });

  it('a Missão tem quatro Passos, e três deles são telas', () => {
    expect(passoDerivado(base, 'investigacao')).toBe('investigacao');
    expect(passoDerivado({ confirmou: true }, 'investigacao')).toBe('resultado');
  });
});
