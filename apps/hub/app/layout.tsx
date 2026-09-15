import { ClarityHub } from "@/components/clarity-hub";
import { VitalsHub } from "@/components/vitals-hub";
import { obsDoAmbiente } from "@/lib/embed-experiencia";
import { metadadosDoFuso } from "@/lib/fuso-do-hub";
import "./globals.css";

/**
 * `generateMetadata` em vez de `metadata` estático porque os valores são lidos
 * do AMBIENTE a cada requisição, e não assados no build:
 *
 * - `unooria-obs-ratio`: a fração de sessões do hub com OpenTelemetry Web
 *   (`OBS_TRACE_RATIO_CLIENTE`), que o `instrumentation-client.ts` lê do
 *   `<meta>`. Mudar a amostragem não exige rebuild (cap. 17).
 * - `unooria-fuso`: o FUSO da plataforma (`FUSO_DA_PLATAFORMA`, ADR-99). **É
 *   assim que ele chega ao NAVEGADOR**, que não lê `process.env`.
 *
 * Por que o `<meta>` e não `NEXT_PUBLIC_FUSO_DA_PLATAFORMA`: `NEXT_PUBLIC_*` é
 * assado no build, e a mesma imagem pode servir mais de um contrato — o valor
 * ficaria errado sem ninguém ver. Por que aqui e não num provider React: no
 * `<head>` ele já está resolvido antes de a hidratação começar, e a falha que
 * este fuso existe para consertar É uma de hidratação (ADR-98). O servidor lê a
 * env e o navegador lê este `<meta>` da MESMA resposta — os dois lados não têm
 * como divergir.
 */
export async function generateMetadata() {
  return {
    title: "Plataforma Unooria",
    other: {
      "unooria-obs-ratio": String(obsDoAmbiente().traceRatio),
      ...metadadosDoFuso(),
    },
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
