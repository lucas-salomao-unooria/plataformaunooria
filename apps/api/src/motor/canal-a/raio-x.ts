import { aleatorioDe, embaralhar, type Nivel } from "../../evidencias/regras";
import { CATEGORIA_DO_NEUTRO_NO_TEMA, type OpcaoDoRaioX } from "./vocabulario";

/**
 * O 6a — RAIO-X DO FEED (EF08CO11, ADR-167). Regras PURAS, testadas sem banco
 * (`tests/motor-canal-a-regras.spec.ts`).
 *
 * O estudante vê 6 posts que ELE viu, um de cada vez, e diz de cada um se
 * "puxa para [lado A]", "puxa para [lado B]" ou "informa sem tomar lado". A
 * tarefa vem logo depois da resposta à pergunta-chave, ANTES do debate e da
 * revelação: o nível mede o que ele enxerga de viés sem ter sido avisado.
 */

/** O mínimo que a composição precisa saber de um post do acervo. */
export interface PostDoAcervo {
  id: string;
  lado: string;
  intensidade: number;
  categoria: string;
  aprovado: boolean;
}

export interface EntradaDaComposicao {
  posts: readonly PostDoAcervo[];
  /** Quantas vezes cada post ficou na tela (`EngineState.vistosPorPost`). */
  vistosPorPost: Readonly<Record<string, number>>;
  /** O tempo de tela por post (`EngineState.dwellPorPost`). */
  dwellPorPost: Readonly<Record<string, number>>;
  /** O lado que o feed mais serviu (`calcularExposicao`); `null` = sem lado. */
  ladoDele: "A" | "B" | null;
  /** O sorteio é estável por sessão: a mesma run dá a mesma composição. */
  semente: string;
}

export interface ComposicaoDoRaioX {
  /** Os 6 posts, na ordem da tela (embaralhada). */
  postIds: string[];
  /** O post do lado dele em que mais parou — entra sempre. */
  maisParou: string;
}

/** Nenhuma resposta certa aparece mais de 3 vezes nos 6 posts. */
export const MAXIMO_POR_RESPOSTA = 3;
export const POSTS_DO_RAIO_X = 6;

/**
 * A COMPOSIÇÃO DO RAIO-X — os 6 posts, ou `null` quando ela não fecha.
 *
 * Só entra post que chegou até ele e ficou na tela dele; nenhum da tela cinza
 * (que só mostra os do outro lado, e entregaria o gabarito):
 *   - 2 do lado dele: o post desse lado em que mais parou, e outro qualquer;
 *   - 2 do outro lado: os mais sutis (menor intensidade) entre os que ele viu;
 *   - 2 neutros SOBRE o tema que ele viu (fora do tema nunca entram).
 *
 * A REGRA DOS 3: no máximo 3 de cada resposta certa, então marcar sempre a
 * mesma opção dá no máximo 3 acertos ("não atingiu"). Os casos de falta:
 *   - atividade sem neutro sobre o tema: 3 de cada lado;
 *   - viu menos de 2 neutros sobre o tema: completa com o outro lado até 3; se
 *     faltar, com o lado dele até 3;
 *   - viu menos de 2 do outro lado: completa com neutros até 3; se faltar, com
 *     o lado dele até 3.
 * Sem lado definido, sem post do lado dele visto, ou sem fechar 6: `null` — o
 * Raio-x não aparece, e a habilidade fica com a reflexão.
 */
