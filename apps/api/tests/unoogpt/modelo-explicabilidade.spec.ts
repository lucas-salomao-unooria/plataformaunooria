import { efeitoDe, empates, estimar } from '../../src/unoogpt/modelo/estimativa';
import { rodarModelo } from '../../src/unoogpt/ferramentas';
import { sementeDe } from '../../src/unoogpt/modelo/aleatorio';

/**
 * As três regras de explicabilidade. O estudante tem cinco minutos e precisa saber,
 * a cada leitura: de onde veio o número, o que a margem impede de afirmar, e o
 * que mudou por causa da fonte que ele acabou de somar.
 */
describe('a leitura se explica sozinha', () => {
  it('toda estimativa visível declara quem a sustenta', () => {
    const r = rodarModelo('s', 0, ['censo', 'previsao']);
    expect(r.estimativas.length).toBeGreaterThan(0);
    for (const e of r.estimativas) {
      expect(e.sustentadaPor.length).toBeGreaterThan(0);
      expect(e.cobertura).toBeGreaterThan(0);
    }
    // Ponto cego nunca vira número: fica de fora da tabela e é declarado.
    for (const cego of r.pontosCegos) {
      expect(r.estimativas.some((e) => e.bairro === cego)).toBe(false);
    }
  });

  it('empate é sobreposição de margem, não diferença pequena', () => {
    const e = estimar(['censo', 'previsao', 'viaria'], sementeDe('x'));
    for (const grupo of empates(e)) {
      expect(grupo.length).toBeGreaterThan(1);
      // TODOS os membros se cruzam com o maior do grupo — nada de empate por
      // transitividade, que juntava faixas que nem se tocam.
      const maior = e.find((x) => x.bairro === grupo[0])!;
      for (const b of grupo.slice(1)) {
        const outro = e.find((x) => x.bairro === b)!;
        expect(maior.pessoasEmRisco.min).toBeLessThanOrEqual(outro.pessoasEmRisco.max);
      }
    }
  });

  it('faixas distantes NUNCA empatam', () => {
    const e = estimar(['censo', 'satelite'], sementeDe('z'));
    const grupos = empates(e);
    for (const grupo of grupos) {
      const nomes = new Set(grupo);
      // Ribeirinha (~3.300, piso 2.574) e Morro Alto (~1.200, teto 1.787) não
      // se tocam: o cadastro velho encolhe o Morro Alto justamente onde a
      // Ribeirinha é maior.
      expect(nomes.has('ribeirinha') && nomes.has('morroalto')).toBe(false);
    }
  });

  it('o efeito de uma fonte é a diferença com e sem ela', () => {
    const semente = sementeDe('y');
    const efeito = efeitoDe(['censo', 'satelite'], 'satelite', semente);
    expect(efeito.length).toBeGreaterThan(0);

    // O maior efeito vem primeiro, e bate com a conta feita à mão.
    const sem = estimar(['censo'], semente);
    const com = estimar(['censo', 'satelite'], semente);
    const topo = efeito[0]!;
    expect(topo.de).toBe(sem.find((x) => x.bairro === topo.bairro)!.pessoasEmRisco.esperado);
    expect(topo.para).toBe(com.find((x) => x.bairro === topo.bairro)!.pessoasEmRisco.esperado);

    // Fonte que não está carregada não tem efeito a explicar.
    expect(efeitoDe(['censo'], 'satelite', semente)).toEqual([]);
  });

  it('a rodada carrega as três explicações juntas', () => {
    const r = rodarModelo('s', 1, ['censo', 'satelite'], 'satelite');
    expect(r.efeito?.fonte).toBe('satelite');
    expect(r.efeito?.mudou.length).toBeGreaterThan(0);
    expect(Array.isArray(r.empates)).toBe(true);
    expect(r.conflitos.length).toBeGreaterThan(0);
  });
});
