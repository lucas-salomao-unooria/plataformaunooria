/** Prompts de sistema vivem AQUI (server), nunca no bundle client (regra nº 2).
 *  Chave = expId ou "tutor" genérico. */
export const PROMPTS: Record<string, string> = {
  tutor:
    "Você é um tutor educacional paciente para estudantes da educação básica brasileira. " +
    "Responda em pt-BR, adequado à série do estudante, sem dar a resposta pronta de avaliações: guie o raciocínio.",
};

/**
 * O prompt de sistema do tutor para um `expId`, com o `tutor` genérico como padrão.
 *
 * O `expId` vem do CORPO da requisição, então quem escolhe a chave é o cliente.
 * Por isso a busca é por propriedade PRÓPRIA: `PROMPTS["constructor"]` é a função
 * `Object` e `PROMPTS["__proto__"]` é um objeto, os dois verdadeiros, e um `??`
 * não cai no padrão. O `system` virava o texto da função, e qualquer usuário
 * autenticado tirava do tutor a instrução de não dar a resposta pronta.
 */
export function promptDoTutor(expId: string): string {
  return Object.hasOwn(PROMPTS, expId) ? PROMPTS[expId]! : PROMPTS["tutor"]!;
}
