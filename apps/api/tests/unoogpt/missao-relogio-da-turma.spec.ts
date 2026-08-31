import {
  RELOGIO,
  RELOGIO_PADRAO,
  estadoDoRelogio,
  minutoNarrativo,
  motivoDeBloqueio,
  pivoParaEstender,
  podePerguntar,
  type RelogioDaTurma,
} from '../../src/unoogpt/regras/relogio';

const T0 = new Date('2026-08-25T14:00:00.000Z');
const em = (s: number) => new Date(T0.getTime() + s * 1000);
const turma = (over: Partial<RelogioDaTurma> = {}): RelogioDaTurma => ({
  ...RELOGIO_PADRAO,
  iniciadoEm: T0,
  ...over,
});

describe('as quatro fases do relógio da turma', () => {
  it('aguardando: o estudante vê o cronômetro cheio e parado, e não pode falar', () => {
    const e = estadoDoRelogio(RELOGIO_PADRAO, em(9999));
    expect(e.fase).toBe('aguardando');
    expect(e.minutosGastos).toBe(0);
    expect(e.segundosAteFechar).toBe(RELOGIO.duracaoRealEmSegundos);
    expect(podePerguntar(e)).toBe(false);
    expect(motivoDeBloqueio(e)).toContain('ainda não começou');
  });

  it('correndo: o padrão de cinco minutos é exatamente o de antes', () => {
    expect(estadoDoRelogio(turma(), em(0)).minutosGastos).toBe(0);
    expect(estadoDoRelogio(turma(), em(5)).minutosGastos).toBe(1);
    expect(estadoDoRelogio(turma(), em(150)).minutosGastos).toBe(30);
    expect(estadoDoRelogio(turma(), em(299)).minutosGastos).toBe(59);
    expect(podePerguntar(estadoDoRelogio(turma(), em(150)))).toBe(true);
  });

  it('a chuva cai no fim do cronômetro, e o motivo é o tempo', () => {
    const e = estadoDoRelogio(turma(), em(300));
    expect(e.fase).toBe('encerrado');
    expect(e.minutosGastos).toBe(RELOGIO.minutosTotais);
    expect(e.segundosAteFechar).toBe(0);
    expect(podePerguntar(e)).toBe(false);
    expect(motivoDeBloqueio(e)).toMatch(/18h00/);
  });

  it('encerrado pelo professor fecha em qualquer modo, e diz que foi ele', () => {
    for (const modo of ['cronometrado', 'livre'] as const) {
      const e = estadoDoRelogio(turma({ modo, encerradoEm: em(120) }), em(200));
      expect(e.fase).toBe('encerrado');
      expect(e.motivoDoFim).toBe('professor');
      expect(podePerguntar(e)).toBe(false);
      expect(motivoDeBloqueio(e)).toContain('professor encerrou');
    }
  });

  it('livre: sem contagem regressiva, e aberta até o professor encerrar', () => {
    const e = estadoDoRelogio(turma({ modo: 'livre' }), em(99_999));
    expect(e.fase).toBe('correndo');
    expect(e.segundosAteFechar).toBeNull();
    expect(e.aberta).toBe(true);
    // A cidade congela às 18h00: a hora não passa de 60 nem em modo livre.
    expect(e.minutosGastos).toBe(RELOGIO.minutosTotais);
  });
});

describe('somar tempo estica a hora da cidade sem rebobinar', () => {
  it('+2 min no meio da aula: o minuto da cidade NUNCA anda para trás', () => {
    // Este é o teste que justifica o pivô existir. Sem ele, trocar a duração
    // aos 4:00 jogava o estudante do minuto 48 de volta para o 34.
    const antes = turma();
    const quando = em(240);
    const noMomento = estadoDoRelogio(antes, quando).minutosGastos;
    expect(noMomento).toBe(48);

    const depois = turma({ duracaoSeg: 420, ...pivoParaEstender(antes, quando) });

    let maximo = 0;
    for (let s = 0; s <= 420; s += 1) {
      const m = estadoDoRelogio(s <= 240 ? antes : depois, em(s)).minutosGastos;
      expect(m).toBeGreaterThanOrEqual(maximo);
      maximo = m;
    }
    expect(estadoDoRelogio(depois, em(240)).minutosGastos).toBe(noMomento);
  });

  it('a chuva passa a cair no novo fim, e não antes', () => {
    const esticado = turma({ duracaoSeg: 420, ...pivoParaEstender(turma(), em(240)) });
    expect(estadoDoRelogio(esticado, em(300)).aberta).toBe(true);
    expect(estadoDoRelogio(esticado, em(419)).minutosGastos).toBeLessThan(RELOGIO.minutosTotais);
    expect(estadoDoRelogio(esticado, em(420)).minutosGastos).toBe(RELOGIO.minutosTotais);
    expect(estadoDoRelogio(esticado, em(420)).aberta).toBe(false);
  });

  it('duas extensões seguidas encadeiam os pivôs', () => {
    const um = turma({ duracaoSeg: 420, ...pivoParaEstender(turma(), em(240)) });
    const dois = turma({ duracaoSeg: 540, ...pivoParaEstender(um, em(400)) });
    expect(estadoDoRelogio(dois, em(400)).minutosGastos).toBe(
      estadoDoRelogio(um, em(400)).minutosGastos,
    );
    expect(estadoDoRelogio(dois, em(540)).minutosGastos).toBe(RELOGIO.minutosTotais);
    expect(estadoDoRelogio(dois, em(539)).aberta).toBe(true);
  });

  it('sem pivô, a fórmula é a escala de sempre', () => {
    expect(minutoNarrativo(150, 300, { seg: 0, min: 0 })).toBe(30);
    expect(minutoNarrativo(300, 300, { seg: 0, min: 0 })).toBe(60);
  });

  it('estender antes da largada não inventa pivô', () => {
    expect(pivoParaEstender(RELOGIO_PADRAO, em(50))).toEqual({ pivoSeg: 0, pivoMin: 0 });
  });
});
