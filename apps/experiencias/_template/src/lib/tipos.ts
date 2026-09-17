/**
 * O contrato desta experiência como o cliente o vê.
 *
 * Numa missão com módulo próprio na api, este arquivo espelha o
 * `apps/api/src/<slug>/contrato-de-rotas.ts` — só o que a TELA precisa ver.
 * Gabarito, parâmetros ocultos e calibragem nunca aparecem aqui: são segredo de
 * servidor (regra 3), e o que vai ao bundle é público.
 */

export const EXP_ID = "exp-template";

/**
 * A versão vive em TRÊS lugares: aqui, no `package.json` e no
 * `public/experiencia.json`. O CI lê a do manifesto, e a divergência já causou
 * bug — o `versao.test.ts` compara os três (ADR-84).
 */
export const EXP_VERSION = "0.1.0";

/** O que o `progresso` da plataforma guarda para esta experiência. */
export interface Progresso {
  passos: number;
}
