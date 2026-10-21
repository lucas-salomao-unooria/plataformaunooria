import type { Nivel } from "../../evidencias/regras";
import { TAMANHO_DA_EDICAO, TIPOS_DE_PISTA, type IdDeNoticia, type TipoDePista } from "../vocabulario";
import { vereditoCerto, type JulgamentoRegistrado } from "./julgamentos";
import { classeDaMontagem, corrigirMontagem, type ClasseDaMontagem, type Montagem } from "./montagem";
import { paresAbertos, type PistaRegistrada } from "./pistas";
import { simulacaoFiel, type Simulacao } from "./simulacao";
import type { Transferencia } from "./transferencia";

/**
 * As RÉGUAS da ficha 2 (`evidencias/fichas/exp04ef1b.ts`, 3.0.0, ADR-168) —
 * Canal A PURO: as três habilidades medidas só por ação, sem pergunta de
 * múltipla escolha. Puras: a missão calcula o nível AQUI e o entrega pela porta
 * `marcar`, dentro da transação da jogada.
 *
 * **A combinação cabe no "melhor dos marcadores".** A plataforma grava a 1ª
 * marca de cada marcador e soma os de uma habilidade pelo MELHOR. As duas
 * habilidades medidas em dois momentos usam um marcador PARCIAL com teto em
 * "em processo" (a montagem, a 2ª edição) e um marcador FINAL que grava o
 * COMBINADO (a simulação, a transferência). Quem não chega ao fim fica com o
 * parcial; as tabelas do PO saem inteiras do melhor dos dois (o plenário
 * conferiu as combinações).
 *
 * Quem sai antes de uma ação não tem marca dela — "Não avaliado", a AUSÊNCIA
 * de linha (E14) —, nunca "não atingiu".
 */

/** Os marcadores de ação da ficha. Os ids são contrato com `fichas/exp04ef1b.ts`. */
export const MARCADOR_DOS_JULGAMENTOS = "julgamentos";
export const MARCADOR_DA_MONTAGEM = "montagem";
export const MARCADOR_DA_SIMULACAO = "simulacao";
export const MARCADOR_DA_EDICAO_2 = "edicao-2";
export const MARCADOR_DA_TRANSFERENCIA = "transferencia";

/** O teto do marcador PARCIAL: nunca "atingiu" sozinho. */
function comTeto(nivel: Nivel): Nivel {
  return nivel === "atingiu" ? "em_processo" : nivel;
}

// ─────────────────────────────────────────────────────── EF15CO04 — a mesa

/** Os limiares da EF15CO04. */
export const REGUA_DOS_JULGAMENTOS = {
  /** Cada tipo de pista julgado em pelo menos tantas notícias. */
  noticiasPorTipo: 2,
  /** Fração de julgamentos certos para "atingiu". */
  certosParaAtingir: 0.8,
  /** Abaixo disto, "não atingiu". */
  certosMinimos: 0.5,
  /** Fração das pistas COM FURO que ela abriu em que o "não confio" tem de estar certo. */
  furosParaAtingir: 0.5,
} as const;

type GabaritoDaNoticia = { id: IdDeNoticia; gabarito: { publicavel: boolean; pilarEmFalta: TipoDePista | null } };

/**
 * **EF15CO04** (decomposição), marcada na 1ª publicação, sobre os julgamentos
 * da mesa e a capa publicada:
 * - atingiu: CADA tipo julgado em ≥ 2 notícias; ≥ 80% dos julgamentos certos;
 *   "não confio" certo em ≥ metade das pistas COM FURO que ela abriu (no
 *   mínimo uma) — o que fecha o atalho de marcar tudo "confio", porque só 4
 *   das 24 pistas falham; e COERÊNCIA: nenhuma notícia da capa tem pista que
 *   ela mesma marcou "não confio";
 * - não atingiu: nenhum julgamento, ou menos de 50% certos;
 * - senão, em processo.
 */
export function nivelDosJulgamentos(
  julgamentos: readonly JulgamentoRegistrado[],
  pistas: readonly PistaRegistrada[],
  noticias: readonly GabaritoDaNoticia[],
  capa: readonly IdDeNoticia[],
): Nivel {
  if (julgamentos.length === 0) return "nao_atingiu";
  const r = REGUA_DOS_JULGAMENTOS;
  const porId = new Map(noticias.map((n) => [n.id, n.gabarito]));
  const certos = julgamentos.filter((j) => {
    const g = porId.get(j.noticiaId);
    return g !== undefined && vereditoCerto(g, j.tipo) === j.veredito;
  }).length;
  const fracao = certos / julgamentos.length;
  if (fracao < r.certosMinimos) return "nao_atingiu";

  const cobertura = TIPOS_DE_PISTA.every(
    (tipo) => new Set(julgamentos.filter((j) => j.tipo === tipo).map((j) => j.noticiaId)).size >= r.noticiasPorTipo,
  );
  const furosAbertos = paresAbertos(pistas, 1).filter((p) => {
    const g = porId.get(p.noticiaId);
    return g !== undefined && vereditoCerto(g, p.tipo) === "nao_confio";
  });
  const furosPegos = furosAbertos.filter((p) =>
    julgamentos.some((j) => j.noticiaId === p.noticiaId && j.tipo === p.tipo && j.veredito === "nao_confio"),
  ).length;
  const furosOk = furosPegos >= 1 && furosPegos >= furosAbertos.length * r.furosParaAtingir;
  const naCapa = new Set<string>(capa);
  const coerente = !julgamentos.some((j) => j.veredito === "nao_confio" && naCapa.has(j.noticiaId));

  return cobertura && fracao >= r.certosParaAtingir && furosOk && coerente ? "atingiu" : "em_processo";
}

