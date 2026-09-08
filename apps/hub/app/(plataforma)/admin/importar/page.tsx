import { auth } from "@/lib/auth";
import { ImportarPessoas } from "./importar-pessoas";

export const metadata = { title: "Importar pessoas — Plataforma Unooria" };

export default async function ImportarPage() {
  const session = await auth();
  const usuario = session!.usuario; // middleware garante sessão + papel
  return (
    <ImportarPessoas
      papel={usuario.papel}
      escolaIdInicial={usuario.papel === "gestor_contrato" ? "" : usuario.escolaId}
    />
  );
}
