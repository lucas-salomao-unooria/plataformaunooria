import { MISSAO_TEMPESTADE as M } from '../../src/unoogpt/cenario';
import { CONJUNTOS } from '../../src/unoogpt/modelo/conjuntos';

/**
 * O teste mais importante da Missão: prova que os dados NÃO entregam a
 * estratégia pronta.
 *
 * Se qualquer bairro vencer em todas as réguas e couber no prazo, a atividade
 * vira ordenar uma tabela — e perguntar melhor deixa de mudar a resposta, que é
 * a única coisa que a Missão tem para ensinar.
 */
const PRAZO_MIN = 40; // chegar até 17h40 para conseguir evacuar
const b = (slug: string) => M.bairros.find((x) => x.slug === slug)!;

/** Bairros que cada base alcança dentro do prazo E antes da via fechar. */
function alcance(base: 'alfa' | 'bravo') {
  return M.bairros.filter((x) => {
    const minutos = base === 'alfa' ? x.tA : x.tB;
    if (minutos > PRAZO_MIN) return false;
    // Via com horário de bloqueio: "17h20" => 20 minutos após a decisão.
    const bloqueio = x.via.match(/(\d{2})h(\d{2})/);
    if (bloqueio) {
      const limite = (Number(bloqueio[1]) - 17) * 60 + Number(bloqueio[2]);
      if (minutos > limite) return false;
    }
    return true;
  });
}

describe('invariante: os dados não entregam a estratégia', () => {
  it('os dois bairros com mais gente exposta ficam no alcance da MESMA equipe', () => {
    const porExpostos = [...M.bairros].sort((x, y) => y.exp - x.exp).slice(0, 2);
    const deBravo = alcance('bravo').map((x) => x.slug);
    for (const x of porExpostos) expect(deBravo).toContain(x.slug);

    const deAlfa = alcance('alfa').map((x) => x.slug);
    // ...e fora do alcance da outra: uma equipe não cobre os dois.
    for (const x of porExpostos) expect(deAlfa).not.toContain(x.slug);
  });

  it('cada equipe tem bairros que só ela alcança', () => {
    // Sobreposição parcial é boa: cria escolhas de fronteira, onde as duas
    // equipes podem ir ao mesmo lugar e uma delas estaria desperdiçada. O que
    // não pode é uma equipe cobrir tudo.
    const a = alcance('alfa').map((x) => x.slug);
    const bs = alcance('bravo').map((x) => x.slug);
    const soAlfa = a.filter((s) => !bs.includes(s));
    const soBravo = bs.filter((s) => !a.includes(s));
    expect(soAlfa.length).toBeGreaterThan(0);
    expect(soBravo.length).toBeGreaterThan(0);
    expect(a.length).toBeLessThan(M.bairros.length);
    expect(bs.length).toBeLessThan(M.bairros.length);
  });

  it('nenhum bairro vence em todas as réguas', () => {
    const reguas = [
      (x: (typeof M.bairros)[number]) => x.exp, // mais gente atingida
      (x: (typeof M.bairros)[number]) => x.vexp, // mais gente que não sai sozinha
      (x: (typeof M.bairros)[number]) => x.danos, // mais prejuízo material
      (x: (typeof M.bairros)[number]) => x.alag, // maior chance de alagar
    ];
    const campeoes = reguas.map((r) => [...M.bairros].sort((x, y) => r(y) - r(x))[0]!.slug);
    expect(new Set(campeoes).size).toBeGreaterThan(1);
  });

  it('a régua muda quem é o pior bairro do lado sul', () => {
    // O aluno que só olha exposição escolhe Ribeirinha; quem olha granizo e
    // abrigo escolhe Morro Alto. Nenhum dos dois está errado — e é esse o ponto.
    expect(b('ribeirinha').exp).toBeGreaterThan(b('morroalto').exp);
    expect(b('morroalto').granizo).toBe('Severo');
    expect(b('morroalto').equipamentos).toMatch(/nenhum abrigo/);
    expect(b('morroalto').danos).toBeGreaterThan(b('ribeirinha').danos);
  });

  it('o número que decidiria a comparação vem do conjunto mais defasado', () => {
    // A exposição do Morro Alto sai do cadastro de 2023, anterior à ocupação da
    // encosta: comparar com a Ribeirinha é comparar medida com contagem velha.
    const censo = CONJUNTOS.find((c) => c.slug === 'censo')!;
    expect(censo.vies.morroalto).toBeLessThan(0.6);
    expect(censo.instrucao).toMatch(/Morro Alto/);
  });
});
