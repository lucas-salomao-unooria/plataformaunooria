import { ENGINE_CONFIG_DEFAULT, PERFIS, type Perfil } from '../src/comum/insta/defaults';
import {
  calcularBolha,
  calcularImersao,
  calcularInvestigacao,
  calcularPerfilObservado,
  calcularRitmo,
  calcularTempo,
  PISO_OCIOSIDADE_MS,
  type EventoDeTelemetria,
  type MetaDePost,
} from '../src/dossie/telemetria';
import { normalizarEstado } from '../src/motor/estado';
import type { EngineState } from '../src/motor/tipos';

/**
 * M8 — o relatório do estudante (doc 02 fase 6, doc 11 §3).
 *
 * O teste central aqui é o da **normalização por exposição**. Sem ele, o
 * relatório diria "o feed acertou seu perfil" sempre — porque o feed serve mais
 * posts do perfil do jogo, o estudante naturalmente para mais neles, e a conclusão se
 * autoconfirma. Uma profecia autorrealizável escrita com dados reais é o pior
 * tipo de mentira que este projeto pode contar.
 */

const CONFIG = ENGINE_CONFIG_DEFAULT;
const T0 = 1_700_000_000_000;

/** Monta um estado com dwell por post e exposição por perfil controlados. */
function estadoCom(opcoes: {
  dwellPorPost?: Record<string, number>;
  exposicaoPorPerfil?: Record<string, number>;
  baselineDwellMs?: number | null;
  servedPostIds?: string[];
  postsConsumidos?: string[];
  blocosServidos?: string[][];
}): EngineState {
  return normalizarEstado({
    ...opcoes,
    baselineDwellMs: opcoes.baselineDwellMs ?? 3_000,
    servedPostIds: opcoes.servedPostIds ?? Object.keys(opcoes.dwellPorPost ?? {}),
  });
}

function entrada(opcoes: {
  estado: EngineState;
  porId: Map<string, MetaDePost>;
  eventos?: EventoDeTelemetria[];
  ladoInicial?: 'A' | 'B';
  ladoOrigem?: string;
  startedAt?: Date;
  finishedAt?: Date | null;
}) {
  return {
    eventos: opcoes.eventos ?? [],
    estado: opcoes.estado,
    config: CONFIG,
    porId: opcoes.porId,
    run: {
      startedAt: opcoes.startedAt ?? new Date(T0),
      finishedAt: opcoes.finishedAt ?? new Date(T0 + 600_000),
      ladoInicial: opcoes.ladoInicial ?? 'A',
      ladoOrigem: opcoes.ladoOrigem ?? 'perfil',
    },
  };
}

/** n posts por perfil, todos do lado informado. */
function catalogoPorPerfil(porPerfil: Record<Perfil, number>, lado = 'A'): Map<string, MetaDePost> {
  const mapa = new Map<string, MetaDePost>();
  for (const perfil of PERFIS) {
    for (let i = 0; i < (porPerfil[perfil] ?? 0); i += 1) {
      mapa.set(`${perfil}-${i}`, { lado, perfil, intensidade: 1 });
    }
  }
  return mapa;
}

