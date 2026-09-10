import "server-only";
import { notFound } from "next/navigation";
import { apiDoServidor } from "./api-servidor";

/**
 * O QUE ESTÁ LIGADO PARA ESTA ESCOLA (ADR-87) — a leitura do interruptor da
 * rede, do lado do hub.
 *
 * O vocabulário de produtos é uma CÓPIA DELIBERADA do `slug` de
 * `lib/produtos.ts`, que por sua vez é cópia do `PRODUTOS` da api. É o mesmo
 * arranjo de `lib/papeis.ts`: aquele arquivo carrega a COPY (nome, chamada,
 * descrição) e vai para o bundle; a api carrega a composição. O que segura a
 * divergência é o `Record` exaustivo de `PRODUTOS` — produto novo sem copy não
 * compila — e o teste dos manifestos, do lado da api.
 */

export type EfetivoDoRecurso = { ligado: boolean; versao: string | null };

export interface RecursosEfetivos {
  produtos: Record<string, EfetivoDoRecurso>;
  experiencias: Record<string, EfetivoDoRecurso>;
}

/** `null` quando a api não respondeu — ver `produtoLigado` para o que fazer. */
export async function recursosEfetivos(): Promise<RecursosEfetivos | null> {
  return apiDoServidor<RecursosEfetivos>("/recursos/efetivos");
}

/**
 * FALHA ABERTA quando a api não responde, e isso é decisão — a mesma de
 * `/exp/[expId]` com `minhasSalas()`.
 *
 * A porta de verdade é do servidor (`exigirMissaoLiberada` e o
 * `DisponibilidadeGuard`), então deixar passar aqui não abre nada: a api recusa
 * na primeira chamada. Falhar FECHADA faria uma api pendurada esconder os
 * produtos de toda a rede — um incidente de leitura virando um incidente de
 * produto, com a tela dizendo "isto não existe" em vez de "isto não carregou".
 */
export async function produtoLigado(slug: string): Promise<boolean> {
  const efetivos = await recursosEfetivos();
  if (!efetivos) return true;
  return efetivos.produtos[slug]?.ligado !== false;
}

/**
 * A GUARDA DAS ROTAS DE PRODUTO. Chamada pelo LAYOUT da área do produto, nunca
 * pela página: layout cobre a subárvore inteira, e é o que faz a rota nova
 * nascer coberta — a mesma razão pela qual a trilha é do layout (ADR-77).
 *
 * 404 e não uma tela de "produto desativado": para o professor daquela rede o
 * produto não existe, e uma tela explicando que existe mas foi desligado é a
 * Unooria contando ao cliente o que ela vendeu a quem.
 */
export async function exigirProdutoLigado(slug: string): Promise<void> {
  if (!(await produtoLigado(slug))) notFound();
}
