import { describe, expect, it } from 'vitest';
import { dadoDaVisao, nivelDeRisco } from './visao';
import type { EstimativaDoBairro } from './tipos';

/**
 * A visão traduz a estimativa do modelo em algo que a tela pode desenhar — e
 * nunca inventa dado. Estas asserções vieram do teste de camadas da api
 * (`missao-camadas.spec.ts`) quando `visao.ts` mudou de lado: ela é lógica de
 * tela, e teste de tela mora junto com a tela.
 */
const COBERTO: EstimativaDoBairro = {
  bairro: 'valeverde',
  cobertura: 0.62,
  chanceDeEventoSevero: { min: 0.31, esperado: 0.46, max: 0.58 },
  pessoasEmRisco: { min: 1200, esperado: 2050, max: 2600 },
  confianca: 'média',
  sustentadaPor: ['censo', 'sensores'],
};

describe('a visão do mapa', () => {
  it('não inventa dado onde não há cobertura', () => {
    // Bairro sem cobertura chega como `undefined` — o mapa manda ausência, não
    // uma estimativa zerada. Ver o comentário em `regras/camadas.ts` da api.
    expect(dadoDaVisao(undefined, 'risco')).toBeNull();
    expect(dadoDaVisao(COBERTO, 'risco')).not.toBeNull();
  });

  it('toda visão mostra faixa, nunca número seco', () => {
    for (const visao of ['risco', 'pessoas', 'confianca'] as const) {
      expect(dadoDaVisao(COBERTO, visao)!.faixa).toBeTruthy();
    }
  });

  it('os cortes de risco separam as três faixas', () => {
    expect(nivelDeRisco(0.12)).toBe('baixo');
    expect(nivelDeRisco(0.46)).toBe('medio');
    expect(nivelDeRisco(0.82)).toBe('alto');
  });
});
