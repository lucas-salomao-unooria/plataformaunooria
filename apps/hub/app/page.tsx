import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { homeDoPapel } from "@/lib/papeis";

/** A raiz só roteia: com sessão → home do papel; sem sessão → login. */
export default async function Home() {
  const session = await auth();
  redirect(session?.usuario ? homeDoPapel(session.usuario.papel, session.usuario.serie) : "/login");
}
