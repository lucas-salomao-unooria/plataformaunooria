import { redirect } from "next/navigation";
import { SiteEntreRedes } from "@/components/site/site-entre-redes";
import { auth } from "@/lib/auth";
import { homeDoPapel } from "@/lib/papeis";

/**
 * Metadados DO SITE, não da plataforma: o `<head>` que o material original
 * trazia. O layout raiz continua com o título da plataforma para todo o resto.
 */
export const metadata = {
  title: "Unooria · ENTRE REDES",
  description:
    "ENTRE REDES. Letramento digital e educação midiática do 1º ano do Ensino Fundamental ao 3º ano do Ensino Médio. Uma jornada que cresce com o estudante.",
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%230e1039'/%3E%3Cpath d='M32 32C8 5 8 59 32 32C56 5 56 59 32 32Z' fill='none' stroke='%238b85ac' stroke-width='6'/%3E%3C/svg%3E",
  },
};

/**
 * `viewport-fit=cover` NÃO é detalhe: o `--gutter` do site é
 * `max(20px, env(safe-area-inset-left), ...)`, e `env()` só devolve valor real
 * com esta linha. Sem ela o desenho não quebra — ele só ignora o recorte da
 * tela, e o texto encosta na borda curva do iPhone.
 */
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
  themeColor: "#090c21",
};

/**
 * A raiz é o SITE PÚBLICO (ENTRE REDES, ADR-107) para quem chega sem sessão, e
 * continua roteando quem tem: com sessão → home do papel (ou a troca de senha
 * do primeiro acesso). O `login-form` e o `trocar-senha` fazem
 * `router.replace("/")` e contam com esse roteamento — é o que faz "entrar"
 * cair na área certa sem o client conhecer o papel (ADR-40). Quem já está
 * dentro e quer ver o site sai da conta.
 *
 * A landing anterior não foi apagada: ela responde em `/landing-anterior`.
 */
export default async function Home() {
  const session = await auth();
  if (session?.usuario) {
    if (session.usuario.precisaTrocarSenha) redirect("/trocar-senha");
    redirect(homeDoPapel(session.usuario.papel));
  }
  return <SiteEntreRedes />;
}
