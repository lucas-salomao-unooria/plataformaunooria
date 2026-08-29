import { redirect } from "next/navigation";
import { Landing } from "@/components/landing/landing";
import { auth } from "@/lib/auth";
import { homeDoPapel } from "@/lib/papeis";

export const metadata = {
  title: "Unooria — Educação Digital e Midiática",
  description:
    "Do 1º ano do Fundamental ao 3º ano do Médio. Aprender a viver melhor no mundo digital.",
};

/**
 * A raiz é a LANDING para quem chega sem sessão, e continua roteando quem tem:
 * com sessão → home do papel (ou a troca de senha do primeiro acesso). O
 * `login-form` e o `trocar-senha` fazem `router.replace("/")` e contam com esse
 * roteamento — é o que faz "entrar" cair na área certa sem o client conhecer o
 * papel (ADR-40). Quem já está dentro e quer ver a landing sai da conta.
 */
export default async function Home() {
  const session = await auth();
  if (session?.usuario) {
    if (session.usuario.precisaTrocarSenha) redirect("/trocar-senha");
    redirect(homeDoPapel(session.usuario.papel));
  }
  return <Landing />;
}
