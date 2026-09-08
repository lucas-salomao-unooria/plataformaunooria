import { auth } from "@/lib/auth";
import { ImportarPessoas } from "./importar-pessoas";
import { ehDoContrato } from "@/lib/papeis";

export const metadata = { title: "Importar pessoas — Plataforma Unooria" };

export default async function ImportarPage() {
  const session = await auth();
  const usuario = session!.usuario; // middleware garante sessão + papel
  return (
    <ImportarPessoas
      papel={usuario.papel}
      escolaIdInicial={ehDoContrato(usuario.papel) ? "" : usuario.escolaId}
    />
  );
}
