import "server-only";
import { apiDoServidor } from "./api-servidor";
import { baseDevDaExperiencia } from "./experiencias-dev";

/**
 * A BASE DO BUNDLE de uma experiência, para o hub mostrar ao PROFESSOR um
 * arquivo do `public/` dela — a cena pronta da exp02ef1b (`cenas/horta.webp`),
 * que o pacote referencia como `{ tipo: "bundle", nome }` e o hub não serve.
 *
 * É a mesma origem que `montarEmbed` (`embed-experiencia.ts`) usa para o
 * iframe, e pela mesma regra: **a origem é do AMBIENTE**. Em dev, o dev server
 * da experiência (`experiencias-dev.ts`); em produção, o caminho versionado do
 * CDN (`{cdn}/{expId}/{versao}`), com a versão fixada no escopo da escola
 * (ADR-87) vencendo a `versaoAtiva` do catálogo. Sem manifesto em produção,
 * `null`: a tela mostra o texto alternativo da cena em vez de um link quebrado.
 *
 * Só leitura de servidor: `NEXT_PUBLIC_CDN_EXP_URL` é env de RUNTIME do hub
 * (não chega ao bundle do cliente), então a página resolve aqui e passa a base
 * pronta ao client component.
 */
export async function baseDoBundleDaExperiencia(expId: string): Promise<string | null> {
  const cdn = (process.env.NEXT_PUBLIC_CDN_EXP_URL ?? "http://localhost:5173").replace(/\/$/, "");
  if (process.env.NODE_ENV !== "production") return baseDevDaExperiencia(expId, cdn).replace(/\/$/, "");

  const [manifesto, efetivos] = await Promise.all([
    apiDoServidor<{ experiencia: { versaoAtiva: string } | null }>(`/experiencias/${encodeURIComponent(expId)}`),
    apiDoServidor<{ experiencias?: Record<string, { versao: string | null }> }>("/recursos/efetivos"),
  ]);
  const versao = efetivos?.experiencias?.[expId]?.versao ?? manifesto?.experiencia?.versaoAtiva ?? null;
  return versao ? `${cdn}/${encodeURIComponent(expId)}/${encodeURIComponent(versao)}` : null;
}
