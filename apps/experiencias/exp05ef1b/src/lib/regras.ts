import type { Estado, LotePublico, MensagemPublica, Passo } from "./tipos";

/**
 * As poucas regras que são do CLIENTE — e por que são tão poucas.
 *
 * Tudo o que decide o que vale (o piso de 3, a leitura integral, o latch da
 * confirmação, o histograma da sala e a veracidade de cada mensagem) mora no
 * servidor, em `apps/api/src/quem-mandou-isso/regras/`. O que sobra aqui é o
 * que o servidor não tem como saber: há quanto tempo esta tela está aberta,
 * quanto tempo o dedo desta criança segurou o balão, e qual das telas o passo
 * está pedindo agora.
 */

/** De quanto em quanto o cliente pergunta em que etapa a turma está (ADR-93). */
export const INTERVALO_DO_GATE_MS = 5_000;

/**
 * Quanto tempo o dedo fica no balão para abrir a seleção.
 *
 * 400 ms é o gesto do app real. Mais curto, a rolagem do feed vira seleção
 * acidental num tablet — e a criança encaminha uma mensagem que não escolheu,
 * num Mural que ela não pode desfazer depois do latch. Mais longo, o toque
 * parece não ter funcionado e ela toca de novo.
 */
export const MS_DO_TOQUE_LONGO = 400;

/**
 * Segundos de inação no grupo antes de Nina falar.
 *
 * O silêncio pedagógico vale enquanto a criança está lendo: nada na tela dá
 * dica de qual mensagem encaminhar, e este balão também não dá — ele só ensina
 * o GESTO (tocar e segurar), que é a única coisa que ela não tem como
 * descobrir sozinha num app que nunca usou. Quatro minutos é o tempo que o
 * playtest mostrou entre "ainda está lendo" e "travou e desistiu".
 */
export const SEGUNDOS_ATE_O_SCAFFOLDING = 240;

/**
 * A tela que o estado pede.
 *
 * Existe para o `switch` da casca ficar num lugar só e para o F5 cair na tela
 * certa: `passo` já vem reconciliado com a etapa da turma, então quem recarrega
 * depois do latch volta para a espera, não para o grupo aberto.
 *
 * `preparada` vem PRIMEIRO e ganha de todo passo. A missão nasce vazia: sem
 * lote homologado não há grupo, não há Mural e não há o que revelar — e cair no
 * feed com `lote === null` seria uma tela de mensageiro sem mensagem nenhuma,
 * que a criança leria como app quebrado.
 */
export type Tela =
  | "preparo"
  | "contexto"
  | "grupo"
  | "mural"
  | "espera"
  | "revelado"
  | "reflexao"
  | "fim";

export function telaDoPasso(passo: Passo, preparada: boolean, muralAberto: boolean): Tela {
  if (!preparada) return "preparo";
  switch (passo) {
    case "contexto":
      return "contexto";
    case "curadoria":
      // O grupo e o Mural são o MESMO passo no servidor: a ida e a volta são do
      // estudante ("Voltar para Turma 5ºB"), e gravar cada travessia como passo
      // faria o polling do gate empurrá-lo de uma tela para a outra.
      return muralAberto ? "mural" : "grupo";
    case "espera":
      return "espera";
    case "revelado":
      return "revelado";
    case "reflexao":
      return "reflexao";
    case "fim":
      return "fim";
  }
}

/**
 * As mensagens que foram ao Mural, na ordem do GRUPO.
 *
 * Não na ordem em que a criança encaminhou: o Mural é a leitura final dela, e
 * reordenar por clique faria a mesma curadoria parecer outra a cada revisão —
 * e, na revelação, faria a fita de veracidade mudar de lugar entre uma tela e a
 * seguinte.
 */
export function mensagensEncaminhadas(
  lote: LotePublico,
  encaminhadas: readonly string[],
): MensagemPublica[] {
  const noMural = new Set(encaminhadas);
  return lote.mensagens.filter((m) => noMural.has(m.id));
}

/** Esta mensagem já está no Mural? É o que acende o selo "Encaminhada". */
export function estaNoMural(estado: Estado, mensagemId: string): boolean {
  return estado.encaminhadas.includes(mensagemId);
}

/**
 * A proporção de uma barra do infográfico, de 0 a 100 e inteira.
 *
 * O piso em 2% não é enfeite: uma barra de largura zero some, e sumir diz
 * "não existe" quando o dado é "existe e é pequeno" — que é justamente a
 * leitura do card quando a sala filtrou bem. Total zero devolve zero: aí a
 * barra realmente não tem o que mostrar.
 */
export function proporcao(valor: number, total: number): number {
  if (total <= 0 || valor <= 0) return 0;
  return Math.max(2, Math.round((valor / total) * 100));
}

/**
 * Segundos decorridos desde um instante, sem negativo.
 *
 * O piso em zero não é paranoia: o relógio da máquina da escola atrasa, e um
 * `Date.now()` menor que o carimbo produziria um tempo negativo na telemetria
 * do primeiro encaminhamento — o número que esta missão existe para medir.
 */
export function segundosDesde(inicioMs: number, agoraMs = Date.now()): number {
  return Math.max(0, Math.floor((agoraMs - inicioMs) / 1000));
}
