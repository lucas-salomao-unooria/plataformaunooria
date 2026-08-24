import { ENGINE_CONFIG_DEFAULT, PERFIS } from '../src/comum/insta/defaults';
import { mixDoBloco } from '../src/motor/curadoria';
import { SEMENTE_INICIAL_PADRAO } from '../src/motor/estado';
import { catalogoDeTeste, simular, sinal, visto } from './motor-simulador';

/**
 * M5 — reversibilidade do viés semeado (doc 04 §10.3, doc 08 M5).
 *
 * Estes são os testes mais importantes do projeto. O aluno nasce empurrado para um
 * lado pelo perfil do Ato 1; se ele **não conseguir virar**, o exercício deixa de
 * ensinar "o algoritmo te empurra, mas você pode reagir" e passa a ensinar "seu
 * tipo define o que você pensa" — o oposto exato da mensagem.
 *
 * Quando um teste daqui falha, a causa quase sempre é uma de duas: a semente está
 * alta demais, ou o piso do lado oposto parou de funcionar.
 */

const CONFIG = ENGINE_CONFIG_DEFAULT;
const DWELL_ALTO = 9_000;
const DWELL_RETO = 700;

describe('a semente inclina sem travar', () => {
  it('o bloco inicial já vem inclinado para o lado semeado', () => {
    const semeadoEmA = simular(1, () => [], { ladoInicial: 'A' }).passos[0]!;
    const semeadoEmB = simular(1, () => [], { ladoInicial: 'B' }).passos[0]!;

    expect(semeadoEmA.metas.filter((m) => m.lado === 'A')).toHaveLength(3);
    expect(semeadoEmA.metas.filter((m) => m.lado === 'B')).toHaveLength(1);

    expect(semeadoEmB.metas.filter((m) => m.lado === 'B')).toHaveLength(3);
    expect(semeadoEmB.metas.filter((m) => m.lado === 'A')).toHaveLength(1);
  });

  it('a inclinação é de composição, nunca de intensidade', () => {
    // Post sensacionalista no primeiro contato quebraria o disfarce.
    const { passos } = simular(1, () => [], { ladoInicial: 'A' });
    expect(passos[0]!.metas.every((meta) => meta.intensidade === 1)).toBe(true);
  });

  it('a semente sozinha NÃO tira o domínio de 0.5', () => {
    // É isso que a torna reversível: o comportamento do aluno é que decide.
    const { passos } = simular(1, () => [], { ladoInicial: 'A' });
    expect(SEMENTE_INICIAL_PADRAO).toBeLessThan(CONFIG.somaMinimaParaDominio);
    expect(passos[0]!.dominio).toBe(0.5);
  });
});

describe('o aluno consegue virar de lado — o teste que define o exercício', () => {
  /**
   * Aluno semeado em A que só engaja com B: para em cada post do lado B e curte,
   * e rola reto pelos do lado A. É o comportamento de quem se interessou pelo
   * outro lado.
   */
  const contrario = (meta: { lado: string; id: string }) =>
    meta.lado === 'B'
      ? [visto(meta as never, DWELL_ALTO), sinal(meta as never, 'curtiu')]
      : [visto(meta as never, DWELL_RETO)];

  it('semeado em A, engajando só com B, o domínio INVERTE', () => {
    const { estado, passos } = simular(6, contrario, { ladoInicial: 'A' });

    expect(estado.scoreB).toBeGreaterThan(estado.scoreA);

    const ultimo = passos[passos.length - 1]!;
    expect(ultimo.metas.filter((m) => m.lado === 'B').length).toBeGreaterThan(
      ultimo.metas.filter((m) => m.lado === 'A').length,
    );
  });

  it('a inversão acontece dentro da sessão, não depois dela', () => {
    const { passos } = simular(6, contrario, { ladoInicial: 'A' });

    const blocoDaInversao = passos.findIndex(
      (passo) => passo.estado.scoreB > passo.estado.scoreA,
    );

    expect(blocoDaInversao).toBeGreaterThanOrEqual(0);
    // Uma sessão real tem ~10 blocos (60 posts). Virar depois do 5º seria virar
    // tarde demais para o feed refletir a mudança antes do encerramento.
    expect(blocoDaInversao).toBeLessThanOrEqual(4);
  });

  it('e vale nos dois sentidos: semeado em B, engajando só com A, também inverte', () => {
    const proA = (meta: { lado: string; id: string }) =>
      meta.lado === 'A'
        ? [visto(meta as never, DWELL_ALTO), sinal(meta as never, 'curtiu')]
        : [visto(meta as never, DWELL_RETO)];

    const { estado } = simular(6, proA, { ladoInicial: 'B' });
    expect(estado.scoreA).toBeGreaterThan(estado.scoreB);
  });
});

