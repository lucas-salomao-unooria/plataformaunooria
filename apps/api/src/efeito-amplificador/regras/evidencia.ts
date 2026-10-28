import type { Nivel } from "../../evidencias/regras";
import type { FeedDaSessao } from "./feed";

/**
 * A RÉGUA do Canal A das quatro habilidades (PRD §14.1 e o contrato de
 * evidência do one-pager §12a, ADR-191). Puro: o servidor junta os fatos e
 * chama. Toda habilidade é medida pelo que o estudante FAZ.
 *
 * Quem não teve a oportunidade fica "Não avaliado" — a AUSÊNCIA de marca —,
 * nunca "não atingiu": CO14 e CO26 marcam no PUBLICAR; CO24 e CO08 marcam a
 * cada ação no feed (vale a melhor) e, se nada foi feito, no momento em que o
 * feed fecha para o estudante (a abertura do Explicar).
 */

/**
 * EM13CO14 — confiabilidade: QUESTIONOU a fonte E corrigiu a estatística antes
 * de exportar. Uma das duas: em processo (perguntou e publicou o dado; ou pediu
 * a revisão ampla sem checar a origem).
 */
export function nivelCO14(f: { pediuFonte: boolean; dadoResolvido: boolean }): Nivel {
  if (f.pediuFonte && f.dadoResolvido) return "atingiu";
  if (f.pediuFonte || f.dadoResolvido) return "em_processo";
  return "nao_atingiu";
}

/** EM13CO26 — direito digital: o crédito à autoria E o colega anonimizado. Um dos dois: em processo. */
export function nivelCO26(f: { plagioResolvido: boolean; lgpdResolvido: boolean }): Nivel {
  const n = Number(f.plagioResolvido) + Number(f.lgpdResolvido);
  return n === 2 ? "atingiu" : n === 1 ? "em_processo" : "nao_atingiu";
}

/**
 * EM13CO24 (o foco) — saúde: fixou o aviso de cuidado com o motivo de SAÚDE
 * ("Conteúdo pode afetar a saúde de quem lê"). Aviso com outro motivo, ou outra
 * moderação da publicação (restringir comentários) sem aviso: em processo.
 * Nenhuma ferramenta de moderação: não atingiu.
 */
export function nivelCO24(f: Pick<FeedDaSessao, "aviso" | "restringirComentarios">): Nivel {
  if (f.aviso === "saude_usuarios") return "atingiu";
  if (f.aviso !== null || f.restringirComentarios) return "em_processo";
  return "nao_atingiu";
}

/**
 * EM13CO08 — segurança: os TRÊS comportamentos protetivos, voluntários —
 * preservar a privacidade (uma das chaves da Configuração da Publicação),
 * reportar a suspeita (denunciar o perfil) E encaminhar um relato pela Central
 * de Apoio (comentário, equipe e envio). Um ou dois, ou só abrir a Central sem
 * concluir: em processo. Nada: não atingiu.
 */
export function nivelCO08(f: Pick<FeedDaSessao, "contaPrivada" | "restringirComentarios" | "abriuCentral" | "denunciou" | "relatos">): Nivel {
  const privacidade = f.contaPrivada || f.restringirComentarios;
  const n = Number(privacidade) + Number(f.denunciou) + Number(f.relatos.length > 0);
  if (n === 3) return "atingiu";
  if (n >= 1 || f.abriuCentral) return "em_processo";
  return "nao_atingiu";
}

/** Os ids dos marcadores da ficha (`evidencias/fichas/exp02em1b.ts`), os do PRD §14.2. */
export const MARCADOR_CO14 = "auditoria_fontes";
export const MARCADOR_CO26 = "direito_digital";
export const MARCADOR_CO24 = "moderacao_saude";
export const MARCADOR_CO08 = "protecao_seguranca";
