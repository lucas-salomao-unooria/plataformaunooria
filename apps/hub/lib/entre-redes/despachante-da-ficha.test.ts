import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import * as catalogo from "./catalogo";
import { MISSOES_DISPONIVEIS, type Missao } from "./catalogo";

/**
 * O que estes testes seguram é uma coisa só: **missão publicada sem ramo no
 * despachante da ficha**.
 *
 * `app/(plataforma)/professor/entre-redes/[ano]/[unidade]/page.tsx` escolhe o
 * corpo da ficha por `missao.expId`, e o `return` final é o corpo do
 * INSTANOORIA. Quem publica uma missão e não acrescenta o ramo não ganha erro
 * nenhum: a tela ABRE, e mostra a ficha de outra missão — com "Nova atividade",
 * que grava em `exp08ef1b_activities`, e sem "Abrir a aula e os resultados", que é
 * o único caminho para o painel da turma.
 *
 * Aconteceu duas vezes. A segunda foi a exp08ef4b (2026-09-11), com o aviso já
 * escrito em `missao-rastro-boato.tsx`, no arquivo ao lado — e quem achou foi a
 * suíte e2e, no `click` que estourou 30s. Comentário não é rede; este teste é.
 *
 * O teste lê o `page.tsx` como TEXTO de propósito: o alvo é um Server Component
 * com JSX, fora do `lib/**` que o `vitest.config.ts` do hub varre, e importá-lo
 * arrastaria a árvore inteira de componentes do design system para dentro do
 * teste. O que importa aqui não é o que o componente desenha — é se o `expId`
 * tem ramo.
 */
const DESPACHANTE = join(
  __dirname,
  "../../app/(plataforma)/professor/entre-redes/[ano]/[unidade]/page.tsx",
);

/**
 * A missão que o `return` final atende, por desenho.
 *
 * Entrar aqui é declarar, por escrito, que aquela missão usa o corpo do
 * Instanooria — nunca um jeito de calar o teste.
 */
const MISSOES_NO_FALLBACK: readonly string[] = ["exp08ef1b"];

/** Nome da constante do catálogo → `expId`, para ler o `page.tsx` sem adivinhar. */
function expIdsDespachados(fonte: string): Set<string> {
  const despachados = new Set<string>();
  for (const [, nome] of fonte.matchAll(/missao\.expId === (MISSAO_\w+)\.expId/g)) {
    /* O grupo 1 existe sempre que a regex casa, mas o tipo de `matchAll` não
       sabe disso: sem o estreitamento, `tsc` recusa o índice. */
    if (!nome) continue;
    const missao = (catalogo as Record<string, unknown>)[nome] as Missao | undefined;
    expect(missao, `${nome} é comparado no despachante mas não existe no catálogo`).toBeDefined();
    if (missao?.expId) despachados.add(missao.expId);
  }
  return despachados;
}

describe("despachante da ficha da missão", () => {
  const fonte = readFileSync(DESPACHANTE, "utf8");

  test("toda missão publicada com experiência tem ramo próprio", () => {
    const despachados = expIdsDespachados(fonte);
    const orfas = MISSOES_DISPONIVEIS.filter(
      (missao) => missao.expId && "anoSlug" in missao,
    )
      .map((missao) => missao.expId!)
      .filter((expId) => !despachados.has(expId) && !MISSOES_NO_FALLBACK.includes(expId));

    expect(orfas, "cairiam no corpo do Instanooria sem nenhum erro").toEqual([]);
  });

  test("o ramo importa o corpo que ele devolve", () => {
    for (const [, nome] of fonte.matchAll(/return <(Missao\w+) ano=/g)) {
      expect(fonte, `${nome} é devolvido sem import`).toContain(`import { ${nome} } from "./`);
    }
  });
});
