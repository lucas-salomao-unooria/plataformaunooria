import type { ExperienciaHandle } from "@edu/sdk";

/**
 * Telemetria analítica da missão — `verbo:objeto`, e nada além disso. A lista é
 * a da especificação v2.2, e o `verbos` do manifesto a descreve.
 *
 * **O que NUNCA sai daqui**: nome, e-mail (regra 6 — vale também dentro do
 * Clarity, que recebe os mesmos `verbo:objeto` pelo SDK), os filtros do
 * alerta e os blocos do robô. Deles sai a CONTAGEM: o acerto é do servidor, e
 * a evidência não entra pela porta dos fundos da analítica.
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

  /**
   * Um "Ver resultado" no alerta (EF05CO03): o pedido, o número da execução e
   * quantas mensagens passaram — nunca o filtro nem quais passaram.
   */
  executouOAlerta: (pedido: number, nExecucao: number, nResultados: number) =>
    track("interacted", "alerta:execucao", { resultado: { pedido, n_execucao: nExecucao, n_resultados: nResultados } }),

  /** Enviou um alerta ao grupo: só o número do pedido. */
  enviouOAlerta: (pedido: number) => track("scored", "alerta:envio", { resultado: { pedido } }),

  /** Ligou o robô (EF05CO04): o número da ligação e se tinha o laço — nunca os blocos. */
  ligouORobo: (nLigacao: number, laco: boolean) =>
    track("interacted", "robo:ligar", { resultado: { n_ligacao: nLigacao, laco } }),

  /** Enviou o robô: quantas ligações ele levou. */
  enviouORobo: (nLigacoes: number) => track("scored", "robo:envio", { resultado: { n_ligacoes: nLigacoes } }),

  /** O fim da missão. */
  concluiu: () => track("completed", "missao:exp05ef1b"),
};
