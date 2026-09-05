import { ANOS, MISSOES_TRANSVERSAIS } from "./entre-redes/catalogo";

/**
 * A COPY que o estudante lê de cada missão — e só isso.
 *
 * Este arquivo já foi a LISTA do hub do estudante: uma constante compilada no
 * bundle, igual para toda criança de toda escola, sem olhar série nem turma.
 * Desde a sala de aula (ADR-69) quem diz o que aparece é a api
 * (`GET /salas/minhas`), que responde pela turma: a grade do ano dela, com o
 * estado de cada missão.
 *
 * O que sobrou aqui é o texto. Ele continua vindo do catálogo do Entre Redes
 * porque é lá que a copy das duas famílias vive, e porque `missao.estudante` é
 * escrita para ser lida ANTES de jogar — a do professor entrega a virada.
 *
 * Missão sem copy de estudante NÃO aparece para ele, mesmo liberada: sem título
 * e sem chamada o card seria um retângulo com um slug dentro. O teste deste
 * arquivo cobra a copy de toda missão publicada.
 */

export interface CopyDaMissao {
  expId: string;
  titulo: string;
  chamada: string;
  /** Rota do aparelho: a experiência embedada em tela cheia. */
  rota: string;
}

/** Todas as missões publicadas que têm copy de estudante, indexadas por `expId`. */
export const COPY_POR_EXP: ReadonlyMap<string, CopyDaMissao> = new Map(
  [...MISSOES_TRANSVERSAIS, ...ANOS.flatMap((ano) => ano.missoes)]
    .filter((missao) => missao.status === "disponivel" && missao.expId && missao.estudante)
    .map((missao) => {
      const copy = missao.estudante!;
      const expId = missao.expId!;
      return [
        expId,
        { expId, titulo: copy.titulo, chamada: copy.chamada, rota: `/exp/${expId}` },
      ] as const;
    }),
);

/** `null` quando a missão não tem copy — e aí ela não vai para a tela. */
export function copyDaMissao(expId: string): CopyDaMissao | null {
  return COPY_POR_EXP.get(expId) ?? null;
}
