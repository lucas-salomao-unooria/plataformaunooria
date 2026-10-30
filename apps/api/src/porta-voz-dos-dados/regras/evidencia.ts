import type { Nivel } from "../../evidencias/regras";
import { CARTAO_DISTORCIDO, MOTIVO_DA_DISTORCAO, type MotivoDaPericia } from "../conteudo";
import { adequada, camadasAtivas, corrigiu, publicacaoFinal, regrediu, type Publicacao } from "./publicacao";

/**
 * A RÉGUA do Canal A das seis habilidades (plano aprovado §1 "Evidência" e as
 * decisões 4 do Lucas, sobre o PRD §14). Puro: o servidor junta os fatos e
 * chama. Toda função tem o ramo RESIDUAL: o que não é atingiu nem em processo
 * é "não atingiu" — e quem não teve a oportunidade não chega a ser marcado
 * ("Não avaliado", a ausência de linha).
 *
 * Quando cada uma é marcada (na transação do gesto):
 *   - EM13CO13 no PUBLICAR da 1ª (só depende do que veio antes do compositor);
 *   - EM13CO12, CO21, CO22 e CO26 na DECISÃO DA ERRATA (publicar ou pular) —
 *     elas leem o conjunto FINAL, e marcar antes deixaria uma marca melhor que
 *     a errata não apagaria (a porta `marcar` guarda a melhor);
 *   - EM13CO14 no parecer da perícia (ou no "Avançar sem emitir parecer").
 */

/** EM13CO12 — o conjunto da publicação FINAL: 0 + fonte atinge; 0 sem fonte ou 80 com fonte, em processo. */
export function nivelCO12(inicial: Publicacao, errata: Publicacao | null): Nivel {
  const f = publicacaoFinal(inicial, errata);
  if (f.escala === 0 && f.fonte) return "atingiu";
  if (f.escala === 0 || f.fonte) return "em_processo";
  return "nao_atingiu";
}

/**
 * EM13CO13 — abriu o anexo ANTES do compositor e antes do nudge de 90 s da E2:
 * atingiu. Antes do compositor mas depois do nudge: em processo. Não abriu
 * antes do compositor (nunca, ou só depois): não atingiu.
 */
export function nivelCO13(m: { anexoAbertoEm: Date | null; nudgeE2Em: Date | null; compositorAbertoEm: Date }): Nivel {
  const anexo = m.anexoAbertoEm?.getTime() ?? null;
  if (anexo === null || anexo > m.compositorAbertoEm.getTime()) return "nao_atingiu";
  const nudge = m.nudgeE2Em?.getTime() ?? null;
  if (nudge === null || anexo < nudge) return "atingiu";
  return "em_processo";
}

/** O parecer da perícia como a régua o lê. `null` = pulou. */
export interface Parecer {
  sinalizouA: boolean;
  motivoA: MotivoDaPericia | null;
  sinalizouB: boolean;
  motivoB: MotivoDaPericia | null;
}

/**
 * EM13CO14 (diretriz do PO): só o cartão B, com o motivo escala — atingiu. B
 * sinalizado com o motivo errado e/ou A sinalizado também — em processo. B não
 * sinalizado, ou a perícia pulada — não atingiu. Abrir os dados ou emitir o
 * parecer sozinhos não pontuam.
 */
export function nivelCO14(p: Parecer | null): Nivel {
  if (!p) return "nao_atingiu";
  const distorcido = CARTAO_DISTORCIDO === "B" ? { sinalizou: p.sinalizouB, motivo: p.motivoB } : { sinalizou: p.sinalizouA, motivo: p.motivoA };
  const outro = CARTAO_DISTORCIDO === "B" ? p.sinalizouA : p.sinalizouB;
  if (!distorcido.sinalizou) return "nao_atingiu";
  if (distorcido.motivo === MOTIVO_DA_DISTORCAO && !outro) return "atingiu";
  return "em_processo";
}

/**
 * EM13CO21 — a explicação da escala: ligada na 1ª (e mantida na errata, se
 * houve) — atingiu. Só na errata, ou ligada na 1ª e DESLIGADA na errata (vale o
 * conjunto final, decisão 4) — em processo. Nunca — não atingiu.
 */
export function nivelCO21(inicial: Publicacao, errata: Publicacao | null): Nivel {
  if (inicial.explicacao) return errata && !errata.explicacao ? "em_processo" : "atingiu";
  if (errata?.explicacao) return "em_processo";
  return "nao_atingiu";
}

/**
 * EM13CO22 — as camadas da publicação FINAL: ≥ 2 corretas atingiu, 1 em
 * processo, 0 não atingiu. Com a PROJEÇÃO incorreta ligada (ADR-203, v2 do
 * PO), o teto é "em processo": quem liga tudo para "ficar completo" sem ler
 * cada camada não atinge, e sem nenhuma correta fica em não atingiu.
 */
export function nivelCO22(inicial: Publicacao, errata: Publicacao | null): Nivel {
  const final = publicacaoFinal(inicial, errata);
  const n = camadasAtivas(final);
  if (final.projecao) return n >= 1 ? "em_processo" : "nao_atingiu";
  if (n >= 2) return "atingiu";
  if (n === 1) return "em_processo";
  return "nao_atingiu";
}

/**
 * EM13CO26 — a tabela de decisão (decisão 4). `errata: null` = pulou.
 *   - errata que leva o eixo de 0 para 80 (regressão) — não atingiu;
 *   - 1ª adequada (0 + fonte), sem regressão — atingiu, com ou sem errata;
 *   - 1ª inadequada e errata que corrige (80 → 0, ou + fonte, ou + contexto
 *     ausentes, ou a projeção incorreta desligada — ADR-203) — atingiu (80 → 0 tirando a fonte conta: o eixo é o centro);
 *   - 1ª inadequada e errata sem correção real — em processo;
 *   - 1ª inadequada e pulou a errata — não atingiu.
 */
export function nivelCO26(inicial: Publicacao, errata: Publicacao | null): Nivel {
  if (errata && regrediu(inicial, errata)) return "nao_atingiu";
  if (adequada(inicial)) return "atingiu";
  if (!errata) return "nao_atingiu";
  return corrigiu(inicial, errata) ? "atingiu" : "em_processo";
}

/** Os ids dos marcadores da ficha (`evidencias/fichas/exp03em1b.ts`). */
export const MARCADOR_CO12 = "boletim_final";
export const MARCADOR_CO13 = "inspecao_anexo";
export const MARCADOR_CO14 = "pericia_eleitoral";
export const MARCADOR_CO21 = "anotacao_escala";
export const MARCADOR_CO22 = "camadas_do_boletim";
export const MARCADOR_CO26 = "errata_responsavel";
