import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { EscolasDaRede } from "./escolas-da-rede";

export const metadata = { title: "Escolas — Plataforma Unooria" };

export default async function EscolasPage() {
  const session = await auth();
  // Escola é *tenant*: só o admin do contrato abre inquilino novo. O gestor que
  // digitar a rota volta para o lugar dele em vez de ver uma tela sem dados.
  if (session!.usuario.papel !== "gestor_contrato") redirect("/admin/usuarios");
  return <EscolasDaRede />;
}
