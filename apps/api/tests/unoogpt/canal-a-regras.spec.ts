import { aleatorioDe } from '../../src/evidencias/regras';
import { AGREGACAO, deveMarcar } from '../../src/unoogpt/regras/agregacao';
import {
  PARTES_DO_ALERTA,
  bairrosSemEquipe,
  enunciadoDoAlerta,
  montarAlerta,
  nivelDoAlerta,
  type RespostasDoAlerta,
} from '../../src/unoogpt/regras/alerta';
import { TAREFAS } from '../../src/unoogpt/regras/canal-a';
import {
  CELULAS,
  FONTES_DA_TAREFA,
  IDS_DAS_PERGUNTAS,
  bairrosQueDistorcem,
  montarCartoes,
  nivelDosCartoes,
} from '../../src/unoogpt/regras/cartoes-das-fontes';
import { IDS_DO_E_SE, gabaritoDe, montarComparacoes, nivelDoESe } from '../../src/unoogpt/regras/e-se';
import {
  CRUZAM,
  montarPares,
  nivelDaLeitura,
  perguntaDoPar,
  type LinhaDaLeitura,
} from '../../src/unoogpt/regras/leitura-dos-pares';
import {
  CERTA,
  PARTES_DA_MORADORA,
  bairroDaMoradora,
  fraseDosDados,
  montarMoradora,
  nivelDaMoradora,
  perfilDaMoradora,
  QUEM_COM_IA,
  QUEM_SEM_IA,
  type RespostasDaMoradora,
} from '../../src/unoogpt/regras/moradora';
import { CONTAGEM_DA_SAUDE, OPCOES_DA_SAUDE, entregaDaSaude, nivelDaSaude } from '../../src/unoogpt/regras/saude';
import { IDS_DA_RESPOSTA, IDS_DO_AVISO, nivelDoWhatsapp } from '../../src/unoogpt/regras/whatsapp';

const BAIRROS = ['ribeirinha', 'valeverde', 'morroalto', 'industrial'];
const contar = <T extends string>(xs: readonly (T | null)[]) =>
  xs.reduce<Record<string, number>>((acc, x) => ({ ...acc, [x ?? 'sem']: (acc[x ?? 'sem'] ?? 0) + 1 }), {});

describe('a Saúde: 4 opções, teto em "em desenvolvimento"', () => {
  it('conferência: cada opção cai num nível, nenhuma dá "demonstra"', () => {
    expect(contar(OPCOES_DA_SAUDE.map((o) => nivelDaSaude(o.id)))).toEqual({ em_processo: 1, nao_atingiu: 3 });
    expect(nivelDaSaude(null)).toBeNull();
  });

  it('a contagem chega a quem pediu a contagem ou uma lista; o aviso, só a quem pediu lista', () => {
    expect(CONTAGEM_DA_SAUDE.map((c) => c.pessoas)).toEqual([2150, 980, 850, 190]);
    expect(entregaDaSaude('nada')).toEqual({ contagem: null, aviso: null });
    expect(entregaDaSaude('contagem').aviso).toBeNull();
    expect(entregaDaSaude('lista-completa').aviso).toBe('Chegaram nomes e endereços de 4.170 pessoas, que agora ficam no sistema.');
    expect(entregaDaSaude('lista-apagada').contagem).toHaveLength(4);
  });
});

describe('o WhatsApp: 4 × 3', () => {
  it('conferência: 12 casas — 1 demonstra, 5 em desenvolvimento, 6 não demonstra', () => {
    const niveis = IDS_DA_RESPOSTA.flatMap((r) => IDS_DO_AVISO.map((a) => nivelDoWhatsapp(r, a)));
    expect(niveis).toHaveLength(12);
    expect(contar(niveis)).toEqual({ atingiu: 1, em_processo: 5, nao_atingiu: 6 });
    expect(nivelDoWhatsapp('nenhum-dado', 'coordenacao')).toBe('atingiu');
    expect(nivelDoWhatsapp('nenhum-dado', 'ignora')).toBe('em_processo');
    expect(nivelDoWhatsapp('lista-se-provar', 'coordenacao')).toBe('nao_atingiu');
  });
});

