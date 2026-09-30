import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * AS REGRAS DOS AGENTES TÊM UMA FONTE E DUAS PORTAS (ADR-102).
 *
 * `docs/regras/` é a fonte. `.agents/rules/` (lida pelo Antigravity) e
 * `.claude/rules/` (lida pelo Claude Code) são symlinks para ela — e NÃO têm o
 * mesmo conteúdo, de propósito:
 *
 * - `.agents/rules/` tem TODAS as regras: o Antigravity lê tudo o que está lá.
 * - `.claude/rules/` tem SÓ as que declaram `paths:` no frontmatter. O Claude
 *   Code carrega regra SEM `paths:` no início de TODA sessão; com `paths:`, só
 *   quando mexe em arquivo que combina. Linkar uma regra sem `paths:` ali a
 *   colocaria em toda conversa, inteira, para sempre.
 *
 * Sem este teste, "as duas pastas espelham a fonte" seria intenção escrita num
 * documento, e a falha é muda: regra nova que esquece um symlink chega a uma
 * ferramenta e à outra não, e o agente simplesmente não sabe a regra — sem erro,
 * sem sintoma. Foi assim que `.claude/rules/` ficou com 8 das 13 regras sem
 * ninguém saber se era decisão ou descuido.
 *
 * Também vale o teto de 12.000 caracteres por regra: é o corte do Antigravity,
 * que trunca em silêncio o FIM do arquivo, onde costuma estar a consequência.
 *
 * E o `CLAUDE.md` é SÓ o ponteiro `@AGENTS.md` (ADR-55), com uma exceção: na raiz,
 * o bloco que uma ferramenta escreve e reescreve — hoje o do graphify (ADR-124).
 *
 * Sem banco: lê o repositório e roda em qualquer máquina.
 */

const RAIZ = resolve(__dirname, "../../..");
const FONTE = join(RAIZ, "docs/regras");
const PASTA_CLAUDE = join(RAIZ, ".claude/rules");
const PASTA_AGENTES = join(RAIZ, ".agents/rules");
const TETO_DE_CARACTERES = 12_000;

const regras = readdirSync(FONTE)
  .filter((nome) => nome.endsWith(".md"))
  .sort();

const texto = (nome: string) => readFileSync(join(FONTE, nome), "utf8");

/** O frontmatter é `---`, `paths:` com itens `  - "glob"`, `---`. Qualquer outra forma não é lida como `paths`. */
const PATHS_NO_FRONTMATTER = /^---\r?\npaths:\r?\n(?:[ \t]+- .+\r?\n)+---\r?\n/;
const temPaths = (nome: string) => PATHS_NO_FRONTMATTER.test(texto(nome));

const comPaths = regras.filter(temPaths);
const semPaths = regras.filter((n) => !temPaths(n));

describe("docs/regras: a fonte", () => {
  test("há regras para conferir (senão este arquivo passaria vazio e não provaria nada)", () => {
    expect(regras.length).toBeGreaterThan(0);
    expect(comPaths.length).toBeGreaterThan(0);
    expect(semPaths.length).toBeGreaterThan(0);
  });

  test("frontmatter, quando existe, é um `paths:` que o Claude Code lê", () => {
    const malFormadas = regras.filter((n) => texto(n).startsWith("---") && !temPaths(n));
    expect(malFormadas).toEqual([]);
  });

  test.each(regras)("%s cabe no corte de 12.000 caracteres do Antigravity", (nome) => {
    expect(Array.from(texto(nome)).length).toBeLessThanOrEqual(TETO_DE_CARACTERES);
  });
});

describe(".agents/rules: todas as regras, por symlink", () => {
  test("tem exatamente as regras de docs/regras", () => {
    expect(readdirSync(PASTA_AGENTES).sort()).toEqual(regras);
  });

  test.each(regras)("%s é symlink para a fonte", (nome) => {
    const caminho = join(PASTA_AGENTES, nome);
    expect(lstatSync(caminho).isSymbolicLink()).toBe(true);
    expect(realpathSync(caminho)).toBe(realpathSync(join(FONTE, nome)));
  });
});

describe(".claude/rules: só as regras com `paths:`, por symlink", () => {
  test("tem exatamente as regras que declaram `paths:`", () => {
    expect(readdirSync(PASTA_CLAUDE).sort()).toEqual(comPaths);
  });

  test.each(comPaths)("%s é symlink para a fonte", (nome) => {
    const caminho = join(PASTA_CLAUDE, nome);
    expect(lstatSync(caminho).isSymbolicLink()).toBe(true);
    expect(realpathSync(caminho)).toBe(realpathSync(join(FONTE, nome)));
  });

  test("regra SEM `paths:` não entra aqui: o Claude Code a carregaria em toda sessão", () => {
    const presentes = new Set(readdirSync(PASTA_CLAUDE));
    expect(semPaths.filter((n) => presentes.has(n))).toEqual([]);
  });
});

/** Pastas com `AGENTS.md`, sem descer no que não é do repositório. */
const PULAR = new Set(["node_modules", ".git", ".next", ".turbo", "dist", "coverage", "worktrees", "graphify-out", "storage", "storage-privado"]);
function pastasComAgents(dir: string, achadas: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && !PULAR.has(e.name)) pastasComAgents(join(dir, e.name), achadas);
    else if (e.isFile() && e.name === "AGENTS.md") achadas.push(dir);
  }
  return achadas.sort();
}
const pastas = pastasComAgents(RAIZ);
const relativa = (p: string) => (p === RAIZ ? "(raiz)" : p.slice(RAIZ.length + 1));

describe("CLAUDE.md: o ponteiro (ADR-55, ADR-124)", () => {
  test("há pastas com AGENTS.md para conferir", () => {
    expect(pastas.length).toBeGreaterThan(50);
  });

  test.each(pastas.filter((p) => p !== RAIZ).map((p) => [relativa(p), p] as const))(
    "%s: o CLAUDE.md existe e é só `@AGENTS.md`",
    (_nome, pasta) => {
      const arquivo = join(pasta, "CLAUDE.md");
      expect(existsSync(arquivo)).toBe(true);
      expect(readFileSync(arquivo, "utf8").trim()).toBe("@AGENTS.md");
    },
  );

  test("a raiz é o ponteiro e, no máximo, o bloco do graphify", () => {
    const linhas = readFileSync(join(RAIZ, "CLAUDE.md"), "utf8").split("\n");
    expect(linhas[0]).toBe("@AGENTS.md");
    const titulos = linhas.filter((l) => /^#{1,6} /.test(l));
    expect(titulos.filter((t) => t !== "## graphify")).toEqual([]);
  });
});
