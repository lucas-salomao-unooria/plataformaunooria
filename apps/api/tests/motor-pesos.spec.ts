import { aplicarEventos, dominioDe, pontosDeDwell } from '../src/motor/eventos';
import { estadoInicial } from '../src/motor/estado';
import type { EngineState, EventoPontuavel, PostMeta } from '../src/motor/tipos';
import { CONFIG } from './motor-simulador';

/**
 * Tabela de pesos do doc 04 §2, linha por linha, com os LITERAIS da spec.
 * Este arquivo existe porque a bateria anterior passava com "rolou reto"
 * valendo +2 e com `curtiu` valendo 80: nenhum teste afirmava um número.
 */

const BASELINE = 2000;

const POST_A: PostMeta = { id: 'a1', lado: 'A', perfil: 'abertura', intensidade: 1, categoria: 'tema', authorId: 'autor-a', likesCount: 900 };
const POST_B: PostMeta = { id: 'b1', lado: 'B', perfil: 'conservacao', intensidade: 1, categoria: 'tema', authorId: 'autor-b', likesCount: 900 };
const POST_NEUTRO: PostMeta = { id: 'n1', lado: 'neutro', perfil: 'autopromocao', intensidade: 1, categoria: 'animais', authorId: 'autor-n', likesCount: 900 };

const MAPA = new Map([POST_A, POST_B, POST_NEUTRO].map((post) => [post.id, post]));
const AUTORES = new Map<string, 'A' | 'B' | 'neutro'>([
  ['autor-a', 'A'],
  ['autor-b', 'B'],
  ['autor-n', 'neutro'],
]);

/** Estado com baseline já estabelecida, para medir só o sinal sob teste. */
function comBaseline(extra: Partial<EngineState> = {}): EngineState {
  return { ...estadoInicial(), baselineDwellMs: BASELINE, dwellsIniciais: Array(8).fill(BASELINE), ...extra };
}

function aplicar(eventos: Omit<EventoPontuavel, 'id'>[], estadoBase = comBaseline()): EngineState {
  return aplicarEventos(
    estadoBase,
    eventos.map((evento, indice) => ({ ...evento, id: String(indice + 1) })),
    MAPA,
    CONFIG,
    AUTORES,
  );
}

const deltaA = (estado: EngineState) => estado.scoreA;

describe('tabela de pesos do doc 04 §2 — valores literais', () => {
  it.each([
    ['dwellNorm 1.0 vale +1', 1.0 * BASELINE, 1],
    ['dwellNorm 2.2 vale +3', 2.2 * BASELINE, 3],
    ['dwellNorm 3.5 vale +5', 3.5 * BASELINE, 5],
    ['dwellNorm 0.99 vale 0', 0.99 * BASELINE, 0],
    ['dwell bruto abaixo de 1,2s vale −2', 1199, -2],
    ['dwell bruto exatamente 1,2s não é "rolou reto"', 1200, 0],
  ])('%s', (_nome, dwellMs, esperado) => {
    const estado = aplicar([{ tipo: 'visto', postId: 'a1', payload: { dwellMs } }]);
    expect(deltaA(estado)).toBe(esperado);
  });

  it.each([
    ['curtiu', 8],
    ['descurtiu', -8],
    ['abriu_comentarios', 3],
    ['comentou', 12],
    ['compartilhou', 7],
    ['salvou', 6],
    ['nao_interessa', -12],
    ['denunciou', -12],
  ] as const)('%s vale %i', (tipo, esperado) => {
    const estado = aplicar([{ tipo, postId: 'a1', payload: {} }]);
    expect(deltaA(estado)).toBe(esperado);
  });

  it('seguir o autor do post vale +10 exatos (o ×1.3 é para os posts seguintes)', () => {
    const estado = aplicar([{ tipo: 'seguiu', postId: 'a1', payload: {} }]);

    expect(deltaA(estado)).toBe(10);
    expect(estado.followedAuthors).toEqual(['autor-a']);
  });

  it('depois de seguir, os posts daquele autor valem ×1.3', () => {
    const estado = aplicar([
      { tipo: 'seguiu', postId: 'a1', payload: {} },
      { tipo: 'curtiu', postId: 'a1', payload: {} },
    ]);

    expect(deltaA(estado)).toBeCloseTo(10 + 8 * 1.3, 5);
  });

  it('seguir pelo módulo Sugestões (sem postId) vale +10 no lado do perfil', () => {
    const estado = aplicar([{ tipo: 'seguiu', postId: null, payload: { authorId: 'autor-b' } }]);

    expect(estado.scoreB).toBe(10);
    expect(estado.scoreA).toBe(0);
    expect(estado.followedAuthors).toEqual(['autor-b']);
    expect(estado.sinaisPorNivel.B['1']).toBe(1);
  });

  it('rever o post (revisita ≥ 2s) vale +4; abaixo disso, nada', () => {
    const base = comBaseline();
    const revisitaLonga = aplicar(
      [
        { tipo: 'visto', postId: 'a1', payload: { dwellMs: 3000 } },
        { tipo: 'visto', postId: 'a1', payload: { dwellMs: 2000 } },
      ],
      base,
    );
    const revisitaCurta = aplicar(
      [
        { tipo: 'visto', postId: 'a1', payload: { dwellMs: 3000 } },
        { tipo: 'visto', postId: 'a1', payload: { dwellMs: 1999 } },
      ],
      base,
    );

    expect(deltaA(revisitaLonga) - deltaA(revisitaCurta)).toBe(4);
  });

  it('enquete vale +8 no lado da OPÇÃO, mesmo num post do outro lado', () => {
    const estado = aplicar([{ tipo: 'enquete', postId: 'a1', payload: { lado: 'B' } }]);

    expect(estado.scoreB).toBe(8);
    expect(estado.scoreA).toBe(0);
  });

  it('post neutro alimenta o balde da categoria, nunca o eixo A/B', () => {
    const estado = aplicar([
      { tipo: 'visto', postId: 'n1', payload: { dwellMs: 3.5 * BASELINE } },
      { tipo: 'curtiu', postId: 'n1', payload: {} },
    ]);

    expect(estado.scoreA).toBe(0);
    expect(estado.scoreB).toBe(0);
    expect(estado.neutroScores.animais).toBe(5 + 8);
  });

  it('abrir perfil não pontua (não está na tabela)', () => {
    expect(deltaA(aplicar([{ tipo: 'abriu_perfil', postId: 'a1', payload: {} }]))).toBe(0);
  });
});

