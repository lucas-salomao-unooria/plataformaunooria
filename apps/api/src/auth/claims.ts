import { z } from "zod";

/**
 * Claims do token — CONTRATO CONGELADO (M0 do plano de migração).
 *
 * O emissor hoje é o hub (NextAuth Credentials + chave RS256 própria, JWKS em
 * `{hub}/.well-known/jwks.json`); amanhã pode ser o WSO2 — a api não sabe a
 * diferença, só valida issuer/audience/assinatura.
 *
 * Payload JWT: { sub, escola_id, turma_id?, perfil, aud: "plataforma-api" }.
 * `usuarioId` = `sub` (professor/gestor/admin passam pelo mesmo guard, daí não
 * se chamar mais estudanteId).
 */
export type Perfil = (typeof PERFIS)[number];

export interface AuthClaims {
  usuarioId: string;
  /** Vazio APENAS para os perfis de contrato (`gestor_contrato`, `admin`) — a
   *  única exceção cross-escola, regra 1. O `gestor_regional` carrega UMA
   *  escola aqui, como o `gestor_escola`: o que a regional dele determina é a
   *  LISTA de escolas que ele pode ativar, não um contexto com várias. */
  escolaId: string;
  turmaId?: string;
  perfil: Perfil;
}

/**
 * SEIS papéis (ADR-80). Foram quatro até 2026-09-08.
 *
 * - `gestor_escola` — era `gestor`.
 * - `gestor_contrato` — era `admin-contrato`. O hífen saiu junto: era o único
 *   valor do vocabulário com um, e um separador diferente dos outros é a
 *   diferença que ninguém lembra na hora de escrever a comparação.
 * - `gestor_regional` — cobre as escolas de uma regional SEM lotação em cada
 *   uma (`users.regional_id`). Trabalha UMA escola por vez.
 * - `admin` — a conta da Unooria. Mesmas capacidades de `gestor_contrato`; o
 *   que a distingue é de quem é a conta, não o que ela pode fazer.
 *
 * A ORDEM é do menor para o maior alcance, e ela é LIDA: a listagem de pessoas
 * ordena por `role`, e a ordem alfabética poria `admin` antes de `estudante`.
 */
export const PERFIS = [
  "estudante",
  "professor",
  "gestor_escola",
  "gestor_regional",
  "gestor_contrato",
  "admin",
] as const;

/** Os mesmos papéis para quem valida com Zod — schema de rota, sobretudo.
 *  Derivado de `PERFIS` (que é tupla) para não haver duas listas: uma terceira
 *  fonte de papéis é exatamente como "coordenacao" viraria papel novo sem
 *  ninguém decidir. */
export const PerfilSchema = z.enum(PERFIS);

/**
 * QUEM ADMINISTRA UMA ESCOLA POR VEZ.
 *
 * Existe como grupo, e não como nomes repetidos em quarenta decoradores, porque
 * a pergunta que cada rota faz é sempre a mesma — "quem administra uma escola
 * pode isto?" — e a resposta precisa mudar em UM lugar no dia em que aparecer o
 * sétimo papel. Espalhada, a lista divergiria em silêncio: a rota esquecida
 * continua compilando, e o sintoma é um 403 numa tela que devia abrir.
 */
export const GESTORES_DA_ESCOLA = ["gestor_escola", "gestor_regional"] as const;

/**
 * A EXCEÇÃO CROSS-ESCOLA (regra inviolável nº 1). Token sem escola, e as únicas
 * rotas que podem atravessar escolas são as destes dois.
 */
export const GESTORES_DO_CONTRATO = ["gestor_contrato", "admin"] as const;

/** Todo mundo que administra alguma coisa — a união das duas listas acima. */
export const GESTORES = [...GESTORES_DA_ESCOLA, ...GESTORES_DO_CONTRATO] as const;

/**
 * `true` para quem enxerga a rede inteira e viaja sem escola no token.
 *
 * Substitui as comparações `perfil === "admin-contrato"` espalhadas pela api.
 * Elas eram o ponto exato em que um papel novo de mesmo alcance seria
 * esquecido — e esquecer ali não dá erro de tipo nem quebra teste: dá uma conta
 * que recebe 400 pedindo `?escolaId=` numa tela que não tem escola a informar.
 */
export function ehDoContrato(perfil: Perfil | string): boolean {
  return (GESTORES_DO_CONTRATO as readonly string[]).includes(perfil);
}

/** `true` para quem administra uma escola por vez (não inclui os de contrato). */
export function ehGestorDaEscola(perfil: Perfil | string): boolean {
  return (GESTORES_DA_ESCOLA as readonly string[]).includes(perfil);
}
