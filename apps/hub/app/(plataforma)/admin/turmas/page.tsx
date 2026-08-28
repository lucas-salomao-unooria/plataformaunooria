import { auth } from "@/lib/auth";
import { TurmasAdmin } from "./turmas-admin";

export const metadata = { title: "Turmas — Plataforma Unooria" };

export default async function TurmasPage() {
  const session = await auth();
  const usuario = session!.usuario; // middleware garante sessão + papel
  return (
    <TurmasAdmin
      papel={usuario.papel}
      escolaIdInicial={usuario.papel === "admin-contrato" ? "" : usuario.escolaId}
    />
  );
}
