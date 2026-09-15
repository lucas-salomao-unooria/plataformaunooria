import type { ExperienciaHandle } from "@edu/sdk";

/**
 * Telemetria analítica da missão — `verbo:objeto`, e nada além disso.
 *
 * O que NUNCA sai daqui: o parágrafo do "Meu Percurso", nome, e-mail. A regra 6
 * vale também dentro do Clarity, que recebe os mesmos `verbo:objeto` de graça
 * pelo SDK. Do texto autoral sai o TAMANHO, e só.
 *
 * **`resultado` e `contexto` são OBJETOS** no contrato do SDK. Mandar string
 * derruba o lote inteiro com `eventos.N.resultado: invalid_type`, e o único
 * rastro é um 400 no console que ninguém lê — armadilha medida na exp-07.
 */

let exp: ExperienciaHandle | null = null;

export function ligarTelemetria(handle: ExperienciaHandle) {
  exp = handle;
}

function track(verbo: string, objeto: string, dados?: Record<string, unknown>) {
  exp?.track(verbo, objeto, dados);
}

export const telemetria = {
  /** Etapa 1 — o briefing de Amara e a entrada na conversa. */
  ouviuAlerta: () => track("interacted", "audio:alerta-amara"),
  abriuConversa: () => track("progressed", "etapa:chat"),

  /** Etapa 2 — a auditoria. É a evidência central da missão (EF08CO05). */
  disparouPrompt: (promptId: string, iteracao: number) =>
    track("interacted", "prompt:auditoria", {
      resultado: { promptId },
      contexto: { iteracao },
    }),
  /** O balão de apoio de Amara apareceu depois de 120s sem ação. */
  hesitouNaAuditoria: () => track("interacted", "aviso:inatividade"),
  /** Cliques rápidos acionaram a latência forçada de 15s. */
  latenciaForcada: () => track("interacted", "aviso:latencia-rapida"),

  /** Etapa 3 — o PICO. */
  fixouClausula: (clausulaId: string, latenciaSeg: number) =>
    track("scored", "clausula:salvaguarda", {
      resultado: { clausulaId },
      contexto: { latenciaSeg },
    }),
  /** A réplica provocativa do bot apareceu (clique em menos de 5s). */
  viuProvocacao: () => track("interacted", "bot:provocacao-minima"),

  /** Etapa 4 — o Aha! e o Checkpoint A. */
  viuOManifesto: () => track("progressed", "etapa:manifesto"),
  copiouOManifesto: () => track("interacted", "manifesto:copiado"),
  esperouODebate: () => track("progressed", "gate:debate"),

  /** Etapa 5 — a assinatura. Só o TAMANHO do texto, nunca o texto. */
  assinouOPercurso: (tags: string[], chars: number) =>
    track("indicative", "percurso:assinado", {
      resultado: { tags },
      contexto: { chars },
    }),
  /** O filtro recusou o parágrafo. Vai o NOME do padrão? Não: nem isso.
   *  O sinal de que a recusa aconteceu basta para calibrar a mensagem. */
  percursoRecusado: () => track("interacted", "percurso:dado-pessoal-recusado"),

  /** Etapa 6 — o fechamento. */
  ouviuOPodcast: () => track("interacted", "audio:podcast"),
  abriuATranscricao: () => track("interacted", "podcast:transcricao"),
  concluiuAMissao: () => track("completed", "missao:manifesto"),
};