// ─────────────────────────────────────────────── EF15CO02 — Chave e simulação

/** O nível bruto da classe da montagem. */
const NIVEL_DA_CLASSE: Record<ClasseDaMontagem, Nivel> = {
  certa: "atingiu",
  meio: "em_processo",
  errada: "nao_atingiu",
};

/** A classe da montagem, para a régua e o painel. */
export function classeDe(m: Montagem): ClasseDaMontagem {
  return classeDaMontagem(corrigirMontagem(m));
}

/** **EF15CO02**, marcador PARCIAL `montagem`, no "Pronto": N se errada, senão P (o teto). */
export function nivelDaMontagem(m: Montagem): Nivel {
  return comTeto(NIVEL_DA_CLASSE[classeDe(m)]);
}

/**
 * **EF15CO02**, marcador FINAL `simulacao`, no fim da simulação: A se FIEL e
 * montagem CERTA; P se fiel e a montagem não estava certa (a regra errada
 * aplicada sem se contradizer — a lógica está lá, o conteúdo não); N se infiel.
 * Com a `montagem`: certa+fiel=A, certa+infiel=P, errada+fiel=P,
 * errada+infiel=N, meio+qualquer=P.
 */
export function nivelDaSimulacao(m: Montagem, s: Simulacao): Nivel {
  if (!simulacaoFiel(m, s)) return "nao_atingiu";
  return classeDe(m) === "certa" ? "atingiu" : "em_processo";
}

// ─────────────────────────────────────── EF04CO08 — 2ª edição e transferência

/** Os limiares do `edicao-2` — o "campo" é par (notícia, tipo) distinto, nas duas fases. */
export const REGUA_DA_EDICAO_2 = { camposMinimos: 3, verificadasMinimas: 1 } as const;

/**
 * O nível BRUTO da 2ª edição:
 * - atingiu: as 3 verificadas E cada uma das 3 publicadas com as 3 pistas
 *   abertas por ela (na mesa ou na revisão) — a revisão marca os furos, então
 *   o 3/3 sozinho viria do feedback, e não da habilidade;
 * - não atingiu: no máximo 1 verificada e menos de 3 pares abertos;
 * - senão, em processo.
 */
export function nivelBrutoDaEdicao2(
  pistas: readonly PistaRegistrada[],
  slots2: readonly IdDeNoticia[],
  verificadas2: number,
): Nivel {
  const pares = paresAbertos(pistas);
  const r = REGUA_DA_EDICAO_2;
  const conferidas = slots2.filter((id) => TIPOS_DE_PISTA.every((t) => pares.some((p) => p.noticiaId === id && p.tipo === t)));
  if (verificadas2 === TAMANHO_DA_EDICAO && conferidas.length === TAMANHO_DA_EDICAO) return "atingiu";
  if (verificadas2 <= r.verificadasMinimas && pares.length < r.camposMinimos) return "nao_atingiu";
  return "em_processo";
}

/** **EF04CO08**, marcador PARCIAL `edicao-2`, no latch da 2ª: o bruto com teto. */
export function nivelDaEdicao2(pistas: readonly PistaRegistrada[], slots2: readonly IdDeNoticia[], verificadas2: number): Nivel {
  return comTeto(nivelBrutoDaEdicao2(pistas, slots2, verificadas2));
}

/**
 * A transferência sozinha: A = abriu a pista de FONTE (a que revela
 * "encaminhada") ou pelo menos duas, e não repassou; N = repassou sem abrir
 * nada; senão, P.
 */
export function nivelBrutoDaTransferencia(t: Transferencia): Nivel {
  const verificou = t.pistas.includes("fonte") || t.pistas.length >= 2;
  if (verificou && t.decisao === "nao_repassar") return "atingiu";
  if (t.pistas.length === 0 && t.decisao === "repassar") return "nao_atingiu";
  return "em_processo";
}

/**
 * **EF04CO08**, marcador FINAL `transferencia`, o COMBINADO: A se a 2ª edição
 * BRUTA e a transferência são A; N se a transferência é N; senão P. Com o
 * `edicao-2` (teto): as nove combinações dão a tabela do PO — A só com as duas
 * A, N só com as duas N.
 */
export function nivelDaTransferencia(bruto2: Nivel | null, t: Transferencia): Nivel {
  const tr = nivelBrutoDaTransferencia(t);
  if (tr === "nao_atingiu") return "nao_atingiu";
  return tr === "atingiu" && bruto2 === "atingiu" ? "atingiu" : "em_processo";
}
