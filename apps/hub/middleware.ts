import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { areaDoPapel, areaDoPathname, homeDoPapel } from "@/lib/papeis";

/** Fora das áreas de papel: vale para estudante, professor, gestor e admin. */
const TROCAR_SENHA = "/trocar-senha";

/**
 * Duas trancas, como no projeto origem: middleware (aqui) + verificação de
 * papel em cada rota de dados (na api, via RolesGuard). Sem sessão → /login
 * com ?next=; sessão em área de OUTRO papel → home do papel (nada de 403:
 * estudante que digita /professor só volta para o lugar dele).
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

  // Primeiro acesso: a senha do lote (ou a temporária do reset) vale UMA vez.
  // A trava é aqui e também no BFF e no /api/exp-token — o middleware sozinho
  // deixaria a experiência abrir por baixo, via token.
  if (usuario.precisaTrocarSenha && pathname !== TROCAR_SENHA) {
    const url = request.nextUrl.clone();
    url.pathname = TROCAR_SENHA;
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (!usuario.precisaTrocarSenha && pathname === TROCAR_SENHA) {
    const url = request.nextUrl.clone();
    url.pathname = homeDoPapel(usuario.papel);
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (pathname === TROCAR_SENHA) return NextResponse.next();

  if (areaDoPathname(pathname) !== areaDoPapel(usuario.papel)) {
    const url = request.nextUrl.clone();
    url.pathname = homeDoPapel(usuario.papel);
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/estudante/:path*",
    "/professor/:path*",
    "/exp/:path*",
    "/admin/:path*",
    "/analise/:path*",
    "/dev-embed",
    "/trocar-senha",
  ],
};
