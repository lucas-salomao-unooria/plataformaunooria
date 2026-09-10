import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { PAPEIS, type Papel } from "./papeis";
import type { UsuarioDaSessao } from "@/types/next-auth";

/**
 * Autenticação do hub — NextAuth v5.
 *
 * HOJE: Credentials. O `authorize()` chama `POST /auth/login` da api NestJS
 * (a api é a única dona do banco e do bcrypt; o hub nunca vê hash) e guarda o
 * usuário no JWT de sessão (cookie httpOnly do próprio NextAuth).
 *
 * AMANHÃ: WSO2. A presença de AUTH_WSO2_ISSUER registra o provider OIDC ao
 * lado — a troca é config, não código (decisão do plano de migração).
 */

const RespostaLoginSchema = z.object({
  usuarioId: z.string().min(1),
  usuario: z.string().min(1),
  nome: z.string(),
  papel: z.enum(PAPEIS as [Papel, ...Papel[]]),
  escolaId: z.string().nullable(),
  turmaId: z.string().nullable(),
  serie: z.string().nullable(),
  precisaTrocarSenha: z.boolean().default(false),
  escolas: z
    .array(z.object({ id: z.string(), nome: z.string(), papel: z.string() }))
    .default([]),
});

const providers = [
  Credentials({
    id: "credentials",
    name: "Usuário e senha",
    credentials: { username: {}, password: {} },
    async authorize(credentials) {
      const cred = z
        .object({ username: z.string().trim().min(1).max(64), password: z.string().min(1).max(200) })
        .safeParse(credentials);
      if (!cred.success) return null;

      const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:3001";
      const resposta = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cred.data),
        cache: "no-store",
      });
      if (!resposta.ok) return null;

      const dados = RespostaLoginSchema.safeParse(await resposta.json().catch(() => null));
      if (!dados.success) return null;

      const usuario: UsuarioDaSessao = {
        id: dados.data.usuarioId,
        usuario: dados.data.usuario,
        nome: dados.data.nome,
        papel: dados.data.papel,
        escolaId: dados.data.escolaId ?? "",
        turmaId: dados.data.turmaId ?? undefined,
        serie: dados.data.serie ?? undefined,
        precisaTrocarSenha: dados.data.precisaTrocarSenha,
        escolas: dados.data.escolas,
      };
      return { id: usuario.id, usuario };
    },
  }),
];

if (process.env.AUTH_WSO2_ISSUER) {
  providers.push({
    id: "wso2",
    name: "WSO2",
    type: "oidc",
    issuer: process.env.AUTH_WSO2_ISSUER,
    clientId: process.env.AUTH_WSO2_CLIENT_ID,
    clientSecret: process.env.AUTH_WSO2_CLIENT_SECRET,
    authorization: { params: { scope: "openid profile escola" } },
    // Mapeamento de claims do WSO2 → UsuarioDaSessao entra quando o IdP
    // existir de fato (M6+): precisa dos nomes reais dos claims custom.
  } as never);
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  providers,
  /**
   * 2h de INATIVIDADE, não 2h absolutas (ADR-95).
   *
   * Com `strategy: "jwt"` o `@auth/core` RE-ASSINA o cookie a cada leitura de
   * sessão (`lib/actions/session.js`, ramo `jwt`: o `jwt.encode` grava
   * `exp = agora + maxAge` e o `handleAuth` do next-auth devolve o
   * `Set-Cookie`), e o `updateAge` **não é consultado nesse ramo** — ele só
   * existe na estratégia de banco. Quem faz a janela deslizar é o MIDDLEWARE:
   * toda navegação casada pelo `matcher` renova. Sessão absoluta deslogaria o
   * estudante no meio da segunda aula, que é exatamente o tempo que estas 2h
   * existem para cobrir.
   *
   * ARMADILHA MEDIDA, e é a consequência ruim declarada na ADR-95: `auth()`
   * SEM argumentos (o caminho de RSC e de route handler) lê a sessão e
   * DESCARTA o `Set-Cookie` — só o middleware renova. Quem fica dentro do
   * iframe de uma missão não navega mais no hub, e o `exp:token-expirando` de
   * 10 em 10 minutos cai em `GET /api/exp-token`, que está fora do `matcher` e
   * portanto NÃO conta como atividade. Missão que passe de 2h desde a última
   * navegação no hub perde a sessão com a criança trabalhando, e hoje o
   * `ExpFrame` só registra isso num `console.error`.
   */
  session: { strategy: "jwt", maxAge: 60 * 60 * 2 },
  pages: { signIn: "/login" },
  callbacks: {
    // O beta do next-auth re-exporta o tipo JWT de @auth/core e a module
    // augmentation não o alcança — o narrow explícito cobre até o beta
    // estabilizar. A Session (o que as telas consomem) é tipada de verdade.
    jwt({ token, user, trigger, session }) {
      const u = user as { usuario?: UsuarioDaSessao } | null;
      if (u?.usuario) token.usuario = u.usuario;
      /**
       * `trigger: "update"` é a troca de ESCOLA ATIVA do professor lotado em
       * mais de uma unidade (`/api/escola-ativa`). O que muda é o cookie de
       * sessão — e, por ele, a escola que o token de dados vai carregar.
       * A validação de que a escola é dele fica na rota, contra a api: aqui só
       * se aplica o que já foi aprovado.
       */
      if (trigger === "update" && token.usuario) {
        const parcial = (session as { usuario?: Partial<UsuarioDaSessao> } | undefined)?.usuario;
        if (parcial) token.usuario = { ...token.usuario, ...parcial };
      }
      return token;
    },
    session({ session, token }) {
      const usuario = (token as { usuario?: UsuarioDaSessao }).usuario;
      if (usuario) session.usuario = usuario;
      return session;
    },
  },
});
