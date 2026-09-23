import type { Estado, Mensagem, Passo } from "./tipos";

/**
 * As poucas regras que são do CLIENTE — e por que são tão poucas.
 *
 * Tudo o que decide o que vale (a cota de auditoria, o desfecho da intervenção,
 * a coerência do ciclo, o alcance da rede) mora no servidor. O que sobra aqui é
 * o que o servidor não tem como saber: quanto tempo esta tela ficou aberta e
 * quanto tempo o dedo desta criança demorou a tocar.
 */

/**
 * Segundos de inação no PICO antes de Tomás falar.
 *
 * O silêncio pedagógico é não-negociável: até aqui a tela não dá dica nenhuma.
 * Passado o teto, o suporte ficcional entra — porque inação prolongada é
 * abandono, não reflexão, e a criança que travou merece uma mão sem que o
 * contrato de agência se rompa (P6 do aprendizado).
 */
export const SEGUNDOS_ATE_O_ALERTA = 90;

/**
 * Segundos de permanência mínima no gráfico antes de o botão do mapa abrir.
 *
 * A trava é analítica, não decorativa: sem ela o estudante toca "Ver mapa"
 * antes de ler a assimetria das curvas, e o Aha! da Etapa 4 chega sem o
 * contraste que o sustenta.
 */
export const SEGUNDOS_DE_LEITURA_DO_GRAFICO = 5;

/** De quanto em quanto o cliente pergunta em que etapa a turma está. */
export const INTERVALO_DO_GATE_MS = 5_000;

/**
 * O estudante está preso esperando a professora?
 *
 * `aguardandoATurma` vem do servidor, mas a tela precisa distinguir a ESPERA do
 * breakpoint (a aula acabou, o progresso está salvo) de qualquer outro estado.
 * São coisas pedagogicamente diferentes, e uma tela de bloqueio genérica faria
 * a criança achar que perdeu a missão.
 */
export function esperandoAAula2(estado: Estado): boolean {
  return estado.aguardandoATurma && estado.passo === "breakpoint";
}

/** As mensagens de uma conversa, na ordem em que o feed as mostra. */
export function mensagensDo(mensagens: Mensagem[], chatId: string): Mensagem[] {
  return mensagens.filter((m) => m.chat === chatId);
}

/**
 * Quantas mensagens desta conversa já foram auditadas.
 *
 * O ponto é o feedback da lista: sem isso a criança que auditou três balões do
 * mesmo grupo não teria como saber por que a cota não fechou — e a cota é sobre
 * mensagens distintas, não sobre repetição.
 */
export function auditadasDo(estado: Estado, mensagens: Mensagem[], chatId: string): number {
  const daConversa = new Set(mensagensDo(mensagens, chatId).map((m) => m.id));
  return estado.auditadas.filter((id) => daConversa.has(id)).length;
}

/**
 * A tela que o passo pede.
 *
 * Existe para o `switch` da casca ficar num lugar só, e para o F5 cair na tela
 * certa: `passo` já vem reconciliado com a etapa da turma, então quem recarrega
 * no meio da Aula 1 volta ao breakpoint, não ao mapa.
 */
export type Tela =
  | "contexto"
  | "conversas"
  | "feed"
  | "crise"
  | "espera"
  | "curvas"
  | "mapa"
  | "construtor"
  | "percurso"
  | "concluida";

export function telaDoPasso(passo: Passo, dentroDeUmChat: boolean, viuOMapa: boolean): Tela {
  switch (passo) {
    case "contexto":
      return "contexto";
    case "chats":
      return dentroDeUmChat ? "feed" : "conversas";
    case "decisao":
      return "crise";
    case "breakpoint":
      return "espera";
    case "resultado":
      // As duas telas da Etapa 4 são um passo só no servidor: a alternância é
      // do estudante, e ele pode voltar para comparar (é o que a missão pede).
      return viuOMapa ? "mapa" : "curvas";
    case "ciclo":
      return "construtor";
    case "percurso":
      return "percurso";
    case "fim":
      return "concluida";
  }
}

/**
 * Segundos decorridos desde um instante, sem negativo.
 *
 * O piso em zero não é paranoia: o relógio da máquina da escola atrasa, e um
 * `Date.now()` menor que o carimbo produziria latência negativa — que o Zod da
 * api recusa com 400, num payload que parecia certo.
 */
export function segundosDesde(inicioMs: number, agoraMs = Date.now()): number {
  return Math.max(0, Math.floor((agoraMs - inicioMs) / 1000));
}
