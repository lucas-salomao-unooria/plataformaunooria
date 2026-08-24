import { auth } from "@/lib/auth";
import { GestaoUsuarios } from "./gestao-usuarios";

export const metadata = { title: "Usuários — Plataforma Unooria" };

export default async function UsuariosPage() {
  const session = await auth();
  const usuario = session!.usuario; // middleware garante sessão + papel
  return (
    <GestaoUsuarios
      papel={usuario.papel}
      escolaIdInicial={usuario.papel === "admin-contrato" ? "" : usuario.escolaId}
    />
  );
}
