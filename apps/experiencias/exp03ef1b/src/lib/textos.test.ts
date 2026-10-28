import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import * as TEXTOS from "./textos";

/** Todas as strings que a tela escreve (as funções, chamadas com valores de exemplo). */
function strings(valor: unknown): string[] {
  if (typeof valor === "string") return [valor];
  if (typeof valor === "function") {
    const f = valor as (...a: unknown[]) => unknown;
    try {
      return strings(f(2, "Onde", "Pátio"));
    } catch {
      return strings(f("k1", "Onde", "Pátio"));
    }
  }
  if (Array.isArray(valor)) return valor.flatMap(strings);
  if (valor && typeof valor === "object") return Object.values(valor).flatMap(strings);
  return [];
}
const TODAS = strings(TEXTOS);

describe("as falas da Nina são LITERAIS (sheet de copy + spec §7)", () => {
  test("E1, E3 (ajuste do PO), E4, desfechos e ponte", () => {
    expect(TEXTOS.NINA.galeria).toBe("Encontre as reportagens do pátio!");
    expect(TEXTOS.NINA.filtro).toBe(
      "A Nina sabe que existem três reportagens sobre a feira de livros da escola. Você consegue ajudá-la a encontrar, no jornal, todas as reportagens que se referem ao pátio?",
    );
    expect(TEXTOS.NINA.instrucaoDoFiltro).toBe("Utilize o filtro para encontrar a(s) reportagem(ns) do local.");
    expect(TEXTOS.NINA.ficha).toBe("Uma notícia não apareceu! O que o seu filtro deixou de fora?");
    expect(TEXTOS.NINA.sucesso).toBe("As 3 notícias apareceram no jornal.");
    expect(TEXTOS.NINA.erro).toBe("O pátio indica o local. Coloque no campo Onde!");
    expect(TEXTOS.NINA.ponte).toBe(
      "Você encontrou o que faltava nessa reportagem! Mas chegaram outras ao jornal. Será que alguma também deixou a ficha incompleta?",
    );
  });

  test("os carimbos com o texto do PO (spec §7.5) e a escolha travada (§7.1)", () => {
    expect(TEXTOS.ROTULO_DO_CARIMBO).toEqual({ v: "É verdade", x: "Não é verdade", duvida: "Não dá para saber" });
    expect(TEXTOS.E2.travada).toBe("Escolha travada!");
    expect(TEXTOS.E2.travar).toBe("Travar Escolha");
  });
});

describe("nada em inglês, e nada diz 'aposta'", () => {
  const PROIBIDAS = [/\baposta/i, /\bsubmit\b/i, /\bloading\b/i, /\berror\b/i, /\bnext\b/i, /\bback\b/i, /\bclose\b/i, /\bsearch\b/i, /\bdemo\b/i];
  test("nenhuma string da tela tem palavra proibida", () => {
    for (const s of TODAS) for (const p of PROIBIDAS) expect(s, s).not.toMatch(p);
  });

  test("nenhum componente escreve texto visível em inglês fora de `textos.ts`", () => {
    const pasta = join(__dirname, "../app");
    const arquivos: string[] = [];
    const andar = (d: string) => {
      for (const n of readdirSync(d)) {
        const c = join(d, n);
        if (statSync(c).isDirectory()) andar(c);
        else if (c.endsWith(".tsx")) arquivos.push(c);
      }
    };
    andar(pasta);
    for (const a of arquivos) {
      const fonte = readFileSync(a, "utf8");
      // Texto entre tags que não é expressão: `>Palavra<`.
      for (const m of fonte.matchAll(/>\s*([A-Za-z][^<>{}]*?)\s*</g)) {
        expect(/\b(the|and|loading|submit|cancel|close|next)\b/i.test(m[1] ?? ""), `${a}: ${m[1]}`).toBe(false);
      }
    }
  });
});

describe("nenhum gabarito na tela", () => {
  test("os textos não carregam o certo dos cartões nem a sequência da rotina", () => {
    const fonte = readFileSync(join(__dirname, "textos.ts"), "utf8");
    expect(fonte).not.toMatch(/certo\s*:/);
    expect(fonte).not.toMatch(/SEQUENCIA_CERTA/);
  });
});
