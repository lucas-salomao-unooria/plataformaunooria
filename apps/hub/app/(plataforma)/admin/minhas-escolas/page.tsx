import { auth } from "@/lib/auth";
import { PanoramaDasEscolas } from "./panorama";

export const metadata = { title: "Minhas escolas — Plataforma Unooria" };

export default async function MinhasEscolasPage() {
  const session = await auth();
  return <PanoramaDasEscolas ativa={session!.usuario.escolaId} />;
}
