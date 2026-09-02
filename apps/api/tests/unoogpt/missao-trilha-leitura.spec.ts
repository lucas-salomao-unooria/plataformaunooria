import { mudancasDeDestino, marcoDeEnvio, marcoDeRecomeco, marcoDeInicio } from '../../src/unoogpt/regras/trilha';
import { coberturaDoRisco, percentilEntre, posicaoNaFaixa } from '../../src/unoogpt/regras/desfecho';

/**
 * O que o relatório do professor DERIVA dos marcos e do desfecho gravados —
 * sem gravar nada a mais. Contar errado aqui é contar errado na tela.
 */

const alocacao = (ordem: number, alfa: string | null, bravo: string | null) => ({
  tipo: 'alocacao',
  ordem,
  dados: { alfa, bravo },
});

describe('mudanças de destino antes do envio', () => {
  it('a primeira escolha não é mudança: mudar é sair de um destino que existia', () => {
    expect(mudancasDeDestino([alocacao(1, 'Ribeirinha', null)])).toBe(0);
  });

  it('o cartão de duas opções manda um POST por equipe: dois marcos, UMA decisão', () => {
    // Alfa e Bravo escolhidos em sequência imediata a partir do vazio.
    const marcos = [alocacao(1, 'Ribeirinha', null), alocacao(2, 'Ribeirinha', 'Vale Verde')];
    expect(mudancasDeDestino(marcos)).toBe(1);
  });

  it('justificar passa pela mesma rota com o mesmo bairro e NÃO conta', () => {
    const marcos = [
      alocacao(1, 'Ribeirinha', 'Vale Verde'),
      alocacao(2, 'Ribeirinha', 'Vale Verde'), // justificou a Alfa
      alocacao(3, 'Ribeirinha', 'Vale Verde'), // justificou a Bravo
    ];
    expect(mudancasDeDestino(marcos)).toBe(0);
  });

  it('trocar um bairro e trocar de volta são duas mudanças', () => {
    const marcos = [
      alocacao(1, 'Ribeirinha', 'Vale Verde'),
      alocacao(2, 'Morro Alto', 'Vale Verde'),
      alocacao(3, 'Ribeirinha', 'Vale Verde'),
    ];
    expect(mudancasDeDestino(marcos)).toBe(2);
  });

  it('o que vem depois do envio não é decisão', () => {
    const marcos = [
      alocacao(1, 'Ribeirinha', 'Vale Verde'),
      alocacao(2, 'Morro Alto', 'Vale Verde'),
      { tipo: 'envio', ordem: 3, dados: {} },
      alocacao(4, 'Industrial', 'Vale Verde'),
    ];
    expect(mudancasDeDestino(marcos)).toBe(1);
  });

  it('a ordem de chegada não importa — a ordem gravada sim', () => {
    const marcos = [alocacao(2, 'Morro Alto', null), alocacao(1, 'Ribeirinha', null)];
    expect(mudancasDeDestino(marcos)).toBe(1);
  });

  it('marcos de outros tipos no meio não interferem', () => {
    const marcos = [
      { tipo: 'fontes', ordem: 1, dados: { somadas: ['satelite'] } },
      alocacao(2, 'Ribeirinha', null),
      { tipo: 'leitura', ordem: 3, dados: {} },
      alocacao(4, 'Ribeirinha', 'Industrial'),
    ];
    expect(mudancasDeDestino(marcos)).toBe(1);
  });
});

describe('cobertura do risco', () => {
  const desfecho = {
    porBairro: [
      { emRisco: 600, equipe: 'alfa' },
      { emRisco: 300, equipe: 'bravo' },
      { emRisco: 100, equipe: null },
    ],
    totais: { emRisco: 1000, salvas: 500 },
  };

  it('é a fração do risco da cidade que os bairros escolhidos cobriam, inteira', () => {
    expect(coberturaDoRisco(desfecho)).toBe(90);
  });

  it('sem risco na cidade é ausência, não zero', () => {
    expect(coberturaDoRisco({ porBairro: [], totais: { emRisco: 0, salvas: 0 } })).toBeNull();
  });
});

describe('posição na faixa', () => {
  const esperado = { media: 1000, faixa: [800, 1200] as const, amostras: [700, 900, 1000, 1100, 1300] };

  it('usa o percentil gravado quando existe', () => {
    expect(posicaoNaFaixa(1000, { ...esperado, percentil: 63 }).percentil).toBe(63);
  });

  it('sem percentil gravado, cai nas amostras — grosso mas honesto', () => {
    const p = posicaoNaFaixa(1000, esperado);
    expect(p.percentil).toBe(60);
    expect(p.dentroDaFaixa).toBe(true);
    expect(p.acimaDaMedia).toBe(true);
  });

  it('fora de [p10, p90] é sorte (ou azar) visível', () => {
    expect(posicaoNaFaixa(1300, esperado).dentroDaFaixa).toBe(false);
    expect(posicaoNaFaixa(700, esperado).acimaDaMedia).toBe(false);
  });

  it('percentil de lista vazia é zero, não NaN', () => {
    expect(percentilEntre(10, [])).toBe(0);
  });
});

describe('os marcos novos e a justificativa no envio', () => {
  it('o envio carrega as justificativas como o professor lê', () => {
    const m = marcoDeEnvio(42, { salvas: 1, vitimas: 2, emRisco: 3 }, [], {
      alfa: 'intuição, sem dado',
      bravo: 'Satélite',
    });
    expect(m.tipo).toBe('envio');
    expect((m.dados as { justificativas: unknown }).justificativas).toEqual({
      alfa: 'intuição, sem dado',
      bravo: 'Satélite',
    });
  });

  it('inicio e recomeco existem com o payload público mínimo', () => {
    expect(marcoDeInicio(0)).toEqual({ tipo: 'inicio', minuto: 0, dados: {} });
    const r = marcoDeRecomeco(30, { origem: 'resultado', fase: 'correndo', modo: 'cronometrado' });
    expect(r.dados).toEqual({ origem: 'resultado', fase: 'correndo', modo: 'cronometrado' });
  });
});
