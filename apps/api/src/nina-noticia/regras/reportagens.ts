import { SUPORTES, type Suporte } from "../vocabulario";
import { idsOpacos } from "./ordem";

/**
 * As três reportagens com ids OPACOS por sessão (`rp-xxx`). Selos, escolha
 * (previsão) e resultado do filtro viajam por esses ids; o servidor traduz
 * para o suporte e grava o SUPORTE (o painel conta "qual ficou de fora").
 */
export type ReportagemDaSessao = { id: string; suporte: Suporte };

/** As três, na ordem fixa dos suportes (mural, portal, telão): a ordem da galeria. */
export function reportagensDaSessao(semente: string): ReportagemDaSessao[] {
  const ids = idsOpacos(semente, "rp", SUPORTES.length);
  return SUPORTES.map((suporte, i) => ({ id: ids[i] as string, suporte }));
}

export type Traducao = { ok: true; suportes: Suporte[] } | { ok: false; codigo: "reportagem-desconhecida" };

/**
 * Traduz ids opacos em suportes, sem repetir e na ordem recebida. Id que a
 * sessão não tem é `reportagem-desconhecida`; repetido conta uma vez.
 */
export function suportesDosIds(semente: string, ids: readonly string[]): Traducao {
  const porId = new Map(reportagensDaSessao(semente).map((r) => [r.id, r.suporte]));
  const suportes: Suporte[] = [];
  for (const id of ids) {
    const suporte = porId.get(id);
    if (!suporte) return { ok: false, codigo: "reportagem-desconhecida" };
    if (!suportes.includes(suporte)) suportes.push(suporte);
  }
  return { ok: true, suportes };
}

/** O caminho de volta: suportes gravados → ids da sessão (para a resposta). */
export function idsDosSuportes(semente: string, suportes: readonly Suporte[]): string[] {
  const porSuporte = new Map(reportagensDaSessao(semente).map((r) => [r.suporte, r.id]));
  return suportes.flatMap((s) => {
    const id = porSuporte.get(s);
    return id ? [id] : [];
  });
}

export type ResultadoDaPrevisao =
  | { ok: true; suportes: Suporte[] }
  | { ok: false; codigo: "previsao-vazia" | "previsao-ja-travada" | "reportagem-desconhecida" };

/**
 * A ESCOLHA da E2 (o "Travar Escolha"): ao menos uma notícia na caixa, e só uma
 * vez — é o LATCH. O que a criança escolheu não é certo nem errado: é a
 * previsão que a omissão vai confrontar.
 */
export function travarPrevisao(semente: string, itens: readonly string[], jaTravada: boolean): ResultadoDaPrevisao {
  if (jaTravada) return { ok: false, codigo: "previsao-ja-travada" };
  if (itens.length === 0) return { ok: false, codigo: "previsao-vazia" };
  const traducao = suportesDosIds(semente, itens);
  if (!traducao.ok) return traducao;
  return { ok: true, suportes: traducao.suportes };
}

/** Os selos da E1: "Avançar" só com os três ("Mesma feira" em cada cartão). */
export function selosCompletos(suportes: readonly Suporte[]): boolean {
  return SUPORTES.every((s) => suportes.includes(s));
}