describe('o piso do lado oposto', () => {
  it('nunca zera, em nenhum bloco de uma sessão inteira', () => {
    // Aluno que só engaja com o lado semeado: o caso em que a bolha mais fecha.
    const soDoLadoA = (meta: { lado: string; id: string }) =>
      meta.lado === 'A'
        ? [visto(meta as never, DWELL_ALTO), sinal(meta as never, 'curtiu')]
        : [visto(meta as never, DWELL_RETO)];

    const { passos } = simular(10, soDoLadoA, { ladoInicial: 'A' });

    for (const passo of passos.slice(1)) {
      const opostos = passo.metas.filter((meta) => meta.lado === 'B');
      expect(opostos.length).toBeGreaterThan(0);
    }
  });

  it('o post do oposto é sempre o mais suave — rampa de saída, não isca de raiva', () => {
    const soDoLadoA = (meta: { lado: string; id: string }) =>
      meta.lado === 'A'
        ? [visto(meta as never, DWELL_ALTO), sinal(meta as never, 'curtiu')]
        : [visto(meta as never, DWELL_RETO)];

    const { passos } = simular(10, soDoLadoA, { ladoInicial: 'A' });

    for (const passo of passos) {
      for (const post of passo.metas.filter((meta) => meta.lado === 'B')) {
        expect(post.intensidade).toBe(1);
      }
    }
  });

  it('a bolha continua sendo bolha: ~5 para 1 no fim', () => {
    const soDoLadoA = (meta: { lado: string; id: string }) =>
      meta.lado === 'A'
        ? [visto(meta as never, DWELL_ALTO), sinal(meta as never, 'curtiu')]
        : [visto(meta as never, DWELL_RETO)];

    const { passos } = simular(10, soDoLadoA, { ladoInicial: 'A' });
    const ultimos = passos.slice(-3).flatMap((passo) => passo.metas);

    const a = ultimos.filter((meta) => meta.lado === 'A').length;
    const b = ultimos.filter((meta) => meta.lado === 'B').length;

    // Piso não é equilíbrio: o dominante segue dominando com folga.
    expect(a).toBeGreaterThan(b * 3);
    expect(b).toBeGreaterThan(0);
  });
});

describe('ponderação por perfil', () => {
  it('com perfil definido, a exposição pende para ele — sem filtrar', () => {
    const { estado } = simular(10, (meta) => [visto(meta, 3_000)], {
      ladoInicial: 'A',
      perfilDominante: 'abertura',
    });

    const exposicao = estado.exposicaoPorPerfil!;
    const total = PERFIS.reduce((soma, perfil) => soma + (exposicao[perfil] ?? 0), 0);
    const fracaoDoPerfil = (exposicao.abertura ?? 0) / total;

    // `pesoPerfil` = 0.5: metade das escolhas prioriza o perfil, e o resto sorteia
    // entre os 4 — então a fração fica bem acima de 1/4 e bem abaixo de 1.
    expect(fracaoDoPerfil).toBeGreaterThan(0.35);
    expect(fracaoDoPerfil).toBeLessThan(0.9);

    // Ponderar, não filtrar: os outros 3 perfis continuam aparecendo.
    for (const perfil of PERFIS) {
      expect(exposicao[perfil] ?? 0).toBeGreaterThan(0);
    }
  });

  it('sem perfil (misto ou ausente), os 4 saem equilibrados', () => {
    const { estado } = simular(10, (meta) => [visto(meta, 3_000)], {
      ladoInicial: 'A',
      perfilDominante: null,
    });

    const exposicao = estado.exposicaoPorPerfil!;
    const total = PERFIS.reduce((soma, perfil) => soma + (exposicao[perfil] ?? 0), 0);

    for (const perfil of PERFIS) {
      const fracao = (exposicao[perfil] ?? 0) / total;
      expect(fracao).toBeGreaterThan(0.12);
      expect(fracao).toBeLessThan(0.42);
    }
  });

  it('`misto` desliga a ponderação sozinho', () => {
    const { estado } = simular(4, (meta) => [visto(meta, 3_000)], {
      ladoInicial: 'A',
      perfilDominante: 'misto',
    });
    expect(estado.perfilDominante).toBeNull();
  });
});

describe('mixagem sem neutros', () => {
  it('o bloco não encurta e o oposto continua presente', () => {
    const semNeutros = catalogoDeTeste().filter((post) => post.lado !== 'neutro');
    const { passos } = simular(6, (meta) => [visto(meta, 3_000)], {
      ladoInicial: 'A',
      catalogo: semNeutros,
    });

    for (const passo of passos.slice(1)) {
      expect(passo.metas).toHaveLength(6);
      expect(passo.metas.filter((m) => m.lado === 'neutro')).toHaveLength(0);
      expect(passo.metas.filter((m) => m.lado === 'B').length).toBeGreaterThan(0);
    }
  });

  it('o bloco inicial cai para 5 do semeado + 3 do oposto', () => {
    const semNeutros = catalogoDeTeste().filter((post) => post.lado !== 'neutro');
    const inicial = simular(1, () => [], { ladoInicial: 'A', catalogo: semNeutros }).passos[0]!;

    expect(inicial.metas).toHaveLength(8);
    expect(inicial.metas.filter((m) => m.lado === 'A')).toHaveLength(5);
    expect(inicial.metas.filter((m) => m.lado === 'B')).toHaveLength(3);
  });

  it('a tabela sem neutros nunca zera o oposto', () => {
    for (let dominio = 0; dominio <= 1; dominio += 0.05) {
      expect(mixDoBloco(dominio, CONFIG, false).oposto).toBeGreaterThan(0);
    }
  });
});
