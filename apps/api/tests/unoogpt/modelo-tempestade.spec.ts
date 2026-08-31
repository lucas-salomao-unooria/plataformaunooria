import { MISSAO_TEMPESTADE } from '../../src/unoogpt/cenario';
import { EFICIENCIA_MINIMA } from '../../src/unoogpt/modelo/parametros';
import { LIMITE_DE_INVESTIGACAO } from '../../src/unoogpt/regras/relogio';
import {
  AMOSTRAS_NA_TELA,
  alcancaveisAgora,
  chegaATempo,
  eficienciaDoTempo,
  esperadoDe,
  simular,
} from '../../src/unoogpt/modelo/tempestade';
import { sementeDe } from '../../src/unoogpt/modelo/aleatorio';

const alocacao = (alfa: string | null, bravo: string | null) => ({ alfa, bravo });

describe('a tempestade é sorteio, não conta', () => {
  it('a mesma alocação, na mesma turma, rende números PRÓXIMOS', () => {
    // Uma cidade, uma tempestade: dois estudantes que mandam para os mesmos lugares
    // não podem terminar em mundos diferentes. A diferença vem da decisão.
    const tempestadeDaTurma = { sementeDaTempestade: sementeDe('turma:cedro-01') };
    const a = simular(alocacao('valeverde', 'ribeirinha'), 1, tempestadeDaTurma).totais;
    const b = simular(alocacao('valeverde', 'ribeirinha'), 2, tempestadeDaTurma).totais;
    expect(Math.abs(a.salvas - b.salvas)).toBeLessThan(a.salvas * 0.2);
    expect(a.emRisco).toBe(b.emRisco);
  });

  it('o horário de chegada informa, não fecha porta', () => {
    // A Ponte do Sauá fecha 20 minutos depois do alerta. Saindo na hora, a
    // Bravo chega em 12 min sem nota nenhuma; saindo 12 minutos depois, ela
    // passa do fechamento — e isso é dito em tempo relativo, porque o estudante só
    // tem o cronômetro na tela.
    expect(chegaATempo('ribeirinha', 'bravo', 0).motivo).toBeNull();
    const tarde = chegaATempo('ribeirinha', 'bravo', 12);
    expect(tarde.chegou).toBe(true);
    expect(tarde.motivo).toContain('min de sobra');
    expect(tarde.motivo).toContain('via principal já terá fechado');
    expect(tarde.motivo).not.toMatch(/\dh\d\d/);

    // Todos os destinos continuam na mesa; o que muda é a margem.
    expect(alcancaveisAgora(30).length).toBe(alcancaveisAgora(0).length);
    expect(eficienciaDoTempo(chegaATempo('ribeirinha', 'bravo', 30).folga)).toBeLessThan(
      eficienciaDoTempo(chegaATempo('ribeirinha', 'bravo', 0).folga),
    );
  });

  it('a rodada varia de turma para turma', () => {
    const a = simular(alocacao('industrial', 'ribeirinha'), 1, {
      sementeDaTempestade: sementeDe('turma:a'),
    }).totais.salvas;
    const b = simular(alocacao('industrial', 'ribeirinha'), 1, {
      sementeDaTempestade: sementeDe('turma:b'),
    }).totais.salvas;
    const c = simular(alocacao('industrial', 'ribeirinha'), 1, {
      sementeDaTempestade: sementeDe('turma:c'),
    }).totais.salvas;
    expect(new Set([a, b, c]).size).toBeGreaterThan(1);
  });

  it('a mesma semente reproduz a mesma rodada: o professor reabre e confere', () => {
    const s = sementeDe('sessao:1');
    expect(simular(alocacao('industrial', 'ribeirinha'), s)).toEqual(
      simular(alocacao('industrial', 'ribeirinha'), s),
    );
  });

  it('o desfecho registra com quanta folga a equipe chegou', () => {
    // Ribeirinha: 41 min para a Alfa, e a via fecha antes disso.
    const d = simular(alocacao('ribeirinha', null), 7);
    const ribeirinha = d.porBairro.find((b) => b.bairro === 'ribeirinha')!;
    expect(ribeirinha.chegou).toBe(true);
    expect(ribeirinha.motivo).toContain('sobra');
    expect(ribeirinha.motivo).not.toMatch(/\dh\d\d/);
    expect(ribeirinha.salvas).toBeGreaterThan(0);

    // Pela base sul a rota é limpa: chega antes, sem nota, e rende mais.
    const pelaBravo = simular(alocacao(null, 'ribeirinha'), 7);
    const mesma = pelaBravo.porBairro.find((b) => b.bairro === 'ribeirinha')!;
    expect(mesma.motivo).toBeNull();
    expect(mesma.salvas).toBeGreaterThan(ribeirinha.salvas);
  });

  it('os totais fecham', () => {
    const d = simular(alocacao('valeverde', 'morroalto'), 11);
    const soma = d.porBairro.reduce((a, b) => a + b.emRisco, 0);
    expect(d.totais.emRisco).toBe(soma);
    expect(d.totais.salvas + d.totais.semSocorro).toBe(d.totais.emRisco);
  });

  it('alocação ruim é confiavelmente pior: sorte não salva quem vai ao lugar errado', () => {
    // Este invariante quase morreu quando a cidade caiu de seis bairros para
    // quatro: o Centro e o Jardim das Flores eram os destinos de baixa
    // probabilidade, e eram eles que faziam escolher errado custar caro. Sem
    // eles, toda alocação de duas equipes passou a render quase o mesmo — 23%
    // entre a melhor e a pior, com as faixas sobrepostas.
    //
    // O custo voltou pela ficha, não por este teste: o Industrial passou a ter
    // 500 expostos em vez de 1.180. Ele continua com o maior prejuízo material
    // da cidade e continua inflado 1,6 vezes pelo satélite — quem decide pelo
    // que a imagem mostra manda equipe para um bairro de galpão.
    const boa = esperadoDe(alocacao('valeverde', 'ribeirinha'), {}, 300);
    const fraca = esperadoDe(alocacao('industrial', 'morroalto'), {}, 300);
    expect(boa.media).toBeGreaterThan(fraca.media * 1.5);

    // Deixar equipe na base separa as faixas de vez: não há rodada em que ela
    // renda o que rendem duas equipes bem mandadas.
    const naBase = esperadoDe(alocacao('morroalto', null), {}, 300);
    expect(boa.media).toBeGreaterThan(naBase.media * 2);
    expect(naBase.faixa[1]).toBeLessThan(boa.faixa[0]);
  });

  it('entre as opções RAZOÁVEIS, a sorte decide: as faixas se sobrepõem', () => {
    // O dilema real do sul: a Bravo alcança Ribeirinha ou Morro Alto, não os
    // dois. Uma rende mais em média; a outra ganha em muitas rodadas.
    const comRibeirinha = esperadoDe(alocacao('valeverde', 'ribeirinha'), {}, 300);
    const comMorroAlto = esperadoDe(alocacao('valeverde', 'morroalto'), {}, 300);
    expect(comMorroAlto.faixa[1]).toBeGreaterThan(comRibeirinha.faixa[0]);
    expect(comRibeirinha.faixa[1]).toBeGreaterThan(comMorroAlto.faixa[0]);
  });

  it('não existe alocação que salve todo mundo', () => {
    const { media } = esperadoDe(alocacao('ribeirinha', 'morroalto'), {}, 200);
    const totalPossivel = simular(alocacao(null, null), 5).totais.emRisco;
    expect(media).toBeLessThan(totalPossivel * 0.6);
  });
});

