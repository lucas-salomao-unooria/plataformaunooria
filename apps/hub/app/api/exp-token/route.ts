import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assinarTokenExperiencia } from "@/lib/chave-token";

/**
 * Reemite o token de experiência a partir da SESSÃO (cookie httpOnly).
 * É o outro lado do `exp:token-expirando`: o ExpFrame chama aqui e responde
 * `hub:token` ao iframe. O token nunca fica em storage — só em memória.
 */
export async function GET() {
  const session = await auth();
  if (!session?.usuario) {
    return NextResponse.json({ mensagem: "sem sessão" }, { status: 401 });
  }
  const u = session.usuario;
  // A experiência não abre com senha de primeiro acesso: o middleware prende as
  // PÁGINAS, e sem esta linha o token continuaria saindo por aqui.
  if (u.precisaTrocarSenha) {
    return NextResponse.json({ mensagem: "troque a senha antes de continuar" }, { status: 403 });
  }
  const token = await assinarTokenExperiencia({
    sub: u.id,
    escola_id: u.escolaId,
    turma_id: u.turmaId,
    perfil: u.papel,
  });
  return NextResponse.json({ token });
}
