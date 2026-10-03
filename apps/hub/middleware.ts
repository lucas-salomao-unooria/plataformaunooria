import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { homeDoPapel, podeEntrarNaArea } from "@/lib/papeis";

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
  /* Quem JÁ trocou também entra: é a troca voluntária, pelo menu do avatar
     (H01.4.1). Ela devolvia para a home do papel, e o item de menu era um link
     morto. A tela muda de texto e de saída conforme `precisaTrocarSenha`. */
  if (pathname === TROCAR_SENHA) return NextResponse.next();

  /* MEMBRESIA, não igualdade: o `admin` entra em DUAS áreas (o painel da
     Unooria e a administrativa, que ele divide com os gestores — ADR-88).
     Comparando uma string só, ele era expulso de uma delas em silêncio. */
  if (!podeEntrarNaArea(usuario.papel, pathname)) {
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
    "/unooria/:path*",
    "/analise/:path*",
    "/dev-embed",
    "/trocar-senha",
  ],
};