describe('a conta do Resultado fecha', () => {
  it('em risco = tiradas + sozinhas + mortas, bairro a bairro', () => {
    const d = simular({ alfa: 'valeverde', bravo: 'ribeirinha' }, 42, {
      sementeDaTempestade: sementeDe('turma:x'),
    });
    for (const b of d.porBairro) {
      const sozinhas = b.emRisco - b.salvas - b.vitimas;
      expect(sozinhas).toBeGreaterThanOrEqual(0);
      expect(b.salvas + sozinhas + b.vitimas).toBe(b.emRisco);
    }
    const sozinhasTotal = d.totais.emRisco - d.totais.salvas - d.totais.vitimas;
    expect(d.totais.salvas + sozinhasTotal + d.totais.vitimas).toBe(d.totais.emRisco);
  });
});

describe('o tempo é rampa, não precipício', () => {
  it('investigar a missão inteira não zera a operação', () => {
    // 10 consultas = 40 minutos, o teto do Relógio. Antes isto zerava tudo, e a
    // lição virava "não pergunte" — o oposto do que a Missão ensina.
    for (const b of MISSAO_TEMPESTADE.bairros) {
      for (const equipe of ['alfa', 'bravo'] as const) {
        if (!chegaATempo(b.slug, equipe, LIMITE_DE_INVESTIGACAO).chegou) continue;
        const so = equipe === 'alfa' ? { alfa: b.slug, bravo: '' } : { alfa: '', bravo: b.slug };
        const tarde = simular(so, 9, {
          sementeDaTempestade: sementeDe('turma:x'),
          saidaEmMinutos: LIMITE_DE_INVESTIGACAO,
        });
        expect(tarde.totais.salvas).toBeGreaterThan(0);
      }
    }
  });

  it('mas sair cedo salva mais que sair tarde', () => {
    const opcoes = { sementeDaTempestade: sementeDe('turma:x') };
    const cedo = simular({ alfa: 'industrial', bravo: 'ribeirinha' }, 9, {
      ...opcoes,
      saidaEmMinutos: 0,
    });
    const tarde = simular({ alfa: 'industrial', bravo: 'ribeirinha' }, 9, {
      ...opcoes,
      saidaEmMinutos: LIMITE_DE_INVESTIGACAO,
    });
    expect(cedo.totais.salvas).toBeGreaterThan(tarde.totais.salvas);
  });

  it('sempre sobra algum destino alcançável, mesmo no último minuto', () => {
    const restam = MISSAO_TEMPESTADE.bairros.filter(
      (b) =>
        chegaATempo(b.slug, 'alfa', LIMITE_DE_INVESTIGACAO).chegou ||
        chegaATempo(b.slug, 'bravo', LIMITE_DE_INVESTIGACAO).chegou,
    );
    expect(restam.length).toBeGreaterThanOrEqual(2);
  });

  it('a rampa desce até o piso e nunca até zero', () => {
    // Chegar com a chuva caindo ainda tira gente: o atraso custa resultado, não
    // a operação inteira.
    expect(eficienciaDoTempo(0)).toBe(EFICIENCIA_MINIMA);
    expect(eficienciaDoTempo(-30)).toBe(EFICIENCIA_MINIMA);
    expect(eficienciaDoTempo(30)).toBe(1);
    expect(eficienciaDoTempo(10)).toBeGreaterThan(EFICIENCIA_MINIMA);
    expect(eficienciaDoTempo(10)).toBeLessThan(1);
  });

  it('sair tarde encolhe a margem, e nunca mais que isso', () => {
    // O piso é alto de propósito: a hora de chegada pesa na conta, mas quem
    // decide o desfecho é onde estão as pessoas.
    expect(eficienciaDoTempo(0)).toBeGreaterThanOrEqual(0.7);
    expect(eficienciaDoTempo(999)).toBe(1);
  });

  it('nenhum destino é impossível, saia a que horas sair', () => {
    for (const b of MISSAO_TEMPESTADE.bairros) {
      for (const equipe of ['alfa', 'bravo'] as const) {
        for (const saida of [0, 20, 40, 59]) {
          expect(chegaATempo(b.slug, equipe, saida).chegou).toBe(true);
        }
      }
    }
  });
});

