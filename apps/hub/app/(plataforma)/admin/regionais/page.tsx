import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { RegionaisDaRede } from "./regionais-da-rede";
import { ehDoContrato } from "@/lib/papeis";

export const metadata = { title: "Regionais — Plataforma Unooria" };

export default async function RegionaisPage() {
  const session = await auth();
  // Mesma porta de Escolas: quem organiza a rede em regionais é o admin do
  // contrato. O gestor que digitar a rota volta para o lugar dele em vez de ver
  // uma tela sem dados.
  if (!ehDoContrato(session!.usuario.papel)) redirect("/admin/usuarios");
  return <RegionaisDaRede />;
}
