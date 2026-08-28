import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { homeDoPapel } from "@/lib/papeis";

/**
 * A raiz só roteia: com sessão → home do papel; sem sessão → login. Quem ainda
 * não trocou a senha do primeiro acesso vai para a troca — o login manda para
 * cá, e sem esta linha a pessoa faria um pingue-pongue com o middleware.
 */
export default async function Home() {
  const session = await auth();
  if (!session?.usuario) redirect("/login");
  if (session.usuario.precisaTrocarSenha) redirect("/trocar-senha");
  redirect(homeDoPapel(session.usuario.papel));
}
