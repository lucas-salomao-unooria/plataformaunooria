import type { ExperienciaHandle } from "@edu/sdk";

/**
 * Telemetria analítica da experiência — `verbo:objeto`, e nada além disso.
 *
 * O contrato real da api é `track(verbo, objeto, { resultado?, contexto? })`:
 * `verbo` e `objeto` são strings (objeto na convenção `namespace:slug`),
 * `resultado` e `contexto` são OBJETOS com número, booleano ou vocabulário
 * fechado. Não existe campo `dados` — chave desconhecida é descartada em
 * silêncio. Mandar string em `resultado` derruba o lote inteiro com
 * `eventos.N.resultado: invalid_type`, e o único rastro é um 400 no console.
 *
 * O que NUNCA sai daqui: texto escrito pela criança, nome, e-mail (regra 6 —
 * vale também dentro do Clarity, que recebe os mesmos `verbo:objeto`). De um
 * texto autoral sai o TAMANHO, e só.
 *
 * Todo evento da missão nasce NESTE arquivo, com nome que diz o que aconteceu:
 * é daqui que sai a tabela de eventos do README e o `verbos` do manifesto.
 */

let exp: ExperienciaHandle | null = null;

export function ligarTelemetria(handle: ExperienciaHandle) {
  exp = handle;
}

function track(verbo: string, objeto: string, dados?: { resultado?: Record<string, unknown>; contexto?: Record<string, unknown> }) {
  exp?.track(verbo, objeto, dados);
}

export const telemetria = {
  /** A criança entrou na missão (depois do handshake). */
  entrou: () => track("attempted", "missao:entrada"),
  /** Um passo registrado — o exemplo do template; troque pelos eventos da missão. */
  registrouPasso: (passos: number) => track("interacted", "passo:registrado", { resultado: { passos } }),
  /** O encerramento. */
  concluiu: (passos: number) => track("completed", "missao:concluida", { contexto: { passos } }),
};
