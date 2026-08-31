import { MISSAO_TEMPESTADE as M } from '../../src/unoogpt/cenario';

/**
 * A ficha é a verdade escondida do mundo (ADR-0006): o estudante nunca a vê, mas
 * ela precisa fechar. Se um bairro mudar e o total não, a cidade passa a mentir
 * — e a mentira é invisível, porque cada tela mostra um pedaço.
 */
describe('invariante: a ficha canônica fecha', () => {
  const soma = (f: (b: (typeof M.bairros)[number]) => number) =>
    M.bairros.reduce((a, b) => a + f(b), 0);

  it('os totais batem com a soma dos bairros', () => {
    expect(soma((b) => b.pop)).toBe(M.totais.populacao);
    expect(soma((b) => b.exp)).toBe(M.totais.expostos);
    expect(soma((b) => b.vuln)).toBe(M.totais.vulneraveis);
    expect(Number(soma((b) => b.danos).toFixed(1))).toBe(M.totais.danosMi);
  });

  it('há menos Equipes que bairros: metade fica descoberta, sempre', () => {
    expect(M.equipes.length).toBeLessThan(M.bairros.length);
  });

  it('nenhum bairro declara risco: risco é o que o estudante infere', () => {
    for (const b of M.bairros) {
      expect(JSON.stringify(b).toLowerCase()).not.toContain('mais perigoso');
      expect(JSON.stringify(b).toLowerCase()).not.toContain('prioridade');
    }
  });
});
