import type { Nivel } from "../../evidencias/regras";
import type { Alinhamento, Equidade } from "./bancada";

/**
 * A RÉGUA da exp01em1b — 100% Canal A (one-pager §12a v1.5), sem pergunta.
 * Nenhuma habilidade bloqueia o avanço: a régua lê os fatos e marca. Puro.
 * Falha técnica é AUSÊNCIA de marca ("Não avaliado"), nunca "não atingiu".
 *
 * Quando marca: no LATCH 2 (publicar), as quatro de uma vez. Quem apostou e
 * não publicou recebe as quatro no ENCERRAR do professor, com `publicou: false`
 * (o padrão "conta ao encerrar", ADR-154) — o PO diz "não publicou → não
 * atingiu", e sem o encerrar a sessão ficaria sem marca para sempre.
 *
 * Com equipe, a marca vai a cada integrante (E13).
 */

export interface FatosDaRegua {
  /** O LATCH 2 aconteceu. */
  publicou: boolean;
  /** O `Toggle` da página de transparência estava ligado ao publicar (E6-ALU-01). */
  paginaAtiva: boolean;
  /** O alinhamento do comunicado (`regras/bancada.ts#corrigirComunicado`); `null` sem publicar. */
  comunicado: Alinhamento | null;
  /** A equidade do ÚLTIMO reteste; `null` se nunca retestou. */
  equidade: Equidade | null;
  /** Abriu o painel opcional "[Opcional / Aprofundamento]". */
  abriuPainelDoAlgoritmo: boolean;
  /** Marcou algum passo. */
  marcouAlgumPasso: boolean;
  /** Marcou exatamente {2, 3, 4}. */
  marcouOsDispensaveis: boolean;
}

/**
 * EM13CO20 (o FOCO): criar e publicar o conteúdo avaliando as consequências.
 * - atingiu: a página ativa **e** os quatro blocos certos;
 * - em processo: a página ativa com o comunicado incompleto (bloco em branco, ou
 *   só o bloco 1 trocado); **ou** os quatro certos sem ativar a página;
 * - não atingiu: não publicou; ou um elo errado (inferência, regra ou revisão
 *   humana) — "descaracteriza a relação causal".
 */
export function nivelCO20(f: FatosDaRegua): Nivel {
  if (!f.publicou || f.comunicado === null || f.comunicado === "descaracterizado") return "nao_atingiu";
  if (f.paginaAtiva && f.comunicado === "pleno") return "atingiu";
  return "em_processo";
}

/**
 * EM13CO01: reutilizar partes de soluções existentes (o banco de critérios).
 * - atingiu: as funções 1 e 2 trocadas por critérios não discriminatórios;
 * - em processo: só uma das duas;
 * - não atingiu: manteve 1B e 2B, ou nunca retestou.
 */
export function nivelCO01(f: FatosDaRegua): Nivel {
  if (f.equidade === "total") return "atingiu";
  if (f.equidade === "parcial") return "em_processo";
  return "nao_atingiu";
}

/** A publicação "plena" do CO18 é o critério de Atingiu do CO20: a página ativa e os quatro blocos. */
function publicacaoPlena(f: FatosDaRegua): boolean {
  return f.publicou && f.paginaAtiva && f.comunicado === "pleno";
}

/**
 * EM13CO18: o ciclo do projeto — reestruturar (E5) e publicar (E6), coerentes.
 * - atingiu: equidade total **e** publicação plena;
 * - em processo: só uma das duas pontas (equidade total sem a publicação plena,
 *   ou a publicação plena com equidade parcial);
 * - não atingiu: nenhuma das duas.
 *
 * Publicação plena com equidade NENHUMA conta como "uma das pontas" — o PO
 * escreveu "completou uma das pontas mas não a outra".
 */
export function nivelCO18(f: FatosDaRegua): Nivel {
  const reestruturou = f.equidade === "total";
  const publicou = publicacaoPlena(f);
  if (reestruturou && publicou) return "atingiu";
  if (reestruturou || publicou) return "em_processo";
  return "nao_atingiu";
}

/**
 * EM13CO03: o consumo de recursos do algoritmo (o painel OPCIONAL).
 * - atingiu: abriu e marcou exatamente os passos de inferência {2, 3, 4};
 * - em processo: abriu e marcou outro conjunto;
 * - não atingiu: não abriu, pulou, ou abriu e não marcou nada.
 *
 * O PQ-04 ("acessa voluntariamente o painel") conta `abriuPainelDoAlgoritmo`,
 * não as marcas — abrir é gravado no toque (a esteira só contava quem marcava).
 */
export function nivelCO03(f: FatosDaRegua): Nivel {
  if (!f.abriuPainelDoAlgoritmo || !f.marcouAlgumPasso) return "nao_atingiu";
  return f.marcouOsDispensaveis ? "atingiu" : "em_processo";
}
