/**
 * O MOTOR do feed da exp06ef1b — puro, determinístico e sem relógio.
 *
 * O cliente MEDE (curtiu, ficou mais de 5 s) e o servidor DECIDE o próximo
 * post (a doutrina da exp08ef1b): o bundle nunca recebe o acervo nem a regra,
 * e a mesma sessão rende o mesmo feed num F5.
 *
 * A regra é a que a Etapa 5 ensina e a enquete da EF06CO03 pergunta:
 *
 *   SE uma área somar 6 pontos (duas curtidas, ou curtida + três
 *   permanências) ENTÃO as próximas posições do feed são só dessa área.
 *
 * Os PESOS não são gravados: saem das curtidas e das permanências da sessão
 * (`pesos`). Salvar NÃO pesa (melhoria 6 do PRD v2): fica na lista para a tela
 * e para a telemetria, e o motor não o lê.
 *
 * A SATURAÇÃO (melhoria 1, 2026-10-10): com a área em FOCO, os posts 5 a 10 são
 * só dela e repetem os projetos que já chegaram em FORMATOS diferentes
 * (apresentação, bastidor, protótipo, depoimento) — no máximo um projeto novo
 * dela entra. Quem curte vê 5 projetos distintos e 11 de 16 ficam fora do feed
 * (69%); a taxa é REAL, e a galeria mostra o número desta sessão.
 */
import {
  AREAS,
  LIMIAR_DA_BOLHA,
  PESO_DA_CURTIDA,
  PESO_DA_PERMANENCIA,
  POSTS_DE_ABERTURA,
  POSTS_NO_FEED,
  TETO_DO_FEED_MS,
  TIPOS_DE_POST,
  TOTAL_DE_PROJETOS,
  areaDoProjeto,
  idDoPost,
  projetoDoPost,
  type Area,
} from "../vocabulario";

/** O que a sessão guarda do feed — quatro listas de ids de post. */
export type EstadoDoFeed = {
  /** Os posts que o feed serviu, na ordem da tela. */
  servidos: readonly string[];
  /** Os posts curtidos AGORA (descurtir tira daqui). */
  curtidos: readonly string[];
  /** Os posts salvos AGORA (tirar dos salvos tira daqui). Não pesa no motor. */
  salvos: readonly string[];
  /** Os posts em que o estudante ficou mais de 5 s (conta uma vez por post). */
  permanencias: readonly string[];
};

export const FEED_VAZIO: EstadoDoFeed = { servidos: [], curtidos: [], salvos: [], permanencias: [] };

// ------------------------------------------------------------ sorteio estável

