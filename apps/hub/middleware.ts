import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { areaDoPapel, areaDoPathname, homeDoPapel } from "@/lib/papeis";

/**
 * Duas trancas, como no projeto origem: middleware (aqui) + verificação de
 * papel em cada rota de dados (na api, via RolesGuard). Sem sessão → /login
 * com ?next=; sessão em área de OUTRO papel → home do papel (nada de 403:
 * aluno que digita /professor só volta para o lugar dele).
 */
export default auth((request) => {
  const { pathname } = request.nextUrl;
  const usuario = request.auth?.usuario;

  if (!usuario) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (areaDoPathname(pathname) !== areaDoPapel(usuario.papel)) {
    const url = request.nextUrl.clone();
    url.pathname = homeDoPapel(usuario.papel);
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/professor/:path*", "/exp/:path*", "/admin/:path*", "/analise/:path*", "/dev-embed"],
};
