import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { lerManifestos } from "../prisma/catalogo-e-liberacoes";
import { PRODUTOS } from "../src/recursos/catalogo";

/**
 * TODA EXPERIÊNCIA DECLARA A QUE PRODUTO PERTENCE (ADR-87).
 *
 * Este teste é o mecanismo que faz o painel da Unooria se auto-estender. Sem
 * ele, "experiência nova já nasce no painel" seria intenção escrita num
 * `AGENTS.md`, e a falha por omissão é MUDA: sem `produto`, a coluna nasce nula,
 * a experiência não aparece dentro de nenhum produto no painel — e continua
 * abrindo normalmente para estudante e professor. Nada quebra, nada avisa, e a
 * única pessoa que descobre é quem for desligar o produto num incidente e
 * perceber que uma missão continuou no ar.
 *
 * Por que aqui e não no Zod da rota: um 400 no `PUT /experiencias/:expId`
 * mataria o job `ativar-exps` do deploy DEPOIS de os bundles já terem subido,
 * com a `versaoAtiva` ainda na versão antiga. O portão certo é o que falha
 * cedo — no CI, antes do deploy.
 */

const PASTA = resolve(__dirname, "../../experiencias");

/** Os manifestos das experiências REAIS — a mesma leitura que o seed faz. */
const manifestos = lerManifestos();

test("há manifesto para ler (senão este teste passaria vazio e não provaria nada)", () => {
  const pastas = readdirSync(PASTA, { withFileTypes: true }).filter(
    (e) => e.isDirectory() && e.name.startsWith("exp-"),
  );
  expect(manifestos).toHaveLength(pastas.length);
});

describe.each(manifestos.map((m) => [m.id, m] as const))("%s", (_id, manifesto) => {
  test("declara `produto`", () => {
    expect(manifesto.produto).toBeDefined();
  });

  test("e o valor está no vocabulário de PRODUTOS", () => {
    expect(PRODUTOS as readonly string[]).toContain(manifesto.produto);
  });
});

/**
 * O `_template` entra à parte: `lerManifestos` filtra pastas `exp-*` e a dele é
 * `_template`. Ele precisa do campo pelo motivo mais direto que existe — o
 * `pnpm new:exp` copia este arquivo, e um template sem `produto` faz TODA
 * experiência nova nascer errada, com o defeito mudo descrito acima.
 */
test("o _template também declara `produto`, senão o scaffold nasce errado", () => {
  const template = JSON.parse(
    readFileSync(resolve(PASTA, "_template/public/experiencia.json"), "utf8"),
  ) as { produto?: string };
  expect(PRODUTOS as readonly string[]).toContain(template.produto);
});
