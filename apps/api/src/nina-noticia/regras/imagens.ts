import { createHash } from "node:crypto";
import { promptDaCenaFixa, promptDaImagem, type ConteudoDoPacote } from "../conteudo";
import {
  CHAVES_DAS_CENAS_FIXAS,
  CHAVES_DAS_IMAGENS,
  type ChaveDaCenaFixa,
  type ChaveDaImagem,
} from "../vocabulario";

/**
 * As IMAGENS da exp03ef1b — o nome do arquivo e a lista do que existe, puros.
 *
 * Dois grupos, com donos diferentes:
 *
 * - as do PACOTE (`mural`, `portal`, `telao`, `cartaz`): a professora gera,
 *   refaz e aprova no preparo, com a quota dela;
 * - as CENAS FIXAS do banco (`caso-a`, `caso-b`, `extra-1`, `extra-2`: o
 *   Festival de Ciências e o Desafio Extra): iguais para toda turma, geradas uma
 *   vez na conta da PLATAFORMA — pelo `admin` em `/unooria/recursos/imagens-da-nina`
 *   ou, a que ainda faltar, no `gerar-midia` da primeira professora (ADR-199).
 *   A professora nunca as refaz nem paga por elas; o pacote as recebe de graça
 *   quando já estão no storage.
 *
 * **O arquivo é o hash do PEDIDO** (o prompt inteiro, com a versão): a mesma
 * cena gerada uma vez serve a toda turma que homologar o mesmo texto, e um
 * texto editado pela professora é outro arquivo. A imagem REFEITA leva uma
 * variação no nome — sobrescrever o arquivo do pedido trocaria a imagem de
 * todo pacote que a herdou, inclusive o de uma turma em aula.
 */

/** 800×600 (4:3), a foto da reportagem — das quatro do pacote e das cenas fixas. */
export const TAMANHO_DA_IMAGEM = { largura: 800, altura: 600 } as const;

/** Sobe quando o PEDIDO de imagem muda de estilo: o próximo preparo gera de novo em vez de reaproveitar. */
export const VERSAO_DO_PEDIDO_DE_IMAGEM = 1;

export type ChaveDaMidia = ChaveDaImagem | ChaveDaCenaFixa;
export const CHAVES_DA_MIDIA: readonly ChaveDaMidia[] = [...CHAVES_DAS_IMAGENS, ...CHAVES_DAS_CENAS_FIXAS];

export function ehChaveDaImagem(chave: string): chave is ChaveDaImagem {
  return (CHAVES_DAS_IMAGENS as readonly string[]).includes(chave);
}

export function ehChaveDaMidia(chave: string): chave is ChaveDaMidia {
  return (CHAVES_DA_MIDIA as readonly string[]).includes(chave);
}

/** O nome do arquivo no bucket (`experiencias/exp03ef1b/feira/<hash>.webp`). */
export function nomeDaImagem(prompt: string, variacao?: string): string {
  const hash = createHash("sha256").update(`v${VERSAO_DO_PEDIDO_DE_IMAGEM}:${prompt}`).digest("hex").slice(0, 32);
  return variacao ? `feira/${hash}-${variacao}.webp` : `feira/${hash}.webp`;
}

export type ItemDeImagem = { chave: ChaveDaMidia; prompt: string; nome: string };

/** As quatro imagens de um pacote, na ordem do vocabulário (a do telão é a que a tela destaca). */
export function itensDoPacote(conteudo: ConteudoDoPacote): ItemDeImagem[] {
  return CHAVES_DAS_IMAGENS.map((chave) => {
    const prompt = promptDaImagem(chave, conteudo);
    return { chave, prompt, nome: nomeDaImagem(prompt) };
  });
}

/** As quatro cenas fixas do banco (o caso novo e o Desafio Extra). */
export function itensDasCenasFixas(): ItemDeImagem[] {
  return CHAVES_DAS_CENAS_FIXAS.map((chave) => {
    const prompt = promptDaCenaFixa(chave);
    return { chave, prompt, nome: nomeDaImagem(prompt) };
  });
}

/** As URLs de imagem gravadas, só com chave conhecida e valor texto. */
export function midiaDaLinha(bruto: unknown): Partial<Record<ChaveDaMidia, string>> {
  if (bruto === null || typeof bruto !== "object" || Array.isArray(bruto)) return {};
  const midia: Partial<Record<ChaveDaMidia, string>> = {};
  for (const [chave, url] of Object.entries(bruto as Record<string, unknown>)) {
    if (ehChaveDaMidia(chave) && typeof url === "string" && url.length > 0) midia[chave] = url;
  }
  return midia;
}

/** Só as do PACOTE — o que as telas da professora mostram e o contrato dela aceita. */
export function imagensDoPacote(midia: Partial<Record<ChaveDaMidia, string>>): Partial<Record<ChaveDaImagem, string>> {
  const imagens: Partial<Record<ChaveDaImagem, string>> = {};
  for (const chave of CHAVES_DAS_IMAGENS) {
    const url = midia[chave];
    if (url) imagens[chave] = url;
  }
  return imagens;
}

/** "X de 4 imagens prontas" — conta só as do pacote. */
export function resumoDaMidia(midia: Partial<Record<ChaveDaMidia, string>>): { total: number; prontas: number } {
  return { total: CHAVES_DAS_IMAGENS.length, prontas: CHAVES_DAS_IMAGENS.filter((c) => midia[c]).length };
}