describe('perfil observado: a normalização pela exposição', () => {
  /**
   * O cenário que o doc 08 M8 manda provar: **muda a exposição, não muda o
   * veredito**. Aqui o feed serve 20 posts de `abertura` e 4 de `autopromocao`,
   * mas o estudante para o MESMO tempo médio em cada um — 3s por post.
   */
  it('exposição desigual com dwell médio igual NÃO elege um dominante', () => {
    const porId = catalogoPorPerfil({
      abertura: 20,
      autopromocao: 4,
      autotranscendencia: 4,
      conservacao: 4,
    });

    const dwellPorPost: Record<string, number> = {};
    for (const id of porId.keys()) dwellPorPost[id] = 3_000;

    const estado = estadoCom({
      dwellPorPost,
      exposicaoPorPerfil: { abertura: 20, autopromocao: 4, autotranscendencia: 4, conservacao: 4 },
    });

    const observado = calcularPerfilObservado(entrada({ estado, porId }), 'abertura');

    // Cada perfil fica com 1/4 da atenção normalizada, apesar de 5× mais posts.
    for (const perfil of PERFIS) expect(observado.normalizado[perfil]).toBeCloseTo(0.25, 3);
    expect(observado.dominante).toBeNull();
    expect(observado.veredito).toBe('sem_referencia');
  });

  /** Sem a normalização, este mesmo cenário elegeria `abertura` por goleada. */
  it('a soma crua de dwell elegeria o perfil mais exposto — e é isso que a divisão evita', () => {
    const porId = catalogoPorPerfil({
      abertura: 20,
      autopromocao: 4,
      autotranscendencia: 4,
      conservacao: 4,
    });
    const somaCrua: Record<string, number> = { abertura: 0, autopromocao: 0, autotranscendencia: 0, conservacao: 0 };
    for (const meta of porId.values()) somaCrua[meta.perfil] = (somaCrua[meta.perfil] ?? 0) + 3_000;

    expect(somaCrua.abertura).toBe(60_000);
    expect(somaCrua.autopromocao).toBe(12_000);
    // 5× mais dwell bruto, mesma atenção por post: é a diferença entre "recebeu
    // mais" e "prendeu mais".
    expect(somaCrua.abertura! / somaCrua.autopromocao!).toBe(5);
  });

  it('muda o DWELL por perfil e o veredito muda', () => {
    const porId = catalogoPorPerfil({
      abertura: 8,
      autopromocao: 8,
      autotranscendencia: 8,
      conservacao: 8,
    });
    const exposicaoPorPerfil = { abertura: 8, autopromocao: 8, autotranscendencia: 8, conservacao: 8 };

    const dwellNeutro: Record<string, number> = {};
    for (const id of porId.keys()) dwellNeutro[id] = 3_000;

    // Mesma exposição, mas ele para 4× mais nos posts de `autopromocao`.
    const dwellInclinado = { ...dwellNeutro };
    for (const [id, meta] of porId) if (meta.perfil === 'autopromocao') dwellInclinado[id] = 12_000;

    const igual = calcularPerfilObservado(
      entrada({ estado: estadoCom({ dwellPorPost: dwellNeutro, exposicaoPorPerfil }), porId }),
      'abertura',
    );
    const inclinado = calcularPerfilObservado(
      entrada({ estado: estadoCom({ dwellPorPost: dwellInclinado, exposicaoPorPerfil }), porId }),
      'abertura',
    );

    expect(igual.dominante).toBeNull();
    expect(inclinado.dominante).toBe('autopromocao');
    expect(inclinado.veredito).toBe('divergiu');
  });

  it('reforçou quando o observado bate com o do jogo', () => {
    const porId = catalogoPorPerfil({ abertura: 8, autopromocao: 8, autotranscendencia: 8, conservacao: 8 });
    const exposicaoPorPerfil = { abertura: 8, autopromocao: 8, autotranscendencia: 8, conservacao: 8 };
    const dwellPorPost: Record<string, number> = {};
    for (const [id, meta] of porId) dwellPorPost[id] = meta.perfil === 'conservacao' ? 12_000 : 3_000;

    const observado = calcularPerfilObservado(
      entrada({ estado: estadoCom({ dwellPorPost, exposicaoPorPerfil }), porId }),
      'conservacao',
    );

    expect(observado.dominante).toBe('conservacao');
    expect(observado.veredito).toBe('reforcou');
  });

  it('perfil `misto` no jogo nunca produz veredito', () => {
    const porId = catalogoPorPerfil({ abertura: 8, autopromocao: 8, autotranscendencia: 8, conservacao: 8 });
    const dwellPorPost: Record<string, number> = {};
    for (const [id, meta] of porId) dwellPorPost[id] = meta.perfil === 'abertura' ? 12_000 : 3_000;

    const observado = calcularPerfilObservado(
      entrada({
        estado: estadoCom({
          dwellPorPost,
          exposicaoPorPerfil: { abertura: 8, autopromocao: 8, autotranscendencia: 8, conservacao: 8 },
        }),
        porId,
      }),
      'misto',
    );

    expect(observado.dominante).toBe('abertura');
    expect(observado.veredito).toBe('sem_referencia');
  });

  it('perfil sem exposição não vira dominante por divisão por zero', () => {
    const porId = catalogoPorPerfil({ abertura: 4, autopromocao: 0, autotranscendencia: 0, conservacao: 0 });
    const dwellPorPost: Record<string, number> = {};
    for (const id of porId.keys()) dwellPorPost[id] = 5_000;

    const observado = calcularPerfilObservado(
      entrada({
        estado: estadoCom({ dwellPorPost, exposicaoPorPerfil: { abertura: 4 } }),
        porId,
      }),
      'abertura',
    );

    expect(observado.normalizado.abertura).toBe(1);
    expect(observado.normalizado.autopromocao).toBe(0);
    expect(observado.dominante).toBe('abertura');
  });
});

