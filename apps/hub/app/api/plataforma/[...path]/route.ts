import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { assinarTokenExperiencia } from "@/lib/chave-token";

/**
 * BFF: o client do hub NUNCA segura bearer token (a sessão é cookie
 * httpOnly). Componentes client chamam `/api/plataforma/...` e este handler
 * valida a sessão, assina um token curto e repassa à api NestJS.
 *
 * Allowlist explícita: só os prefixos de rota da api que as telas do hub
 * usam. Nada de proxy aberto.
 */
const PREFIXOS_PERMITIDOS = [
  "usuarios",
  "atividades",
  "runs",
  "posts",
  "experiencias",
  "perfis",
  "analise",
  "progresso",
] as const;

async function proxy(request: NextRequest, path: string[]) {
  const session = await auth();
  if (!session?.usuario) {
    return NextResponse.json({ mensagem: "sem sessão" }, { status: 401 });
  }
  const prefixo = path[0] ?? "";
  if (!PREFIXOS_PERMITIDOS.includes(prefixo as (typeof PREFIXOS_PERMITIDOS)[number])) {
    return NextResponse.json({ mensagem: "rota não permitida" }, { status: 404 });
  }

  const u = session.usuario;
  const token = await assinarTokenExperiencia({
    sub: u.id,
    escola_id: u.escolaId,
    turma_id: u.turmaId,
    perfil: u.papel,
  });

  const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:3001";
  const destino = new URL(`${apiUrl}/${path.join("/")}`);
  request.nextUrl.searchParams.forEach((valor, chave) => destino.searchParams.set(chave, valor));

  const temCorpo = request.method !== "GET" && request.method !== "HEAD";
  const resposta = await fetch(destino, {
    method: request.method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(temCorpo ? { "content-type": request.headers.get("content-type") ?? "application/json" } : {}),
    },
    body: temCorpo ? await request.arrayBuffer() : undefined,
    cache: "no-store",
  });

  // Repassa corpo e content-type como vieram (JSON, CSV de exportação, etc.).
  return new NextResponse(resposta.body, {
    status: resposta.status,
    headers: {
      "content-type": resposta.headers.get("content-type") ?? "application/json",
      ...(resposta.headers.get("content-disposition")
        ? { "content-disposition": resposta.headers.get("content-disposition")! }
        : {}),
    },
  });
}

type Ctx = { params: Promise<{ path: string[] }> };
export async function GET(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