describe('o alerta: 4 × 4 × 4', () => {
  it('conferência: 64 combinações — 1 demonstra, 9 em desenvolvimento, 54 não demonstra', () => {
    const [f, t, c] = PARTES_DO_ALERTA;
    const niveis = f.opcoes.flatMap((a) =>
      t.opcoes.flatMap((b) =>
        c.opcoes.map((d) => nivelDoAlerta({ frequencia: a.id, tom: b.id, conteudo: d.id } as RespostasDoAlerta)),
      ),
    );
    expect(contar(niveis)).toEqual({ atingiu: 1, em_processo: 9, nao_atingiu: 54 });
  });

  it('cada parte tem uma certa, duas extremas e uma moderada; a apresentação embaralha', () => {
    for (const p of PARTES_DO_ALERTA) expect(p.opcoes.filter((o) => o.certa)).toHaveLength(1);
    const ordens = new Set(
      Array.from({ length: 20 }, (_, i) => montarAlerta(['valeverde'], aleatorioDe(`a${i}`)).partes[0]!.ordem.join()),
    );
    expect(ordens.size).toBeGreaterThan(1);
  });

  it('o enunciado nomeia os bairros sem equipe', () => {
    expect(bairrosSemEquipe({ alfa: 'ribeirinha', bravo: 'morroalto' })).toEqual(['valeverde', 'industrial']);
    expect(enunciadoDoAlerta(['valeverde', 'industrial'])).toMatch(/^Vale Verde e Industrial ficaram sem equipe/);
  });
});

describe('a moradora: 4 perfis, 3⁴ por perfil', () => {
  it('conferência: 81 combinações — 1, 8, 72', () => {
    const op = ['certa', 'x', 'y'];
    const niveis = op.flatMap((a) =>
      op.flatMap((b) =>
        op.flatMap((c) => op.map((d) => nivelDaMoradora({ dados: a, criterio: b, quem: c, contestar: d }))),
      ),
    );
    expect(contar(niveis)).toEqual({ atingiu: 1, em_processo: 8, nao_atingiu: 72 });
  });

  it('o perfil sai do que o grupo fez, e a frase certa é verdadeira para ele', () => {
    expect(perfilDaMoradora({ justificativas: ['censo', 'sensores'], conjuntos: ['censo', 'sensores'] })).toEqual({
      perfil: 'citou',
      citadas: ['censo', 'sensores'],
    });
    expect(perfilDaMoradora({ justificativas: ['censo', 'intuicao'], conjuntos: ['censo'] }).perfil).toBe('misto');
    expect(perfilDaMoradora({ justificativas: ['intuicao', 'intuicao'], conjuntos: ['censo'] }).perfil).toBe('consultou');
    expect(perfilDaMoradora({ justificativas: ['intuicao', null], conjuntos: [] }).perfil).toBe('sem-dados');

    expect(fraseDosDados('citou', ['censo', 'sensores'], [])).toBe(
      'Para decidir, usei: o cadastro de moradores e as medições do rio.',
    );
    expect(fraseDosDados('misto', ['censo'], [])).toBe(
      'Para decidir, usei o cadastro de moradores e, numa das equipes, a minha avaliação.',
    );
    expect(fraseDosDados('consultou', [], ['previsao'])).toBe('Consultei a previsão do tempo, mas decidi pela minha avaliação.');
  });

  it('cada parte tem exatamente uma frase certa, e "quem decidiu" segue o perfil', () => {
    const comDados = montarMoradora({ bairro: 'valeverde', justificativas: ['censo', 'censo'], conjuntos: ['censo'] }, aleatorioDe('m'));
    const semDados = montarMoradora({ bairro: 'valeverde', justificativas: ['intuicao', 'intuicao'], conjuntos: [] }, aleatorioDe('m'));
    for (const a of [comDados, semDados]) {
      expect(a.partes.map((p) => p.id)).toEqual([...PARTES_DA_MORADORA]);
      for (const p of a.partes) {
        expect(p.opcoes).toHaveLength(3);
        expect(p.opcoes.filter((o) => o.id === CERTA)).toHaveLength(1);
      }
    }
    const quem = (a: typeof comDados) => a.partes.find((p) => p.id === 'quem')!.opcoes.find((o) => o.id === CERTA)!.texto;
    expect(quem(comDados)).toBe(QUEM_COM_IA);
    expect(quem(semDados)).toBe(QUEM_SEM_IA);
    expect(comDados.enunciado).toContain('moradora do Vale Verde');
    expect(nivelDaMoradora({ dados: CERTA, criterio: CERTA, quem: CERTA, contestar: CERTA } as RespostasDaMoradora)).toBe('atingiu');
  });

  it('a moradora é do bairro sem equipe com mais gente em risco', () => {
    expect(
      bairroDaMoradora(['valeverde', 'industrial'], [
        { bairro: 'valeverde', emRisco: 100 },
        { bairro: 'industrial', emRisco: 300 },
      ]),
    ).toBe('industrial');
  });
});

