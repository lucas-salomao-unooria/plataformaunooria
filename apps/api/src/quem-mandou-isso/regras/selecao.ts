import { ENCAMINHAMENTOS, type IdDeMensagem } from "../catalogo";

export type ProblemaDaSelecao =
  | "mensagem-desconhecida"
  | "selecao-repetida"
  | "selecao-acima-do-limite"
  | "selecao-incompleta";

/**
 * A SELEÇÃO do Mural contra o pacote da turma.
 *
 * `exata: false` é o `PUT /selecao` (0 a 3, a triagem em andamento: F5 volta
 * com ela); `exata: true` é o latch do `POST /mural` (exatamente 3). Os ids
 * são conferidos contra os DESTE pacote, e não contra a lista `msg_1..msg_8`:
 * uma tela velha falando com um pacote novo não pode encaminhar o que não está
 * no grupo dela.
 */
export function conferirSelecao(
  ids: readonly string[],
  doPacote: ReadonlySet<string>,
  exata: boolean,
): { ok: true; selecao: IdDeMensagem[] } | { ok: false; codigo: ProblemaDaSelecao } {
  if (ids.some((id) => !doPacote.has(id))) return { ok: false, codigo: "mensagem-desconhecida" };
  if (new Set(ids).size !== ids.length) return { ok: false, codigo: "selecao-repetida" };
  if (ids.length > ENCAMINHAMENTOS) return { ok: false, codigo: "selecao-acima-do-limite" };
  if (exata && ids.length < ENCAMINHAMENTOS) return { ok: false, codigo: "selecao-incompleta" };
  return { ok: true, selecao: [...ids] as IdDeMensagem[] };
}

/** A mesma seleção, sem olhar a ordem — é o que torna o duplo toque em "Confirmar envio" idempotente. */
export function mesmaSelecao(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const conjunto = new Set(a);
  return b.every((id) => conjunto.has(id));
}
