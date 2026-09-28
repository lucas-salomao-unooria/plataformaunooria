import { z } from "zod";
import { IDS_DE_NOTICIA, TIPOS_DE_PISTA, type IdDeNoticia, type TipoDePista } from "../vocabulario";
import type { Passo } from "./passos";

/**
 * O REGISTRO DAS PISTAS — quem abriu qual (notícia, tipo), em que fase. Puro.
 *
 * É o dado da EF15CO04 (decompor "posso confiar?" em fonte, data e autoria) e
 * a metade do `edicao-2` da EF04CO08. Por isso o TEXTO da pista desce pelo
 * `POST pista`, e não na sessão: uma pista lida sem registro seria evidência
 * que a plataforma não vê (`contrato-de-rotas.ts`). Abrir um campo NÃO prova
 * compreensão (PDF §11) — o registro apoia a observação do professor.
 *
 * Duas FASES: a mesa da 1ª edição (fase 1) e a mesa de revisão (fase 2). O
 * mesmo par pode entrar uma vez em cada fase, e nunca duas vezes na mesma:
 * abrir de novo é idempotente (o F5 e o toque duplo não contam).
 */

export const FASES_DAS_PISTAS = [1, 2] as const;
export type FaseDaPista = (typeof FASES_DAS_PISTAS)[number];

export interface PistaRegistrada {
  noticiaId: IdDeNoticia;
  tipo: TipoDePista;
  fase: FaseDaPista;
  /** ISO 8601 do servidor. */
  em: string;
}

const PistaRegistradaSchema = z.object({
  noticiaId: z.enum(IDS_DE_NOTICIA),
  tipo: z.enum(TIPOS_DE_PISTA),
  fase: z.union([z.literal(1), z.literal(2)]),
  em: z.string(),
});

/**
 * Lê o JSONB da sessão. Tolerante: uma entrada torta (gravada por outro
 * caminho) é descartada, não derruba a sessão — o CHECK só garante o array.
 */
export function pistasDaLinha(bruto: unknown): PistaRegistrada[] {
  if (!Array.isArray(bruto)) return [];
  const pistas: PistaRegistrada[] = [];
  for (const item of bruto) {
    const lido = PistaRegistradaSchema.safeParse(item);
    if (lido.success) pistas.push(lido.data);
  }
  return pistas;
}

/** Em que fase o passo EFETIVO abre pistas — `null` fora da mesa e da revisão. */
export function faseDoPasso(passoEfetivo: Passo): FaseDaPista | null {
  if (passoEfetivo === "mesa") return 1;
  if (passoEfetivo === "revisao") return 2;
  return null;
}

export const chaveDoPar = (noticiaId: string, tipo: string) => `${noticiaId}:${tipo}`;

/**
 * Registra a abertura. `nova: false` quando o par já estava aberto NESTA fase
 * — e aí a lista volta igual, sem carimbo novo.
 */
export function registrarPista(
  pistas: readonly PistaRegistrada[],
  par: { noticiaId: IdDeNoticia; tipo: TipoDePista },
  fase: FaseDaPista,
  agora: Date,
): { pistas: PistaRegistrada[]; nova: boolean } {
  const ja = pistas.some((p) => p.fase === fase && p.noticiaId === par.noticiaId && p.tipo === par.tipo);
  if (ja) return { pistas: [...pistas], nova: false };
  return { pistas: [...pistas, { ...par, fase, em: agora.toISOString() }], nova: true };
}

/**
 * Os pares DISTINTOS abertos — numa fase, ou nas duas —, na ordem da primeira
 * abertura. É o que o F5 devolve (`pistasAbertas`) e o que as réguas contam.
 */
export function paresAbertos(
  pistas: readonly PistaRegistrada[],
  fase?: FaseDaPista,
): Array<{ noticiaId: IdDeNoticia; tipo: TipoDePista }> {
  const vistos = new Set<string>();
  const pares: Array<{ noticiaId: IdDeNoticia; tipo: TipoDePista }> = [];
  for (const p of pistas) {
    if (fase !== undefined && p.fase !== fase) continue;
    const chave = chaveDoPar(p.noticiaId, p.tipo);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    pares.push({ noticiaId: p.noticiaId, tipo: p.tipo });
  }
  return pares;
}

/**
 * As pistas como a TELA as lista (`pistasAbertas`): uma entrada por par E por
 * fase, na ordem em que foram abertas. O par aberto na mesa e de novo na
 * revisão aparece duas vezes — a gaveta da revisão reabre como estava, e a da
 * mesa também (no modo leitura).
 */
export function pistasDaTela(
  pistas: readonly PistaRegistrada[],
): Array<{ noticiaId: IdDeNoticia; tipo: TipoDePista; fase: FaseDaPista }> {
  return pistas.map((p) => ({ noticiaId: p.noticiaId, tipo: p.tipo, fase: p.fase }));
}
