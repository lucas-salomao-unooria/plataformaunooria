/**
 * O MOTOR do feed da exp06ef1b — puro, determinístico e sem relógio.
 *
 * O cliente MEDE (curtiu, ficou mais de 5 s) e o servidor DECIDE o próximo
 * post (a doutrina da exp08ef1b): o bundle nunca recebe o acervo nem a regra,
 * e a mesma sessão rende o mesmo feed num F5.
 *
 * A regra é a que a Etapa 5 ensina e a enquete da EF06CO03 pergunta:
 *
 *   SE uma área somar 6 pontos (duas curtidas, ou curtida + permanências)
 *   ENTÃO as próximas posições do feed são só dessa área.
 *
 * Os PESOS não são gravados: saem das curtidas e das permanências da sessão
 * (`pesos`). Um valor derivado não diverge do que o gerou.
 */
import {
  AREAS,
  LIMIAR_DA_BOLHA,
  PESO_DA_CURTIDA,
  PESO_DA_PERMANENCIA,
  POSTS_DE_ABERTURA,
  POSTS_NO_FEED,
  TOTAL_DE_PROJETOS,
  areaDoProjeto,
  idDoPost,
  projetoDoPost,
  type Area,
} from "../vocabulario";

/** O que a sessão guarda do feed — três listas de ids de post. */
export type EstadoDoFeed = {
  /** Os posts que o feed serviu, na ordem da tela. */
  servidos: readonly string[];
  /** Os posts curtidos AGORA (descurtir tira daqui). */
  curtidos: readonly string[];
  /** Os posts em que o estudante ficou mais de 5 s (conta uma vez por post). */
  permanencias: readonly string[];
};

export const FEED_VAZIO: EstadoDoFeed = { servidos: [], curtidos: [], permanencias: [] };

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

/** Os pontos de cada área agora: 3 por curtida, 1 por permanência. */
export function pesos(estado: EstadoDoFeed): Record<Area, number> {
  const total = Object.fromEntries(AREAS.map((a) => [a, 0])) as Record<Area, number>;
  for (const post of estado.curtidos) total[areaDoProjeto(projetoDoPost(post))] += PESO_DA_CURTIDA;
  for (const post of estado.permanencias) total[areaDoProjeto(projetoDoPost(post))] += PESO_DA_PERMANENCIA;
  return total;
}

/**
 * A área que fechou a bolha, ou `null`. Com duas acima do limiar, vence a de
 * mais pontos; no empate, a que tem mais curtidas; depois, a que apareceu
 * primeiro no feed. Determinístico, sem relógio.
 */
export function areaLider(estado: EstadoDoFeed): Area | null {
  const p = pesos(estado);
  const curtidasPorArea = (area: Area) =>
    estado.curtidos.filter((post) => areaDoProjeto(projetoDoPost(post)) === area).length;
  const primeiraPosicao = (area: Area) => {
    const i = estado.servidos.findIndex((post) => areaDoProjeto(projetoDoPost(post)) === area);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const acima = AREAS.filter((a) => p[a] >= LIMIAR_DA_BOLHA);
  if (acima.length === 0) return null;
  return (
    [...acima].sort(
      (x, y) => p[y] - p[x] || curtidasPorArea(y) - curtidasPorArea(x) || primeiraPosicao(x) - primeiraPosicao(y),
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

/**
 * O próximo post do feed, ou `null` se o feed já tem os dez.
 *
 * - COM bolha: a área líder. Primeiro as apresentações de projetos dela que o
 *   estudante ainda não viu; depois os BASTIDORES, começando pelos projetos já
 *   vistos (é a área líder repetindo o projeto com outro post).
 * - SEM bolha: a apresentação de um projeto novo da área de MAIOR peso — o
 *   feed já puxa para o que o estudante engajou, antes do limiar, como uma
 *   recomendação de verdade (é o que faz a segunda curtida acontecer cedo).
 *   Sem peso nenhum, a área menos vista: quem não interage vê um feed variado.
 *   Empate: ordem sorteada pela sessão. Sem apresentação sobrando, um bastidor.
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
  const bastidor = (area: Area | null) => {
    const daArea = ordenados.filter((p) => area === null || p.area === area);
    const vistosPrimeiro = [...daArea.filter((p) => vistos.has(p.id)), ...daArea.filter((p) => !vistos.has(p.id))];
    return vistosPrimeiro.find((p) => !jaServidos.has(idDoPost(p.id, "bastidor")));
  };

  const lider = areaLider(estado);
  if (lider) {
    const nova = apresentacaoNova(lider);
    if (nova) return idDoPost(nova.id, "apresentacao");
    const repetido = bastidor(lider);
    if (repetido) return idDoPost(repetido.id, "bastidor");
  }

  // Sem bolha (ou a líder esgotou): a de maior peso; sem peso, a menos vista.
  const p = pesos(estado);
  const vistosPorArea = (area: Area) => projetos.filter((x) => x.area === area && vistos.has(x.id)).length;
  const areas = embaralhar(AREAS, semente, `variado:${posicao}`).sort(
    (x, y) => p[y] - p[x] || vistosPorArea(x) - vistosPorArea(y),
  );
  for (const area of areas) {
    const nova = apresentacaoNova(area);
    if (nova) return idDoPost(nova.id, "apresentacao");
  }
  const qualquer = bastidor(null);
  return qualquer ? idDoPost(qualquer.id, "bastidor") : null;
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

/** O feed chegou aos dez posts? É o que abre a cédula. */
export function feedCompleto(estado: EstadoDoFeed): boolean {
  return estado.servidos.length >= POSTS_NO_FEED;
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
