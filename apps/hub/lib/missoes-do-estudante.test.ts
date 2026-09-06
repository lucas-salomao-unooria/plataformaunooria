import { describe, expect, test } from "vitest";
import { ANOS, MISSOES_TRANSVERSAIS } from "./entre-redes/catalogo";
import { COPY_POR_EXP, copyDaMissao } from "./missoes-do-estudante";

/**
 * A COPY do hub do estudante.
 *
 * Este teste já cobrou a LISTA e a ORDEM das missões. Não cobra mais: desde a
 * sala de aula (ADR-69) quem responde o que aparece é a api, pela turma
 * (`GET /salas/minhas`), e a ordem — transversal primeiro — é decidida em
 * `salas/regras.ts`, com teste próprio do lado de lá. O que sobrou aqui é a
 * regra que continua sendo do hub: missão sem copy de estudante não vai à tela.
 */

/** Missões de ano E transversais: as duas famílias entram no hub do estudante. */
const publicadas = [
  ...ANOS.flatMap((ano) => ano.missoes),
  ...MISSOES_TRANSVERSAIS,
].filter((missao) => missao.status === "disponivel");

describe("copy das missões do estudante", () => {
  test("toda missão publicada tem copy — senão o card seria um slug num retângulo", () => {
    const semCopy = publicadas.filter((missao) => !missao.estudante);
    /* Identifica pelo `expId` (as duas famílias têm) e cai no título, que
       também têm — `unidadeSlug` só existe nas de ano. */
    expect(semCopy.map((m) => m.expId ?? m.titulo)).toEqual([]);
  });

  test("toda missão publicada é encontrável por `expId`, com rota do aparelho", () => {
    for (const missao of publicadas) {
      const copy = copyDaMissao(missao.expId!);
      expect(copy).not.toBeNull();
      expect(copy!.rota).toBe(`/exp/${missao.expId}`);
      expect(copy!.titulo.length).toBeGreaterThan(0);
    }
  });

  test("a transversal tem copy como qualquer outra — ela não é caso especial aqui", () => {
    for (const missao of MISSOES_TRANSVERSAIS) {
      if (missao.status !== "disponivel") continue;
      expect(COPY_POR_EXP.has(missao.expId!)).toBe(true);
    }
  });

  test("expId desconhecido devolve null em vez de quebrar a tela", () => {
    // A api pode liberar uma experiência que o catálogo do hub ainda não
    // conhece (bundle publicado antes de a copy ser escrita). A tela pula.
    expect(copyDaMissao("exp-99-que-nao-existe")).toBeNull();
  });

  test("a copy do estudante não repete a do professor (que entrega a virada)", () => {
    for (const missao of publicadas) {
      const copy = missao.estudante!;
      expect(copy.chamada).not.toBe(missao.resumo);
    }
  });
});
