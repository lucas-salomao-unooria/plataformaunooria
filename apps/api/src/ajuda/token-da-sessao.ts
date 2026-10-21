import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import { PERFIS_DA_AJUDA } from "./regras";

/**
 * O TOKEN DA SESSÃO DA AJUDA — como o endpoint de LLM sabe quem está falando.
 *
 * O vendor do avatar chama a api sem token de usuário (é um servidor dele, não
 * o navegador). Ao abrir a sessão, a api assina este token curto e o entrega ao
 * vendor em `dynamic_variables.sessao`; o vendor o escreve no prompt do
 * contexto (`[sessao:${sessao}]`), e ele volta na mensagem `system` de toda
 * chamada ao nosso `/chat/completions` (MEDIDO no spike da ADR-132).
 *
 * HS256 com `AJUDA_SESSAO_CHAVE`, e não o RS256 do hub: quem assina e quem
 * confere é a MESMA api, e o token nunca sai para um terceiro que precise
 * conferir sem a chave. Vale até o teto da sessão + 1 min de folga.
 *
 * O que ele carrega é o mínimo para decidir sem banco: quem (`sub`), onde
 * (`escola`, vazia nos papéis de contrato), como (`perfil`) e qual sessão
 * (`sid`) — nunca nome nem e-mail: o vendor vê o prompt (regra 6).
 */
const EMISSOR = "plataforma-api";
/**
 * Duas audiências, a MESMA chave: `ajuda-llm` é o token que o vendor do avatar
 * devolve no prompt; `ajuda-mascote` é o BILHETE com que o navegador entra na
 * conexão de voz do mascote (ADR-158). Um não abre a porta do outro.
 */
export type AudienciaDoToken = "ajuda-llm" | "ajuda-mascote";
const FOLGA_S = 60;

export const ClaimsDaSessaoSchema = z.object({
  sub: z.string().uuid(),
  escola: z.string(),
  perfil: z.enum(PERFIS_DA_AJUDA),
  sid: z.string().uuid(),
});
export type ClaimsDaSessao = z.infer<typeof ClaimsDaSessaoSchema>;

function chave(segredo: string): Uint8Array {
  return new TextEncoder().encode(segredo);
}

export async function assinarTokenDaSessao(
  claims: ClaimsDaSessao,
  duracaoS: number,
  segredo: string,
  audiencia: AudienciaDoToken = "ajuda-llm",
): Promise<string> {
  return new SignJWT({ escola: claims.escola, perfil: claims.perfil, sid: claims.sid })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuer(EMISSOR)
    .setAudience(audiencia)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + duracaoS + FOLGA_S)
    .sign(chave(segredo));
}

/** `null` para qualquer token que não sirva — vencido, adulterado, de outra audiência. */
export async function verificarTokenDaSessao(
  token: string,
  segredo: string,
  audiencia: AudienciaDoToken = "ajuda-llm",
): Promise<ClaimsDaSessao | null> {
  try {
    const { payload } = await jwtVerify(token, chave(segredo), {
      issuer: EMISSOR,
      audience: audiencia,
      algorithms: ["HS256"],
    });
    const lido = ClaimsDaSessaoSchema.safeParse(payload);
    return lido.success ? lido.data : null;
  } catch {
    return null;
  }
}