describe('a leitura dos dados: dois pares', () => {
  const linhas: LinhaDaLeitura[] = [
    { bairro: 'ribeirinha', min: 2000, esperado: 2400, max: 2800 },
    { bairro: 'morroalto', min: 1900, esperado: 2200, max: 2500 },
    { bairro: 'industrial', min: 300, esperado: 400, max: 500 },
  ];

  it('monta um par separado e um cruzado, com o gabarito certo', () => {
    const pares = montarPares(linhas, aleatorioDe('l'))!;
    expect(pares).toHaveLength(2);
    const separado = pares.find((p) => p.id === 'separado')!;
    const cruzado = pares.find((p) => p.id === 'cruzado')!;
    expect(separado.gabarito).toBe('ribeirinha');
    expect(new Set(cruzado.bairros)).toEqual(new Set(['ribeirinha', 'morroalto']));
    expect(cruzado.gabarito).toBe(CRUZAM);
    expect(perguntaDoPar(cruzado)).toMatch(/^Pelo que esta tabela mostra, há mais gente em risco (na Ribeirinha|no Morro Alto) ou/);
  });

  it('sem os dois tipos de par, o cartão não aparece', () => {
    expect(montarPares(linhas.slice(0, 2), aleatorioDe('l'))).toBeNull();
    expect(montarPares([linhas[0]!, linhas[2]!], aleatorioDe('l'))).toBeNull();
  });

  it('conferência da régua: 10 combinações, cada uma num nível', () => {
    expect(nivelDaLeitura({ fontes: 0, teveMinuto: true, acertos: null })).toBe('nao_atingiu');
    expect(nivelDaLeitura({ fontes: 0, teveMinuto: false, acertos: null })).toBeNull();
    for (const acertos of [null, 0, 1, 2]) expect(nivelDaLeitura({ fontes: 1, teveMinuto: true, acertos })).toBe('em_processo');
    for (const acertos of [null, 0, 1]) expect(nivelDaLeitura({ fontes: 2, teveMinuto: true, acertos })).toBe('em_processo');
    expect(nivelDaLeitura({ fontes: 3, teveMinuto: true, acertos: 2 })).toBe('atingiu');
  });
});

