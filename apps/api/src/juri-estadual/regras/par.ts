import { AREAS, areaDoProjeto, projetoDoPost, type Area } from "../vocabulario";
import { areaDominante, embaralhar, postsPorArea, type EstadoDoFeed } from "./afunilamento";

/**
 * O PAR SIMULADO da Etapa 5 (PRD v2 §5.1, E5-ALU-01; melhoria 7): o histórico
 * da criança ao lado do de "outro jurado que curtiu temas diferentes". O outro
 * jurado NÃO é um colega — nenhum dado de outra criança sai daqui. O servidor o
 * GERA a partir das áreas reais que este feed mostrou: o perfil OPOSTO, que é a
 * mesma distribuição de posts e curtidas espelhada (a área que mais apareceu
 * para a criança é a que menos apareceu para o par, e vice-versa).
 *
 * Puro e determinístico pela semente (o empate na ordem das áreas também).
 */

export type HistoricoPorArea = { area: Area; posts: number; curtidas: number };
export type Historico = { areaPrincipal: Area | null; porArea: HistoricoPorArea[] };

function curtidasPorArea(curtidos: readonly string[]): Record<Area, number> {
  const total = Object.fromEntries(AREAS.map((a) => [a, 0])) as Record<Area, number>;
  for (const post of curtidos) total[areaDoProjeto(projetoDoPost(post))] += 1;
  return total;
}

export function parSimulado(feed: EstadoDoFeed, semente: string): { voce: Historico; outroJurado: Historico } {
  const posts = postsPorArea(feed.servidos);
  const curtidas = curtidasPorArea(feed.curtidos);
  const principal = areaDominante(feed);

  /* As áreas da mais vista para a menos vista (a principal primeiro; o empate
     pela ordem sorteada da sessão), e o espelho: a i-ésima recebe os números da
     (n-1-i)-ésima. */
  const ordem = embaralhar(AREAS, semente, "par:areas").sort(
    (x, y) => Number(y === principal) - Number(x === principal) || posts[y] - posts[x] || curtidas[y] - curtidas[x],
  );
  const espelho = new Map<Area, Area>(ordem.map((area, i) => [area, ordem[ordem.length - 1 - i] as Area]));

  const voce: Historico = {
    areaPrincipal: principal,
    porArea: AREAS.map((area) => ({ area, posts: posts[area], curtidas: curtidas[area] })),
  };
  const outroJurado: Historico = {
    areaPrincipal: principal ? (espelho.get(principal) ?? null) : null,
    porArea: AREAS.map((area) => {
      const origem = espelho.get(area) ?? area;
      return { area, posts: posts[origem], curtidas: curtidas[origem] };
    }),
  };
  return { voce, outroJurado };
}
