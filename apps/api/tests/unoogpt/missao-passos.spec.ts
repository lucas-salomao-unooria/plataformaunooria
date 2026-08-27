import { PASSOS, podeIr } from '../../src/unoogpt/regras/passos';

describe('Passos da Missão', () => {
  it('avança um passo por vez', () => {
    expect(podeIr('abertura', 'orientacao')).toBe(true);
    expect(podeIr('orientacao', 'investigacao')).toBe(true);
    expect(podeIr('abertura', 'investigacao')).toBe(false);
  });

  it('são quatro: decidir e confirmar acontecem dentro da Investigação', () => {
    expect(PASSOS).toEqual(['abertura', 'orientacao', 'investigacao', 'resultado']);
  });

  it('voltar é sempre permitido: reler a Orientação é legítimo', () => {
    expect(podeIr('investigacao', 'orientacao')).toBe(true);
    expect(podeIr('resultado', 'abertura')).toBe(true);
  });

  it('todos os sete passos existem e são alcançáveis em ordem', () => {
    for (let i = 0; i < PASSOS.length - 1; i += 1) {
      expect(podeIr(PASSOS[i]!, PASSOS[i + 1]!)).toBe(true);
    }
  });
});