describe('as fontes: o cartão cai sempre numa célula que distorce ou não enxerga', () => {
  it('toda fonte da tarefa tem pelo menos uma célula que distorce ou não enxerga', () => {
    expect(FONTES_DA_TAREFA).not.toContain('viaria');
    expect(FONTES_DA_TAREFA).toHaveLength(7);
    for (const f of FONTES_DA_TAREFA) expect(bairrosQueDistorcem(f).length).toBeGreaterThan(0);
  });

  it('toda célula que distorce tem pergunta-chave, e nenhuma aceita "nada"', () => {
    for (const f of FONTES_DA_TAREFA) {
      for (const b of BAIRROS) {
        const c = CELULAS[f]![b]!;
        if (c.caso === 'nao-distorce') expect(c.certas).toEqual([]);
        else {
          expect(c.certas.length).toBeGreaterThan(0);
          expect(c.certas).not.toContain('nada');
        }
      }
    }
  });

  it('o cartão real: fonte citada que distorce no bairro da equipe', () => {
    const c = montarCartoes({
      equipes: [
        { equipe: 'alfa', bairro: 'morroalto', justificativa: 'censo' },
        { equipe: 'bravo', bairro: 'ribeirinha', justificativa: 'telefonia' },
      ],
      abertas: ['censo', 'telefonia'],
      leitura: [],
    })!;
    expect(c.map((x) => [x.fonte, x.bairro, x.tipo])).toEqual([
      ['censo', 'morroalto', 'real'],
      ['telefonia', 'ribeirinha', 'real'],
    ]);
    expect(c[0]!.texto).toBe(
      'Equipe Alfa → Morro Alto. Você disse que foi pelo cadastro de moradores. Antes de confiar nessa fonte para o Morro Alto, o que você precisaria saber?',
    );
  });

  it('a célula sem distorção vira hipotética, no bairro que a leitura mostrava com mais gente', () => {
    const c = montarCartoes({
      equipes: [
        { equipe: 'alfa', bairro: 'valeverde', justificativa: 'ocorrencias' },
        { equipe: 'bravo', bairro: 'ribeirinha', justificativa: 'sensores' },
      ],
      abertas: ['ocorrencias', 'sensores'],
      leitura: [
        { bairro: 'ribeirinha', esperado: 1000 },
        { bairro: 'morroalto', esperado: 3000 },
      ],
    })!;
    expect(c[0]).toMatchObject({ fonte: 'ocorrencias', bairro: 'morroalto', tipo: 'hipotetico' });
    expect(c[0]!.texto).toContain('Se fosse usar essa fonte no Morro Alto, o que você precisaria saber?');
  });

  it('intuição: a primeira fonte que o grupo abriu; o mapa de estradas fica fora', () => {
    const c = montarCartoes({
      equipes: [
        { equipe: 'alfa', bairro: 'ribeirinha', justificativa: 'intuicao' },
        { equipe: 'bravo', bairro: 'morroalto', justificativa: 'viaria' },
      ],
      abertas: ['viaria', 'censo', 'telefonia'],
      leitura: [],
    })!;
    expect(c[0]!.texto).toContain('Você foi por intuição. A primeira fonte que o grupo abriu foi o cadastro de moradores.');
    // os dois caem no cadastro no Morro Alto: o segundo vai para a próxima fonte aberta
    expect(c.map((x) => [x.fonte, x.bairro])).toEqual([
      ['censo', 'morroalto'],
      ['telefonia', 'ribeirinha'],
    ]);
    expect(c[1]!.texto).toContain('Outra fonte que o grupo abriu foi o sinal de celular.');
    expect(c.every((x) => x.certas.length > 0)).toBe(true);
  });

  it('os dois pares coincidem: o segundo é a mesma fonte noutro bairro; sem outro, a próxima fonte', () => {
    const mesmoBairro = montarCartoes({
      equipes: [
        { equipe: 'alfa', bairro: 'ribeirinha', justificativa: 'telefonia' },
        { equipe: 'bravo', bairro: 'ribeirinha', justificativa: 'telefonia' },
      ],
      abertas: ['telefonia'],
      leitura: [],
    })!;
    expect(mesmoBairro[1]).toMatchObject({ fonte: 'telefonia', bairro: 'morroalto', tipo: 'segundo' });
    expect(mesmoBairro[1]!.texto).toContain('Se fosse usá-la para o Morro Alto, o que precisaria saber antes?');

    const soUmBairro = montarCartoes({
      equipes: [
        { equipe: 'alfa', bairro: 'morroalto', justificativa: 'censo' },
        { equipe: 'bravo', bairro: 'morroalto', justificativa: 'censo' },
      ],
      abertas: ['censo', 'satelite'],
      leitura: [],
    })!;
    expect(soUmBairro[1]).toMatchObject({ fonte: 'satelite', bairro: 'industrial' });

    expect(
      montarCartoes({
        equipes: [
          { equipe: 'alfa', bairro: 'morroalto', justificativa: 'censo' },
          { equipe: 'bravo', bairro: 'morroalto', justificativa: 'censo' },
        ],
        abertas: ['censo'],
        leitura: [],
      }),
    ).toBeNull();
  });

  it('sem fonte nenhuma além do mapa de estradas, não há cartão', () => {
    expect(
      montarCartoes({
        equipes: [{ equipe: 'alfa', bairro: 'ribeirinha', justificativa: 'intuicao' }, { equipe: 'bravo', bairro: null, justificativa: null }],
        abertas: ['viaria'],
        leitura: [],
      }),
    ).toBeNull();
  });

  it('a régua: dois certos, um, nenhum; sem dois cartões, sem marca', () => {
    const c = montarCartoes({
      equipes: [
        { equipe: 'alfa', bairro: 'morroalto', justificativa: 'censo' },
        { equipe: 'bravo', bairro: 'industrial', justificativa: 'satelite' },
      ],
      abertas: ['censo', 'satelite'],
      leitura: [],
    })!;
    expect(nivelDosCartoes(c, { c1: 'quando', c2: 'conta' })).toBe('atingiu');
    expect(nivelDosCartoes(c, { c1: 'quando', c2: 'nada' })).toBe('em_processo');
    expect(nivelDosCartoes(c, { c1: 'nada', c2: 'quem' })).toBe('nao_atingiu');
    expect(nivelDosCartoes(null, {})).toBeNull();
    expect(IDS_DAS_PERGUNTAS).toHaveLength(5);
  });

  it('com qualquer par de destinos e de fontes abertas, todo cartão aceita só pergunta-chave', () => {
    for (const a of BAIRROS)
      for (const b of BAIRROS)
        for (const fa of FONTES_DA_TAREFA)
          for (const fb of FONTES_DA_TAREFA) {
            const c = montarCartoes({
              equipes: [
                { equipe: 'alfa', bairro: a, justificativa: fa },
                { equipe: 'bravo', bairro: b, justificativa: fb },
              ],
              abertas: [fa, fb],
              leitura: [],
            });
            if (!c) continue;
            expect(c).toHaveLength(2);
            expect(c[0]!.fonte + c[0]!.bairro).not.toBe(c[1]!.fonte + c[1]!.bairro);
            for (const x of c) expect(x.certas.length).toBeGreaterThan(0);
          }
  });
});

