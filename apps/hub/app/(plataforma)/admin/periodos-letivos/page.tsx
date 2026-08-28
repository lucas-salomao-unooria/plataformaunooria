import { auth } from "@/lib/auth";
import { PeriodosLetivos } from "./periodos-letivos";

export const metadata = { title: "Ano letivo — Plataforma Unooria" };

export default async function PeriodosPage() {
  const session = await auth();
  return <PeriodosLetivos papel={session!.usuario.papel} />;
}
