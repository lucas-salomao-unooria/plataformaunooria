import { deveEncerrar, mixDoBloco } from '../src/motor/curadoria';
import type { PostMeta } from '../src/motor/tipos';
import { CONFIG, catalogoDeTeste, simular, sinal, visto } from './motor-simulador';

/** Testes obrigatórios do doc 04 §8. */

const DWELL_LONGO = 9000;
const DWELL_CURTO = 900;
const DWELL_MEDIO = 2000;

describe('sessão que só engaja o lado A', () => {
  const { passos, estado } = simular(6, (meta) =>
    meta.lado === 'A'
      ? [visto(meta, DWELL_LONGO), sinal(meta, 'curtiu')]
      : [visto(meta, DWELL_CURTO)],
  );

  it('domínio passa de 0.75 até o bloco 4', () => {
    expect(passos[3]!.dominio).toBeGreaterThan(0.75);
    expect(passos[3]!.estado.scoreA).toBeGreaterThan(passos[3]!.estado.scoreB);
  });

  it('o feed vira majoritariamente do lado A, mas o lado B nunca desaparece', () => {
    const ultimo = passos[passos.length - 1]!;
    const doLadoA = ultimo.metas.filter((meta) => meta.lado === 'A').length;
    const doLadoB = ultimo.metas.filter((meta) => meta.lado === 'B').length;

    expect(doLadoA).toBeGreaterThanOrEqual(4);

    /**
     * ESTA asserção mudou no M5, e é a mudança mais consequente do projeto.
     *
     * Antes o teste exigia ZERO posts do lado B no fim — a bolha hermética. Com o
     * viés vindo do perfil, isso tornaria a virada de lado **mecanicamente
     * impossível**: o estudante não deixaria de mudar de ideia por convicção, mas
     * porque o outro lado pararia de aparecer. E o relatório afirmaria "você podia
     * ter mudado de lado" sendo mentira.
     *
     * Agora o piso é 1 em 6 (~17%), a faixa em que feeds reais operam
     * (Bakshy, Messing & Adamic, Science 2015). A bolha continua sendo bolha —
     * 5 contra 1 —, mas com porta de saída.
     */
    expect(doLadoB).toBe(1);
    expect(doLadoA).toBeGreaterThan(doLadoB * 3);
  });

  it('o post do lado oposto é sempre o mais suave — rampa de saída, não isca', () => {
    /**
     * Se o único post do outro lado que chega fosse intensidade 3, ele não
     * funcionaria como saída: funcionaria como isca de indignação, aquele post do
     * "inimigo" que a pessoa vê para se irritar — e que FECHA a bolha em vez de
     * abrir porta. Feeds reais fazem os dois; nós escolhemos o primeiro.
     */
    for (const passo of passos) {
      const opostos = passo.metas.filter((meta) => meta.lado === 'B');
      for (const post of opostos) {
        expect(post.intensidade).toBe(1);
      }
    }
  });

  it('intensidade 3 só aparece depois da escada, nunca no primeiro contato', () => {
    const int3PorBloco = passos.map((passo) =>
      passo.metas.filter((meta) => meta.lado === 'A' && meta.intensidade === 3).length,
    );
    expect(int3PorBloco[0]).toBe(0);
    expect(int3PorBloco[1]).toBe(0);
    expect(estado.intensityUnlocked.A).toBe(3);
    expect(int3PorBloco.slice(2).reduce((soma, valor) => soma + valor, 0)).toBeGreaterThan(0);
  });

  it('a escalada do lado oposto não destrava sozinha', () => {
    expect(estado.intensityUnlocked.B).toBe(1);
  });
});

describe('sessão que rola tudo reto', () => {
  const { passos } = simular(6, (meta) => [visto(meta, 700)]);

  it('não forma bolha: domínio segue equilibrado', () => {
    for (const passo of passos) {
      expect(passo.dominio).toBeLessThan(0.6);
    }
  });

  it('mantém o mix 2/2/2 dos dois lados', () => {
    const ultimo = passos[passos.length - 1]!;
    expect(ultimo.metas.filter((meta) => meta.lado === 'A').length).toBeGreaterThan(0);
    expect(ultimo.metas.filter((meta) => meta.lado === 'B').length).toBeGreaterThan(0);
  });
});

describe('sessão só de rolagem (zero curtidas)', () => {
  const { passos, estado } = simular(6, (meta) =>
    meta.lado === 'B' ? [visto(meta, DWELL_LONGO)] : [visto(meta, DWELL_MEDIO)],
  );

  it('a bolha se forma apenas com dwell time', () => {
    expect(passos[passos.length - 1]!.dominio).toBeGreaterThan(0.7);
    expect(estado.scoreB).toBeGreaterThan(estado.scoreA);
  });

  it('nenhum sinal explícito foi necessário', () => {
    const explicitos = Object.values(estado.sinaisPorNivel.B).reduce((soma, valor) => soma + valor, 0);
    expect(explicitos).toBe(0);
    expect(estado.intensityUnlocked.B).toBeGreaterThan(1);
  });
});

