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
 * Entram primeiro os posts que chegaram até ele e ficaram na tela dele;
 * nenhum da tela cinza (que só mostra os do outro lado, e entregaria o
 * gabarito):
 *   - 2 do lado dele: o post desse lado em que mais parou, e outro qualquer;
 *   - 2 do outro lado: os mais sutis (menor intensidade) entre os que ele viu;
 *   - 2 neutros SOBRE o tema que ele viu (fora do tema, só no último caso
 *     abaixo).
 *
 * A REGRA DOS 3: no máximo 3 de cada resposta certa, então marcar sempre a
 * mesma opção dá no máximo 3 acertos ("não atingiu"). Os casos de falta:
 *   - atividade sem neutro sobre o tema: 3 de cada lado;
 *   - viu menos de 2 neutros sobre o tema: completa com o outro lado até 3; se
 *     faltar, com o lado dele até 3;
 *   - viu menos de 2 do outro lado: completa com neutros até 3; se faltar, com
 *     o lado dele até 3.
 *
 * QUEM VIU POUCO (ADR-179): o PO testou a missão rolando rápido e não achou o
 * Raio-x. Quando os vistos não fecham a composição, ela COMPLETA com posts
 * aprovados que ele NÃO viu — do lado dele e neutros sobre o tema, nunca do
 * outro lado (um post do lado escondido, antes da revelação, mostraria que
 * havia outro feed). Os vistos vêm sempre antes. O "post em que mais parou"
 * é o do lado dele com mais tempo de tela, e entre não vistos, o primeiro.
 *
 * SEMPRE (ADR-183): o PO voltou a não achar a tela. Sem 6 assim, entram os
 * neutros FORA do tema e, sem neutro nenhum, o lado dele passa de 3 (ver o
 * comentário das três tentativas). `null` só sem lado ou com o acervo
 * aprovado menor que 6 — atividade que nem o feed teria como mostrar.
 */
export function comporRaioX(e: EntradaDaComposicao): ComposicaoDoRaioX | null {
  if (!e.ladoDele) return null;
  const ladoDele = e.ladoDele;
  const outroLado = ladoDele === "A" ? "B" : "A";
  const aleatorio = aleatorioDe(`raio-x:${e.semente}`);
  const viu = (p: PostDoAcervo) => p.aprovado && (e.vistosPorPost[p.id] ?? 0) > 0;
  const dwell = (id: string) => e.dwellPorPost[id] ?? 0;

  /* Os vistos primeiro; depois, para completar, os aprovados que ele não viu. */
  const vistosAntes = (lista: PostDoAcervo[]) => [
    ...embaralhar(lista.filter(viu), aleatorio),
    ...embaralhar(lista.filter((p) => p.aprovado && !viu(p)), aleatorio),
  ];
  const doLadoDele = vistosAntes(e.posts.filter((p) => p.aprovado && p.lado === ladoDele));
  if (doLadoDele.length === 0) return null;
  /* O de maior tempo de tela; empate, o primeiro do embaralhamento (estável). */
  const maisParou = doLadoDele.reduce((a, b) => (dwell(b.id) > dwell(a.id) ? b : a));
  const restoDoLadoDele = doLadoDele.filter((p) => p.id !== maisParou.id);

  /* Os mais sutis primeiro: menor intensidade; dentro dela, a ordem sorteada. */
  const doOutroLado = embaralhar(
    e.posts.filter((p) => viu(p) && p.lado === outroLado),
    aleatorio,
  ).sort((a, b) => a.intensidade - b.intensidade);

  const neutroDoTema = (p: PostDoAcervo) => p.aprovado && p.lado === "neutro" && p.categoria === CATEGORIA_DO_NEUTRO_NO_TEMA;
  const neutrosNoTema = vistosAntes(e.posts.filter(neutroDoTema));
  const neutrosForaDoTema = vistosAntes(e.posts.filter((p) => p.aprovado && p.lado === "neutro" && !neutroDoTema(p)));

  /*
   * Três tentativas, da mais fiel à mais larga, e a primeira que fecha vale
   * (ADR-183 — "a tela aparece sempre", independente de quanto ele rolou):
   *   1. só neutros SOBRE o tema, regra dos 3;
   *   2. sem 6 assim, os neutros FORA do tema entram depois dos do tema — o
   *      gabarito deles continua "informa sem tomar lado";
   *   3. sem 6 ainda (atividade sem neutro nenhum, e ele viu pouco do outro
   *      lado), o lado dele passa de 3. É a única que afrouxa a regra dos 3,
   *      e só existe porque o outro lado não visto não entra nunca.
   */
  const conta =
    fecharComposicao(doLadoDele.length, doOutroLado.length, neutrosNoTema.length, MAXIMO_POR_RESPOSTA) ??
    fecharComposicao(doLadoDele.length, doOutroLado.length, neutrosNoTema.length + neutrosForaDoTema.length, MAXIMO_POR_RESPOSTA) ??
    fecharComposicao(doLadoDele.length, doOutroLado.length, neutrosNoTema.length + neutrosForaDoTema.length, POSTS_DO_RAIO_X);
  if (!conta) return null;

  const neutros = [...neutrosNoTema, ...neutrosForaDoTema];
  const escolhidos = [
    maisParou,
    ...restoDoLadoDele.slice(0, conta.dele - 1),
    ...doOutroLado.slice(0, conta.outro),
    ...neutros.slice(0, conta.neutro),
  ];
  return { postIds: embaralhar(escolhidos, aleatorio).map((p) => p.id), maisParou: maisParou.id };
}

