/**
 * O extrator contra o PRÓPRIO repo, num diretório temporário.
 *
 *   node --test scripts/base-do-gerador/
 *
 * Não é unitário de propósito: o que quebra este extrator é o repo mudar de
 * forma (uma tabela, um `export const`, um caminho), e só rodando contra ele
 * isso aparece. O workflow roda este teste antes de subir a base.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { ADR_TEX, ErroDeExtracao, FONTES_DO_CONTRATO, OPENAPI, RAIZ, SCHEMA_PRISMA, extrair, listarFontes } from "./extrair.mjs";

const lerJson = (p) => JSON.parse(readFileSync(p, "utf8"));

/** Os `paths:` do workflow como regex: `**` atravessa pastas; `*` e `?` não. */
function pathsDoWorkflow() {
  const arq = ".github/workflows/base-do-gerador.yml";
  const bloco = readFileSync(join(RAIZ, arq), "utf8").match(/^ {4}paths:\n((?: {6}.*\n)+)/m);
  assert.ok(bloco, `não achei \`paths:\` em ${arq}`);
  return bloco[1]
    .split("\n")
    .map((l) => l.match(/^ {6}- (\S+)$/)?.[1])
    .filter(Boolean)
    .map((p) => {
      const corpo = p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\0").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]").replace(/\0/g, ".*");
      return new RegExp(`^${corpo}$`);
    });
}

