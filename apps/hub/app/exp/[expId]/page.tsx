import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { montarEmbed } from "@/lib/embed-experiencia";
import { ExpHost } from "@/components/ExpHost";

/**
 * Superfície do ALUNO: embeda a experiência do manifesto (ou, em dev, o dev
 * server dela). A montagem vive em `lib/embed-experiencia.ts`, compartilhada
 * com a superfície do professor.
 */
export default async function ExpPage({ params }: { params: Promise<{ expId: string }> }) {
  const { expId } = await params;
  const session = await auth();
  const usuario = session!.usuario; // middleware garante sessão nesta rota

  const embed = await montarEmbed(expId, usuario);

  // Ferramenta de professor (exp-90) não é uma experiência do aluno: a api
  // recusaria as chamadas com 403, mas a tela quebraria feio. 404 é o certo.
  if (embed.manifesto && (embed.manifesto.publico ?? "aluno") !== "aluno") notFound();

  return (
    <ExpHost
      expId={expId}
      src={embed.src}
      expOrigin={embed.expOrigin}
      token={embed.token}
      aluno={embed.aluno}
      apiUrl={embed.apiUrl}
      viewport={embed.viewport}
    />
  );
}
