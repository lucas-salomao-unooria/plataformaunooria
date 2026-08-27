import { indiceDoUltimoCartao, oQueMudou, rotuloColapsado } from '../../src/unoogpt/regras/cartoes';
import type { RodadaDoModelo } from '../../src/unoogpt/ferramentas';

const rodada = (empates: string[][], conflitos: string[]) =>
  ({
    empates,
    conflitos: conflitos.map((bairro) => ({ bairro, infla: {}, encolhe: {} })),
  }) as unknown as RodadaDoModelo;

describe('qual cartão fica aberto', () => {
  it('acha a última leitura, ignorando alocação e desfecho', () => {
    const falas = [
      { anexo: { tipo: 'tendencia' } },
      { anexo: null },
      { anexo: { tipo: 'tendencia' } },
      { anexo: { tipo: 'alocacao' } },
    ];
    expect(indiceDoUltimoCartao(falas)).toBe(2);
  });

  it('sem leitura nenhuma, não há cartão aberto', () => {
    expect(indiceDoUltimoCartao([{ anexo: null }, { anexo: { tipo: 'alocacao' } }])).toBe(-1);
    expect(indiceDoUltimoCartao([])).toBe(-1);
  });

  it('a linha do cartão fechado diz de quando ele é', () => {
    expect(rotuloColapsado('3:20')).toBe('Leitura com 3:20 no relógio');
    expect(rotuloColapsado(undefined)).toBe('Leitura anterior');
  });
});

describe('o que mudou desde a leitura anterior', () => {
  it('a primeira leitura é toda novidade', () => {
    expect(oQueMudou(null, rodada([['a', 'b']], ['x']))).toEqual({
      empates: true,
      conflitos: true,
    });
  });

  it('mesmo empate em ordem diferente não é empate novo', () => {
    const antes = rodada(
      [
        ['a', 'b'],
        ['c', 'd'],
      ],
      [],
    );
    const depois = rodada(
      [
        ['d', 'c'],
        ['b', 'a'],
      ],
      [],
    );
    expect(oQueMudou(antes, depois).empates).toBe(false);
  });

  it('empate que some, aparece ou troca de bairro é novidade', () => {
    expect(oQueMudou(rodada([['a', 'b']], []), rodada([], [])).empates).toBe(true);
    expect(oQueMudou(rodada([], []), rodada([['a', 'b']], [])).empates).toBe(true);
    expect(oQueMudou(rodada([['a', 'b']], []), rodada([['a', 'c']], [])).empates).toBe(true);
  });

  it('conflito é comparado pelo bairro, não pelos números', () => {
    expect(oQueMudou(rodada([], ['morroalto']), rodada([], ['morroalto'])).conflitos).toBe(false);
    expect(
      oQueMudou(rodada([], ['morroalto']), rodada([], ['morroalto', 'industrial'])).conflitos,
    ).toBe(true);
  });
});