describe('bolha: virou o jogo ou não', () => {
  /**
   * `blocos` recebe CONTAGEM de posts por lado, e a virada é lida do acumulado —
   * é o acumulado que o motor usa como domínio (doc 11 §3.5).
   */
  const contagens = (blocos: [number, number][]) =>
    blocos.map(([A, B], indice) => ({ bloco: indice + 1, A, B }));

  const base = (ladoInicial: 'A' | 'B' = 'A') =>
    entrada({ estado: estadoCom({}), porId: new Map(), ladoInicial });

  it('não inverteu quando termina no lado semeado', () => {
    const bolha = calcularBolha(base('A'), 'A', contagens([[6, 2], [6, 2], [6, 2]]));
    expect(bolha.inverteu).toBe(false);
    expect(bolha.blocoDaInversao).toBeNull();
  });

  it('a virada é o bloco em que o ACUMULADO troca de lado', () => {
    // 4 posts por bloco: B lidera nos dois primeiros, A assume no terceiro.
    const bolha = calcularBolha(base('B'), 'A', contagens([[1, 3], [2, 2], [4, 0], [4, 0]]));
    expect(bolha.inverteu).toBe(true);
    expect(bolha.blocoDaInversao).toBe(3);
  });

  /**
   * A regressão que a validação de duas sessões opostas encontrou: o último bloco
   * da sessão costuma ter 2 posts, e um bloco-cauda do lado semeado apagava a
   * inversão de uma sessão que havia virado no bloco 3.
   */
  it('bloco-cauda pequeno do lado semeado não apaga a inversão', () => {
    const bolha = calcularBolha(
      base('B'),
      'A',
      contagens([[1, 3], [2, 2], [4, 0], [4, 0], [2, 1], [0, 2]]),
    );
    expect(bolha.inverteu).toBe(true);
    expect(bolha.blocoDaInversao).toBe(3);
  });

  it('liderança que volta para o lado semeado não conta como virada', () => {
    // Acumulado: B, empate, A, B — a virada que vale é a última, não a primeira.
    const bolha = calcularBolha(base('A'), 'B', contagens([[0, 4], [4, 0], [4, 0], [0, 8]]));
    expect(bolha.inverteu).toBe(true);
    expect(bolha.blocoDaInversao).toBe(4);
  });

  it('feed que termina sem lado dominante não é inversão', () => {
    const bolha = calcularBolha(base('A'), 'indefinido', contagens([[4, 4], [4, 4]]));
    expect(bolha.inverteu).toBe(false);
    expect(bolha.blocoDaInversao).toBeNull();
  });

  it('carrega a origem do lado, que é o que a explicabilidade precisa', () => {
    const sorteado = entrada({
      estado: estadoCom({}),
      porId: new Map(),
      ladoInicial: 'B',
      ladoOrigem: 'sorteio',
    });
    expect(calcularBolha(sorteado, 'B', contagens([[2, 6]])).ladoOrigem).toBe('sorteio');
  });
});

