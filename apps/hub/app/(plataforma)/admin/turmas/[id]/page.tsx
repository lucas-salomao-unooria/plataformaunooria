import { auth } from "@/lib/auth";
import { TurmaDetalhe } from "./turma-detalhe";

export const metadata = { title: "Turma — Plataforma Unooria" };

export default async function TurmaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const usuario = session!.usuario; // middleware garante sessão + papel
  return (
    <TurmaDetalhe
      turmaId={id}
      papel={usuario.papel}
      escolaId={usuario.papel === "admin-contrato" ? "" : usuario.escolaId}
    />
  );
}
