import type { Nivel } from "../../evidencias/regras";
import { TIPOS_DE_PISTA, TAMANHO_DA_EDICAO } from "../vocabulario";
import { paresAbertos, type PistaRegistrada } from "./pistas";

/**
 * As RÉGUAS das três ações da ficha (`evidencias/fichas/exp04ef1b.ts`). Puras:
 * a missão calcula o nível AQUI e o entrega pela porta `marcar`, dentro da
 * transação do latch ou da Chave.
 *
 * Quem sai antes de uma ação não tem marca dela — "Não avaliado", a AUSÊNCIA
 * de linha (E14) —, nunca "não atingiu". O "não atingiu" de cada régua é de
 * quem FEZ a ação sem o que ela mede.
 */

/** Os marcadores de ação da ficha. Os ids são contrato com `fichas/exp04ef1b.ts`. */
export const MARCADOR_DAS_PISTAS = "pistas";
export const MARCADOR_DA_CHAVE = "chave";
export const MARCADOR_DA_EDICAO_2 = "edicao-2";

/** Quantas notícias com os três tipos abertos a EF15CO04 pede para "atingiu". */
export const NOTICIAS_DECOMPOSTAS_PARA_ATINGIR = 2;

/**
 * **EF15CO04** (decomposição), marcada na 1ª publicação, sobre as pistas da
 * FASE 1 — as que a criança abriu antes de decidir, sem ninguém pedir (PDF §4:
 * "não há obrigação de abrir um número mínimo de campos"):
 * - atingiu: abriu os três tipos em pelo menos duas notícias;
 * - em processo: abriu alguma pista;
 * - não atingiu: publicou sem abrir nenhuma.
 */
export function nivelDasPistas(pistas: readonly PistaRegistrada[]): Nivel {
  const pares = paresAbertos(pistas, 1);
  if (pares.length === 0) return "nao_atingiu";
  const tiposPorNoticia = new Map<string, Set<string>>();
  for (const p of pares) {
    const tipos = tiposPorNoticia.get(p.noticiaId) ?? new Set<string>();
    tipos.add(p.tipo);
    tiposPorNoticia.set(p.noticiaId, tipos);
  }
  const decompostas = [...tiposPorNoticia.values()].filter((t) => t.size === TIPOS_DE_PISTA.length).length;
  return decompostas >= NOTICIAS_DECOMPOSTAS_PARA_ATINGIR ? "atingiu" : "em_processo";
}

/**
 * **EF15CO02** (algoritmo), marcada quando a Chave se forma, pelo número de
 * tentativas (o PRD, §14): uma = atingiu; duas ou três = em processo; mais de
 * três = não atingiu.
 */
export function nivelDaChave(tentativas: number): Nivel {
  if (tentativas <= 1) return "atingiu";
  if (tentativas <= 3) return "em_processo";
  return "nao_atingiu";
}

/** Os limiares do `edicao-2` — o "campos" do PRD é par (notícia, tipo) distinto. */
export const REGUA_DA_EDICAO_2 = { camposParaAtingir: 6, camposMinimos: 3, verificadasMinimas: 1 } as const;

/**
 * **EF04CO08** (verificar a confiabilidade das fontes), marcador de ação
 * `edicao-2`, na 2ª publicação:
 * - `campos` = pares (notícia, tipo) DISTINTOS abertos nas duas fases;
 * - `v2` = verificadas da 2ª edição;
 * - atingiu: `campos ≥ 6` e `v2 = 3`;
 * - não atingiu: `v2 ≤ 1` e `campos < 3`;
 * - senão, em processo.
 *
 * O PRD pedia os dois E a P1 no mesmo "atingiu"; aqui a P1 é outro marcador
 * da mesma habilidade, e vale o MELHOR dos três (a política da E14) — o que
 * afrouxa o "E" do PRD, registrado na ficha.
 */
export function nivelDaEdicao2(pistas: readonly PistaRegistrada[], verificadas2: number): Nivel {
  const campos = paresAbertos(pistas).length;
  const r = REGUA_DA_EDICAO_2;
  if (campos >= r.camposParaAtingir && verificadas2 === TAMANHO_DA_EDICAO) return "atingiu";
  if (verificadas2 <= r.verificadasMinimas && campos < r.camposMinimos) return "nao_atingiu";
  return "em_processo";
}