describe('o "E se…": uma comparação clara e uma que depende', () => {
  it('o gabarito: 18+ mais, 2- menos, o resto depende', () => {
    expect([20, 18, 17, 3, 2, 0].map((n) => gabaritoDe(n))).toEqual(['mais', 'mais', 'depende', 'depende', 'menos', 'menos']);
  });

  it('acha as duas comparações para as decisões da sala, em várias horas de saída', () => {
    const decisoes = [
      { alfa: 'ribeirinha', bravo: 'morroalto' },
      { alfa: 'industrial', bravo: 'valeverde' },
      { alfa: 'industrial', bravo: 'industrial' },
      { alfa: 'ribeirinha', bravo: null },
    ];
    for (const sua of decisoes) {
      for (const saida of [5, 30, 55]) {
        const c = montarComparacoes(sua, saida, aleatorioDe(`${sua.alfa}${sua.bravo}${saida}`));
        expect(c).not.toBeNull();
        const clara = c!.find((x) => x.id === 'clara')!;
        const depende = c!.find((x) => x.id === 'depende')!;
        expect(clara.quadradinhos).toHaveLength(20);
        expect(['mais', 'menos']).toContain(clara.gabarito);
        expect(depende.gabarito).toBe('depende');
      }
    }
  });

  it('conferência: 9 combinações — 1 demonstra, 2 em desenvolvimento, 6 não demonstra', () => {
    const c = montarComparacoes({ alfa: 'ribeirinha', bravo: 'morroalto' }, 20, aleatorioDe('x'))!;
    const gab = Object.fromEntries(c.map((x) => [x.id, x.gabarito]));
    const niveis = IDS_DO_E_SE.flatMap((a) => IDS_DO_E_SE.map((b) => nivelDoESe(c, { clara: a, depende: b })));
    expect(contar(niveis)).toEqual({ atingiu: 1, em_processo: 2, nao_atingiu: 6 });
    expect(nivelDoESe(c, { clara: gab.clara!, depende: gab.depende! })).toBe('atingiu');
    expect(nivelDoESe(c, {})).toBeNull();
  });
});

describe('a agregação', () => {
  it('cada tarefa tem a sua régua, e só duas são "melhor tentativa"', () => {
    expect(Object.keys(AGREGACAO).sort()).toEqual([...TAREFAS].sort());
    expect(TAREFAS.filter((t) => AGREGACAO[t] === 'melhor-tentativa')).toEqual(['leitura', 'fontes']);
  });

  it('primeira da rodada não marca de novo; melhor tentativa não marca se começou com o relógio fechado', () => {
    expect(deveMarcar('alerta', { jaMarcouNaRodada: true, inicioComRelogioAberto: true })).toBe(false);
    expect(deveMarcar('alerta', { jaMarcouNaRodada: false, inicioComRelogioAberto: false })).toBe(true);
    expect(deveMarcar('leitura', { jaMarcouNaRodada: true, inicioComRelogioAberto: true })).toBe(true);
    expect(deveMarcar('fontes', { jaMarcouNaRodada: false, inicioComRelogioAberto: false })).toBe(false);
  });
});
