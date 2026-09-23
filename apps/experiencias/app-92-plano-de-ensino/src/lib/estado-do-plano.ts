import type { Status } from "./tipos";

/**
 * O que a tela do plano anual mostra, em UM valor.
 *
 * Existe por um bug de tela: os três blocos eram três condições independentes
 * no JSX, e duas delas podiam ser verdadeiras ao mesmo tempo. Com o plano em
 * `pendente`, a tela mostrava JUNTOS o botão "Escrever o plano anual" e a
 * barra de progresso com "pode fechar esta tela: a geração continua no
 * servidor" — e a promessa vencia o botão. O professor esperava por um
 * trabalho que ninguém tinha começado, enquanto o polling relia `pendente`
 * a cada três segundos, para sempre.
 *
 * Condições independentes que precisam ser mutuamente exclusivas são um convite
 * a essa classe de erro: nada no compilador impede a segunda de esquecer o que
 * a primeira já cobriu. Um valor só, decidido aqui, torna a sobreposição
 * impossível de escrever — e testável sem montar componente.
 *
 * A regra de leitura de `Status` que o bug ignorava: **`pendente` é "ninguém
 * disparou"**, não "está em andamento". Quem dispara recebe `gerando` do claim
 * na mesma requisição, então um plano só está sendo escrito de verdade quando
 * o servidor diz `gerando`.
 */
export type EstadoDaTelaDoPlano = "convite" | "gerando" | "documento";

export function estadoDaTelaDoPlano(status: Status, html: string | null): EstadoDaTelaDoPlano {
  if (status === "gerando") return "gerando";
  // O documento vale mais que o status: uma regeneração que falhou não apaga o
  // plano que o professor já tem na mão, e escondê-lo para mostrar um convite
  // seria trocar trabalho salvo por um botão.
  if (html !== null) return "documento";
  return "convite";
}
