import type { ExperienciaHandle } from "@edu/sdk";

/**
 * Telemetria analítica da missão — `verbo:objeto`, e nada além disso.
 *
 * **O que NUNCA sai daqui**: o texto que a criança escreveu no dilema do tio
 * (dela sai o TAMANHO, e só), nome, e-mail. A regra 6 vale também dentro do
 * Clarity, que recebe os mesmos `verbo:objeto` de graça pelo SDK.
 *
 * **Nem os ids das mensagens encaminhadas.** Da curadoria sai a CONTAGEM. O id
 * parece inofensivo, mas o gabarito da missão está no material do professor: um
 * evento `mural:msg-2` cruzado com a tabela de veracidade reconstrói "quais
 * mentiras esta criança encaminhou" — exatamente a coluna que
 * `invariantes.ts` proíbe no painel, entrando pela porta dos fundos da
 * analítica. Pela mesma razão a mídia aberta sai pelo TIPO (`audio`, `link`),
 * não pelo id.
 *
 * **`resultado` e `contexto` são OBJETOS** no contrato do SDK. Mandar string
 * derruba o lote inteiro com `eventos.N.resultado: invalid_type`, e o único
 * rastro é um 400 no console que ninguém lê — armadilha medida na exp-07.
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

export const telemetria = {
  /** Etapa 1 → 2: tocou "Entrar no grupo". É o marco zero do relógio da impulsividade. */
  entrouNoGrupo: () => track("attempted", "grupo:entrada"),

  /**
   * O PRIMEIRO encaminhamento, com os segundos desde a entrada no grupo.
   *
   * É o dado central da missão: quem manda para o Mural em doze segundos não
   * leu as oito mensagens. Só o primeiro é medido — os seguintes já são
   * curadoria em andamento, e o número deixaria de significar impulso.
   */
  primeiroEncaminhamento: (segundos: number) =>
    track("interacted", "mural:primeiro-encaminhamento", { contexto: { segundos } }),

  /** Abriu a transcrição do áudio ou o card do link. Indicativo de leitura, nunca mérito. */
  abriuMidia: (tipo: "audio" | "link") => track("interacted", `midia:${tipo}`),

  /** Rolou até a 8ª mensagem: viu o esclarecimento do professor, que é a última. */
  leuOGrupoInteiro: () => track("progressed", "grupo:leitura-integral"),

  /** O botão inferior recusou. Os dois motivos são pedagogicamente diferentes. */
  faltaPiso: (faltam: number) => track("interacted", "aviso:piso", { contexto: { faltam } }),
  faltaRolagem: () => track("interacted", "aviso:rolagem"),

  /** O balão de Nina por inação (4 min sem encaminhar nada). */
  precisouDoScaffolding: () => track("interacted", "aviso:inacao"),

  /** Tirou uma mensagem do Mural antes do latch. Revisar é o comportamento que a missão quer. */
  revisouOMural: (restantes: number) =>
    track("interacted", "mural:remocao", { contexto: { restantes } }),

  /** O LATCH. A contagem, nunca os ids — ver a nota do topo. */
  confirmouACuradoria: (total: number) =>
    track("attempted", "mural:confirmado", { contexto: { total } }),

  /** Passou pelo caminho degenerado: encaminhou as oito e leu o atrito. */
  viuOAtritoDeTudo: () => track("interacted", "mural:atrito-oito-de-oito"),

  /** A espera ativa e a chegada do telão. */
  esperouARevelacao: () => track("progressed", "gate:espera"),
  viuARevelacao: () => track("progressed", "mural:revelado"),

  /** Só o TAMANHO do texto — nunca o texto. */
  entregouReflexao: (chars: number) =>
    track("completed", "missao:reflexao", { contexto: { chars } }),
};
