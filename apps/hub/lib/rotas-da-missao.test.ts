import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import * as catalogo from "./entre-redes/catalogo";
import { MISSOES_DISPONIVEIS, type Missao } from "./entre-redes/catalogo";
import { EXPS_COM_CONDUCAO, rotaDeConducao, rotasDaMissao } from "./rotas-da-missao";

/**
 * O que estes testes seguram: **"Conduzir com esta turma" apontando para 404**.
 *
 * A sala de aula (`/professor/turmas/:id`) só conhece `expId`, e montava a rota
 * de condução como `${ficha}/resultados` para TODA missão. Mas a rota
 * `.../resultados` é um despachante por `expId` que termina em `notFound()` — e
 * o Instanooria, que se conduz pela atividade, não tem ramo lá. O professor do
 * 8º ano clicava e recebia um 404 (texto branco em fundo branco, ainda por
 * cima). Relatado em 2026-09-14.
 *
 * Como o do despachante da ficha, este lê o `page.tsx` como TEXTO: o alvo é um
 * Server Component com JSX, fora do `lib/**` que o `vitest.config.ts` varre.
 */
const DESPACHANTE = join(
  __dirname,
  "../app/(plataforma)/professor/entre-redes/[ano]/[unidade]/resultados/page.tsx",
);

/**
 * Tem tela de condução, mas não passa pelo despachante: a Vila é transversal e
 * tem rota própria (`/professor/entre-redes/vila-do-lume/resultados`).
 */
const FORA_DO_DESPACHANTE: readonly string[] = ["exp-70-vila-do-lume"];

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

describe("rota de condução da sala de aula", () => {
  const fonte = readFileSync(DESPACHANTE, "utf8");

  test("só oferece condução para missão que tem tela — o resto seria 404", () => {
    const despachados = expIdsDespachados(fonte);
    const prometidas = MISSOES_DISPONIVEIS.filter(
      (missao) => missao.expId && rotasDaMissao(missao.expId)?.resultados,
    ).map((missao) => missao.expId!);

    const semTela = prometidas.filter(
      (expId) => !despachados.has(expId) && !FORA_DO_DESPACHANTE.includes(expId),
    );
    expect(semTela, "a sala linkaria para o `notFound()` do despachante").toEqual([]);
  });

  test("missão com ramo no despachante é oferecida na sala", () => {
    const orfas = [...expIdsDespachados(fonte)].filter((expId) => !EXPS_COM_CONDUCAO.has(expId));
    expect(orfas, "a tela existe e a sala não leva até ela").toEqual([]);
  });

  test("o Instanooria não oferece condução: ele se conduz pela atividade", () => {
    expect(rotaDeConducao("exp-01-instanooria", "turma-8a")).toBeNull();
  });

  test("a turma vai na URL de quem tem condução", () => {
    expect(rotaDeConducao("exp-02-unootube", "turma 8a/1")).toBe(
      "/professor/entre-redes/4-ano/unidade-1/resultados?turmaId=turma%208a%2F1",
    );
  });
});
