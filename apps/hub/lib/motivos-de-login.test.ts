import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  MENSAGEM_DE_CREDENCIAL,
  MOTIVO_API_INDISPONIVEL,
  MOTIVO_MUITAS_TENTATIVAS,
  TODAS_AS_MENSAGENS,
  mensagemDeRecusa,
} from "./motivos-de-login";

/**
 * O que a suíte e2e NÃO alcança.
 *
 * Ela sabe digitar credencial errada; não sabe pendurar a api nem esgotar o
 * limite de 8 tentativas por minuto. A propriedade que as três mensagens
 * precisam ter — nenhuma diz qual metade da credencial errou — só fica coberta
 * aqui, e é a que não pode quebrar: dizer "este usuário não existe" confirma o
 * login a quem está adivinhando.
 */
describe("os motivos de recusa do login", () => {
  it("nenhuma mensagem entrega qual metade da credencial errou", () => {
    // A MESMA regex da verificação em scripts/e2e/publico/02-login-e-papeis.mjs.
    for (const mensagem of TODAS_AS_MENSAGENS) {
      expect(mensagem).not.toMatch(/usuário não existe|conta não encontrada|senha incorreta para/i);
    }
  });

  it("toda mensagem é reconhecida como recusa pela suíte e2e", () => {
    for (const mensagem of TODAS_AS_MENSAGENS) {
      expect(mensagem).toMatch(/incorret|inválid|não foi possível|tentativas/i);
    }
  });

  it("motivo ausente ou desconhecido cai na recusa de credencial", () => {
    expect(mensagemDeRecusa(undefined)).toBe(MENSAGEM_DE_CREDENCIAL);
    // `credentials` é o que o próprio @auth/core produz quando authorize devolve null.
    expect(mensagemDeRecusa("credentials")).toBe(MENSAGEM_DE_CREDENCIAL);
    expect(mensagemDeRecusa("motivo-que-nao-existe")).toBe(MENSAGEM_DE_CREDENCIAL);
  });

  it("api indisponível e limite por minuto têm cada um a sua mensagem", () => {
    const api = mensagemDeRecusa(MOTIVO_API_INDISPONIVEL);
    const limite = mensagemDeRecusa(MOTIVO_MUITAS_TENTATIVAS);
    expect(api).not.toBe(MENSAGEM_DE_CREDENCIAL);
    expect(limite).not.toBe(MENSAGEM_DE_CREDENCIAL);
    expect(api).not.toBe(limite);
  });

  /**
   * A outra ponta. O `code` só chega ao cliente porque o `authorize` o escreve
   * numa subclasse de `CredentialsSignin`; um literal digitado de novo lá
   * quebraria a ligação EM SILÊNCIO — a mensagem cairia na recusa de
   * credencial e a tela culparia a pessoa por uma falha nossa.
   */
  it("o servidor escreve os motivos desta tabela, não literais próprios", () => {
    const auth = readFileSync(new URL("./auth.ts", import.meta.url), "utf8");
    expect(auth).toContain("code = MOTIVO_API_INDISPONIVEL");
    expect(auth).toContain("code = MOTIVO_MUITAS_TENTATIVAS");
  });
});
