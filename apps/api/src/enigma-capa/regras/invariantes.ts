import {
  ERROS_ATE_A_AJUDA,
  FOTOS,
  INVARIANTES,
  RECORTE_DA_FOTO,
  type FotoId,
  type InvarianteDaCena,
  type InvarianteId,
  type Ponto,
} from "../conteudo";
import { acertaAlvo, contemPonto } from "./geometria";

/**
 * A BUSCA DOS INVARIANTES (E4, Momento 4): "TOQUE EM 2 COISAS IGUAIS" — os dois
 * objetos do fundo, nas DUAS fotos. Quatro acertos (2 invariantes × 2 fotos)
 * completam. O gabarito (os alvos) é do servidor.
 *
 * Os erros contam até `ERROS_ATE_A_AJUDA` (3): no terceiro, a AJUDA acende — o
 * relógio e o cartaz pulsam (one-pager §7), e só então os alvos descem ao
 * cliente. Os erros DEPOIS da ajuda contam à parte: são o "precisou de
 * apontamento do professor" que a EF02CO01 mede. O fluxo nunca trava: com a
 * ajuda acesa, a criança (ou o professor ao lado dela) acha os quatro.
 */

/** `"inv-1:foto-1"` — um invariante achado numa foto. */
export type Achado = `${InvarianteId}:${FotoId}`;
export const TOTAL_DE_ACHADOS = INVARIANTES.length * FOTOS.length;

export interface BuscaDaSessao {
  encontrados: Achado[];
  erros: number;
  ajuda: boolean;
  errosPosAjuda: number;
}

export type ResultadoDoToque =
  | { ok: false; motivo: "fora-da-foto" | "sem-alvos" }
  | { ok: true; acerto: InvarianteId | null; busca: BuscaDaSessao; ajudaAcendeu: boolean; completou: boolean; mudou: boolean };

export function completa(b: Pick<BuscaDaSessao, "encontrados">): boolean {
  return b.encontrados.length >= TOTAL_DE_ACHADOS;
}

/** Lê a lista gravada, descartando o que não é um achado válido. */
export function lerAchados(bruto: unknown): Achado[] {
  if (!Array.isArray(bruto)) return [];
  const validos = new Set<string>(INVARIANTES.flatMap((i) => FOTOS.map((f) => `${i}:${f}`)));
  return [...new Set(bruto.filter((x): x is string => typeof x === "string" && validos.has(x)))] as Achado[];
}

/**
 * Um toque em `fotoId`, no ponto `p` da PANORÂMICA. O toque fora do recorte da
 * foto é recusado (é defeito da tela, não erro da criança). Tocar de novo um
 * achado não é erro nem acerto novo. Depois de completa, nada muda.
 */
export function tocar(busca: BuscaDaSessao, invariantes: readonly InvarianteDaCena[], fotoId: FotoId, p: Ponto): ResultadoDoToque {
  if (!contemPonto(RECORTE_DA_FOTO[fotoId], p)) return { ok: false, motivo: "fora-da-foto" };
  if (invariantes.some((i) => i.alvo === null)) return { ok: false, motivo: "sem-alvos" };
  const acertado = invariantes.find((i) => i.alvo !== null && acertaAlvo(i.alvo, p)) ?? null;
  if (completa(busca)) {
    return { ok: true, acerto: acertado?.id ?? null, busca, ajudaAcendeu: false, completou: false, mudou: false };
  }
  if (acertado) {
    const achado = `${acertado.id}:${fotoId}` as Achado;
    if (busca.encontrados.includes(achado)) {
      return { ok: true, acerto: acertado.id, busca, ajudaAcendeu: false, completou: false, mudou: false };
    }
    const nova = { ...busca, encontrados: [...busca.encontrados, achado] };
    return { ok: true, acerto: acertado.id, busca: nova, ajudaAcendeu: false, completou: completa(nova), mudou: true };
  }
  if (busca.ajuda) {
    return { ok: true, acerto: null, busca: { ...busca, errosPosAjuda: busca.errosPosAjuda + 1 }, ajudaAcendeu: false, completou: false, mudou: true };
  }
  const erros = busca.erros + 1;
  const ajudaAcendeu = erros >= ERROS_ATE_A_AJUDA;
  return { ok: true, acerto: null, busca: { ...busca, erros, ajuda: ajudaAcendeu }, ajudaAcendeu, completou: false, mudou: true };
}
