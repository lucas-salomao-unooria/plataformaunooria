/**
 * A `rota` de um Web Vital vira rótulo de métrica — então tem de ser um
 * conjunto FECHADO. O navegador manda o `pathname` (hub) ou o `expId`
 * (experiência); aqui isso é reduzido a uma dúzia de valores, e qualquer coisa
 * fora deles é `outra`. Sem isto, um id na URL cria uma série por criança.
 */
export const EXP_ID = /^exp-\d{2}-[a-z0-9-]+$/;

const ROTAS_DO_HUB: Array<[RegExp, string]> = [
  [/^\/$/, "/"],
  [/^\/login$/, "/login"],
  [/^\/trocar-senha$/, "/trocar-senha"],
  [/^\/estudante(\/|$)/, "/estudante"],
  [/^\/professor$/, "/professor"],
  [/^\/professor\/[^/]+/, "/professor/:secao"],
  [/^\/admin$/, "/admin"],
  [/^\/admin\/[^/]+/, "/admin/:secao"],
  [/^\/analise(\/|$)/, "/analise"],
  [/^\/exp\/[^/]+/, "/exp/:expId"],
  [/^\/dev-embed$/, "/dev-embed"],
];

export function normalizarRota(bruta: string, superficie: "hub" | "exp"): string {
  const semQuery = bruta.split("?")[0]?.split("#")[0] ?? "";
  if (superficie === "exp") return EXP_ID.test(semQuery) ? semQuery : "outra";
  const caminho = semQuery.length > 1 ? semQuery.replace(/\/+$/, "") : semQuery;
  for (const [padrao, rotulo] of ROTAS_DO_HUB) {
    if (padrao.test(caminho)) return rotulo;
  }
  return "outra";
}