export function comporRaioX(e: EntradaDaComposicao): ComposicaoDoRaioX | null {
  if (!e.ladoDele) return null;
  const ladoDele = e.ladoDele;
  const outroLado = ladoDele === "A" ? "B" : "A";
  const aleatorio = aleatorioDe(`raio-x:${e.semente}`);
  const viu = (p: PostDoAcervo) => p.aprovado && (e.vistosPorPost[p.id] ?? 0) > 0;
  const dwell = (id: string) => e.dwellPorPost[id] ?? 0;

  const doLadoDele = embaralhar(
    e.posts.filter((p) => viu(p) && p.lado === ladoDele),
    aleatorio,
  );
  if (doLadoDele.length === 0) return null;
  /* O de maior tempo de tela; empate, o primeiro do embaralhamento (estável). */
  const maisParou = doLadoDele.reduce((a, b) => (dwell(b.id) > dwell(a.id) ? b : a));
  const restoDoLadoDele = doLadoDele.filter((p) => p.id !== maisParou.id);

  /* Os mais sutis primeiro: menor intensidade; dentro dela, a ordem sorteada. */
  const doOutroLado = embaralhar(
    e.posts.filter((p) => viu(p) && p.lado === outroLado),
    aleatorio,
  ).sort((a, b) => a.intensidade - b.intensidade);

  const temNeutroNoTema = e.posts.some(
    (p) => p.aprovado && p.lado === "neutro" && p.categoria === CATEGORIA_DO_NEUTRO_NO_TEMA,
  );
  const neutros = temNeutroNoTema
    ? embaralhar(
        e.posts.filter((p) => viu(p) && p.lado === "neutro" && p.categoria === CATEGORIA_DO_NEUTRO_NO_TEMA),
        aleatorio,
      )
    : [];

  /* As metas de partida, e quanto cada grupo tem para dar. */
  const meta = temNeutroNoTema ? { dele: 2, outro: 2, neutro: 2 } : { dele: 3, outro: 3, neutro: 0 };
  const disponivel = { dele: doLadoDele.length, outro: doOutroLado.length, neutro: neutros.length };
  const conta = {
    dele: Math.min(meta.dele, disponivel.dele),
    outro: Math.min(meta.outro, disponivel.outro),
    neutro: Math.min(meta.neutro, disponivel.neutro),
  };
  const completar = (grupo: keyof typeof conta, falta: number): number => {
    const cabe = Math.min(MAXIMO_POR_RESPOSTA, disponivel[grupo]) - conta[grupo];
    const leva = Math.max(0, Math.min(falta, cabe));
    conta[grupo] += leva;
    return falta - leva;
  };
  /* A falta de neutro sai do outro lado, e depois do lado dele. */
  let falta = meta.neutro - conta.neutro;
  if (falta > 0) completar("dele", completar("outro", falta));
  /* A falta do outro lado sai dos neutros (sobre o tema), e depois do lado dele. */
  falta = meta.outro - conta.outro;
  if (falta > 0) completar("dele", temNeutroNoTema ? completar("neutro", falta) : falta);
  /* E, sem neutro na atividade, o lado dele cobre o que ainda faltar. */
  const total = conta.dele + conta.outro + conta.neutro;
  if (total < POSTS_DO_RAIO_X) completar("dele", POSTS_DO_RAIO_X - total);

  if (conta.dele + conta.outro + conta.neutro !== POSTS_DO_RAIO_X) return null;

  const escolhidos = [
    maisParou,
    ...restoDoLadoDele.slice(0, conta.dele - 1),
    ...doOutroLado.slice(0, conta.outro),
    ...neutros.slice(0, conta.neutro),
  ];
  return { postIds: embaralhar(escolhidos, aleatorio).map((p) => p.id), maisParou: maisParou.id };
}

/** O gabarito de um post: o lado em que ele foi escrito, ou "neutro". */
export function gabaritoDoPost(lado: string): OpcaoDoRaioX {
  return lado === "A" || lado === "B" ? lado : "neutro";
}

/**
 * A RÉGUA DO 6a — a do PO, validada com a pedagogia em 2026-10-21 (ADR-179).
 * N é o número de acertos em 6:
 *   - atingiu: 5 ou 6;
 *   - em processo: 3 ou 4;
 *   - não atingiu: 0 a 2.
 * O post em que mais parou continua entrando na composição (e na devolutiva),
 * mas não pesa mais no nível. Todo envio cai em um nível.
 */
export function nivelDoRaioX(entrada: {
  respostas: Readonly<Record<string, OpcaoDoRaioX>>;
  gabarito: Readonly<Record<string, OpcaoDoRaioX>>;
}): { nivel: Nivel; acertos: number } {
  const ids = Object.keys(entrada.gabarito);
  const acertos = ids.filter((id) => entrada.respostas[id] === entrada.gabarito[id]).length;
  if (acertos >= 5) return { nivel: "atingiu", acertos };
  if (acertos >= 3) return { nivel: "em_processo", acertos };
  return { nivel: "nao_atingiu", acertos };
}
