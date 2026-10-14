import { AREAS, BATIMENTO_VALIDO_MS, SEGUNDOS_PARA_OCIOSO, areaDoProjeto, type Area } from "../vocabulario";
import { postsPorArea } from "./afunilamento";

/**
 * O PAINEL do professor — o que ele conta, puro.
 *
 * O painel é PROJETADO na lousa no pico (PED-07: sem nome ligado a escolha).
 * Então a linha de cada computador diz só PROGRESSO (entrou, votou, abriu a
 * galeria, buscou, revisou, concluiu), e o que a turma escolheu vive no resumo
 * ANÔNIMO: os votos por área, a concentração do feed de quem curtiu e de quem
 * não curtiu, quantos mantiveram ou trocaram.
 *
 * O SINALIZADOR DE OCIOSOS (PRD v2, Anexo §9; melhoria 8) é progresso, não
 * escolha: o ícone ao lado do nome de quem está com a cédula aberta e parado há
 * mais de 60 s.
 */

/**
 * As chaves que a linha do painel NÃO pode ter — o teste cobra por SUBCADEIA,
 * em minúsculas. É a lista de PED-07 e da E14: nem o voto (o projeto, a
 * convicção, a área), nem a taxa de cada criança, nem nível de habilidade.
 *
 * `voto` NÃO está aqui de propósito: `votou` (o progresso) a conteria. Quem
 * segura o voto fora da linha é `projeto`, `area` e `conviccao` — e o teste do
 * VALOR, que procura id de projeto no JSON das linhas.
 */
export const PROIBIDO_NA_LINHA_DO_PAINEL = [
  "projeto",
  "area",
  "conviccao",
  "invisibilidade",
  "concentracao",
  "taxa",
  "percentual",
  "ocultos",
  "nivel",
  "status",
  "nota",
  "score",
  "pontos",
  "ranking",
  "posicao",
  "acerto",
  "tentativa",
  "mecanismo",
  "atitude",
] as const;

/** Votos por área, na ordem das áreas: o gráfico da lousa. */
export function votosPorArea(votos: readonly string[]): Record<Area, number> {
  const total = Object.fromEntries(AREAS.map((a) => [a, 0])) as Record<Area, number>;
  for (const projetoId of votos) total[areaDoProjeto(projetoId)] += 1;
  return total;
}

/**
 * A CONCENTRAÇÃO de um feed: a fração (0–100, inteira) dos posts servidos que
 * caiu na área MAIS vista — 70 para quem curtiu cedo (7 de 10), 30 para quem não
 * interagiu (3 de 10). `null` num feed vazio. É o número da lousa do contraste;
 * a linha do painel não o carrega (PED-07).
 */
export function concentracaoDoFeed(servidos: readonly string[]): number | null {
  if (servidos.length === 0) return null;
  const maior = Math.max(...Object.values(postsPorArea(servidos)));
  return Math.round((maior / servidos.length) * 100);
}

/** A média inteira, ou `null` sem ninguém no grupo. */
export function mediaInteira(valores: readonly number[]): number | null {
  if (valores.length === 0) return null;
  return Math.round(valores.reduce((s, p) => s + p, 0) / valores.length);
}

/**
 * A concentração da TURMA: entre os computadores que votaram, a média da
 * concentração de quem curtiu algum post e a de quem não curtiu nenhum. Esperado,
 * com o motor de quarenta: perto de 70 contra perto de 30.
 */
export function concentracaoDaTurma(
  feeds: readonly { servidos: readonly string[]; curtidos: readonly string[] }[],
): { curtiram: number | null; naoCurtiram: number | null } {
  const curtiram: number[] = [];
  const naoCurtiram: number[] = [];
  for (const feed of feeds) {
    const c = concentracaoDoFeed(feed.servidos);
    if (c === null) continue;
    (feed.curtidos.length > 0 ? curtiram : naoCurtiram).push(c);
  }
  return { curtiram: mediaInteira(curtiram), naoCurtiram: mediaInteira(naoCurtiram) };
}

/**
 * A criança está OCIOSA na cédula? A tela manda um batimento a cada 15 s com a
 * cédula aberta e há quantos segundos não há toque nela (`cedula_inativa_desde`
 * = o instante do último toque). Ocioso = batimento recente (até 40 s) E mais
 * de 60 s sem toque. Sem batimento, volta ao normal sozinho: a cédula fechou,
 * ou o voto foi.
 */
export function ociosoNaCedula(
  batimentoEm: Date | null,
  inativaDesde: Date | null,
  agora: Date,
): boolean {
  if (!batimentoEm || !inativaDesde) return false;
  if (agora.getTime() - batimentoEm.getTime() > BATIMENTO_VALIDO_MS) return false;
  return agora.getTime() - inativaDesde.getTime() > SEGUNDOS_PARA_OCIOSO * 1000;
}
