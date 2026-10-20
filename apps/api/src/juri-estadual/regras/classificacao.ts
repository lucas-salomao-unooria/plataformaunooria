import type { Nivel } from "../../evidencias/regras";
import { AREAS, areaDoProjeto, projetoDoPost, type Area } from "../vocabulario";
import { opacosEmbaralhados } from "./ordem";

/**
 * A SEPARAÇÃO (EF06CO01): a criança guarda cada estande que o feed lhe mostrou
 * na coleção — a PASTA da área — a que ele pertence. É o "classificar
 * informações, agrupando-as em coleções e associando cada coleção a um tipo de
 * dados" do texto oficial.
 *
 * Desde a 0.7.0 (ADR-176, o pedido do time que rodou a missão) a separação
 * acontece DURANTE o feed, no "Salvar" do post: ele abre as quatro pastas da
 * mostra, como as coleções do Instagram. A tela "Organize o que você viu"
 * saiu; o voto só lacra com todo estande visto numa pasta, e é NO VOTO que o
 * servidor corrige e marca (`respostasDasPastas` + `corrigirClassificacao`).
 * Salvar continua sem pesar no motor (`regras/afunilamento.ts`).
 *
 * Puro. O servidor corrige e dá o nível; a tela nunca vê quantos acertou.
 *
 * O que NÃO é segredo, e não se finge que é: o post traz a área no perfil e na
 * hashtag, que a criança VÊ ao salvar. Na 0.6.0 a tela da separação escondia
 * os dois (id opaco `cl-xxx`); guardar no próprio feed os mostra — a troca
 * está registrada na ADR-176. Quem corrige continua sendo o servidor (regra 3).
 */

/** Com menos estandes vistos, a separação não diz nada: "não avaliado" (o relógio de 8 min levou ao voto). */
export const MINIMO_PARA_CLASSIFICAR = AREAS.length;

/** A fração de acertos que atinge (9 de 10) e a que fica em processo (5 de 10). Chute: ~1/4. */
export const FRACAO_PARA_ATINGIR = 0.9;
export const FRACAO_PARA_EM_PROCESSO = 0.5;

/** Os projetos DISTINTOS que o feed serviu, na ordem em que apareceram. */
export function projetosParaClassificar(servidos: readonly string[]): string[] {
  const vistos: string[] = [];
  for (const post of servidos) {
    const projeto = projetoDoPost(post);
    if (!vistos.includes(projeto)) vistos.push(projeto);
  }
  return vistos;
}

/** Um item da separação como o SERVIDOR o vê: o id opaco e o projeto que ele esconde. */
export type ItemDaClassificacao = { id: string; projetoId: string };

/** Os itens desta sessão, embaralhados pela semente (a ordem do feed também diria a área). */
export function itensDaClassificacao(semente: string, servidos: readonly string[]): ItemDaClassificacao[] {
  return opacosEmbaralhados(projetosParaClassificar(servidos), semente, "cl", "classificacao").map((p) => ({
    id: p.opaco,
    projetoId: p.item,
  }));
}

export type RespostaDaClassificacao = { itemId: string; area: Area };

export type Correcao = { acertos: number; total: number };

/**
 * Corrige a separação. `null` quando o corpo não é desta sessão: falta item,
 * sobra item ou repete item — é corpo inválido (400), nunca "errou".
 */
export function corrigirClassificacao(
  itens: readonly ItemDaClassificacao[],
  respostas: readonly RespostaDaClassificacao[],
): Correcao | null {
  if (respostas.length !== itens.length) return null;
  const porId = new Map(itens.map((i) => [i.id, i.projetoId]));
  const vistos = new Set<string>();
  let acertos = 0;
  for (const r of respostas) {
    const projetoId = porId.get(r.itemId);
    if (projetoId === undefined || vistos.has(r.itemId)) return null;
    vistos.add(r.itemId);
    if (areaDoProjeto(projetoId) === r.area) acertos += 1;
  }
  return { acertos, total: itens.length };
}

/**
 * **EF06CO01** pela fração de acertos: com dez, 9–10 atinge, 5–8 fica em
 * processo, até 4 não atinge. Menos de quatro estandes vistos = `null` (sem
 * marca, "não avaliado"), nunca "não atingiu".
 */
export function nivelDaClassificacao({ acertos, total }: Correcao): Nivel | null {
  if (total < MINIMO_PARA_CLASSIFICAR) return null;
  const fracao = acertos / total;
  if (fracao >= FRACAO_PARA_ATINGIR) return "atingiu";
  if (fracao >= FRACAO_PARA_EM_PROCESSO) return "em_processo";
  return "nao_atingiu";
}

// ─────────────────────────────────────────── as pastas do feed (0.7.0)

/** As pastas da sessão: o post salvo → a área em que a criança o guardou. */
export type Pastas = Readonly<Record<string, Area>>;

export type SalvamentoComPasta = { postId: string; salvou: boolean; pasta?: Area };

/**
 * Aplica os salvamentos às pastas DEPOIS de o feed tê-los aplicado aos
 * `salvos`: salvar com pasta guarda (ou MOVE) o post; tirar dos salvos apaga a
 * pasta. Só sobrevive pasta de post que está nos `salvos` — o post que o feed
 * não serviu já não entrou neles. Salvar sem pasta (bundle anterior à 0.7.0)
 * guarda o post e não lhe dá pasta: ele conta como não separado.
 */
export function aplicarPastas(
  pastas: Pastas,
  salvos: readonly string[],
  salvamentos: readonly SalvamentoComPasta[],
): Record<string, Area> {
  const novas: Record<string, Area> = { ...pastas };
  for (const s of salvamentos) {
    if (!s.salvou) delete novas[s.postId];
    else if (s.pasta) novas[s.postId] = s.pasta;
  }
  const guardados = new Set(salvos);
  for (const postId of Object.keys(novas)) if (!guardados.has(postId)) delete novas[postId];
  return novas;
}

/** A pasta de cada projeto visto: a do ÚLTIMO post dele que está numa pasta (só sessões antigas repetem projeto). */
function pastaDoProjeto(servidos: readonly string[], pastas: Pastas): Map<string, Area> {
  const porProjeto = new Map<string, Area>();
  for (const post of servidos) {
    const pasta = pastas[post];
    if (pasta) porProjeto.set(projetoDoPost(post), pasta);
  }
  return porProjeto;
}

/** Quantos estandes vistos ainda não estão em pasta nenhuma — o voto espera zero. */
export function estandesSemPasta(servidos: readonly string[], pastas: Pastas): number {
  const comPasta = pastaDoProjeto(servidos, pastas);
  return projetosParaClassificar(servidos).filter((p) => !comPasta.has(p)).length;
}

/**
 * As respostas da separação lidas das pastas, no formato da 0.6.0 — os itens
 * opacos da sessão e a área escolhida —, para a correção e a coluna
 * `classificacao_respostas` continuarem as mesmas. `null` se algum estande
 * visto está sem pasta.
 */
export function respostasDasPastas(
  itens: readonly ItemDaClassificacao[],
  servidos: readonly string[],
  pastas: Pastas,
): RespostaDaClassificacao[] | null {
  const comPasta = pastaDoProjeto(servidos, pastas);
  const respostas: RespostaDaClassificacao[] = [];
  for (const item of itens) {
    const area = comPasta.get(item.projetoId);
    if (!area) return null;
    respostas.push({ itemId: item.id, area });
  }
  return respostas;
}