describe('"não tenho interesse" derruba o lado', () => {
  const { estado } = simular(5, (meta) => {
    if (meta.lado === 'A') return [visto(meta, DWELL_LONGO), sinal(meta, 'nao_interessa')];
    if (meta.lado === 'B') return [visto(meta, DWELL_MEDIO)];
    return [visto(meta, DWELL_CURTO)];
  });

  it('o lado rejeitado perde para o outro na prática', () => {
    expect(estado.scoreA).toBeLessThan(estado.scoreB);
  });
});

describe('invariantes de curadoria', () => {
  it('nenhum post é servido duas vezes em 12 blocos', () => {
    const { estado } = simular(12, (meta) => [visto(meta, meta.lado === 'A' ? DWELL_LONGO : DWELL_CURTO)]);
    expect(new Set(estado.servedPostIds).size).toBe(estado.servedPostIds.length);
  });

  it('o bloco inicial tem 8 posts com os dois lados e iscas nas posições 1 e 4', () => {
    const { passos } = simular(1, (meta) => [visto(meta, DWELL_MEDIO)]);
    const inicial = passos[0]!;
    expect(inicial.ids).toHaveLength(8);
    /**
     * O bloco inicial agora nasce INCLINADO para o lado semeado (doc 02 fase 2):
     * 3 do semeado + 1 do oposto + 2 iscas + 2 neutros. Antes era 2 + 2, porque o
     * feed nascia neutro; com o viés vindo do perfil, o primeiro bloco já
     * inclina — mas de composição, não de intensidade.
     */
    expect(inicial.metas.filter((meta) => meta.lado === 'A')).toHaveLength(3);
    expect(inicial.metas.filter((meta) => meta.lado === 'B')).toHaveLength(1);
    expect(inicial.metas.filter((meta) => meta.lado === 'neutro')).toHaveLength(4);
    expect(inicial.metas[0]!.lado).toBe('neutro');
    expect(inicial.metas[3]!.lado).toBe('neutro');
    expect(inicial.metas.every((meta) => meta.intensidade === 1)).toBe(true);
  });

  it('nunca 3 posts do mesmo lado seguidos enquanto o domínio é baixo', () => {
    const { passos } = simular(4, (meta) => [visto(meta, DWELL_MEDIO)]);
    for (const passo of passos) {
      if (passo.dominio >= 0.75) continue;
      for (let i = 2; i < passo.metas.length; i += 1) {
        const trinca = [passo.metas[i - 2]!.lado, passo.metas[i - 1]!.lado, passo.metas[i]!.lado];
        expect(new Set(trinca).size).toBeGreaterThan(1);
      }
    }
  });

  it('a mixagem segue a tabela do doc 04 §5 — e o oposto NUNCA zera', () => {
    expect(mixDoBloco(0.5, CONFIG)).toMatchObject({ dominante: 2, oposto: 2, neutro: 2 });
    expect(mixDoBloco(0.7, CONFIG)).toMatchObject({ dominante: 3, oposto: 2, neutro: 1 });
    expect(mixDoBloco(0.8, CONFIG)).toMatchObject({ dominante: 4, oposto: 1, neutro: 1 });
    expect(mixDoBloco(0.95, CONFIG)).toMatchObject({ dominante: 5, oposto: 1, neutro: 0 });
  });

  it('o piso do oposto vale em TODO valor de domínio', () => {
    /**
     * Este é o teste que protege a reversibilidade. Na versão anterior o oposto
     * ia a 0 acima de 0,75 — e aí virar de lado ficava mecanicamente impossível,
     * não por convicção do estudante, mas porque o outro lado parava de aparecer.
     */
    for (let dominio = 0; dominio <= 1; dominio += 0.01) {
      expect(mixDoBloco(dominio, CONFIG).oposto).toBeGreaterThan(0);
      expect(mixDoBloco(dominio, CONFIG, false).oposto).toBeGreaterThan(0);
    }
  });

  it('sem neutros, as vagas vão para os lados e o bloco não encurta', () => {
    for (const dominio of [0.5, 0.7, 0.8, 0.95]) {
      const mix = mixDoBloco(dominio, CONFIG, false);
      expect(mix.neutro).toBe(0);
      expect(mix.dominante + mix.oposto).toBe(6);
    }
  });

  it('o catálogo sintético cobre os dois lados nas três intensidades', () => {
    const catalogo = catalogoDeTeste();
    for (const lado of ['A', 'B'] as const) {
      for (const intensidade of [1, 2, 3] as const) {
        expect(catalogo.some((post) => post.lado === lado && post.intensidade === intensidade)).toBe(true);
      }
    }
  });
});

