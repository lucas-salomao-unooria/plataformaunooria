import { describe, expect, test } from "vitest";
import { hashDoPerfil, jsonCanonico, nomeDoArquivo } from "./perfil-portatil";

/**
 * O hub ASSINA o perfil portátil; a api de destino VERIFICA — e a de destino
 * está noutra instalação, possivelmente noutra versão. As duas cópias de
 * `jsonCanonico` só servem para alguma coisa se produzirem o mesmo número.
 *
 * O fixture e a constante abaixo são os MESMOS de
 * `apps/api/tests/perfil-portatil.spec.ts`. Mexer numa das implementações
 * derruba um dos dois testes — que é exatamente o aviso que se quer.
 */
describe("hash canônico do perfil portátil", () => {
  test("fixture de contrato: o hash é este número e não outro", () => {
    const fixture = {
      documento: "perfil-portatil-unooria",
      versao: 1,
      titular: { cpf: "700.100.200-39", nome: "Ana" },
      participacoes: [{ expId: "exp-70-vila-do-lume", em: "2026-03-01T12:00:00.000Z" }],
    };
    expect(hashDoPerfil(fixture)).toBe(
      "a8bf15847e2b3a4aa640d32a7cf907496c19bf1fb08c8c525ad403cbbcc4ea43",
    );
  });

  test("ordem das chaves não muda o hash", () => {
    expect(jsonCanonico({ b: 1, a: 2 })).toBe(jsonCanonico({ a: 2, b: 1 }));
  });

  test("o nome do arquivo é legível por quem recebe por e-mail", () => {
    expect(nomeDoArquivo("Ana Portátil da Silva", new Date("2026-08-28T10:00:00Z"))).toBe(
      "perfil-ana-portatil-da-silva-2026-08-28.json",
    );
  });
});
