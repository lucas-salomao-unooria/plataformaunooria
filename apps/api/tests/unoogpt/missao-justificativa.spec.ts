import {
  INTUICAO,
  ROTULO_INTUICAO,
  comoOProfessorLe,
  faltaJustificar,
  justificativaValida,
  opcoesDeJustificativa,
} from '../../src/unoogpt/regras/justificativa';

describe('a pergunta que separa decisão de palpite', () => {
  it('só oferece as fontes que o aluno abriu — mais a intuição', () => {
    const opcoes = opcoesDeJustificativa(['previsao', 'viaria']);
    expect(opcoes.map((o) => o.valor)).toEqual(['previsao', 'viaria', INTUICAO]);
    expect(opcoes.at(-1)!.rotulo).toBe(ROTULO_INTUICAO);
  });

  it('sem nada carregado, sobra só a intuição — e ela basta', () => {
    const opcoes = opcoesDeJustificativa([]);
    expect(opcoes).toHaveLength(1);
    expect(justificativaValida(INTUICAO, [])).toBe(true);
  });

  it('fonte NÃO carregada não vale: a lista não pode virar gabarito', () => {
    // Aceitar 'estudo' aqui seria dizer ao aluno, pela interface, qual fonte
    // ele deveria ter olhado — o painel de fontes que o ADR-0009 recusou.
    expect(justificativaValida('estudo', ['previsao'])).toBe(false);
    expect(opcoesDeJustificativa(['previsao']).map((o) => o.valor)).not.toContain('estudo');
  });

  it('vazio não vale', () => {
    expect(justificativaValida(null, ['previsao'])).toBe(false);
    expect(justificativaValida('', ['previsao'])).toBe(false);
    expect(justificativaValida(undefined, ['previsao'])).toBe(false);
  });
});

describe('o portão do envio', () => {
  const carregou = ['previsao'];

  it('libera quando as duas equipes com destino têm por quê', () => {
    expect(
      faltaJustificar(
        { alfa: 'ribeirinha', bravo: 'valeverde' },
        { alfa: 'previsao', bravo: INTUICAO },
        carregou,
      ),
    ).toEqual([]);
  });

  it('trava exatamente na equipe que falta', () => {
    expect(
      faltaJustificar(
        { alfa: 'ribeirinha', bravo: 'valeverde' },
        { alfa: 'previsao', bravo: null },
        carregou,
      ),
    ).toEqual(['bravo']);
  });

  it('equipe na base não justifica: não houve escolha de lugar', () => {
    expect(
      faltaJustificar(
        { alfa: 'ribeirinha', bravo: null },
        { alfa: INTUICAO, bravo: null },
        carregou,
      ),
    ).toEqual([]);
    // E sem destino nenhum não há nada a explicar.
    expect(faltaJustificar({ alfa: null, bravo: null }, { alfa: null, bravo: null }, [])).toEqual(
      [],
    );
  });

  it('justificativa que aponta fonte não carregada não passa pelo portão', () => {
    expect(
      faltaJustificar(
        { alfa: 'ribeirinha', bravo: null },
        { alfa: 'satelite', bravo: null },
        carregou,
      ),
    ).toEqual(['alfa']);
  });
});

describe('o que o professor lê', () => {
  it('traduz a fonte, nomeia a intuição e admite o silêncio', () => {
    expect(comoOProfessorLe('previsao')).toBe('previsão do tempo');
    expect(comoOProfessorLe(INTUICAO)).toBe('intuição, sem dado');
    expect(comoOProfessorLe(null)).toBe('não disse');
  });
});