/**
 * Quantos posts de cada grupo fecham os 6, ou `null`. `tetoDoLadoDele` é o
 * máximo do lado dele: a regra dos 3, ou 6 na última tentativa. O outro lado e
 * os neutros ficam sempre em 3. As metas partem de
 * 2/2/2 (3/3/0 sem neutro) e a falta se cobre na ordem de sempre: a de neutro
 * pelo outro lado e depois pelo lado dele; a do outro lado pelos neutros e
 * depois pelo lado dele; o que ainda faltar, pelo lado dele.
 */
function fecharComposicao(
  dele: number,
  outro: number,
  neutro: number,
  tetoDoLadoDele: number,
): { dele: number; outro: number; neutro: number } | null {
  const meta = neutro > 0 ? { dele: 2, outro: 2, neutro: 2 } : { dele: 3, outro: 3, neutro: 0 };
  const disponivel = { dele, outro, neutro };
  const conta = {
    dele: Math.min(meta.dele, dele),
    outro: Math.min(meta.outro, outro),
    neutro: Math.min(meta.neutro, neutro),
  };
  const completar = (grupo: keyof typeof conta, falta: number): number => {
    const teto = grupo === "dele" ? tetoDoLadoDele : MAXIMO_POR_RESPOSTA;
    const cabe = Math.min(teto, disponivel[grupo]) - conta[grupo];
    const leva = Math.max(0, Math.min(falta, cabe));
    conta[grupo] += leva;
    return falta - leva;
  };
  let falta = meta.neutro - conta.neutro;
  if (falta > 0) completar("dele", completar("outro", falta));
  falta = meta.outro - conta.outro;
  if (falta > 0) completar("dele", neutro > 0 ? completar("neutro", falta) : falta);
  const total = conta.dele + conta.outro + conta.neutro;
  if (total < POSTS_DO_RAIO_X) completar("neutro", completar("dele", POSTS_DO_RAIO_X - total));
  return conta.dele + conta.outro + conta.neutro === POSTS_DO_RAIO_X ? conta : null;
}

/** O gabarito de um post: o lado em que ele foi escrito, ou "neutro". */
export function gabaritoDoPost(lado: string): OpcaoDoRaioX {
  return lado === "A" || lado === "B" ? lado : "neutro";
}

/**
 * A RÉGUA DO 6a — a do PO, validada com a pedagogia em 2026-10-21 (ADR-179)
 * e ajustada por ele em 2026-10-22 (ADR-180). N é o número de acertos em 6:
 *   - atingiu: 5 ou 6;
 *   - em processo: 4;
 *   - não atingiu: 0 a 3.
 * Os 3 acertos ficam abaixo de "em processo" pela regra dos 3: nenhuma
 * resposta certa aparece mais de 3 vezes, então quem marca a mesma opção nos
 * 6 posts, sem ler nenhum, acerta até 3.
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
  if (acertos === 4) return { nivel: "em_processo", acertos };
  return { nivel: "nao_atingiu", acertos };
}
