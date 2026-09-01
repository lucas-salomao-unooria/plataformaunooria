import { ClarityHub } from "@/components/clarity-hub";
import "./globals.css";

export const metadata = { title: "Plataforma Unooria" };

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
      </body>
    </html>
  );
}
