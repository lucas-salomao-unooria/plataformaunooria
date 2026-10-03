import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";

const CorpoSchema = z.object({
  senhaAtual: z.string().min(1).max(200),
  senhaNova: z.string().min(8, "A nova senha precisa ter pelo menos 8 caracteres.").max(200),
});

/**
 * Troca de senha: a do primeiro acesso e a voluntária, pelo menu do avatar
 * (H01.4.1). A api é a mesma para as duas.
 *
 * Route handler próprio, e não o BFF, por dois motivos: o BFF recusa tudo
 * enquanto `precisaTrocarSenha` (é justamente a trava), e o login usado aqui sai
 * da SESSÃO — o browser nunca escolhe de quem é a senha que está trocando.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.usuario) {
    return NextResponse.json({ mensagem: "sem sessão" }, { status: 401 });
  }

  const corpo = CorpoSchema.safeParse(await request.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json(
      { mensagem: corpo.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }

  const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:3001";
  const resposta = await fetch(`${apiUrl}/auth/trocar-senha`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: session.usuario.usuario, ...corpo.data }),
    cache: "no-store",
  });

  const dados = (await resposta.json().catch(() => null)) as { mensagem?: string } | null;
  if (!resposta.ok) {
    return NextResponse.json(
      { mensagem: dados?.mensagem ?? "Não foi possível trocar a senha." },
      { status: resposta.status },
    );
  }
  return NextResponse.json({ ok: true });
}
