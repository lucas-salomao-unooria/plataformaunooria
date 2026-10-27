import type { ExperienciaHandle } from "@edu/sdk";

/**
 * Telemetria ANALÍTICA da missão — `verbo:objeto`, e nada além disso. O que a
 * evidência mede (a aposta, os cartões, os passos, os critérios, o comunicado)
 * é gravado pela api, na rota de cada gesto: aqui ficam só os sinais de
 * produto, como nas irmãs.
 *
 * Contrato: `track(verbo, objeto, { resultado?, contexto? })`, com valores de
 * número, booleano ou vocabulário fechado. O que NUNCA sai daqui: a RESPOSTA
 * do estudante (a aposta, a coluna de um cartão, um critério, uma opção de
 * bloco), o gabarito, nome e e-mail (regra 6).
 */
let exp: ExperienciaHandle | null = null;

export function ligarTelemetria(handle: ExperienciaHandle) {
  exp = handle;
}

function track(verbo: string, objeto: string, dados?: { resultado?: Record<string, unknown>; contexto?: Record<string, unknown> }) {
  exp?.track(verbo, objeto, dados);
}

export const telemetria = {
  /** A primeira tela, depois do handshake. */
  entrou: (retomada: boolean) => track("attempted", "missao:iniciar", { resultado: { retomada } }),
  /** A entrada em cada passo (derivado do servidor). */
  etapa: (passo: string) => track("progressed", "etapa:entrar", { contexto: { passo } }),
  /** Um tempo parado numa decisão (aposta, critérios, comunicado) — sem o que ele escolheu. */
  inatividade: (passo: string) => track("interacted", "aviso:inatividade", { contexto: { passo } }),
  /** A janela "Módulo de Homologação Offline" ou "Sessão escolar pausada". */
  erro: (codigo: "sem-sinal" | "sessao-expirada") => track("attempted", "erro:exibir", { resultado: { codigo } }),
  /** O LATCH 2: a missão concluída. */
  concluiu: () => track("completed", "missao:concluida"),
};
