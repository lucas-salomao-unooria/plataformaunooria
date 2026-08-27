import { MISSAO_TEMPESTADE } from '../../src/unoogpt/cenario';
import { CONJUNTOS } from '../../src/unoogpt/modelo/conjuntos';
import { coberturaDaCidade, estimar, pontosCegos } from '../../src/unoogpt/modelo/estimativa';
import { PARAMETRO_POR_SLUG } from '../../src/unoogpt/modelo/parametros';

const de = (e: ReturnType<typeof estimar>, bairro: string) => e.find((x) => x.bairro === bairro)!;

describe('o modelo enxerga o que os Conjuntos deixam', () => {
  it('sem Conjunto nenhum, o modelo não estima nada', () => {
    const e = estimar([], 1);
    expect(pontosCegos(e)).toHaveLength(MISSAO_TEMPESTADE.bairros.length);
    expect(coberturaDaCidade(e)).toBe(0);
  });

  it('carregar um Conjunto acende só o que ele cobre', () => {
    // O estudo acadêmico é rigoroso e cobre a Ribeirinha e mais nada.
    const e = estimar(['estudo'], 1);
    expect(de(e, 'ribeirinha').confianca).toBe('alta');
    expect(pontosCegos(e)).toHaveLength(MISSAO_TEMPESTADE.bairros.length - 1);
  });

  it('fonte que concorda estreita a faixa', () => {
    // Vale Verde é a régua limpa: nem a previsão nem os sensores têm viés
    // sobre ele, então somar a segunda fonte só estreita.
    const pouco = de(estimar(['previsao'], 7), 'valeverde');
    const muito = de(estimar(['previsao', 'sensores'], 7), 'valeverde');
    const largura = (f: { min: number; max: number }) => f.max - f.min;
    expect(largura(muito.pessoasEmRisco)).toBeLessThan(largura(pouco.pessoasEmRisco));
    expect(muito.cobertura).toBeGreaterThan(pouco.cobertura);
  });

  it('fonte que DISCORDA alarga a faixa: mais dado, menos certeza', () => {
    // Satélite infla o Morro Alto (vê a ocupação da encosta) e o censo o
    // encolhe (cadastro velho): duas fontes puxando para lados opostos deixam
    // o modelo MENOS certo do que estava com uma só.
    const largura = (f: { min: number; max: number }) => f.max - f.min;
    const so = de(estimar(['satelite'], 7), 'morroalto');
    const brigando = de(estimar(['satelite', 'censo'], 7), 'morroalto');

    expect(brigando.cobertura).toBeGreaterThan(so.cobertura);
    expect(largura(brigando.pessoasEmRisco) / brigando.pessoasEmRisco.esperado).toBeGreaterThan(
      largura(so.pessoasEmRisco) / so.pessoasEmRisco.esperado,
    );
  });

  it('a faixa NUNCA fecha: nem com os três melhores conjuntos o modelo sabe', () => {
    const e = estimar(['censo', 'sensores', 'satelite'], 3);
    for (const b of e) {
      if (b.cobertura === 0) continue;
      expect(b.pessoasEmRisco.max).toBeGreaterThan(b.pessoasEmRisco.esperado);
      expect(b.pessoasEmRisco.min).toBeLessThan(b.pessoasEmRisco.esperado);
    }
  });

  it('o viés desloca a estimativa sem avisar', () => {
    const verdade = PARAMETRO_POR_SLUG.get('morroalto')!.expostosSevero;
    // Censo sozinho: cadastro de 2023, anterior à ocupação da encosta.
    const comCenso = de(estimar(['censo'], 5), 'morroalto').pessoasEmRisco.esperado;
    expect(comCenso).toBeLessThan(verdade * 0.7);

    // Telefonia: proxy de aparelho, subestima quem não sai sozinho.
    const comTelefonia = de(estimar(['telefonia'], 5), 'morroalto').pessoasEmRisco.esperado;
    expect(comTelefonia).toBeLessThan(verdade);
  });

  it('Conjuntos se corrigem em par: satélite conserta a defasagem do censo', () => {
    const verdade = PARAMETRO_POR_SLUG.get('morroalto')!.expostosSevero;
    const so = de(estimar(['censo'], 11), 'morroalto');
    const par = de(estimar(['censo', 'satelite'], 11), 'morroalto');
    const erro = (v: number) => Math.abs(v - verdade);
    expect(erro(par.pessoasEmRisco.esperado)).toBeLessThan(erro(so.pessoasEmRisco.esperado));
    expect(par.cobertura).toBeGreaterThan(so.cobertura);
  });

  it('nenhuma combinação de três enxerga a cidade inteira', () => {
    const slugs = CONJUNTOS.map((c) => c.slug);
    const trios: string[][] = [];
    for (let i = 0; i < slugs.length; i += 1)
      for (let j = i + 1; j < slugs.length; j += 1)
        for (let k = j + 1; k < slugs.length; k += 1) trios.push([slugs[i]!, slugs[j]!, slugs[k]!]);

    expect(trios).toHaveLength(56);
    for (const trio of trios) {
      // "Enxergar inteira" seria cobertura média acima de 0.85 sem ponto cego.
      const e = estimar(trio, 2);
      expect(coberturaDaCidade(e)).toBeLessThan(0.85);
    }
  });

  it('nem carregar TUDO fecha a conta: o teto de cobertura vale sempre', () => {
    // Sem teto de inventário, o aluno pode empilhar o catálogo inteiro. Isso
    // não pode virar onisciência: a cidade continua parcialmente invisível.
    const e = estimar(
      CONJUNTOS.map((c) => c.slug),
      9,
    );
    expect(coberturaDaCidade(e)).toBeLessThan(0.85);
    for (const b of e) {
      expect(b.pessoasEmRisco.max).toBeGreaterThan(b.pessoasEmRisco.esperado);
    }
  });

  it('trios diferentes produzem leituras diferentes da mesma cidade', () => {
    const a = de(estimar(['censo', 'telefonia', 'ocorrencias'], 4), 'morroalto').pessoasEmRisco
      .esperado;
    const b = de(estimar(['satelite', 'estudo', 'previsao'], 4), 'morroalto').pessoasEmRisco
      .esperado;
    expect(Math.abs(a - b)).toBeGreaterThan(300);
  });
});
