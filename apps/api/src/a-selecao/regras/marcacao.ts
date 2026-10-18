import { ENQUADRAMENTOS, type Enquadramento } from "../catalogo";
import type { Nivel } from "../../evidencias/regras";

/**
 * O NÍVEL DA MARCAÇÃO — a ação da EF07CO08 (ADR-170).
 *
 * Entre o Mural e as fichas, a criança responde: "Tem algo na publicação de
 * {colega} que a sua deixou de fora e muda a história?" — tocando num dos três
 * posts do colega, ou em "Nada que mude a história". A régua mede TOMADA DE
 * PERSPECTIVA (reconhecer que a outra publicação mostra um lado que faltou na
 * sua), que é o proxy documentado de "demonstrar empatia sobre opiniões
 * divergentes na web". Não mede empatia afetiva, e a ficha diz isso.
 *
 * | Situação                                                   | Nível       |
 * |------------------------------------------------------------|-------------|
 * | post de um enquadramento que FALTA no trio da criança      | atingiu     |
 * | trio 1/1/1 e um post que ela não publicou                  | atingiu     |
 * | post de um enquadramento que ela já tem                    | em_processo |
 * | "nada que mude", com trio 1/1/1                            | em_processo |
 * | "nada que mude", nos outros casos                          | nao_atingiu |
 * | um post que a própria criança publicou                     | nao_atingiu |
 * | não marcou                                                 | `null`      |
 *
 * Duas decisões, com a razão:
 *
 * - **"Nada que mude" é "não atingiu"** (decisão do PO, 16/10): o pareamento
 *   escolhe o colega pela MAIOR diferença, então a publicação dele sempre traz
 *   um lado que faltou — dizer que nada muda é recusar a perspectiva do outro.
 *   A exceção é o trio 1/1/1: quem publicou os três lados não tem lado
 *   faltando, e dizer que nada muda não é recusa.
 * - **Sem marcação = sem nível** ("Não avaliado", ADR-112), nunca "não
 *   atingiu": a criança pode ter faltado, estar em outro computador, ou a
 *   professora ter seguido sem esperar. Quem decide é o ajuste.
 *
 * "Alternou para o colega" NÃO entra: o Mural abre no Story do colega desde a
 * ADR-146, então a condição valeria para todo mundo — ou zeraria justamente
 * quem passou o tempo todo olhando o colega.
 *
 * Limite conhecido, aceito pelo PO: com o par mais distante, um toque ao acaso
 * tende a cair num enquadramento ausente. O "atingiu" é uma medida fraca, e a
 * professora confirma pelo "por quê?" quando quiser.
 */

export type MarcacaoDaSessao = { postId: string } | { nenhum: true } | null;

export interface EntradaDaMarcacao {
  marcacao: MarcacaoDaSessao;
  /** Os 3 ids que a criança publicou. */
  minha: readonly string[];
  /** O enquadramento de cada post da cobertura — gabarito, só do servidor. */
  enquadramentoDe: (id: string) => Enquadramento | undefined;
}

/** O trio cobre os três enquadramentos (1/1/1)? */
export function trioCompleto(minha: readonly string[], enquadramentoDe: EntradaDaMarcacao["enquadramentoDe"]): boolean {
  const lentes = new Set(minha.map(enquadramentoDe).filter((l): l is Enquadramento => Boolean(l)));
  return ENQUADRAMENTOS.every((l) => lentes.has(l));
}

export function nivelDaMarcacao({ marcacao, minha, enquadramentoDe }: EntradaDaMarcacao): Nivel | null {
  if (!marcacao) return null;
  const completo = trioCompleto(minha, enquadramentoDe);
  if ("nenhum" in marcacao) return completo ? "em_processo" : "nao_atingiu";

  if (minha.includes(marcacao.postId)) return "nao_atingiu";
  if (completo) return "atingiu";
  const lente = enquadramentoDe(marcacao.postId);
  if (!lente) return null;
  const minhasLentes = new Set(minha.map(enquadramentoDe));
  return minhasLentes.has(lente) ? "em_processo" : "atingiu";
}
