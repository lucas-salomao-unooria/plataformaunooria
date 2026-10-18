import { z } from "zod";
import {
  BLOCOS_VALIDOS,
  CARTOES_POR_BLOCO,
  IDS_DE_BLOCO,
  LADOS_DA_CONDICAO,
  REPETICOES,
  SE_FALHAR,
  TAMANHO_DA_CHAVE,
  type IdDeBloco,
  type LadoDaCondicao,
  type Repeticao,
  type SeFalhar,
} from "../vocabulario";

/**
 * A MONTAGEM da Chave do Editor (3.0.0, ADR-168) — o "Montador": a criança
 * escolhe três blocos entre seis (três pilares e três iscas), põe cada um numa
 * vaga ordenada, decide de que lado fica cada cartão de condição do bloco
 * (APROVA ou REPROVA), o que fazer quando a pista falha ("Não publico" ou "Olho
 * a próxima pista") e se os passos valem para TODAS as notícias ou só para a
 * primeira. Puro, e só no servidor: o lado certo de cada cartão é GABARITO
 * (regra 3) e não desce ao bundle.
 *
 * Um envio, sem correção e sem nova tentativa — é o dado da EF15CO02. A ordem
 * das vagas NÃO pesa na régua (decisão do plenário): conferir fonte, data e
 * autoria dá o mesmo veredito em qualquer ordem; a ordem ganha função na
 * simulação, onde a criança segue a dela.
 */

export interface VagaMontada {
  bloco: IdDeBloco;
  /** O lado que a criança deu a cada um dos dois cartões do bloco, na ordem `<bloco>-1`, `<bloco>-2`. */
  lados: [LadoDaCondicao, LadoDaCondicao];
  seFalhar: SeFalhar;
}

export interface Montagem {
  vagas: VagaMontada[];
  repeticao: Repeticao;
}

/** O corpo do `POST chave`: três vagas COMPLETAS e distintas — o "Pronto" só habilita assim. */
export const MontagemSchema = z
  .object({
    vagas: z
      .array(
        z.object({
          bloco: z.enum(IDS_DE_BLOCO),
          lados: z.tuple([z.enum(LADOS_DA_CONDICAO), z.enum(LADOS_DA_CONDICAO)]),
          seFalhar: z.enum(SE_FALHAR),
        }),
      )
      .length(TAMANHO_DA_CHAVE),
    repeticao: z.enum(REPETICOES),
  })
  .refine((m) => new Set(m.vagas.map((v) => v.bloco)).size === TAMANHO_DA_CHAVE, {
    message: "Os três blocos da Chave são diferentes.",
  });

/** Lê o JSONB gravado; `null` quando falta ou está torto. */
export function montagemDaLinha(bruto: unknown): Montagem | null {
  const lido = MontagemSchema.safeParse(bruto);
  return lido.success ? (lido.data as Montagem) : null;
}

/**
 * O lado CERTO de cada cartão dos pilares — o 1º faz a pista passar, o 2º a faz
 * falhar (os textos estão em `catalogo.ts#CARTOES_DA_CHAVE`). A ORDEM em que a
 * tela os mostra é embaralhada por sessão, então "o de cima aprova" não é dica.
 * Cartão de isca não tem lado certo: na régua ele conta como errado.
 */
export const LADO_CERTO: readonly [LadoDaCondicao, LadoDaCondicao] = ["aprova", "reprova"];

const PILARES = new Set<string>(BLOCOS_VALIDOS);

export function ehBlocoPilar(bloco: IdDeBloco): boolean {
  return PILARES.has(bloco);
}

/** A correção da montagem, campo a campo — o que a régua e o painel leem. */
export interface CorrecaoDaMontagem {
  /** Quantas vagas têm isca. */
  iscas: number;
  /** Condições certas, de 0 a 6 (os cartões de isca contam como errados). */
  condicoesCertas: number;
  /** Quantas vagas dizem "Não publico" quando a pista falha. */
  paradas: number;
  repeticaoCerta: boolean;
}

export function corrigirMontagem(m: Montagem): CorrecaoDaMontagem {
  let iscas = 0;
  let condicoesCertas = 0;
  let paradas = 0;
  for (const v of m.vagas) {
    if (!ehBlocoPilar(v.bloco)) {
      iscas += 1;
    } else {
      for (let i = 0; i < CARTOES_POR_BLOCO; i++) if (v.lados[i] === LADO_CERTO[i]) condicoesCertas += 1;
    }
    if (v.seFalhar === "parar") paradas += 1;
  }
  return { iscas, condicoesCertas, paradas, repeticaoCerta: m.repeticao === "todas" };
}

/** A classe BRUTA da montagem: certa, errada ou no meio. */
export type ClasseDaMontagem = "certa" | "meio" | "errada";

/**
 * - CERTA: os três pilares, sem isca; ≥ 5 de 6 condições; "Não publico" nas
 *   três vagas; "em TODAS as notícias";
 * - ERRADA: duas iscas ou mais, ou no máximo 3 de 6 condições;
 * - senão, no meio.
 */
export function classeDaMontagem(c: CorrecaoDaMontagem): ClasseDaMontagem {
  if (c.iscas === 0 && c.condicoesCertas >= 5 && c.paradas === TAMANHO_DA_CHAVE && c.repeticaoCerta) return "certa";
  if (c.iscas >= 2 || c.condicoesCertas <= 3) return "errada";
  return "meio";
}
