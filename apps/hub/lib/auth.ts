import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { PAPEIS, type Papel } from "./papeis";
import { SESSAO_TTL_SEGUNDOS } from "./sessao";
import { MOTIVO_API_INDISPONIVEL, MOTIVO_MUITAS_TENTATIVAS } from "./motivos-de-login";
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

/**
 * Quanto tempo o hub espera a api responder o login.
 *
 * Sem isto a espera é ILIMITADA: api PENDURADA — não fora do ar, pendurada,
 * que é como aparecem um Cloud Run em partida a frio e um pool de conexões
 * esgotado — deixa a pessoa no "Entrando…" para sempre, sem nunca receber
 * mensagem nenhuma. É o modo de falhar MUDO: ela não sabe se errou a senha ou
 * se o sistema travou. 8s é folgado para o bcrypt do `/auth/login` (~100ms
 * medidos em dev) mais uma partida a frio da api.
 */
const TIMEOUT_DO_LOGIN_MS = 8_000;

/**
 * "Não foi possível entrar", que é DIFERENTE de "credencial errada".
 *
 * `authorize` só sabe recusar devolvendo `null`, e todo `null` chega ao
 * cliente como a MESMA `CredentialsSignin` da senha errada. Se a falha da api
 * entrasse por esse caminho, a tela diria "Usuário ou senha incorretos" a quem
 * digitou tudo certo — culpando a pessoa por uma falha nossa. É a regra do
 * "o texto não mente" aplicada a interface, não a documento.
 *
 * O `code` é o único campo que o @auth/core leva até o cliente: ele o escreve
 * no `?code=` da URL de erro (`@auth/core/index.js`, `params.set("code", ...)`)
 * e o `signIn` o devolve em `SignInResponse.code`. Como ele VAI PARA A URL, só
 * pode dizer de que LADO foi a falha — nunca qual metade da credencial errou.
 * A recusa de credencial continua ambígua entre usuário e senha, de propósito:
 * dizer "este usuário não existe" entrega a lista de logins da rede.
 */
class ApiNaoRespondeu extends CredentialsSignin {
  code = MOTIVO_API_INDISPONIVEL;
}

/** 429 da api. Acertar a senha agora não adiantaria, e insistir só estende o bloqueio. */
class MuitasTentativas extends CredentialsSignin {
  code = MOTIVO_MUITAS_TENTATIVAS;
}

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
      let resposta: Response;
      try {
        resposta = await fetch(`${apiUrl}/auth/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(cred.data),
          cache: "no-store",
          signal: AbortSignal.timeout(TIMEOUT_DO_LOGIN_MS),
        });
      } catch (err) {
        /* `console` e não o pino de `lib/log.ts`: este módulo é importado pelo
           `middleware.ts`, que roda no EDGE (o `lib/log.ts` é `server-only`) —
           a mesma razão do aviso de `lib/sessao.ts`. O `name` basta para
           separar prazo estourado (`TimeoutError`) de api inalcançável
           (`TypeError`), e não carrega nada da credencial. */
        console.warn(
          `[login] a api não respondeu: ${err instanceof Error ? err.name : "erro desconhecido"}`,
        );
        throw new ApiNaoRespondeu();
      }
      if (resposta.status === 429) throw new MuitasTentativas();
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
   * 2h de INATIVIDADE, não 2h absolutas, e igual para todo papel (ADR-95).
   *
   * Com `strategy: "jwt"` o `@auth/core` RE-ASSINA o cookie a cada leitura de
   * sessão (`lib/actions/session.js`, ramo `jwt`: o `jwt.encode` grava
   * `exp = agora + maxAge`) e o `handleAuth` do next-auth devolve o
   * `Set-Cookie`. O `updateAge` **não é consultado nesse ramo** — ele só existe
   * na estratégia de banco, então não há o que ajustar nele aqui.
   *
   * **O QUE CONTA COMO USO (ADR-96):** toda navegação casada pelo `matcher` do
   * middleware e o pedido de passe da experiência (`GET /api/exp-token`, que
   * chama `unstable_update` para ESCREVER o cookie — `auth()` sozinho lê e
   * descarta o `Set-Cookie`, porque em RSC e route handler não se escreve
   * cookie). Antes da ADR-96 o pedido de passe não contava, e quem ficava
   * dentro de uma missão via a sessão envelhecer como se estivesse parado.
   *
   * O número vem de `lib/sessao.ts`, que o pina em produção: a `/privacidade`
   * afirma o prazo à família e não pode divergir dele.
   */
  session: { strategy: "jwt", maxAge: SESSAO_TTL_SEGUNDOS },
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
