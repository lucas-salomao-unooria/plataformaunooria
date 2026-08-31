import { calcularExposicao, type PostParaExposicao } from '../src/dossie/exposicao';
import { calcularTempo, fimDoFeedDe, type EventoDeTelemetria } from '../src/dossie/telemetria';
import { dominioDe } from '../src/motor/eventos';
import { ENGINE_CONFIG_DEFAULT } from '../src/comum/insta/defaults';
import { normalizarEstado } from '../src/motor/estado';

/**
 * A TRAVA DO "32 OU 30" (ADR-42).
 *
 * O produto tinha duas contas para "o que o algoritmo escondeu": a tela do estudante
 * decidia o lado dele pela EXPOSIÇÃO (quantos posts de cada lado o feed serviu)
 * e o relatório do professor decidia pelo DOMÍNIO (`dominioDe`, o score do
 * motor). Enquanto os dois apontam o mesmo lado ninguém percebe. Eles divergem
 * exatamente quando o estudante VIRA O JOGO — e aí as duas telas nomeavam lados
 * opostos para a mesma criança, na mesma conversa.
 *
 * O caso do meio é o que este arquivo existe para não deixar voltar.
 */

const CONFIG = ENGINE_CONFIG_DEFAULT;

/** Acervo com `porLado` posts aprovados de cada lado, mais os neutros. */
function acervo(porLado: number, neutros = 4): PostParaExposicao[] {
  const posts: PostParaExposicao[] = [];
  for (let i = 0; i < porLado; i += 1) posts.push({ id: `a${i}`, lado: 'A', aprovado: true });
  for (let i = 0; i < porLado; i += 1) posts.push({ id: `b${i}`, lado: 'B', aprovado: true });
  for (let i = 0; i < neutros; i += 1) posts.push({ id: `n${i}`, lado: 'neutro', aprovado: true });
  return posts;
}

describe('exposição: uma conta só para o lado oposto', () => {
  it('conta os não servidos do lado que o feed menos serviu', () => {
    // 48 de cada lado; ele viu 32 do A e 16 do B.
    const posts = acervo(48);
    const servidos = [
      ...Array.from({ length: 32 }, (_, i) => `a${i}`),
      ...Array.from({ length: 16 }, (_, i) => `b${i}`),
    ];

    const exposicao = calcularExposicao(servidos, posts);

    expect(exposicao.ladoDele).toBe('A');
    expect(exposicao.ladoPerdido).toBe('B');
    expect(exposicao.totalNoAcervo).toBe(48);
    expect(exposicao.vistos).toBe(16);
    expect(exposicao.perdidos).toBe(32);
    // 16 vistos + 32 perdidos = os 48 do lado B: a conta fecha na frente do estudante.
    expect(exposicao.vistos + exposicao.perdidos).toBe(exposicao.totalNoAcervo);
  });

  it('O ESTUDANTE QUE VIROU O JOGO: exposição e domínio discordam, e a exposição manda', () => {
    /**
     * O feed empurrou A (32 servidos contra 16), mas a atenção dele terminou em
     * B — é a definição de "virou o jogo", e é o caso que o painel do professor
     * marca com orgulho. Era aqui que as duas telas se contradiziam.
     */
    const posts = acervo(48);
    const servidos = [
      ...Array.from({ length: 32 }, (_, i) => `a${i}`),
      ...Array.from({ length: 16 }, (_, i) => `b${i}`),
    ];
    const estado = normalizarEstado({
      servedPostIds: servidos,
      scoreA: 10,
      scoreB: 40, // a atenção foi para B
    });

    const { ladoDominante } = dominioDe(estado, CONFIG);
    const exposicao = calcularExposicao(estado.servedPostIds, posts);

    // O domínio diz B; a exposição diz A. As duas leituras seguem existindo…
    expect(ladoDominante).toBe('B');
    expect(exposicao.ladoDele).toBe('A');

    // …mas quem responde "o que o algoritmo escondeu" é a exposição, e o lado
    // escondido é B — o que o feed NÃO serviu, não o oposto de onde ele foi
    // parar. Pelo domínio, esta conta olharia para A e contaria os posts que o
    // algoritmo estava justamente EMPURRANDO nele.
    expect(exposicao.ladoPerdido).toBe('B');
    expect(exposicao.perdidos).toBe(32);
  });

  it('sem post de tese servido não nomeia lado nenhum — 0 mentiria', () => {
    const posts = acervo(48);
    const exposicao = calcularExposicao(['n0', 'n1'], posts);

    expect(exposicao.ladoDele).toBeNull();
    expect(exposicao.ladoPerdido).toBeNull();
    expect(exposicao.perdidos).toBe(0);
  });

  it('post desaprovado não é "escondido pelo algoritmo" — foi decisão editorial', () => {
    const posts = acervo(10);
    // Metade do lado B sai do banco pela mão do professor.
    for (let i = 0; i < 5; i += 1) posts.find((p) => p.id === `b${i}`)!.aprovado = false;

    const exposicao = calcularExposicao(['a0', 'a1', 'a2'], posts);

    expect(exposicao.ladoPerdido).toBe('B');
    expect(exposicao.totalNoAcervo).toBe(5);
    expect(exposicao.perdidos).toBe(5);
  });

  it('empate na exposição escolhe um lado só, e de forma estável', () => {
    const posts = acervo(20);
    const servidos = ['a0', 'a1', 'b0', 'b1'];

    const primeira = calcularExposicao(servidos, posts);
    const segunda = calcularExposicao(servidos, posts);

    expect(primeira.ladoDele).toBe(segunda.ladoDele);
    expect(primeira.perdidos).toBe(segunda.perdidos);
  });
});