describe('tempo e ritmo (doc 11 §3.1 e §3.2)', () => {
  const porId = new Map<string, MetaDePost>([
    ['a1', { lado: 'A', perfil: 'abertura', intensidade: 1 }],
    ['b1', { lado: 'B', perfil: 'conservacao', intensidade: 1 }],
    ['n1', { lado: 'neutro', perfil: 'abertura', intensidade: 1 }],
  ]);

  it('tempo por lado sai do dwell acumulado, incluindo revisita', () => {
    const tempo = calcularTempo(
      entrada({
        estado: estadoCom({ dwellPorPost: { a1: 9_000, b1: 2_000, n1: 4_000 } }),
        porId,
      }),
    );

    expect(tempo.porLadoMs).toEqual({ A: 9_000, B: 2_000, neutro: 4_000 });
    expect(tempo.porPerfilMs.abertura).toBe(13_000);
    expect(tempo.porPerfilMs.conservacao).toBe(2_000);
  });

  it('vão maior que o piso de 20s vira ocioso e sai do tempo ativo', () => {
    const eventos: EventoDeTelemetria[] = [
      { tipo: 'visto', postId: 'a1', payload: null, clientTs: T0 },
      { tipo: 'visto', postId: 'b1', payload: null, clientTs: T0 + 5_000 },
      // 40s de vão: o estudante olhou para outro lugar da sala.
      { tipo: 'visto', postId: 'n1', payload: null, clientTs: T0 + 45_000 },
    ];

    const tempo = calcularTempo(entrada({ estado: estadoCom({}), porId, eventos }));

    expect(tempo.feedMs).toBe(45_000);
    expect(tempo.vaosOciosos).toBe(1);
    expect(tempo.ociosoMs).toBe(40_000);
    expect(tempo.ativoMs).toBe(5_000);
  });

  it('vão logo abaixo do piso não é ociosidade (ler legenda longa não é distração)', () => {
    const eventos: EventoDeTelemetria[] = [
      { tipo: 'visto', postId: 'a1', payload: null, clientTs: T0 },
      { tipo: 'visto', postId: 'b1', payload: null, clientTs: T0 + PISO_OCIOSIDADE_MS - 1 },
    ];
    const tempo = calcularTempo(entrada({ estado: estadoCom({}), porId, eventos }));

    expect(tempo.vaosOciosos).toBe(0);
    expect(tempo.ativoMs).toBe(PISO_OCIOSIDADE_MS - 1);
  });

  it('o tempo antes do primeiro post não conta como ociosidade', () => {
    const eventos: EventoDeTelemetria[] = [
      // 2 min lendo o cartão de missão — não é distração, é a missão.
      { tipo: 'trocou_aba', postId: null, payload: { aba: 'feed' }, clientTs: T0 },
      { tipo: 'visto', postId: 'a1', payload: null, clientTs: T0 + 120_000 },
      { tipo: 'visto', postId: 'b1', payload: null, clientTs: T0 + 125_000 },
    ];
    const tempo = calcularTempo(entrada({ estado: estadoCom({}), porId, eventos }));

    expect(tempo.vaosOciosos).toBe(0);
    expect(tempo.feedMs).toBe(5_000);
  });

  it('ritmo regular tem variação baixa; ritmo errático tem variação alta', () => {
    const marcas = (intervalos: number[]) => {
      let agora = T0;
      return intervalos.map((intervalo) => {
        agora += intervalo;
        return { tipo: 'visto', postId: 'a1', payload: null, clientTs: agora } as EventoDeTelemetria;
      });
    };

    const regular = calcularRitmo(
      entrada({ estado: estadoCom({}), porId, eventos: marcas([5_000, 5_000, 5_000, 5_000]) }),
      { sessaoMs: 0, feedMs: 20_000, ativoMs: 20_000, ociosoMs: 0, vaosOciosos: 0, porLadoMs: { A: 0, B: 0, neutro: 0 }, porPerfilMs: {} },
    );
    const erratico = calcularRitmo(
      entrada({ estado: estadoCom({}), porId, eventos: marcas([1_000, 15_000, 1_000, 15_000]) }),
      { sessaoMs: 0, feedMs: 32_000, ativoMs: 32_000, ociosoMs: 0, vaosOciosos: 0, porLadoMs: { A: 0, B: 0, neutro: 0 }, porPerfilMs: {} },
    );

    expect(regular.variacaoDoRitmo).toBe(0);
    expect(erratico.variacaoDoRitmo).toBeGreaterThan(0.5);
  });
});

