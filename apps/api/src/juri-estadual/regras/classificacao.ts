import type { Nivel } from "../../evidencias/regras";
import { AREAS, areaDoProjeto, projetoDoPost, type Area } from "../vocabulario";
import { opacosEmbaralhados } from "./ordem";

/**
 * A SEPARAÇÃO (EF06CO01, ADR-174): logo depois do voto, a criança põe cada
 * estande que o feed lhe mostrou na coleção — a área — a que ele pertence. É o
 * "classificar informações, agrupando-as em coleções e associando cada coleção
 * a um tipo de dados" do texto oficial.
 *
 * Puro. O servidor monta os itens, corrige e dá o nível; a tela recebe os
 * estandes com id OPACO (`cl-xxx`), sem área, sem hashtag e sem perfil (o
 * `perfil` do post é a própria hashtag), e nunca vê quantos acertou.
 *
 * O que NÃO é segredo, e não se finge que é: o feed já entregou a área de cada
 * post ao aparelho (é a hashtag que a criança VIU). O id opaco tira a resposta
 * da tela; quem corrige é o servidor (regra 3).
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
