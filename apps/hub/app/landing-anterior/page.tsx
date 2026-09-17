import { Landing } from "@/components/landing/landing";

/**
 * A LANDING ANTERIOR (ADR-40), preservada fora da raiz (ADR-107).
 *
 * O site ENTRE REDES tomou a `/` em 2026-09-16, e esta página ficou de pé em
 * endereço próprio porque o material dela ainda serve de referência e porque
 * `components/landing/` continua vivo por outro motivo: `/privacidade` e
 * `/termos` montam o `FundoAnimado` e a folha dela (ver `casca-legal.tsx`).
 * Apagar o componente derrubaria as duas páginas legais junto.
 *
 * `noindex`: duas páginas públicas com a mesma proposta competindo no buscador
 * é o caminho conhecido para a errada ganhar. Nada linka para cá — o endereço
 * é para quem já o conhece.
 */
export const metadata = {
  title: "Unooria — Educação Digital e Midiática",
  description:
    "Do 1º ano do Fundamental ao 3º ano do Médio. Aprender a viver melhor no mundo digital.",
  robots: { index: false, follow: false },
};

export default function LandingAnterior() {
  return <Landing />;
}
