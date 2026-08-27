import { montarMapa, naoCarregados } from '../../src/unoogpt/regras/camadas';
import { CONJUNTOS } from '../../src/unoogpt/modelo/conjuntos';
import { MISSAO_TEMPESTADE } from '../../src/unoogpt/cenario';

const bairro = (m: ReturnType<typeof montarMapa>, slug: string) =>
  m.bairros.find((b) => b.slug === slug)!;

/**
 * A regra que a tela 2 promete ao aluno: o mapa é a leitura dos Conjuntos que
 * ele carregou — nada mais. Se este teste cair, a Missão mente na segunda tela.
 *
 * As asserções sobre a VISÃO (níveis de risco, faixa em vez de número seco)
 * moraram aqui até o porte e agora vivem em
 * `apps/experiencias/exp-03-unoogpt/src/lib/visao.test.ts`: `visao.ts` é
 * lógica de tela e mudou de lado junto com ela.
 */
describe('invariante: o mapa é a leitura dos Conjuntos', () => {
  it('sem Conjunto, nenhum bairro mostra nada', () => {
    const m = montarMapa('s1', 0, []);
    expect(m.bairros).toHaveLength(MISSAO_TEMPESTADE.bairros.length);
    for (const b of m.bairros) {
      expect(b.estimativa?.cobertura ?? 0).toBe(0);
      expect(b.tempos).toBeNull();
    }
  });

  it('um Conjunto acende só o que ele cobre — e o resto fica em BRANCO', () => {
    const m = montarMapa('s1', 0, ['estudo']);
    expect(bairro(m, 'ribeirinha').estimativa!.cobertura).toBeGreaterThan(0);
    // Ponto cego é AUSÊNCIA, não zero. No porte isto mudou de propósito: antes
    // vinha uma estimativa com `cobertura: 0` e todos os números zerados, e ela
    // atravessava até a tela — onde imprimiria "0 pessoas em risco no Morro
    // Alto" com a verdade sendo "não sabemos". É a mesma distinção que separa
    // `zero` de `none` no relatório do professor, e agora o cliente é
    // estruturalmente incapaz de confundir as duas.
    expect(bairro(m, 'morroalto').estimativa).toBeNull();
  });

  it('tempo de deslocamento só existe com a malha viária carregada', () => {
    expect(bairro(montarMapa('s1', 0, ['censo']), 'ribeirinha').tempos).toBeNull();
    expect(bairro(montarMapa('s1', 0, ['viaria']), 'ribeirinha').tempos).toEqual({
      alfa: 41,
      bravo: 12,
    });
  });

  it('o que não foi carregado é rastreável — é a peça final do Resultado', () => {
    expect(naoCarregados([])).toHaveLength(CONJUNTOS.length);
    expect(naoCarregados(['censo'])).toHaveLength(CONJUNTOS.length - 1);
  });
});
