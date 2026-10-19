import type { ExperienciaHandle } from "@edu/sdk";

/**
 * Telemetria analítica da missão — `verbo:objeto`, e nada além disso. A lista é
 * a da especificação v2.2, e o `verbos` do manifesto a descreve.
 *
 * **O que NUNCA sai daqui**: nome, e-mail (regra 6 — vale também dentro do
 * Clarity, que recebe os mesmos `verbo:objeto` pelo SDK), as respostas do
 * cartão e as peças da regra. Do cartão e da regra sai a CONTAGEM: o acerto é
 * do servidor, e a evidência não entra pela porta dos fundos da analítica.
 *
 * **Nem os ids das mensagens encaminhadas.** Do Mural sai a CONTAGEM. O id
 * parece inofensivo, mas o gabarito está no material do professor: um evento
 * `mensagem:msg_2` cruzado com a curadoria reconstrói "quais mentiras esta
 * criança encaminhou" — a evidência da EF05CO08 entrando pela porta dos fundos
 * da analítica. O motivo da enquete sai porque é vocabulário FECHADO (quatro
 * ids) e é ele que o Termômetro cruza.
 *
 * **Chaves só em `resultado`/`contexto`, e os dois são OBJETOS.** Mandar string
 * derruba o lote inteiro com `eventos.N.resultado: invalid_type`, e o único
 * rastro é um 400 no console — armadilha medida na exp07ef1b.
 */

let exp: ExperienciaHandle | null = null;

export function ligarTelemetria(handle: ExperienciaHandle) {
  exp = handle;
}

function track(
  verbo: string,
  objeto: string,
  dados?: { resultado?: Record<string, unknown>; contexto?: Record<string, unknown> },
) {
  exp?.track(verbo, objeto, dados);
}

/** As três fases que o professor abre — o `objeto` de `progressed gate:*`. */
export type GateVisto = "revelacao" | "sintese" | "reflexao";

export const telemetria = {
  /** Tocou a conversa da Nina na lista: o começo do funil. */
  abriuAMissao: () => track("attempted", "missao:exp05ef1b"),

  /** "Entrar no grupo" respondeu: o relógio do `tempo_feed_segundos` começou no servidor. */
  entrouNoGrupo: () => track("progressed", "grupo:turma"),

  /** Um "Enviar" na folha "Encaminhar para...". Só a contagem, nunca o id (ver o topo). */
  encaminhou: (selecionadas: number) =>
    track("interacted", "mensagem:encaminhar", { contexto: { selecionadas } }),

  /** O LATCH 1 fechou. */
  confirmouOMural: (total: number) => track("scored", "mural:selecao", { resultado: { total } }),

  /** O LATCH 2 fechou. `opcao` é um dos quatro ids do vocabulário. */
  votou: (opcao: string) => track("scored", "enquete:motivo", { resultado: { opcao } }),

  /** A criança VIU a fase que o professor abriu (uma vez por fase, por aba). */
  viuOGate: (fase: GateVisto) => track("progressed", `gate:${fase}`),

  /** Enviou o cartão de frases (EF05CO03). Só a contagem — o acerto é do servidor. */
  respondeuOCartao: () => track("scored", "mural:operacoes", { resultado: { total: 6 } }),

  /** Um "Testar no áudio do tio" — o número do teste, nunca as peças nem a previsão. */
  testouARegra: (nTeste: number) => track("interacted", "regra:teste", { resultado: { n_teste: nTeste } }),

  /** Enviou a regra do tio (EF05CO04): quantos testes ela levou. */
  enviouARegra: (nTestes: number) => track("scored", "regra:envio", { resultado: { n_testes: nTestes } }),

  /** O fim da missão. */
  concluiu: () => track("completed", "missao:exp05ef1b"),
};
