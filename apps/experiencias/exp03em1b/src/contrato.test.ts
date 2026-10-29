import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * O que o bundle NÃO pode ter, e as fronteiras que o typecheck não vê — o
 * bundle é público, e `/exp/exp03em1b` é endereço adivinhável (regra 3).
 */
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}
/** `lib/fixtures.ts` é SÓ de desenvolvimento (import dinâmico atrás de `import.meta.env.DEV`): fica fora. */
const fonte = arquivos("src")
  .filter((f) => !f.endsWith("fixtures.ts"))
  .map((f) => [f, readFileSync(f, "utf8")] as const);

describe("o bundle não carrega o gabarito da perícia", () => {
  test("nem o cartão distorcido, nem o motivo, nem a palavra do gabarito", () => {
    for (const [arquivo, texto] of fonte) {
      expect({ arquivo, casou: /CARTAO_DISTORCIDO|MOTIVO_DA_DISTORCAO|cartaoDistorcido|gabarito\s*[:=]/.test(texto) }).toEqual({ arquivo, casou: false });
    }
  });

  test("nem o conteúdo do banco padrão (ele vem da api, do pacote homologado)", () => {
    for (const [arquivo, texto] of fonte) {
      expect({ arquivo, casou: /Mariana Costa|Conselheiro Beto|Santos Dumont|Rua das Flores|Vigilância Sanitária/.test(texto) }).toEqual({ arquivo, casou: false });
    }
  });

  test("o código só importa a api FALSA de dentro de `import.meta.env.DEV`", () => {
    const boot = readFileSync("src/bootstrap.tsx", "utf8");
    const i = boot.indexOf('import("./lib/fixtures")');
    expect(i).toBeGreaterThan(boot.indexOf("import.meta.env.DEV"));
    for (const [arquivo, texto] of fonte) {
      if (arquivo.endsWith("bootstrap.tsx")) continue;
      expect({ arquivo, casou: /lib\/fixtures|\.\/fixtures/.test(texto) }).toEqual({ arquivo, casou: false });
    }
  });

  test.runIf(existsSync("dist/assets"))("o build de produção não leva a fixture nem o catálogo da api", () => {
    const js = readdirSync("dist/assets").filter((n) => n.endsWith(".js"));
    expect(js.length).toBeGreaterThan(0);
    for (const n of js) {
      const t = readFileSync(join("dist/assets", n), "utf8");
      expect({ n, casou: /__portaVoz|fixture|Mariana Costa|Santos Dumont/.test(t) }).toEqual({ n, casou: false });
    }
  });
});

describe("sem podcast nem texto livre na tela do estudante (decisão 1)", () => {
  test("nenhum player, transcrição ou podcast", () => {
    for (const [arquivo, texto] of fonte) {
      /* O comentário pode explicar a ausência; o CÓDIGO não pode ter a peça. */
      const codigo = texto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect({ arquivo, casou: /podcast|AudioPlayer|Transcrição/i.test(codigo) }).toEqual({ arquivo, casou: false });
    }
  });

  test("sem campo de escrever: nada de MessageComposer nem TextField (o manifesto não pede `forms`)", () => {
    for (const [arquivo, texto] of fonte) {
      expect({ arquivo, casou: /<MessageComposer|<TextField|<textarea|<input /.test(texto) }).toEqual({ arquivo, casou: false });
    }
    const m = JSON.parse(readFileSync("public/experiencia.json", "utf8")) as { permissoes?: string[] };
    expect(m.permissoes ?? []).not.toContain("forms");
  });
});

describe("a api do módulo porta-voz-dos-dados", () => {
  const api = readFileSync("src/lib/api.ts", "utf8");
  test("as rotas do contrato, e só elas", () => {
    expect(api).toContain('"/porta-voz-dos-dados"');
    for (const rota of ["sessao/marco", "decisao/publicar", "errata/publicar", "errata/pular", "pericia/parecer", "pericia/pular"]) {
      expect(api).toContain(`"${rota}"`);
    }
    expect(api).toContain("${BASE}/sessao");
  });
  test("sem IA na aula: nenhum teto de timeout próprio", () => {
    expect(api).not.toMatch(/timeoutMs/);
  });
});

describe("cada tela fala pela sua seção do DS", () => {
  const telas = readdirSync("src/telas").filter((n) => n.endsWith(".tsx"));
  const ler = (arquivo: string) => readFileSync(join("src/telas", arquivo), "utf8");
  const pontes = (arquivo: string) => [...ler(arquivo).matchAll(/from "@edu\/ui\/([a-z-]+)"/g)].map((m) => m[1]);

  test("nenhuma tela mistura duas seções", () => {
    for (const t of telas) expect({ t, n: new Set(pontes(t)).size <= 1 }).toEqual({ t, n: true });
  });

  test.each([
    ["Conversas.tsx", "ds-unoochat"],
    ["Assistente.tsx", "ds-unoochat"],
    ["Compositor.tsx", "ds-unoochat"],
    ["Grupo.tsx", "ds-unoochat"],
    ["Pausa.tsx", "ds-unoochat"],
    ["Pericia.tsx", "ds-unoochat"],
    ["Pecas.tsx", "ds-unoochat"],
    ["FaixaDeConexao.tsx", "ds-unoochat"],
    ["Laudo.tsx", "ds"],
    ["Conclusao.tsx", "ds"],
  ])("%s → @edu/ui/%s", (arquivo, ponte) => {
    expect(pontes(arquivo)).toEqual([ponte]);
  });

  test("o gráfico e a planilha são desenho: não importam ponte (servem às duas seções)", () => {
    expect(pontes("GraficoDoBoletim.tsx")).toEqual([]);
    expect(pontes("TabelaDoBoletim.tsx")).toEqual([]);
  });

  test("o compositor usa o Switch e o Radio do clone, nunca o Toggle da plataforma", () => {
    expect(ler("Compositor.tsx")).toMatch(/<Switch\b/);
    expect(ler("Compositor.tsx")).not.toMatch(/\bToggle\b/);
  });

  test("a nota técnica abre numa BottomSheet, não no AttachmentSheet", () => {
    expect(ler("Assistente.tsx")).not.toMatch(/AttachmentSheet/);
  });
});