/**
 * A JANELA DO FEED (ADR-44).
 *
 * O buffer de eventos da experiência vive enquanto a run vive, então durante o
 * debate, a explicação e a reflexão ainda chegam `perdeu_foco`. Com a conta
 * fechando no último evento da SESSÃO, `feedMs` crescia depois de o feed fechar
 * e a imersão derretia sozinha conforme a aula avançava — o painel mostrava
 * adolescente desengajando onde havia um denominador correndo.
 */
describe('tempo: a janela termina com o feed', () => {
  const T0 = 1_700_000_000_000;

  it('evento de visibilidade no debate não estica o feed nem desconta continuidade', () => {
    const noFeed = [
      { tipo: 'visto', postId: 'p1', payload: { dwellMs: 4000 }, clientTs: T0 },
      { tipo: 'visto', postId: 'p2', payload: { dwellMs: 4000 }, clientTs: T0 + 30_000 },
      { tipo: 'visto', postId: 'p3', payload: { dwellMs: 4000 }, clientTs: T0 + 60_000 },
    ];
    // 20 minutos depois, no meio do debate, o estudante olha para o professor.
    const noDebate = [
      { tipo: 'perdeu_foco', postId: null, payload: {}, clientTs: T0 + 1_200_000 },
      { tipo: 'voltou_foco', postId: null, payload: {}, clientTs: T0 + 1_260_000 },
    ];

    expect(fimDoFeedDe([...noFeed, ...noDebate])).toBe(T0 + 60_000);

    const so = calcularTempoDeTeste(noFeed);
    const com = calcularTempoDeTeste([...noFeed, ...noDebate]);

    // O feed é o mesmo nos dois casos: os 60s entre o primeiro e o último post.
    expect(com.feedMs).toBe(so.feedMs);
    expect(com.feedMs).toBe(60_000);
    // E nenhum vão ocioso foi inventado pelo intervalo até o debate.
    expect(com.vaosOciosos).toBe(so.vaosOciosos);
  });
});

/** `calcularTempo` com o mínimo de entrada: aqui só o eixo do tempo importa. */
function calcularTempoDeTeste(eventos: EventoDeTelemetria[]) {
  return calcularTempo({
    eventos,
    estado: normalizarEstado({}),
    porId: new Map(),
    run: { startedAt: new Date(1_700_000_000_000), finishedAt: null },
  } as never);
}