describe('a variância que o estudante enxerga', () => {
  const alocacao = { alfa: 'valeverde', bravo: 'industrial' };

  it('entrega vinte corridas da mesma decisão', () => {
    expect(esperadoDe(alocacao).amostras).toHaveLength(AMOSTRAS_NA_TELA);
  });

  // Se as vinte derem o mesmo número, a nuvem vira um ponto e a tela volta a
  // dizer que o resultado é nota. A lição inteira depende de elas diferirem.
  it('as vinte não são iguais entre si', () => {
    const { amostras } = esperadoDe(alocacao);
    expect(new Set(amostras).size).toBeGreaterThan(1);
  });

  it('as amostras caem dentro da mesma ordem de grandeza da faixa', () => {
    const { amostras, faixa } = esperadoDe(alocacao);
    const dentro = amostras.filter((n) => n >= faixa[0] && n <= faixa[1]).length;
    expect(dentro).toBeGreaterThanOrEqual(AMOSTRAS_NA_TELA * 0.6);
  });

  // O contrafactual só responde "e se?" se a única coisa que mudar for o
  // destino: mesma semente de tempestade, mesma hora de saída.
  it('mesma tempestade e outro destino dá outro número', () => {
    const opcoes = { sementeDaTempestade: 7, saidaEmMinutos: 12 };
    const a = simular(alocacao, 42, opcoes).totais.salvas;
    const b = simular({ alfa: 'ribeirinha', bravo: 'industrial' }, 42, opcoes).totais.salvas;
    expect(a).not.toBe(b);
  });
});
