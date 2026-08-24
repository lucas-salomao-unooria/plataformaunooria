import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { homeDoPapel } from "@/lib/papeis";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar — Plataforma Unooria" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await auth();
  if (session?.usuario) redirect(homeDoPapel(session.usuario.papel));

  // Só aceitamos destinos internos.
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;

  return (
    <main className="unooria-fundo-login flex min-h-dvh items-center justify-center px-5 py-10">
      <LoginForm nextPath={safeNext} />
    </main>
  );
}
