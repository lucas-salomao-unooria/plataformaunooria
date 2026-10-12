/**
 * AS ORIGENS QUE FALAM COM A API pelo navegador — o CORS do `main.ts` e a
 * conferência do `Origin` na conexão de voz do mascote (ADR-158), que o CORS
 * não alcança: WebSocket não faz preflight, e qualquer site aberto no
 * navegador consegue abrir um para cá.
 *
 * **Toda porta de experiência nova entra AQUI.** O fallback já parou na 5175
 * uma vez, e as exps 5176/5177/5178 ficaram fora: o navegador barra a chamada
 * com um erro que fala de CORS, não da porta que faltou — o sintoma na tela é a
 * experiência abrindo e morrendo em "Failed to fetch", como se a api estivesse
 * fora do ar.
 *
 * 5179 (A Seleção, que substituiu o Eco no Grupo na mesma porta — ADR-113),
 * 5180 (plano de ensino) e 5181 (Rastro do Boato) entraram depois. A lista viva
 * é `apps/hub/lib/experiencias-dev.ts`.
 */
const PADRAO = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "http://localhost:5177",
  "http://localhost:5178",
  "http://localhost:5179",
  "http://localhost:5180",
  "http://localhost:5181",
];

export function origensPermitidas(env: Record<string, string | undefined> = process.env): string[] {
  return (env.CORS_ORIGINS ?? PADRAO.join(","))
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}