/** FNV-1a de 32 bits: a semente da sessão vira um número. */
function hash(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: o mesmo `rotulo` + `semente` sempre dá a mesma sequência. */
function gerador(semente: string, rotulo: string): () => number {
  let a = hash(`${semente}:${rotulo}`);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates com o gerador da sessão. Não muda a lista recebida. */
export function embaralhar<T>(lista: readonly T[], semente: string, rotulo: string): T[] {
  const copia = [...lista];
  const aleatorio = gerador(semente, rotulo);
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    const tmp = copia[i] as T;
    copia[i] = copia[j] as T;
    copia[j] = tmp;
  }
  return copia;
}

// ------------------------------------------------------------------- pesos

/** Os pontos de cada área agora: 3 por curtida, 1 por permanência. Salvar não conta. */
export function pesos(estado: EstadoDoFeed): Record<Area, number> {
  const total = Object.fromEntries(AREAS.map((a) => [a, 0])) as Record<Area, number>;
  for (const post of estado.curtidos) total[areaDoProjeto(projetoDoPost(post))] += PESO_DA_CURTIDA;
  for (const post of estado.permanencias) total[areaDoProjeto(projetoDoPost(post))] += PESO_DA_PERMANENCIA;
  return total;
}

function contagem(posts: readonly string[], area: Area): number {
  return posts.filter((post) => areaDoProjeto(projetoDoPost(post)) === area).length;
}

function primeiraPosicao(estado: EstadoDoFeed, area: Area): number {
  const i = estado.servidos.findIndex((post) => areaDoProjeto(projetoDoPost(post)) === area);
  return i < 0 ? Number.MAX_SAFE_INTEGER : i;
}

/**
 * A área LÍDER, ou `null`:
 *
 * 1. a que somou 6 ou mais (com duas acima, a de mais pontos; empate, a de mais
 *    curtidas; depois, a que apareceu primeiro no feed);
 * 2. SEM curtida nenhuma, a permanência sozinha elege: a área com mais posts
 *    vistos por mais de 5 s (empate, a que apareceu primeiro) — melhoria 1.
 *
 * Determinístico, sem relógio.
 */
export function areaLider(estado: EstadoDoFeed): Area | null {
  const p = pesos(estado);
  const acima = AREAS.filter((a) => p[a] >= LIMIAR_DA_BOLHA);
  if (acima.length > 0) {
    return (
      [...acima].sort(
        (x, y) =>
          p[y] - p[x] ||
          contagem(estado.curtidos, y) - contagem(estado.curtidos, x) ||
          primeiraPosicao(estado, x) - primeiraPosicao(estado, y),
      )[0] ?? null
    );
  }
  if (estado.curtidos.length === 0 && estado.permanencias.length > 0) {
    return (
      [...AREAS]
        .filter((a) => contagem(estado.permanencias, a) > 0)
        .sort(
          (x, y) =>
            contagem(estado.permanencias, y) - contagem(estado.permanencias, x) ||
            primeiraPosicao(estado, x) - primeiraPosicao(estado, y),
        )[0] ?? null
    );
  }
  return null;
}

/**
 * A área para onde o feed PUXA: a líder; sem líder, mas com alguma curtida, a de
 * maior peso (o feed já puxa para o que a criança engajou, antes do limiar, como
 * uma recomendação de verdade — é o que faz a segunda curtida acontecer cedo).
 * Sem sinal nenhum, `null`: o feed segue variado (RF-002, caso de borda).
 */
export function areaEmFoco(estado: EstadoDoFeed): Area | null {
  const lider = areaLider(estado);
  if (lider) return lider;
  if (estado.curtidos.length === 0) return null;
  const p = pesos(estado);
  return (
    [...AREAS]
      .filter((a) => p[a] > 0)
      .sort(
        (x, y) =>
          p[y] - p[x] ||
          contagem(estado.curtidos, y) - contagem(estado.curtidos, x) ||
          primeiraPosicao(estado, x) - primeiraPosicao(estado, y),
      )[0] ?? null
  );
}

// --------------------------------------------------------------- o feed

/** O mínimo que o motor precisa de um projeto: o id e a área. */
export type ProjetoDoMotor = { id: string; area: Area };

/**
 * Os quatro primeiros posts: a APRESENTAÇÃO de um projeto de cada área, em
 * ordem sorteada pela sessão. É o que mostra ao estudante que a mostra é
 * variada antes de a bolha fechar.
 */
export function abertura(projetos: readonly ProjetoDoMotor[], semente: string): string[] {
  const areas = embaralhar(AREAS, semente, "abertura:areas");
  return areas.slice(0, POSTS_DE_ABERTURA).map((area) => {
    const [primeiro] = embaralhar(
      projetos.filter((p) => p.area === area),
      semente,
      `abertura:${area}`,
    );
    if (!primeiro) throw new Error(`pacote sem projeto na área ${area}`);
    return idDoPost(primeiro.id, "apresentacao");
  });
}

function projetosServidos(servidos: readonly string[]): Set<string> {
  return new Set(servidos.map(projetoDoPost));
}

/** Os projetos servidos, na ordem em que chegaram pela primeira vez. */
function projetosNaOrdem(servidos: readonly string[]): string[] {
  return [...new Set(servidos.map(projetoDoPost))];
}

/** Quantos projetos DISTINTOS da área em foco podem chegar ao feed (o da abertura e mais um). */
export const PROJETOS_DA_AREA_EM_FOCO = 2;

/**
 * O próximo post do feed, ou `null` se o feed já tem os dez.
 *
 * - Os quatro primeiros: a abertura (um de cada área).
 * - COM área em FOCO (`areaEmFoco`): só ela. Enquanto ela tiver menos de dois
 *   projetos no feed, a apresentação de um projeto NOVO dela; depois, os
 *   formatos que faltam dos projetos dela que já chegaram (apresentação,
 *   bastidor, protótipo, depoimento), na ordem em que chegaram — é a SATURAÇÃO.
 * - SEM foco (ninguém curtiu nem ficou num post): a apresentação de um projeto
 *   novo da área MENOS vista — quem não interage vê um feed variado.
 */
export function proximoPost(
  projetos: readonly ProjetoDoMotor[],
  estado: EstadoDoFeed,
  semente: string,
): string | null {
  if (estado.servidos.length >= POSTS_NO_FEED) return null;
  if (estado.servidos.length < POSTS_DE_ABERTURA) {
    return abertura(projetos, semente)[estado.servidos.length] ?? null;
  }

  const jaServidos = new Set(estado.servidos);
  const vistos = projetosServidos(estado.servidos);
  const posicao = estado.servidos.length;
  const ordenados = embaralhar(projetos, semente, `posicao:${posicao}`);

  const apresentacaoNova = (area: Area | null) =>
    ordenados.find(
      (p) => (area === null || p.area === area) && !vistos.has(p.id) && !jaServidos.has(idDoPost(p.id, "apresentacao")),
    );
  const formatoQueFalta = (area: Area | null): string | null => {
    for (const projetoId of projetosNaOrdem(estado.servidos)) {
      if (area !== null && areaDoProjeto(projetoId) !== area) continue;
      for (const tipo of TIPOS_DE_POST) {
        const post = idDoPost(projetoId, tipo);
        if (!jaServidos.has(post)) return post;
      }
    }
    return null;
  };

  const foco = areaEmFoco(estado);
  if (foco) {
    const vistosDoFoco = projetosNaOrdem(estado.servidos).filter((id) => areaDoProjeto(id) === foco);
    if (vistosDoFoco.length < PROJETOS_DA_AREA_EM_FOCO) {
      const nova = apresentacaoNova(foco);
      if (nova) return idDoPost(nova.id, "apresentacao");
    }
    const repetido = formatoQueFalta(foco);
    if (repetido) return repetido;
    const nova = apresentacaoNova(foco);
    if (nova) return idDoPost(nova.id, "apresentacao");
  }

  // Sem foco (ou a área esgotou): a menos vista, para o feed seguir variado.
  const vistosPorArea = (area: Area) => projetos.filter((x) => x.area === area && vistos.has(x.id)).length;
  const areas = embaralhar(AREAS, semente, `variado:${posicao}`).sort((x, y) => vistosPorArea(x) - vistosPorArea(y));
  for (const area of areas) {
    const nova = apresentacaoNova(area);
    if (nova) return idDoPost(nova.id, "apresentacao");
  }
  return formatoQueFalta(null);
}

/** Serve posts até `quantos` (ou até o feed completar). Puro: devolve a lista nova. */
export function servirAte(
  projetos: readonly ProjetoDoMotor[],
  estado: EstadoDoFeed,
  semente: string,
  quantos: number,
): string[] {
  const servidos = [...estado.servidos];
  while (servidos.length < Math.min(quantos, POSTS_NO_FEED)) {
    const proximo = proximoPost(projetos, { ...estado, servidos }, semente);
    if (!proximo) break;
    servidos.push(proximo);
  }
  return servidos;
}

/** O feed chegou aos dez posts? */
export function feedCompleto(estado: EstadoDoFeed): boolean {
  return estado.servidos.length >= POSTS_NO_FEED;
}

/**
 * O teto de tempo do feed (RNF-USA-002, melhoria 9): oito minutos contados
 * pelo SERVIDOR desde a primeira rolagem (`feed_iniciado_em`). Recarregar não
 * zera, porque o início está gravado.
 */
export function tempoDoFeedEsgotado(iniciadoEm: Date | null, agora: Date): boolean {
  return iniciadoEm !== null && agora.getTime() - iniciadoEm.getTime() >= TETO_DO_FEED_MS;
}

/** Quando o feed encerra por tempo, ou `null` antes da primeira rolagem. */
export function fimDoFeed(iniciadoEm: Date | null): Date | null {
  return iniciadoEm ? new Date(iniciadoEm.getTime() + TETO_DO_FEED_MS) : null;
}

/** A cédula abre com os dez posts OU com o tempo esgotado — o que vier primeiro. */
export function cedulaLiberada(estado: EstadoDoFeed, iniciadoEm: Date | null, agora: Date): boolean {
  return feedCompleto(estado) || tempoDoFeedEsgotado(iniciadoEm, agora);
}

// ------------------------------------------------------------- eventos

/**
 * Curtir ou descurtir. Só vale para post que o feed SERVIU (o cliente não
 * inventa post), e é idempotente: curtir duas vezes é curtir uma.
 */
export function aplicarCurtida(estado: EstadoDoFeed, postId: string, curtiu: boolean): EstadoDoFeed {
  if (!estado.servidos.includes(postId)) return estado;
  const tem = estado.curtidos.includes(postId);
  if (curtiu === tem) return estado;
  return {
    ...estado,
    curtidos: curtiu ? [...estado.curtidos, postId] : estado.curtidos.filter((p) => p !== postId),
  };
}

/** Salvar ou tirar dos salvos — as mesmas regras da curtida. */
export function aplicarSalvamento(estado: EstadoDoFeed, postId: string, salvou: boolean): EstadoDoFeed {
  if (!estado.servidos.includes(postId)) return estado;
  const tem = estado.salvos.includes(postId);
  if (salvou === tem) return estado;
  return {
    ...estado,
    salvos: salvou ? [...estado.salvos, postId] : estado.salvos.filter((p) => p !== postId),
  };
}

/** A permanência de mais de 5 s: uma vez por post, e só em post servido. */
export function aplicarPermanencia(estado: EstadoDoFeed, postId: string): EstadoDoFeed {
  if (!estado.servidos.includes(postId) || estado.permanencias.includes(postId)) return estado;
  return { ...estado, permanencias: [...estado.permanencias, postId] };
}

// --------------------------------------------------------- o que não chegou

/** Os projetos que o feed NUNCA mostrou (nenhum dos dois posts). */
export function projetosOcultos(projetos: readonly ProjetoDoMotor[], servidos: readonly string[]): string[] {
  const vistos = projetosServidos(servidos);
  return projetos.filter((p) => !vistos.has(p.id)).map((p) => p.id);
}

/**
 * A taxa REAL de invisibilidade (decisão de 2026-10-02): os projetos que não
 * chegaram sobre os dezesseis. Não é o "75%" da spec — é o que esta sessão
 * produziu, e quem não afunilou vê o número dele, menor.
 */
export function invisibilidade(servidos: readonly string[]): {
  vistos: number;
  ocultos: number;
  total: number;
  percentual: number;
} {
  const vistos = projetosServidos(servidos).size;
  const ocultos = TOTAL_DE_PROJETOS - vistos;
  return { vistos, ocultos, total: TOTAL_DE_PROJETOS, percentual: Math.round((ocultos / TOTAL_DE_PROJETOS) * 100) };
}

/** O voto só vale para projeto que o feed mostrou: é a cédula "do seu feed". */
export function projetoFoiExibido(servidos: readonly string[], projetoId: string): boolean {
  return projetosServidos(servidos).has(projetoId);
}

// ------------------------------------------------------- contagens por área

/** Quantos projetos de cada área chegaram ao feed (por qualquer formato). */
export function projetosVistosPorArea(servidos: readonly string[]): Record<Area, number> {
  const total = Object.fromEntries(AREAS.map((a) => [a, 0])) as Record<Area, number>;
  for (const projeto of projetosServidos(servidos)) total[areaDoProjeto(projeto)] += 1;
  return total;
}

/** Quantos POSTS de cada área o feed serviu. */
export function postsPorArea(servidos: readonly string[]): Record<Area, number> {
  const total = Object.fromEntries(AREAS.map((a) => [a, 0])) as Record<Area, number>;
  for (const post of servidos) total[areaDoProjeto(projetoDoPost(post))] += 1;
  return total;
}

/**
 * A área que DOMINOU o feed: a de mais posts servidos (empate: a de mais
 * curtidas, depois a que apareceu primeiro). É a "bolha" de quem não chegou a
 * eleger líder — a régua da EF06CO01 a usa para dizer o que ficou fora.
 */
export function areaDominante(estado: EstadoDoFeed): Area | null {
  if (estado.servidos.length === 0) return null;
  const lider = areaLider(estado);
  if (lider) return lider;
  const posts = postsPorArea(estado.servidos);
  return (
    [...AREAS].sort(
      (x, y) =>
        posts[y] - posts[x] ||
        contagem(estado.curtidos, y) - contagem(estado.curtidos, x) ||
        primeiraPosicao(estado, x) - primeiraPosicao(estado, y),
    )[0] ?? null
  );
}
