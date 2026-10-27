import { TEXTOS } from "./textos";
import type { ConteudoDoPacote, MaterialFixo, Reteste } from "./tipos";

/**
 * As conversas do UnooriaAI são ROTEIRIZADAS a partir do pacote (sem IA na
 * tela do estudante — decisão fechada). O roteiro é dado puro: a tela só o
 * revela em sequência. Nada aqui é gabarito: o desfecho de cada perfil (Lucas
 * avança, Beatriz é rebaixada, Thiago é limitado) é o que a simulação MOSTRA,
 * e os avisos de sistema descem fixos em `material.avisos`.
 */
export type Fala =
  | { tipo: "separador"; texto: string; sessao: 1 | 2 | 3 }
  | { tipo: "estudante"; texto: string; sessao: 1 | 2 | 3 }
  | { tipo: "assistente"; texto: string; sessao: 1 | 2 | 3 }
  | { tipo: "cartao"; titulo: string; texto: string; sessao: 1 | 2 | 3 };

/**
 * E4-ALU-01: Lucas pergunta → boas-vindas, a Trilha Avançada e a resposta;
 * Beatriz pergunta → o aviso de rebaixamento e o Reforço Básico; Thiago
 * pergunta duas vezes (com resposta) e na terceira recebe o limite.
 */
export function roteiroDaSimulacao(c: ConteudoDoPacote, m: MaterialFixo): Fala[] {
  return [
    { tipo: "estudante", texto: c.duvidas.lucas, sessao: 1 },
    { tipo: "assistente", texto: TEXTOS.e4chat.boasVindasLucas, sessao: 1 },
    { tipo: "cartao", titulo: c.trilhaAvancada.titulo, texto: c.trilhaAvancada.enunciado, sessao: 1 },
    { tipo: "assistente", texto: c.respostas.lucas, sessao: 1 },
    { tipo: "separador", texto: TEXTOS.e4chat.separadorBeatriz, sessao: 2 },
    { tipo: "estudante", texto: c.duvidas.beatriz, sessao: 2 },
    { tipo: "assistente", texto: TEXTOS.e4chat.aviso(m.avisos.beatriz), sessao: 2 },
    { tipo: "cartao", titulo: c.reforcoBasico.titulo, texto: c.reforcoBasico.enunciado, sessao: 2 },
    { tipo: "separador", texto: TEXTOS.e4chat.separadorThiago, sessao: 3 },
    { tipo: "estudante", texto: c.duvidas.thiago1, sessao: 3 },
    { tipo: "assistente", texto: c.respostas.thiago1, sessao: 3 },
    { tipo: "estudante", texto: c.duvidas.thiago2, sessao: 3 },
    { tipo: "assistente", texto: c.respostas.thiago2, sessao: 3 },
    { tipo: "estudante", texto: c.duvidas.thiago3, sessao: 3 },
    { tipo: "assistente", texto: TEXTOS.e4chat.aviso(m.avisos.thiago), sessao: 3 },
  ];
}

/**
 * E5-ALU-04: o efeito do reteste no chat. Com a função 1 sem dado observado,
 * a Beatriz recebe a resposta avançada; com a 2, o Thiago recebe a terceira
 * resposta. Os dois booleanos vêm do SERVIDOR (`ultimoReteste`): a tela não
 * sabe quais critérios são equitativos.
 */
export function roteiroDoReteste(c: ConteudoDoPacote, m: MaterialFixo, r: Reteste): Fala[] {
  return [
    { tipo: "separador", texto: TEXTOS.e4chat.separadorBeatriz, sessao: 2 },
    { tipo: "estudante", texto: c.duvidas.beatriz, sessao: 2 },
    ...(r.beatrizAvancada
      ? ([
          { tipo: "cartao", titulo: c.trilhaAvancada.titulo, texto: c.trilhaAvancada.enunciado, sessao: 2 },
          { tipo: "assistente", texto: c.respostas.beatriz, sessao: 2 },
        ] as const)
      : ([
          { tipo: "assistente", texto: TEXTOS.e4chat.aviso(m.avisos.beatriz), sessao: 2 },
          { tipo: "cartao", titulo: c.reforcoBasico.titulo, texto: c.reforcoBasico.enunciado, sessao: 2 },
        ] as const)),
    { tipo: "separador", texto: TEXTOS.e4chat.separadorThiago, sessao: 3 },
    { tipo: "estudante", texto: c.duvidas.thiago3, sessao: 3 },
    r.thiagoLivre
      ? { tipo: "assistente", texto: c.respostas.thiago3, sessao: 3 }
      : { tipo: "assistente", texto: TEXTOS.e4chat.aviso(m.avisos.thiago), sessao: 3 },
  ];
}
