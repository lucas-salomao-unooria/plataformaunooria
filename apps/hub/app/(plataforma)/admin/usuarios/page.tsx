import { auth } from "@/lib/auth";
import { GestaoUsuarios } from "./gestao-usuarios";
import { ehDoContrato } from "@/lib/papeis";

export const metadata = { title: "Usuários — Plataforma Unooria" };

export default async function UsuariosPage() {
  const session = await auth();
  const usuario = session!.usuario; // middleware garante sessão + papel
  return (
    <GestaoUsuarios
      papel={usuario.papel}
      escolaIdInicial={ehDoContrato(usuario.papel) ? "" : usuario.escolaId}
    />
  );
}
