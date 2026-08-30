import type { ExperienciaHandle } from "@edu/sdk";

/**
 * Telemetria ANALÍTICA da missão (canal do SDK: batch 50 / flush 10s → Pub/Sub
 * → `telemetria_eventos`).
 *
 * NÃO é a trilha pedagógica: essa é `exp_03_marcos`, gravada pela api de forma
 * síncrona e transacional, e é ela que o professor lê. Os dois canais existem
 * separados de propósito (ver CLAUDE.md, "Telemetria: dois canais, não um").
 *
 * O TEXTO DO ESTUDANTE NUNCA ENTRA AQUI. A conversa é caixa livre escrita por menor
 * de idade; o que a telemetria carrega é contagem e nome de etapa.
 */
let exp: ExperienciaHandle | null = null;

export function ligarTelemetria(handle: ExperienciaHandle) {
  exp = handle;
}

type Dados = Record<string, string | number | boolean>;

function track(verbo: string, objeto: string, resultado?: Dados) {
  exp?.track(verbo, objeto, resultado ? { resultado } : undefined);
}

/** O estudante abriu o briefing. */
export const briefingAberto = () => track("attempted", "briefing");

/** Entrou na investigação — a conversa começa aqui. */
export const investigacaoAberta = (tentativa: number) =>
  track("progressed", "investigacao", { tentativa });

/** Um turno com o Cientista. Sem o texto: só o que ele produziu. */
export const turnoFeito = (dados: { debitou: boolean; comCartao: boolean; perguntasGastas: number }) =>
  track("interacted", "turno", dados);

/** Fontes carregadas — quantas, não quais palavras o estudante usou para pedir. */
export const fontesCarregadas = (quantas: number) =>
  track("interacted", "fontes", { carregadas: quantas });

export const equipeAlocada = (equipe: string, comJustificativa: boolean) =>
  track("interacted", "alocacao", { equipe, comJustificativa });

export const tempestadeEnfrentada = (dados: { salvas: number; fontesUsadas: number }) =>
  track("scored", "desfecho", dados);

export const recomecou = (tentativa: number) => track("attempted", "recomeco", { tentativa });