describe('baseline de dwell', () => {
  it('é a mediana dos 8 primeiros dwells da sessão', () => {
    // Posts DISTINTOS: repetir o mesmo id conta como revisita e não alimenta a
    // baseline (foi assim que este teste pegou meu próprio erro de setup).
    const dwells = [1000, 5000, 2000, 2000, 3000, 1000, 4000, 2000]; // mediana = 2000
    const catalogo = new Map<string, PostMeta>();
    const eventos: EventoPontuavel[] = dwells.map((dwellMs, indice) => {
      const id = `p${indice}`;
      catalogo.set(id, { ...(indice % 2 === 0 ? POST_A : POST_B), id });
      return { id: String(indice + 1), tipo: 'visto' as const, postId: id, payload: { dwellMs } };
    });

    const estado = aplicarEventos(estadoInicial(), eventos, catalogo, CONFIG, AUTORES);

    expect(estado.baselineDwellMs).toBe(2000);
  });

  it('pontua os 8 primeiros posts RETROATIVAMENTE quando a baseline nasce', () => {
    // 7 posts de A com 9s + 1 de B com 0,9s: a mediana sai 9000 e os 8 dwells
    // precisam ter sido pontuados (antes, os 7 primeiros valiam zero).
    const catalogo = new Map<string, PostMeta>();
    const eventosDistintos: EventoPontuavel[] = [];
    for (let i = 0; i < 7; i += 1) {
      const id = `a${i}`;
      catalogo.set(id, { ...POST_A, id });
      eventosDistintos.push({ id: String(i + 1), tipo: 'visto', postId: id, payload: { dwellMs: 9000 } });
    }
    catalogo.set('b0', { ...POST_B, id: 'b0' });
    eventosDistintos.push({ id: '8', tipo: 'visto', postId: 'b0', payload: { dwellMs: 900 } });

    const estado = aplicarEventos(estadoInicial(), eventosDistintos, catalogo, CONFIG, AUTORES);

    expect(estado.baselineDwellMs).toBe(9000);
    // 7 posts com dwellNorm 1.0 → +1 cada.
    expect(estado.scoreA).toBe(7);
    // O post de 900ms rolou reto → −2.
    expect(estado.scoreB).toBe(-2);
    expect(estado.pendentesDeBaseline).toHaveLength(0);
  });

  it('pontosDeDwell nunca premia sem baseline', () => {
    expect(pontosDeDwell(9000, null, CONFIG).pontos).toBe(0);
    expect(pontosDeDwell(500, null, CONFIG).pontos).toBe(-2);
  });
});

describe('domínio', () => {
  it('é 0.5 enquanto a soma dos lados não chega ao mínimo', () => {
    const estado = comBaseline({ scoreA: 9, scoreB: 0 });
    expect(dominioDe(estado, CONFIG)).toEqual({ dominio: 0.5, ladoDominante: 'neutro' });
  });

  it('não salta para 1.0 só porque o outro lado ficou negativo', () => {
    const estado = comBaseline({ scoreA: 16, scoreB: -4 });
    const { dominio, ladoDominante } = dominioDe(estado, CONFIG);

    expect(ladoDominante).toBe('A');
    expect(dominio).toBeLessThan(1);
    expect(dominio).toBeGreaterThan(0.6);
  });

  it('com suavizacaoDominio = 0 volta à fórmula literal do doc', () => {
    const estado = comBaseline({ scoreA: 30, scoreB: 10 });
    const literal = dominioDe(estado, { ...CONFIG, suavizacaoDominio: 0 });
    expect(literal.dominio).toBeCloseTo(0.75, 5);
  });

  it('converge para 1.0 quando a evidência de um lado é esmagadora', () => {
    const estado = comBaseline({ scoreA: 400, scoreB: 0 });
    expect(dominioDe(estado, CONFIG).dominio).toBeGreaterThan(0.97);
  });
});
