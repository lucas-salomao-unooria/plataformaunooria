import type { ExperienciaHandle } from "@edu/sdk";

/**
 * `hub:pause` / `hub:resume` — o hub emite quando a página perde ou recupera
 * foco.
 *
 * Aqui isso NÃO pausa o relógio: o tempo da missão é da TURMA e corre sozinho,
 * e deixar a aba escondida congelar a chuva daria vantagem a quem trocasse de
 * janela. O que a pausa faz é parar o POLLING — não há por que perguntar o
 * relógio ao servidor para uma tela que ninguém está vendo.
 */
export function ouvirVisibilidade(exp: ExperienciaHandle, aoMudar: (visivel: boolean) => void) {
  exp.on("pause", () => aoMudar(false));
  exp.on("resume", () => aoMudar(true));
}
