import { OPCAO_QUE_INTERROMPE, type IdDeOpcao } from "../catalogo";

/**
 * O nível de intervenção consciente — e por que ele NÃO é uma nota.
 *
 * O PRD proíbe escore numérico punitivo, ranking e percentual de acerto
 * (PED-05, PED-07). O que existe é uma leitura QUALITATIVA em três degraus, e
 * ela combina dois sinais que sozinhos não dizem nada:
 *
 * - `auditou` — abriu os dados de 3 mensagens distintas ANTES de decidir;
 * - `opcao` — o que fez com a mensagem da crise.
 *
 * Quem denuncia e fixa o laudo sem ter checado nada acertou por sorte, e a
 * plataforma não pode ler isso como o mesmo comportamento de quem checou
 * primeiro. É por isso que o nível não sai da opção sozinha.
 *
 * Calculado no servidor, sempre. Um nível vindo do cliente seria a criança
 * escolhendo o próprio laudo (regra inviolável nº 3).
 */

export const NIVEIS = ["basico", "intermediario", "avancado"] as const;
export type Nivel = (typeof NIVEIS)[number];

/**
 * Os três degraus:
 *
 * - `avancado` — checou os metadados E interveio com a fonte oficial.
 * - `intermediario` — checou, mas não interveio (apagou para si, ou repassou
 *   depois de checar: os dois mostram leitura sem ação sobre a rede).
 * - `basico` — decidiu sem auditar. Não é castigo: é o que o mapa da Etapa 4
 *   vai mostrar em números, sem uma palavra que rotule quem fez isso.
 */
export function nivelDe(auditou: boolean, opcao: IdDeOpcao): Nivel {
  if (!auditou) return "basico";
  return opcao === OPCAO_QUE_INTERROMPE ? "avancado" : "intermediario";
}

/**
 * O `score` que vai ao hub pelo `exp:concluir`.
 *
 * Existe porque o contrato da bridge tem o campo e o progresso da plataforma o
 * lê; NÃO é nota e nunca aparece para a criança nem no painel da professora —
 * `PROIBIDO_NO_PAINEL` (`invariantes.ts`) tem o teste que cobra isso.
 * Três valores, um por nível: qualquer outro número aqui seria pontuação
 * fabricada em algum caminho que esqueceu a regra.
 */
export const SCORE_DO_NIVEL: Record<Nivel, number> = {
  basico: 0,
  intermediario: 70,
  avancado: 100,
};

export function scoreDe(auditou: boolean, opcao: IdDeOpcao): number {
  return SCORE_DO_NIVEL[nivelDe(auditou, opcao)];
}
