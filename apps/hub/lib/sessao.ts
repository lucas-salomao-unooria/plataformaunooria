import { z } from "zod";

/**
 * Quanto tempo a sessão do hub sobrevive SEM USO.
 *
 * A janela é de INATIVIDADE, e vale igual para todo papel (ADR-95). O que conta
 * como "uso" está na ADR-96: toda navegação casada pelo `matcher` do middleware
 * e — desde ela — o pedido de passe que a experiência faz de dentro do iframe.
 *
 * **O valor de PRODUÇÃO é fixo, e isso é decisão.** A página `/privacidade`
 * afirma o prazo em texto para a família, e texto legal só pode afirmar o que o
 * código faz (ADR-70). Uma env honrada em produção faria a página mentir na
 * primeira rede que a mudasse — ou obrigaria aquela página, que é estática e
 * pública, a virar dinâmica só para imprimir um número. `lib/sessao.test.ts`
 * prende os dois lados: o valor daqui e a frase de lá.
 */
export const TTL_DE_PRODUCAO_SEGUNDOS = 60 * 60 * 2;

/**
 * `SESSAO_TTL_SEGUNDOS` existe para a SUÍTE e é IGNORADA em produção: sem ela,
 * exercitar a morte da sessão custa duas horas de relógio por corrida.
 *
 * Piso de 60s para o roteiro não ficar instável; teto de 12h para um zero a
 * mais não virar "sessão que nunca morre".
 */
const TtlSchema = z.number().int().min(60).max(60 * 60 * 12);

export function ttlDoAmbiente(env: Record<string, string | undefined> = process.env): number {
  const bruto = env.SESSAO_TTL_SEGUNDOS;
  if (!bruto) return TTL_DE_PRODUCAO_SEGUNDOS;
  /*
   * `console` e não o pino de `lib/log.ts`: este módulo é importado por
   * `lib/auth.ts`, que o middleware do EDGE carrega, e `server-only` não entra
   * lá. É a mesma razão do aviso de chave efêmera em `lib/chave-token.ts`.
   */
  if (env.NODE_ENV === "production") {
    console.warn(
      "[sessao] SESSAO_TTL_SEGUNDOS IGNORADA em produção: a sessão segue em 2h (ADR-96). " +
        "Mudar o prazo de verdade exige mudar também a frase de /privacidade.",
    );
    return TTL_DE_PRODUCAO_SEGUNDOS;
  }
  const lido = TtlSchema.safeParse(Number(bruto));
  if (!lido.success) {
    console.warn(
      `[sessao] SESSAO_TTL_SEGUNDOS inválida (${bruto}) — usando ${TTL_DE_PRODUCAO_SEGUNDOS}s`,
    );
    return TTL_DE_PRODUCAO_SEGUNDOS;
  }
  return lido.data;
}

export const SESSAO_TTL_SEGUNDOS = ttlDoAmbiente();
