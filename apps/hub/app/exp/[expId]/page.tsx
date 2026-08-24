import { auth } from "@/lib/auth";
import { assinarTokenExperiencia } from "@/lib/chave-token";
import { ExpHost } from "@/components/ExpHost";

interface ManifestoDeExperiencia {
  expId: string;
  nome: string;
  versaoAtiva: string;
  viewport?: { largura: number; altura: number } | null;
}

/** Consulta o manifesto de versões na api (tabela `experiencias`). */
async function buscarManifesto(expId: string, token: string): Promise<ManifestoDeExperiencia | null> {
  try {
    const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:3001";
    const r = await fetch(`${apiUrl}/experiencias/${encodeURIComponent(expId)}`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!r.ok) return null;
    const { experiencia } = (await r.json()) as { experiencia: ManifestoDeExperiencia | null };
    return experiencia;
  } catch {
    return null;
  }
}

export default async function ExpPage({ params }: { params: Promise<{ expId: string }> }) {
  const { expId } = await params;
  const session = await auth();
  const usuario = session!.usuario; // middleware garante sessão nesta rota

  const token = await assinarTokenExperiencia({
    sub: usuario.id,
    escola_id: usuario.escolaId,
    turma_id: usuario.turmaId,
    perfil: usuario.papel,
  });

  const manifesto = await buscarManifesto(expId, token);

  const cdn = process.env.NEXT_PUBLIC_CDN_EXP_URL ?? "http://localhost:5173";

  // DEV sem manifesto: o Vite serve a exp na raiz — o viewport vem do
  // experiencia.json dele (mesma fonte que o /dev-embed usa).
  let viewportDev: { largura: number; altura: number } | null = null;
  if (!manifesto && process.env.NODE_ENV !== "production") {
    try {
      const r = await fetch(`${cdn}/experiencia.json`, { cache: "no-store" });
      if (r.ok) {
        const meta = (await r.json()) as { viewport?: { largura: number; altura: number } };
        viewportDev = meta.viewport ?? null;
      }
    } catch {
      // sem dev server no ar — segue sem viewport
    }
  }
  const expOrigin = new URL(cdn).origin;
  const hubOrigin = encodeURIComponent(process.env.HUB_ORIGIN ?? "http://localhost:3000");
  // Com manifesto: URL versionada do bucket/CDN (rollback = trocar versaoAtiva
  // na tabela). Sem manifesto (dev): raiz do servidor do Vite.
  const src = manifesto
    ? `${cdn}/${manifesto.expId}/${manifesto.versaoAtiva}/index.html?hubOrigin=${hubOrigin}`
    : `${cdn}/?hubOrigin=${hubOrigin}`;

  return (
    <ExpHost
      expId={expId}
      src={src}
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
      viewport={manifesto?.viewport ?? viewportDev}
    />
  );
}