describe("base do gerador, extraída deste repo", () => {
  let saida;
  let r;
  let contrato;

  before(() => {
    saida = mkdtempSync(join(tmpdir(), "base-do-gerador-teste-"));
    r = extrair(RAIZ, saida);
    contrato = lerJson(join(r.pasta, "contrato-plataforma.json"));
  });
  after(() => rmSync(saida, { recursive: true, force: true }));

  it("o atual.json aponta para a pasta gerada, e conta o que ela tem", () => {
    const atual = lerJson(join(saida, "plataforma", "atual.json"));
    assert.equal(atual.versao_formato, 1);
    assert.equal(atual.pasta, `plataforma/${atual.commit}/`);
    assert.equal(join(saida, atual.pasta), join(r.pasta, "/"));
    const manifesto = lerJson(join(saida, atual.pasta, "manifesto.json"));
    assert.equal(manifesto.commit, atual.commit);
    assert.equal(atual.arquivos, manifesto.arquivos.length);
  });

  it("nenhuma cópia faltando, e o sha256 do manifesto é o do arquivo", () => {
    const manifesto = lerJson(join(r.pasta, "manifesto.json"));
    const destinos = new Set(manifesto.arquivos.map((a) => a.destino));
    for (const { destino } of listarFontes(RAIZ)) assert.ok(destinos.has(`arquivos/${destino}`), `faltou ${destino}`);
    for (const fixo of ["arquivos/adr-log.md", "arquivos/exemplo-schema-exp.md", "arquivos/openapi-indice.md", "openapi-rotas.json", "contrato-plataforma.json"]) {
      assert.ok(destinos.has(fixo), `faltou ${fixo}`);
    }
    for (const a of manifesto.arquivos) {
      const p = join(r.pasta, a.destino);
      assert.ok(existsSync(p), `listado e não gravado: ${a.destino}`);
      const conteudo = readFileSync(p, "utf8");
      assert.equal(a.sha256, createHash("sha256").update(conteudo, "utf8").digest("hex").slice(0, 16), a.destino);
    }
  });

  it("toda fonte casa uma linha de `paths:` do workflow — sem ela, mudá-la não republica a base", () => {
    const paths = pathsDoWorkflow();
    const fontes = [
      ...listarFontes(RAIZ).map((f) => f.origem),
      ADR_TEX,
      SCHEMA_PRISMA,
      OPENAPI,
      ...Object.values(FONTES_DO_CONTRATO).filter((rel) => extname(rel)),
      ...contrato.experiencias.map((e) => `${e.pasta}/public/experiencia.json`),
    ];
    const fora = fontes.filter((rel) => !paths.some((re) => re.test(rel)));
    assert.deepEqual(fora, [], `fonte sem linha em \`paths:\`: ${fora.join(", ")}`);
  });

  it("os destinos antigos do exp-08/exp-04 não voltam", () => {
    const manifesto = lerJson(join(r.pasta, "manifesto.json"));
    assert.deepEqual(manifesto.arquivos.filter((a) => /exp-0[48]/.test(a.destino)), []);
  });

  it("as cópias carregam o cabeçalho e NÃO neutralizam chaves", () => {
    const agents = readFileSync(join(r.pasta, "arquivos/agents-raiz.md"), "utf8");
    assert.match(agents.split("\n")[0], /^<!-- CÓPIA de plataforma-unooria@[0-9a-f]{8} \(\d{4}-\d{2}-\d{2}\) · origem: AGENTS\.md · não edite -->$/);
    assert.ok(agents.includes("{contrato}"), "o `{contrato}` do AGENTS.md virou outra coisa");
    assert.ok(!agents.includes("«"), "chave neutralizada: isso é do gerador");
  });

  it("ADR: a próxima é a última + 1", () => {
    assert.ok(Number.isInteger(contrato.adr.ultima) && contrato.adr.ultima >= 148);
    assert.equal(contrato.adr.proxima, contrato.adr.ultima + 1);
    const rotulo = `ADR-${String(contrato.adr.ultima).padStart(2, "0")}`;
    assert.ok(contrato.adr.titulos[rotulo], `sem título para ${rotulo}`);
    assert.ok(!Object.values(contrato.adr.titulos).some((t) => /\\[a-z]/.test(t)), "sobrou macro LaTeX num título");
  });

  it("a próxima porta livre não está ocupada", () => {
    assert.ok(!Object.values(contrato.portas.ocupadas).includes(contrato.portas.proxima_livre));
  });

  it("o DS: unooriaai entre as seções, e toda ponte é export do @edu/ui", () => {
    const secoes = contrato.design_system.secoes.map((s) => s.secao);
    assert.ok(secoes.includes("unooriaai"), secoes.join(", "));
    assert.ok(secoes.includes("unooria"));
    assert.match(contrato.design_system.dependencia, /^\^?\d+\.\d+\.\d+$/);
    const pontes = new Set(contrato.design_system.pontes.map((p) => p.ponte));
    for (const s of contrato.design_system.secoes) if (s.ponte) assert.ok(pontes.has(s.ponte), s.ponte);
  });

  it("experiências: só as ativas, cada uma com produto e versão", () => {
    const ids = contrato.experiencias.map((e) => e.id);
    assert.ok(ids.includes("exp06ef1b"));
    assert.ok(!ids.some((id) => id.startsWith("backup-") || id.startsWith("exp-template")), ids.join(", "));
    for (const e of contrato.experiencias) {
      assert.ok(e.produto && /^\d+\.\d+\.\d+$/.test(e.versao), e.id);
    }
  });

  it("listas fechadas do manifesto, das equipes, da evidência e da IA vieram cheias", () => {
    assert.ok(contrato.manifesto.chaves.includes("id") && contrato.manifesto.chaves.includes("produto"));
    assert.ok(contrato.manifesto.capabilities.includes("telemetria"));
    assert.deepEqual([...contrato.manifesto.publico].sort(), ["estudante", "professor"]);
    assert.ok(contrato.manifesto.permissoes_iframe.includes("forms"));
    assert.ok(contrato.equipes.com_atividade.every((id) => contrato.equipes.com_equipe.includes(id)));
    assert.ok(contrato.evidencia.fichas.length > 0);
    assert.deepEqual([...contrato.evidencia.niveis].sort(), ["atingiu", "em_processo", "nao_atingiu"]);
    assert.match(contrato.ia.modelo_padrao, /^gemini-/);
  });
});

describe("fonte ausente", () => {
  it("falha com o caminho, e não grava ponteiro nenhum", () => {
    const vazio = mkdtempSync(join(tmpdir(), "base-do-gerador-vazio-"));
    const saida = mkdtempSync(join(tmpdir(), "base-do-gerador-saida-"));
    try {
      execFileSync("git", ["init", "-q"], { cwd: vazio });
      execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "vazio"], { cwd: vazio });
      assert.throws(() => extrair(vazio, saida), (e) => e instanceof ErroDeExtracao && /apps\/api\/prisma\/migrations|AGENTS\.md/.test(e.message));
      assert.ok(!existsSync(join(saida, "plataforma", "atual.json")));
    } finally {
      rmSync(vazio, { recursive: true, force: true });
      rmSync(saida, { recursive: true, force: true });
    }
  });
});
