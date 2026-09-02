import { ClarityHub } from "@/components/clarity-hub";
import { VitalsHub } from "@/components/vitals-hub";
import { obsDoAmbiente } from "@/lib/embed-experiencia";
import "./globals.css";

/**
 * `generateMetadata` em vez de `metadata` estático porque um dos valores é
 * lido do AMBIENTE a cada requisição: `unooria-obs-ratio` é a fração de
 * sessões do hub com OpenTelemetry Web (`OBS_TRACE_RATIO_CLIENTE`), que o
 * `instrumentation-client.ts` lê do `<meta>`. Env de runtime, não
 * `NEXT_PUBLIC_*`: mudar a amostragem não exige rebuild (cap. 17).
 */
export async function generateMetadata() {
  return {
    title: "Plataforma Unooria",
    other: { "unooria-obs-ratio": String(obsDoAmbiente().traceRatio) },
  };
}

/**
 * O `ClarityHub` mora aqui, e não na casca, porque este é o único layout que
 * cobre TODAS as rotas — a landing pública e o login inclusive, que estão fora
 * do grupo `(plataforma)`. Sem `NEXT_PUBLIC_CLARITY_PROJECT_ID` ele não
 * renderiza nada. Quem é a pessoa vem depois, no `ClarityIdentidade` do layout
 * do grupo, que é onde a sessão existe (ADR-60).
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui", margin: 0 }}>
        {children}
        <ClarityHub />
        <VitalsHub />
      </body>
    </html>
  );
}
