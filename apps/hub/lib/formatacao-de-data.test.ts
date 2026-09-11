import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

import { describe, expect, test } from "vitest";

/**
 * O que este teste segura: **data formatada sem fuso, numa tela do hub**.
 *
 * O hub renderiza a MESMA linha no servidor e no navegador. Sem `timeZone`, o
 * container (UTC) e a professora (`America/Sao_Paulo`) discordam por três horas
 * — e entre 21h e a meia-noite isso vira um DIA de diferença. O React acusa
 * "hydration failed", regenera a árvore, e o clique dela cai no vazio: foi
 * assim que a suíte e2e da exp-08 morreu com `page.click: Timeout 30000ms`,
 * um sintoma a três saltos da causa (ADR-98).
 *
 * A correção foi centralizar em `@edu/sdk` (`data`, `dataCurta`, `dataHora`,
 * `dataCurtaHora`, `hora`, `horaComSegundos`). Mas centralizar não impede
 * ninguém de escrever `new Date(x).toLocaleDateString(...)` na próxima tela, e
 * o defeito é **intermitente**: passa em toda revisão feita de manhã.
 *
 * Número não tem fuso: `n.toLocaleString("pt-BR")` para separar milhar continua
 * livre, e é por isso que `toLocaleString` sozinho não basta como sinal — só
 * conta quando está sobre uma data.
 */
const RAIZ = join(__dirname, "..");
const PASTAS = ["app", "components", "lib"];

/** `toLocaleDateString` e `toLocaleTimeString` só existem em `Date`. */
const SO_DE_DATA = /\.toLocale(Date|Time)String\s*\(/;
/** `toLocaleString` é ambíguo; sobre um `new Date(...)`, não é. */
const DATA_COM_TO_LOCALE_STRING = /new\s+Date\s*\([^)]*\)\s*\.toLocaleString\s*\(/;
/** O formatador cru, que é onde o `timeZone` seria esquecido de novo. */
const INTL_DE_DATA = /new\s+Intl\.DateTimeFormat\s*\(/;

function arquivosDeCodigo(dir: string): string[] {
  const achados: string[] = [];
  for (const nome of readdirSync(dir)) {
    if (nome === "node_modules" || nome.startsWith(".")) continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      achados.push(...arquivosDeCodigo(caminho));
    } else if ([".ts", ".tsx"].includes(extname(nome)) && !nome.includes(".test.")) {
      achados.push(caminho);
    }
  }
  return achados;
}

describe("formatação de data no hub", () => {
  test("nenhuma tela formata data sem o fuso da plataforma", () => {
    const infratores: string[] = [];

    for (const pasta of PASTAS) {
      for (const arquivo of arquivosDeCodigo(join(RAIZ, pasta))) {
        const linhas = readFileSync(arquivo, "utf8").split("\n");
        linhas.forEach((linha, i) => {
          const suspeita =
            SO_DE_DATA.test(linha) ||
            DATA_COM_TO_LOCALE_STRING.test(linha) ||
            INTL_DE_DATA.test(linha);
          // Uma linha que já declara o fuso está certa — é o que o SDK faz.
          if (suspeita && !linha.includes("timeZone")) {
            infratores.push(`${relative(RAIZ, arquivo)}:${i + 1}`);
          }
        });
      }
    }

    expect(
      infratores,
      "use `data`/`dataCurta`/`dataHora`/`dataCurtaHora`/`hora`/`horaComSegundos` do `@edu/sdk`",
    ).toEqual([]);
  });
});
