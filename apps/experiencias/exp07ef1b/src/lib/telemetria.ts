import type { ExperienciaHandle } from "@edu/sdk";

/**
 * Telemetria analítica da missão — `verbo:objeto`, e nada além disso.
 *
 * O que NUNCA sai daqui: o texto que o estudante escreveu para Amara, o
 * conteúdo do "Meu percurso" em texto, nome, e-mail. A regra 6 vale também
 * dentro do Clarity, que recebe os mesmos `verbo:objeto` de graça pelo SDK.
 *
 * `resultado` e `contexto` ficam no canal analítico e não vão ao Clarity — é o
 * SDK que faz esse corte, e é por isso que dá para mandar a opção escolhida
 * aqui sem que ela vire evento de funil de terceiro.
 */

let exp: ExperienciaHandle | null = null;

export function ligarTelemetria(handle: ExperienciaHandle) {
  exp = handle;
}

function track(verbo: string, objeto: string, dados?: Record<string, unknown>) {
  exp?.track(verbo, objeto, dados);
}

export const telemetria = {
  /** Etapa 1 e 2 — a navegação dentro do mensageiro. */
  abriuChat: (qual: "amara" | "grupo") => track("interacted", `chat:${qual}`),
  ouviuAudio: (audioId: string) => track("interacted", `audio:${audioId}`),
  /** A evidência que a missão mede (BNCC EF07CO01). */
  inspecionouMateria: () => track("interacted", "midia:materia-completa"),
  fechouMateria: (segundos: number) =>
    track("interacted", "midia:materia-fechada", { contexto: { segundos } }),
  cutucao: () => track("interacted", "amara:cutucao"),

  /** Breakpoint e podcast. */
  esperouALargada: () => track("progressed", "gate:breakpoint"),
  ouviuPodcast: () => track("interacted", "audio:podcast"),

  /** Etapa 3 e 4 — a decisão e o que o bairro fez com ela. */
  marcouOpcao: (opcao: string) => track("attempted", "resposta:selecionada", { contexto: { opcao } }),
  // `resultado` e `contexto` são OBJETOS no contrato do SDK — mandar string
  // aqui derruba o lote inteiro com `invalid_type`, e o único rastro é um 400
  // no console que ninguém lê. Medido.
  enviouResposta: (opcao: string, latenciaSeg: number) =>
    track("scored", "resposta:enviada", { resultado: { opcao }, contexto: { latenciaSeg } }),
  desfez: (opcaoAnterior: string) =>
    track("interacted", "resposta:desfeita", { contexto: { opcaoAnterior } }),
  viuOAlfinete: () => track("progressed", "feed:mensagem-fixada"),
  /** Só a CONTAGEM de turnos: o que ela escreveu para Amara não sai daqui. */
  falouComAmara: (turno: number) => track("interacted", "amara:conversa", { contexto: { turno } }),

  /** Etapa 5 e 6. */
  leuCard: (indice: number) => track("progressed", `cards:${indice}`),
  entregouPercurso: (score: number) =>
    track("completed", "missao:concluida", { resultado: { score } }),
};
