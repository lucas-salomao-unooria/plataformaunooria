import type { EstadoDoRelogio, RelogioPublico } from "./tipos";

export type { EstadoDoRelogio, RelogioPublico };

/**
 * As duas grandezas do relógio que a TELA precisa: o cronômetro cheio (o que
 * mostrar enquanto a largada não vem) e a hora total da cidade (o denominador da
 * barra de progresso). São constantes de desenho — a conta que decide mora na
 * api, em `regras/relogio.ts`.
 */
export const RELOGIO_DA_TELA = {
  /** A hora do cenário cabe em cinco minutos de relógio de parede. */
  duracaoRealEmSegundos: 300,
  /** 17h00 às 18h00. */
  minutosTotais: 60,
} as const;

/**
 * O relógio DA TELA. Só formatação e contagem regressiva local.
 *
 * A conta que decide — o minuto da cidade, com o pivô que impede a chuva de
 * rebobinar quando o professor estica a aula — mora na api e chega pronta em
 * `EstadoDoRelogio`. O projeto de origem tinha essa matemática nos dois lados;
 * duas cópias de uma conta sutil são duas chances de divergir, e aqui quem
 * manda é o servidor.
 *
 * O que sobra para o cliente é desenho: transformar segundos em "3:20" e fazer
 * o número descer de um em um entre dois pollings.
 */

/** "3:20". Nunca negativo — a chuva já caiu é 0:00. */
export function cronometroDe(segundosQueFaltam: number): string {
  const s = Math.max(0, Math.floor(segundosQueFaltam));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** "17:34" — a hora da cidade, a partir do minuto decorrido desde as 17h00. */
export function horaDaTela(minutosGastos: number): string {
  const total = 17 * 60 + Math.max(0, Math.min(60, minutosGastos));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Quantos segundos faltam AGORA, ancorados na hora do SERVIDOR.
 *
 * `relogio.agora` é o instante em que a api respondeu; a diferença entre ele e o
 * `Date.now()` local é a defasagem do relógio da máquina da escola, que
 * costuma atrasar. Sem esta âncora, um laboratório com a hora errada daria mais
 * (ou menos) tempo à turma do que o professor concedeu.
 */
export function segundosRestantes(
  relogio: RelogioPublico,
  estado: EstadoDoRelogio,
  agoraLocal: number,
): number | null {
  if (estado.segundosAteFechar === null) return null;
  if (estado.fase !== "correndo") return estado.segundosAteFechar;
  const desdeAResposta = (agoraLocal - Date.parse(relogio.agora)) / 1000;
  return Math.max(0, estado.segundosAteFechar - desdeAResposta);
}

/** Faixa de urgência do cronômetro. Serve para a tela mudar de tom, não de regra. */
export function urgencia(segundos: number | null): "calma" | "atencao" | "fim" {
  if (segundos === null) return "calma";
  if (segundos <= 30) return "fim";
  if (segundos <= 90) return "atencao";
  return "calma";
}

/**
 * Por que o campo está fechado, em uma frase que o aluno entende.
 *
 * Nunca "aguardando" seco: a espera pela largada é a AULA acontecendo, e um
 * campo desabilitado sem explicação parece tela travada — o aluno recarrega a
 * página e perde o lugar.
 */
export function motivoDeBloqueio(estado: EstadoDoRelogio): string | null {
  if (estado.aberta) return null;
  if (estado.fase === "aguardando") {
    return "A missão ainda não começou. Espere o professor liberar.";
  }
  if (estado.motivoDoFim === "professor") {
    return "O professor encerrou a investigação. Mande as equipes.";
  }
  return "São 18h00. A chuva chegou e não dá mais para investigar.";
}
