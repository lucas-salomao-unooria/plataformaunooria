import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { assinarTokenExperiencia } from "@/lib/chave-token";
import { ExpHost } from "@/components/ExpHost";

interface ExperienciaJson {
  id?: string;
  nome?: string;
  viewport?: { largura: number; altura: number };
}

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
  const expOrigin = new URL(base).origin;

  let meta: ExperienciaJson = {};
  try {
    const r = await fetch(`${base}/experiencia.json`, { cache: "no-store" });
    if (r.ok) meta = (await r.json()) as ExperienciaJson;
  } catch {
    // sem experiencia.json — segue sem viewport/nome
  }

  const token = await assinarTokenExperiencia({
    sub: usuario.id,
    escola_id: usuario.escolaId,
    turma_id: usuario.turmaId,
    perfil: usuario.papel,
  });

  const hubOrigin = encodeURIComponent(process.env.HUB_ORIGIN ?? "http://localhost:3000");
  return (
    <ExpHost
      expId={meta.id ?? "exp-dev"}
      src={`${base}/?hubOrigin=${hubOrigin}`}
      expOrigin={expOrigin}
      token={token}
      aluno={{
        id: usuario.id,
        nome: usuario.nome,
        serie: usuario.serie ?? "",
        turmaId: usuario.turmaId ?? "",
        escolaId: usuario.escolaId,
      }}
      apiUrl={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}
      viewport={meta.viewport ?? null}
    />
  );
}
