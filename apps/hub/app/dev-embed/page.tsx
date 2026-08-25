import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { montarEmbed } from "@/lib/embed-experiencia";
import { ExpHost } from "@/components/ExpHost";
import { HeaderPlataforma } from "@/components/header-plataforma";

/**
 * Bancada de teste de experiência local (dev only): aponta para o dev server
 * do Vite (`?src=http://localhost:5173`), lê o `experiencia.json` servido por
 * ele (por isso o arquivo vive em `public/`) e embeda com a MESMA sessão e o
 * MESMO fluxo de token do caminho real — nada de token fake divergindo do
 * fluxo de produção.
 */
export default async function DevEmbedPage({
  searchParams,
}: {
  searchParams: Promise<{ src?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const session = await auth();
  const usuario = session!.usuario; // middleware protege /dev-embed

  const { src: srcParam } = await searchParams;
  const base = (srcParam ?? "http://localhost:5173").replace(/\/$/, "");

  let expId = "exp-dev";
  try {
    const r = await fetch(`${base}/experiencia.json`, { cache: "no-store" });
    if (r.ok) expId = ((await r.json()) as { id?: string }).id ?? expId;
  } catch {
    // sem experiencia.json — segue com id genérico
  }

  const embed = await montarEmbed(expId, usuario, { srcDev: base });
  return (
    <>
      <HeaderPlataforma largura="cheia" voltar={{ href: "/aluno", rotulo: "Missões" }} />
      <ExpHost
        expId={expId}
        src={embed.src}
        expOrigin={embed.expOrigin}
        token={embed.token}
        aluno={embed.aluno}
        apiUrl={embed.apiUrl}
        viewport={embed.viewport}
      />
    </>
  );
}
