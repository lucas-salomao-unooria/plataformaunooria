import { auth } from "@/lib/auth";
import { ExpFrame } from "@/components/ExpFrame";

export default async function ExpPage({ params }: { params: Promise<{ expId: string }> }) {
  const { expId } = await params;
  const session = await auth();

  // Em dev sem WSO2 configurado, usa aluno fake para destravar o fluxo:
  const aluno = (session as any)?.aluno ?? {
    id: "dev-aluno-1", nome: "Aluno Dev", serie: "6EF", turmaId: "dev-turma", escolaId: "dev-escola",
  };
  const token = (session as any)?.accessToken ?? "dev-token";

  const cdn = process.env.NEXT_PUBLIC_CDN_EXP_URL ?? "http://localhost:5173";
  const expOrigin = new URL(cdn).origin;
  const src = `${cdn}/?hubOrigin=${encodeURIComponent(process.env.HUB_ORIGIN ?? "http://localhost:3000")}`;

  return (
    <ExpFrame src={src} expOrigin={expOrigin} token={token} aluno={aluno}
      apiUrl={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"} />
  );
}
