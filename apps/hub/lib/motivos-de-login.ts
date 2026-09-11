/**
 * Por que o login não passou — e o que a tela diz de cada motivo.
 *
 * Uma fonte só, porque as duas pontas moram em arquivos diferentes: o
 * `authorize` (`lib/auth.ts`, servidor) ESCREVE o motivo no `code` da
 * `CredentialsSignin`, e o formulário (`login/login-form.tsx`, cliente) o LÊ
 * do `SignInResponse.code`. Se cada ponta tivesse a sua cópia da string, um
 * erro de digitação não quebraria nada: a mensagem cairia calada na recusa de
 * credencial, e a tela passaria a culpar a pessoa por uma falha nossa. Um
 * lugar só remove a possibilidade.
 *
 * Este módulo é importado pelo CLIENTE e, por `lib/auth.ts`, pelo middleware
 * do EDGE: não pode ganhar import de servidor (nem o pino de `lib/log.ts`).
 */

/** A api não respondeu no prazo, ou não foi alcançada. Não é credencial errada. */
export const MOTIVO_API_INDISPONIVEL = "api-indisponivel";

/** 429 da api: 8 tentativas por minuto com o mesmo login (`auth.controller.ts`). */
export const MOTIVO_MUITAS_TENTATIVAS = "muitas-tentativas";

/**
 * A recusa que vale quando o motivo é a credencial — e o padrão de todo motivo
 * desconhecido, que é o caso comum: `code=credentials` é o que o próprio
 * @auth/core produz sozinho quando o `authorize` devolve `null`.
 *
 * Ela é AMBÍGUA de propósito entre usuário e senha. Dizer "este usuário não
 * existe" transformaria a tela de login num verificador de logins válidos da
 * rede — e as outras duas mensagens seguem a mesma regra: falam do sistema,
 * nunca de qual metade errou.
 */
export const MENSAGEM_DE_CREDENCIAL = "Usuário ou senha incorretos.";

const MENSAGEM_POR_MOTIVO: Record<string, string> = {
  [MOTIVO_API_INDISPONIVEL]: "Não foi possível entrar agora. Tente de novo em alguns instantes.",
  [MOTIVO_MUITAS_TENTATIVAS]: "Muitas tentativas. Aguarde um momento e tente de novo.",
};

export function mensagemDeRecusa(motivo: string | undefined): string {
  return MENSAGEM_POR_MOTIVO[motivo ?? ""] ?? MENSAGEM_DE_CREDENCIAL;
}

/** Só para o teste: garante que nenhuma mensagem entregue qual metade errou. */
export const TODAS_AS_MENSAGENS = [MENSAGEM_DE_CREDENCIAL, ...Object.values(MENSAGEM_POR_MOTIVO)];
