import type { ExperienciaHandle } from "@edu/sdk";

/**
 * Telemetria analítica da missão — `verbo:objeto`, e nada além disso.
 *
 * O que NUNCA sai daqui: o texto do "Meu percurso", nome, e-mail. A regra 6
 * vale também dentro do Clarity, que recebe os mesmos `verbo:objeto` de graça
 * pelo SDK.
 *
 * **`resultado` e `contexto` são OBJETOS** no contrato do SDK. Mandar string
 * derruba o lote inteiro com `eventos.N.resultado: invalid_type`, e o único
 * rastro é um 400 no console que ninguém lê — armadilha medida na exp07ef1b.
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
  entrouNoApp: () => track("interacted", "app:aberto"),
  abriuChat: (chatId: string) => track("interacted", `chat:${chatId}`),
  ouviuAudio: (audioId: string) => track("interacted", `audio:${audioId}`),
  /** A evidência que a missão mede (BNCC EF06CO01). */
  inspecionouMetadados: (mensagemId: string, total: number) =>
    track("interacted", "mensagem:metadados", {
      contexto: { mensagemId, totalAuditadas: total },
    }),
  bloqueadoSemCota: (faltam: number) =>
    track("interacted", "aviso:auditoria-incompleta", { contexto: { faltam } }),

  /** Etapa 3 — o pico. */
  criseChegou: () => track("progressed", "crise:notificacao"),
  /** O alerta de inação de 90s apareceu. Sinal da hipótese H3 do playtest. */
  hesitou: () => track("interacted", "crise:alerta-de-inacao"),
  decidiu: (opcao: string, latenciaSeg: number) =>
    track("attempted", "intervencao:decisao", {
      resultado: { opcao },
      contexto: { latenciaSeg },
    }),

  /** Breakpoint e Etapa 4. */
  esperouALargada: () => track("progressed", "gate:breakpoint"),
  viuAsCurvas: () => track("progressed", "telemetria:curvas"),
  /** O Aha!: a alternância para o mapa é o que a missão quer ver acontecer. */
  viuOMapa: (permanenciaSeg: number) =>
    track("progressed", "telemetria:topologia", { contexto: { permanenciaSeg } }),

  /** Etapa 5 e 6. */
  montouOCiclo: (coerente: boolean) =>
    track("interacted", "construtor:ciclo", { resultado: { coerente } }),
  ouviuPodcast: () => track("interacted", "audio:podcast"),
  /** Só o TAMANHO do texto — nunca o texto. */
  entregouPercurso: (chars: number) =>
    track("completed", "missao:percurso", { contexto: { chars } }),
};
