import { z } from "zod";
import { IDS_DE_NOTICIA, TIPOS_DE_PISTA, VEREDITOS, type IdDeNoticia, type TipoDePista, type Veredito } from "../vocabulario";
import { chaveDoPar } from "./pistas";

/**
 * OS JULGAMENTOS da mesa (3.0.0, ADR-168) — o "confio / não confio" que a
 * criança marca numa pista DEPOIS de abri-la e ANTES de decidir a capa. Puro.
 *
 * É o dado da EF15CO04: abrir a pista é dividir o problema em partes; julgar
 * cada uma é resolvê-las; a capa publicada é a combinação. O plenário (F0)
 * pôs o julgamento antes da decisão — julgado depois, ele vira justificativa
 * de uma escolha já feita.
 *
 * Só na mesa da 1ª edição, e o PRIMEIRO julgamento de cada (notícia, pista)
 * vale: mudar de ideia depois não reescreve a evidência (o F5 e o toque duplo
 * também não). Julgar é opcional — a pista aberta e não julgada só não conta.
 */

export interface JulgamentoRegistrado {
  noticiaId: IdDeNoticia;
  tipo: TipoDePista;
  veredito: Veredito;
  /** ISO 8601 do servidor. */
  em: string;
}

const JulgamentoRegistradoSchema = z.object({
  noticiaId: z.enum(IDS_DE_NOTICIA),
  tipo: z.enum(TIPOS_DE_PISTA),
  veredito: z.enum(VEREDITOS),
  em: z.string(),
});

/** Lê o JSONB da sessão; entrada torta é descartada (o CHECK só garante o array). */
export function julgamentosDaLinha(bruto: unknown): JulgamentoRegistrado[] {
  if (!Array.isArray(bruto)) return [];
  const lidos: JulgamentoRegistrado[] = [];
  for (const item of bruto) {
    const lido = JulgamentoRegistradoSchema.safeParse(item);
    if (lido.success) lidos.push(lido.data);
  }
  return lidos;
}

/** Registra o julgamento. `novo: false` quando o par já tinha um — e a lista volta igual. */
export function registrarJulgamento(
  julgamentos: readonly JulgamentoRegistrado[],
  j: { noticiaId: IdDeNoticia; tipo: TipoDePista; veredito: Veredito },
  agora: Date,
): { julgamentos: JulgamentoRegistrado[]; novo: boolean } {
  const ja = julgamentos.some((x) => chaveDoPar(x.noticiaId, x.tipo) === chaveDoPar(j.noticiaId, j.tipo));
  if (ja) return { julgamentos: [...julgamentos], novo: false };
  return { julgamentos: [...julgamentos, { ...j, em: agora.toISOString() }], novo: true };
}

/**
 * O gabarito POR PISTA, derivado do da notícia: a pista que falta merece
 * "não confio", as outras "confio". A invariante do pacote (`invariantes.ts`)
 * garante uma pista em falta por notícia não publicável e nenhuma na
 * publicável — então o gabarito por pista não é outra coisa a manter.
 */
export function vereditoCerto(gabarito: { publicavel: boolean; pilarEmFalta: TipoDePista | null }, tipo: TipoDePista): Veredito {
  return !gabarito.publicavel && gabarito.pilarEmFalta === tipo ? "nao_confio" : "confio";
}