describe('investigação (doc 11 §3.4)', () => {
  const porId = new Map<string, MetaDePost>([
    ['a1', { lado: 'A', perfil: 'abertura', intensidade: 1 }],
    ['b1', { lado: 'B', perfil: 'conservacao', intensidade: 1 }],
    ['b2', { lado: 'B', perfil: 'conservacao', intensidade: 1 }],
  ]);

  it('conta busca, termos e posts abertos de lá', () => {
    const eventos: EventoDeTelemetria[] = [
      { tipo: 'abriu_busca', postId: null, payload: { aba: 'busca' }, clientTs: T0 },
      { tipo: 'buscou', postId: null, payload: { termo: 'Tordesilhas' }, clientTs: T0 + 1 },
      { tipo: 'buscou', postId: null, payload: { termo: 'tempestade' }, clientTs: T0 + 2 },
      { tipo: 'abriu_da_busca', postId: 'b1', payload: null, clientTs: T0 + 3 },
    ];

    const investigacao = calcularInvestigacao(
      entrada({ estado: estadoCom({ dwellPorPost: { a1: 1_000 } }), porId, eventos }),
    );

    expect(investigacao.usosDaBusca).toBe(1);
    expect(investigacao.termosBuscados).toEqual(['Tordesilhas', 'tempestade']);
    expect(investigacao.postsPelaBusca).toBe(1);
  });

  /**
   * A distinção que o doc 11 chama de "ver × considerar". Dois posts do lado
   * oposto: num ele rolou reto, no outro parou 8s (baseline 3s → 2,7×).
   */
  it('consideração do oposto só conta parada de verdade', () => {
    const investigacao = calcularInvestigacao(
      entrada({
        estado: estadoCom({
          dwellPorPost: { a1: 3_000, b1: 8_000, b2: 900 },
          baselineDwellMs: 3_000,
        }),
        porId,
        ladoInicial: 'A',
      }),
    );

    expect(investigacao.consideracaoDoOposto).toBe(1);
    expect(investigacao.coberturaDosLados.B.posts).toBe(2);
    expect(investigacao.coberturaDosLados.B.segundos).toBeCloseTo(8.9, 1);
  });
});

