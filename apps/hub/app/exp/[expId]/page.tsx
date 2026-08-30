import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { montarEmbed } from "@/lib/embed-experiencia";
import { ExpHost } from "@/components/ExpHost";
import { HeaderPlataforma } from "@/components/header-plataforma";

/**
 * Superfície do ALUNO: embeda a experiência do manifesto (ou, em dev, o dev
 * server dela). A montagem vive em `lib/embed-experiencia.ts`, compartilhada
 * com a superfície do professor.
 *
 * O header é o MESMO de todas as áreas do hub (marca, identidade, sair), com o
 * caminho de volta para as missões. Ele é chrome do HUB, acima do aparelho —
 * a regra de ouro (nada da marca institucional dentro do iframe) segue valendo.
 */
export default async function ExpPage({ params }: { params: Promise<{ expId: string }> }) {
  const { expId } = await params;
  const session = await auth();
  const usuario = session!.usuario; // middleware garante sessão nesta rota

  const embed = await montarEmbed(expId, usuario);

  // Ferramenta de professor (exp-90) não é uma experiência do estudante: a api
  // recusaria as chamadas com 403, mas a tela quebraria feio. 404 é o certo.
  if (
    embed.manifesto &&
    (embed.manifesto.publico ?? "estudante") !== "estudante" &&
    embed.manifesto.publico !== "aluno"
  ) {
    notFound();
  }

  return (
    <>
      <HeaderPlataforma largura="cheia" voltar={{ href: "/estudante", rotulo: "Missões" }} />
      <ExpHost
        expId={expId}
        src={embed.src}
        expOrigin={embed.expOrigin}
        token={embed.token}
        estudante={embed.estudante}
        aluno={embed.aluno}
        apiUrl={embed.apiUrl}
        viewport={embed.viewport}
        permissoes={embed.permissoes}
      />
    </>
  );
}
