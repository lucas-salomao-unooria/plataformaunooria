import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import * as catalogo from "./entre-redes/catalogo";
import { MISSOES_DISPONIVEIS, type Missao } from "./entre-redes/catalogo";
import { comTurma, rotaDeConducao, rotasDaMissao } from "./rotas-da-missao";

/**
 * O caminho da SALA DE AULA para a missão (ADR-100).
 *
 * Duas regressões já aconteceram nesta linha, e são OPOSTAS — por isso as duas
 * estão presas aqui:
 *
 * 1. **Link para 404** (o card de 2026-09-14): a sala apontava direto para
 *    `.../resultados`, que é um despachante e termina em `notFound()` para quem
 *    não tem ramo. O Instanooria não tem, e o professor do 8º ano caía no erro.
 * 2. **Link ausente**: a primeira correção tirou o link daquela missão. Deixou
 *    de dar 404 e passou a esconder da sala o caminho da aula, que é pior de
 *    perceber — ninguém abre um chamado por um link que não existe.
 *
 * Hoje a sala faz UMA pergunta, "onde fica esta missão?", e a resposta é sempre
 * a ficha, com a turma. Quem sabe o que cada missão oferece é o corpo dela.
 */
const TURMA = "87dbd1f4-0c67-445e-a58b-65a72cefeb3e";

const DESPACHANTE_DE_RESULTADOS = join(
  __dirname,
  "../app/(plataforma)/professor/entre-redes/[ano]/[unidade]/resultados/page.tsx",
);
const CORPOS = join(
  __dirname,
  "../app/(plataforma)/professor/entre-redes/[ano]/[unidade]",
);

/** Nome da constante do catálogo → `expId`, para ler o `page.tsx` sem adivinhar. */
function expIdsDespachados(fonte: string): Set<string> {
  const despachados = new Set<string>();
  for (const [, nome] of fonte.matchAll(/missao\.expId === (MISSAO_\w+)\.expId/g)) {
    if (!nome) continue;
    const missao = (catalogo as Record<string, unknown>)[nome] as Missao | undefined;
    expect(missao, `${nome} é comparado no despachante mas não existe no catálogo`).toBeDefined();
    if (missao?.expId) despachados.add(missao.expId);
  }
  return despachados;
}

describe("da sala para a missão", () => {
  test("TODA missão publicada tem caminho — nenhuma fica sem link", () => {
    const semCaminho = MISSOES_DISPONIVEIS.filter(
      (missao) => missao.expId && !rotaDeConducao(missao.expId, TURMA),
    ).map((missao) => missao.expId);

    expect(semCaminho, "a sala esconderia a missão do professor").toEqual([]);
  });

  test("o caminho é a FICHA, nunca a tela de resultados", () => {
    /* Apontar para `.../resultados` foi exatamente o que produziu o 404: a sala
       decidindo o que a missão oferece, sem ter como saber. */
    for (const missao of MISSOES_DISPONIVEIS) {
      if (!missao.expId) continue;
      const rota = rotaDeConducao(missao.expId, TURMA)!;
      expect(rota, `${missao.expId} volta a apontar para uma tela interna`).not.toContain(
        "/resultados",
      );
      expect(rota.startsWith(`${rotasDaMissao(missao.expId)!.ficha}?`)).toBe(true);
    }
  });

  test("a missão do card (Instanooria) abre a ficha na turma", () => {
    expect(rotaDeConducao("exp-01-instanooria", TURMA)).toBe(
      `/professor/entre-redes/8-ano/unidade-1?turmaId=${TURMA}`,
    );
  });

  test("a turma vai na URL, escapada", () => {
    expect(rotaDeConducao("exp-02-unootube", "turma 8a/1")).toBe(
      "/professor/entre-redes/4-ano/unidade-1?turmaId=turma%208a%2F1",
    );
  });

  test("missão que o hub não conhece não ganha link", () => {
    expect(rotaDeConducao("exp-99-inexistente", TURMA)).toBeNull();
  });
});

describe("comTurma", () => {
  test("sem turma, devolve a rota intacta — a tela de destino tem seletor", () => {
    expect(comTurma("/professor/entre-redes/8-ano/unidade-1/resultados", null)).toBe(
      "/professor/entre-redes/8-ano/unidade-1/resultados",
    );
    expect(comTurma("/x", undefined)).toBe("/x");
    expect(comTurma("/x", "")).toBe("/x");
  });

  test("com turma, repõe o parâmetro que a sala já sabia", () => {
    expect(comTurma("/x", TURMA)).toBe(`/x?turmaId=${TURMA}`);
  });
});

describe("o corpo da missão não promete tela que não existe", () => {
  test("todo corpo que linka /resultados tem ramo no despachante", () => {
    /* A sala não aponta mais para `.../resultados`, mas os CORPOS apontam — e
       lá o 404 voltaria pelo mesmo buraco, só que um clique mais fundo. */
    const despachados = expIdsDespachados(readFileSync(DESPACHANTE_DE_RESULTADOS, "utf8"));

    const orfas = MISSOES_DISPONIVEIS.filter((missao) => {
      if (!missao.expId || !("anoSlug" in missao)) return false;
      const arquivo = join(CORPOS, `missao-${missao.expId.replace(/^exp-\d+-/, "")}.tsx`);
      let fonte: string;
      try {
        fonte = readFileSync(arquivo, "utf8");
      } catch {
        /* Corpo com outro nome de arquivo: o teste do despachante da ficha
           (`despachante-da-ficha.test.ts`) é quem cobra a existência do ramo. */
        return false;
      }
      return fonte.includes("/resultados") && !despachados.has(missao.expId);
    }).map((missao) => missao.expId);

    expect(orfas, "o corpo oferece 'ver resultados' para o `notFound()`").toEqual([]);
  });
});
