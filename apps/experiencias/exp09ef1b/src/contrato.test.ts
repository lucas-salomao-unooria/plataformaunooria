import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * O que o bundle NÃO pode ter, e a fronteira do DS híbrido (ADR-202). O
 * bundle é público e `/exp/exp09ef1b` é endereço adivinhável (regra 3).
 */
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}
const fonte = arquivos("src").map((f) => [f, readFileSync(f, "utf8")] as const);

describe("o bundle não carrega o gabarito", () => {
  test.each([
    ["o gabarito do protocolo", /GABARITO|BLOCO_DANOSO|blocosCorretos|nivelCO0/],
    ["a régua das habilidades", /atingiu|em_processo|nao_atingiu/],
    ["os cadernos antes da digitalização (o conteúdo do banco)", /4\.320|Caderno 1 \(dias|180 registros diários de campo: /],
  ])("%s", (_nome, padrao) => {
    for (const [arquivo, texto] of fonte) expect({ arquivo, casou: padrao.test(texto) }).toEqual({ arquivo, casou: false });
  });
});

describe("sem a Etapa 6 e sem Canal B (decisão do Lucas, 2026-10-29)", () => {
  test("nada do transporte, de enquete nem do motivo estruturado", () => {
    for (const [arquivo, texto] of fonte) {
      expect({ arquivo, casou: /Lia|Davi|Linha 302|transporte|\/perguntas|ChoicePoll|motivo_opcao|Novos dados mudaram/.test(texto) }).toEqual({ arquivo, casou: false });
    }
  });
});

describe("o DS híbrido: a separação é por pasta", () => {
  test("o clone só importa a ponte unooriaai", () => {
    for (const [arquivo, texto] of fonte.filter(([f]) => f.includes("/clone/"))) {
      expect({ arquivo, ok: !/@edu\/ui\/ds"/.test(texto) && /@edu\/ui\/ds-unooriaai/.test(texto) }).toEqual({ arquivo, ok: true });
    }
  });
  test("a mecânica só importa a ponte unooria", () => {
    for (const [arquivo, texto] of fonte.filter(([f]) => f.includes("/mecanica/"))) {
      expect({ arquivo, ok: /@edu\/ui\/ds"/.test(texto) && !/ds-unooriaai/.test(texto) }).toEqual({ arquivo, ok: true });
    }
  });
  test("as telas e o resto não importam o DS direto", () => {
    for (const [arquivo, texto] of fonte.filter(([f]) => !f.includes("/clone/") && !f.includes("/mecanica/"))) {
      expect({ arquivo, casou: /from "@edu\/ui\//.test(texto) }).toEqual({ arquivo, casou: false });
    }
  });
});

describe("a api", () => {
  const api = readFileSync("src/lib/api.ts", "utf8");
  test("as rotas do módulo, no singular (correção do PO de 29/10)", () => {
    expect(api).toContain('"/dossie-invisivel/sessao"');
    for (const rota of ["entrar", "mensagem", "ver-projetos", "digitalizar", "decisao", "pilula", "revoto", "ancoras", "protocolo"]) expect(api).toContain(`"${rota}"`);
  });
  test("a IA da aula corre no servidor: nenhum teto de timeout próprio", () => {
    expect(api).not.toMatch(/timeoutMs/);
  });
});