describe('encerramento', () => {
  const minutosAtras = (minutos: number) => new Date(Date.now() - minutos * 60_000);

  it('dispara por posts consumidos — o literal do doc é 60', () => {
    /**
     * 60/18/8 substituiu 34/12/4 no M5: a missão passou a ser investigativa, e
     * 34 posts em 12 min é ritmo de quem passa o tempo, não de quem investiga
     * (doc 04 §8).
     */
    const { estado } = simular(12, (meta) => [visto(meta, DWELL_MEDIO)]);

    expect(CONFIG.encerramento.maxPosts).toBe(60);
    expect(estado.postsConsumidos.length).toBeGreaterThanOrEqual(60);
    // Já passou do piso de tempo: encerra.
    expect(deveEncerrar(estado, CONFIG, minutosAtras(10))).toBe(true);
  });

  it('respeita o piso de tempo: rolagem rápida não encerra antes de 8 min', () => {
    const { estado } = simular(12, (meta) => [visto(meta, DWELL_MEDIO)]);

    expect(estado.postsConsumidos.length).toBeGreaterThanOrEqual(60);
    expect(deveEncerrar(estado, CONFIG, minutosAtras(2))).toBe(false);
    expect(deveEncerrar(estado, CONFIG, minutosAtras(7))).toBe(false);
    expect(deveEncerrar(estado, CONFIG, minutosAtras(9))).toBe(true);
  });

  it('dispara por tempo de feed — o literal do doc é 18 min', () => {
    const { estado } = simular(2, (meta) => [visto(meta, DWELL_MEDIO)]);

    expect(CONFIG.encerramento.maxMinutos).toBe(18);
    expect(estado.postsConsumidos.length).toBeLessThan(60);
    expect(deveEncerrar(estado, CONFIG, minutosAtras(19))).toBe(true);
    expect(deveEncerrar(estado, CONFIG, minutosAtras(17))).toBe(false);
  });

  it('o relógio conta do início do FEED, não do onboarding', () => {
    const { estado } = simular(2, (meta) => [visto(meta, DWELL_MEDIO)]);

    // Run aberta há 20 min, mas o feed começou há 3: ainda não encerra.
    const comFeedRecente = { ...estado, feedIniciadoEm: minutosAtras(3).toISOString() };
    expect(deveEncerrar(comFeedRecente, CONFIG, minutosAtras(20))).toBe(false);

    const comFeedAntigo = { ...estado, feedIniciadoEm: minutosAtras(19).toISOString() };
    expect(deveEncerrar(comFeedAntigo, CONFIG, minutosAtras(20))).toBe(true);
  });
});

describe('bolha também nos neutros', () => {
  it('a categoria neutra mais engajada acumula mais pontos', () => {
    const { estado } = simular(8, (meta) => {
      if (meta.lado !== 'neutro') return [visto(meta, DWELL_CURTO)];
      return meta.categoria === 'animais' ? [visto(meta, DWELL_LONGO), sinal(meta, 'curtiu')] : [visto(meta, DWELL_CURTO)];
    });

    const animais = estado.neutroScores.animais ?? 0;
    const outros = Object.entries(estado.neutroScores)
      .filter(([categoria]) => categoria !== 'animais')
      .map(([, valor]) => valor);

    expect(animais).toBeGreaterThan(0);
    for (const valor of outros) expect(animais).toBeGreaterThan(valor);
  });
});

describe('teto da escada é inviolável (regressão)', () => {
  /** Catálogo escasso: força o esgotamento do nível 1 e revela furos na escada. */
  function catalogoEscasso(): PostMeta[] {
    const posts: PostMeta[] = [];
    let contador = 0;
    const criar = (lado: PostMeta['lado'], intensidade: 1 | 2 | 3, categoria: string, quantidade: number) => {
      for (let i = 0; i < quantidade; i += 1) {
        contador += 1;
        posts.push({
          id: `escasso-${contador}`,
          lado,
          perfil: 'abertura',
          intensidade,
          categoria,
          authorId: `autor-${lado}`,
          likesCount: 1000 + contador,
        });
      }
    };
    for (const lado of ['A', 'B'] as const) {
      criar(lado, 1, 'tema', 7);
      criar(lado, 2, 'tema', 6);
      criar(lado, 3, 'tema', 5);
    }
    criar('neutro', 1, 'animais', 12);
    criar('neutro', 1, 'memes de escola', 12);
    return posts;
  }

  it('nenhum post servido passa da intensidade destravada, nem com catálogo escasso', () => {
    const catalogo = catalogoEscasso();
    const { passos } = simular(8, (meta) => [visto(meta, 1500)], { catalogo });

    for (const passo of passos) {
      for (const meta of passo.metas) {
        if (meta.lado === 'neutro') continue;
        expect(meta.intensidade).toBeLessThanOrEqual(passo.estado.intensityUnlocked[meta.lado]);
      }
    }
  });

  it('sem nenhum sinal, o estudante nunca vê intensidade 2 ou 3', () => {
    const catalogo = catalogoEscasso();
    const { passos } = simular(8, (meta) => [visto(meta, 700)], { catalogo });

    const acima = passos.flatMap((passo) =>
      passo.metas.filter((meta) => meta.lado !== 'neutro' && meta.intensidade > 1),
    );
    expect(acima).toHaveLength(0);
  });
});