describe('imersão (doc 11 §3.3)', () => {
  const porId = new Map<string, MetaDePost>(
    Array.from({ length: 10 }, (_, i) => [`p${i}`, { lado: 'A', perfil: 'abertura', intensidade: 1 }]),
  );

  const tempoCheio = {
    sessaoMs: 600_000,
    feedMs: 600_000,
    ativoMs: 600_000,
    ociosoMs: 0,
    vaosOciosos: 0,
    porLadoMs: { A: 0, B: 0, neutro: 0 },
    porPerfilMs: {},
  };

  it('os 5 componentes vêm sempre separados, e o total é a soma deles', () => {
    const imersao = calcularImersao(entrada({ estado: estadoCom({}), porId }), tempoCheio);

    expect(imersao.componentes.map((c) => c.chave)).toEqual([
      'continuidade',
      'atencao',
      'gestos',
      'voluntariedade',
      'exploracao',
    ]);
    expect(imersao.total).toBeCloseTo(
      imersao.componentes.reduce((soma, c) => soma + c.pontos, 0),
      1,
    );
  });

  it('nenhum componente passa de 20, mesmo martelando uma dimensão só', () => {
    const eventos: EventoDeTelemetria[] = Array.from({ length: 80 }, (_, i) => ({
      tipo: 'duplo_toque',
      postId: 'p0',
      payload: null,
      clientTs: T0 + i * 1_000,
    }));

    const imersao = calcularImersao(entrada({ estado: estadoCom({}), porId, eventos }), tempoCheio);
    const gestos = imersao.componentes.find((c) => c.chave === 'gestos');

    expect(gestos?.pontos).toBe(20);
    expect(imersao.total).toBeLessThanOrEqual(100);
  });

  it('perda de foco desconta continuidade e nunca fica negativa', () => {
    const eventos: EventoDeTelemetria[] = Array.from({ length: 30 }, (_, i) => ({
      tipo: 'perdeu_foco',
      postId: null,
      payload: null,
      clientTs: T0 + i * 30_000,
    }));
    /**
     * O `visto` no fim não é enfeite: ele DELIMITA o feed. Só descontam as
     * perdas de foco de dentro dele — sem um post visto, não houve feed, e
     * trinta saídas de tela durante a reflexão não dizem nada sobre a atenção
     * que ele deu ao que o algoritmo serviu.
     */
    eventos.push({ tipo: 'visto', postId: 'p0', payload: { dwellMs: 3000 }, clientTs: T0 + 30 * 30_000 });

    const imersao = calcularImersao(entrada({ estado: estadoCom({}), porId, eventos }), tempoCheio);
    const continuidade = imersao.componentes.find((c) => c.chave === 'continuidade');

    expect(continuidade?.pontos).toBe(0);
  });

  it('perda de foco DEPOIS do feed não desconta nada', () => {
    /**
     * O buffer de eventos vive enquanto a run vive: durante o debate, a
     * explicação e a reflexão — mais de metade do roteiro de 100 min — cada
     * `hub:pause` ainda registra `perdeu_foco`. Descontá-las fazia a imersão da
     * turma derreter conforme a AULA avançava, e o painel mostrava isso como
     * adolescente desengajando.
     */
    const noFeed: EventoDeTelemetria[] = [
      { tipo: 'visto', postId: 'p0', payload: { dwellMs: 3000 }, clientTs: T0 },
      { tipo: 'visto', postId: 'p1', payload: { dwellMs: 3000 }, clientTs: T0 + 20_000 },
    ];
    const depois: EventoDeTelemetria[] = Array.from({ length: 8 }, (_, i) => ({
      tipo: 'perdeu_foco',
      postId: null,
      payload: null,
      clientTs: T0 + 600_000 + i * 60_000,
    }));

    const so = calcularImersao(entrada({ estado: estadoCom({}), porId, eventos: noFeed }), tempoCheio);
    const com = calcularImersao(
      entrada({ estado: estadoCom({}), porId, eventos: [...noFeed, ...depois] }),
      tempoCheio,
    );

    const pontos = (imersao: typeof so) =>
      imersao.componentes.find((c) => c.chave === 'continuidade')?.pontos;

    expect(pontos(com)).toBe(pontos(so));
  });

  it('exploração conta superfícies distintas, não repetições', () => {
    const umaSuperficie: EventoDeTelemetria[] = Array.from({ length: 12 }, (_, i) => ({
      tipo: 'abriu_busca',
      postId: null,
      payload: null,
      clientTs: T0 + i * 1_000,
    }));
    const quatroSuperficies: EventoDeTelemetria[] = [
      { tipo: 'abriu_busca', postId: null, payload: null, clientTs: T0 },
      { tipo: 'abriu_story', postId: 'p0', payload: null, clientTs: T0 + 1 },
      { tipo: 'abriu_perfil', postId: null, payload: null, clientTs: T0 + 2 },
      { tipo: 'trocou_aba', postId: null, payload: { aba: 'notificacoes' }, clientTs: T0 + 3 },
    ];

    const pontosDe = (eventos: EventoDeTelemetria[]) =>
      calcularImersao(entrada({ estado: estadoCom({}), porId, eventos }), tempoCheio).componentes.find(
        (c) => c.chave === 'exploracao',
      )?.pontos;

    expect(pontosDe(umaSuperficie)).toBe(4);
    expect(pontosDe(quatroSuperficies)).toBe(16);
  });

  it('atenção mede posts acima do ritmo DELE, não de um número fixo', () => {
    const dwellPorPost: Record<string, number> = {};
    for (const [indice, id] of [...porId.keys()].entries()) dwellPorPost[id] = indice < 7 ? 5_000 : 500;

    // Baseline 3s: 7 de 10 posts acima de 1,0 → teto do componente.
    const rapido = calcularImersao(
      entrada({ estado: estadoCom({ dwellPorPost, baselineDwellMs: 3_000 }), porId }),
      tempoCheio,
    );
    // Mesmo comportamento, estudante mais lento (baseline 8s): nenhum post acima.
    const lento = calcularImersao(
      entrada({ estado: estadoCom({ dwellPorPost, baselineDwellMs: 8_000 }), porId }),
      tempoCheio,
    );

    expect(rapido.componentes.find((c) => c.chave === 'atencao')?.pontos).toBe(20);
    expect(lento.componentes.find((c) => c.chave === 'atencao')?.pontos).toBe(0);
  });
});
