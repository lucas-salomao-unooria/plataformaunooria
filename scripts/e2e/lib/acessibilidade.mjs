/**
 * O axe-core contra a WCAG 2.2 A e AA, numa página e nos iframes dela (ADR-162).
 *
 * Uma fonte para os dois consumidores: a ferramenta que percorre as telas
 * (`ferramentas/medir-acessibilidade.mjs`) e o roteiro, que com
 * `E2E_ACESSIBILIDADE=1` mede CADA passo das suítes — é o que alcança as telas
 * de dentro das missões, que a ferramenta só vê na abertura.
 *
 * O iframe é medido À PARTE (`iframes: false`): a experiência é outra origem,
 * e deixar o axe da página conversar com o da experiência por `postMessage`
 * poria mensagens estranhas na ponte do hub.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
let axe = null;
const fonteDoAxe = () =>
  (axe ??= readFileSync(createRequire(join(RAIZ, "package.json")).resolve("axe-core/axe.min.js"), "utf8"));

export const TAGS_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** As violações de UM documento (página ou frame do Playwright). */
export async function violacoesEm(alvo) {
  await alvo.evaluate(fonteDoAxe());
  return alvo.evaluate(async (tags) => {
    const r = await window.axe.run(document, {
      runOnly: { type: "tag", values: tags },
      resultTypes: ["violations"],
      iframes: false,
    });
    return r.violations.map((v) => ({
      id: v.id,
      impacto: v.impact,
      criterios: v.tags.filter((t) => /^wcag\d{3,}/.test(t)),
      ajuda: v.help,
      nos: v.nodes.map((n) => ({
        alvo: n.target.join(" "),
        html: n.html.slice(0, 240),
        resumo: (n.failureSummary ?? "").slice(0, 320),
      })),
    }));
  }, TAGS_AA);
}

/**
 * A página e cada iframe http(s) dela. Frame que falha ao medir (navegou no
 * meio, foi removido) volta com `erro` em vez de derrubar quem chamou.
 */
export async function medirPaginaEFrames(pagina) {
  const resultado = { pagina: await violacoesEm(pagina), frames: [] };
  for (const f of pagina.frames()) {
    if (f === pagina.mainFrame() || !/^https?:/.test(f.url())) continue;
    try {
      const texto = await f.evaluate(() => document.body?.innerText.length ?? 0);
      resultado.frames.push({ url: f.url(), texto, violacoes: await violacoesEm(f) });
    } catch (e) {
      resultado.frames.push({ url: f.url(), erro: String(e).slice(0, 200) });
    }
  }
  return resultado;
}

/** Achata em `[onde, violação]`, com o frame identificado pelo host. */
export function achatar(rotulo, { pagina, frames }) {
  return [
    ...pagina.map((v) => [rotulo, v]),
    ...frames.flatMap((f) => (f.violacoes ?? []).map((v) => [`${rotulo} [exp ${new URL(f.url).host}]`, v])),
  ];
}
