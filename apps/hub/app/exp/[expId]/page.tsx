import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { montarEmbed } from "@/lib/embed-experiencia";
import { minhasSalas, podeEntrar } from "@/lib/salas";
import { ExpHost } from "@/components/ExpHost";
import { HeaderPlataforma } from "@/components/header-plataforma";

/**
 * Superfície do ESTUDANTE: embeda a experiência do manifesto (ou, em dev, o dev
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

  /* A PORTA DA SALA (ADR-69), ANTES de montar o embed: sem liberação na turma,
     a missão não abre. A api recusaria de qualquer jeito (403
     `missao-nao-liberada` na entrada de cada experiência), mas aí a criança
     veria o aparelho carregar e quebrar por dentro — e o token já teria sido
     assinado para uma missão que ela não pode fazer.

     Só para ESTUDANTE: professor e gestor não chegam nesta rota (o middleware
     manda cada papel para a própria área), e `/dev-embed` continua sem porta,
     porque é ferramenta de desenvolvimento. */
  if (usuario.papel === "estudante") {
    const salas = await minhasSalas();
    /* `null` é a api fora do ar. Deixar passar aqui não abre nada: a api recusa
       a entrada logo em seguida, e um 404 por indisponibilidade diria à criança
       que a missão não existe. */
    const liberada = (salas ?? []).some((sala) =>
      sala.missoes.some((missao) => missao.expId === expId && podeEntrar(missao.estado)),
    );
    if (salas !== null && !liberada) notFound();
  }

  const embed = await montarEmbed(expId, usuario);

  // Ferramenta de professor (exp-90) não é uma experiência do estudante: a api
  // recusaria as chamadas com 403, mas a tela quebraria feio. 404 é o certo.
  if (
    embed.manifesto &&
    (embed.manifesto.publico ?? "estudante") !== "estudante" &&
    embed.manifesto.publico !== "estudante"
  ) {
    notFound();
  }

  return (
    <>
      <HeaderPlataforma voltar={{ href: "/estudante", rotulo: "Missões" }} />
      <ExpHost
        expId={expId}
        src={embed.src}
        expOrigin={embed.expOrigin}
        token={embed.token}
        estudante={embed.estudante}
        apiUrl={embed.apiUrl}
        viewport={embed.viewport}
        permissoes={embed.permissoes}
        obs={embed.obs}
      />
    </>
  );
}
