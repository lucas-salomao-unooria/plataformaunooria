/**
 * Auth.js (NextAuth v5) com provider OIDC genérico → WSO2 Identity Server.
 * O hub guarda o access_token na sessão server-side e o entrega à experiência
 * via postMessage (nunca em localStorage).
 */
import NextAuth from "next-auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    {
      id: "wso2",
      name: "WSO2",
      type: "oidc",
      issuer: process.env.AUTH_WSO2_ISSUER,
      clientId: process.env.AUTH_WSO2_CLIENT_ID,
      clientSecret: process.env.AUTH_WSO2_CLIENT_SECRET,
      authorization: { params: { scope: "openid profile escola" } },
    },
  ],
  callbacks: {
    jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
        token.aluno = {
          id: token.sub,
          nome: profile?.name ?? "",
          serie: (profile as Record<string, unknown> | null)?.["serie"] ?? "",
          turmaId: (profile as Record<string, unknown> | null)?.["turma_id"] ?? "",
          escolaId: (profile as Record<string, unknown> | null)?.["escola_id"] ?? "",
        };
      }
      return token;
    },
    session({ session, token }) {
      // @ts-expect-error — campos custom
      session.accessToken = token.accessToken;
      // @ts-expect-error
      session.aluno = token.aluno;
      return session;
    },
  },
});
