import {
  abrirContexto,
  comEscolaNoContexto,
  contextoAtual,
  definirTenancyNoContexto,
  escolaDoContexto,
} from "../src/tenancy/tenancy-context";

/**
 * O store da requisição é um só e MUTÁVEL: o middleware abre, o interceptor
 * preenche a escola, o filtro lê. Fora de requisição, `comEscolaNoContexto`
 * continua funcionando sozinho (seed, worker, teste) — e dentro de uma abre
 * uma cópia, sem vazar a troca de escola para o resto da requisição.
 */
describe("contexto da requisição", () => {
  it("fora de qualquer contexto, nada existe", () => {
    expect(contextoAtual()).toBeUndefined();
    expect(escolaDoContexto()).toBeUndefined();
    expect(definirTenancyNoContexto({ escolaId: "e1" })).toBe(false);
  });

  it("o interceptor preenche o MESMO store que o middleware abriu", () => {
    abrirContexto({ requestId: "r1" }, () => {
      expect(definirTenancyNoContexto({ escolaId: "e1", perfil: "gestor_escola" })).toBe(true);
      expect(contextoAtual()).toEqual({ requestId: "r1", escolaId: "e1", perfil: "gestor_escola" });
      expect(escolaDoContexto()).toBe("e1");
    });
  });

  it("o store sobrevive a um await dentro da requisição", async () => {
    await abrirContexto({ requestId: "r1" }, async () => {
      definirTenancyNoContexto({ escolaId: "e1" });
      await new Promise((r) => setTimeout(r, 1));
      expect(escolaDoContexto()).toBe("e1");
    });
  });

  it("comEscolaNoContexto fora de requisição abre um store com requestId próprio", () => {
    comEscolaNoContexto("e9", () => {
      expect(escolaDoContexto()).toBe("e9");
      expect(contextoAtual()?.requestId).toMatch(/^[0-9a-f-]{36}$/);
    });
    expect(contextoAtual()).toBeUndefined();
  });

  it("comEscolaNoContexto dentro de requisição troca a escola numa CÓPIA e preserva o requestId", () => {
    abrirContexto({ requestId: "r1", escolaId: "e1" }, () => {
      comEscolaNoContexto("e2", () => {
        expect(escolaDoContexto()).toBe("e2");
        expect(contextoAtual()?.requestId).toBe("r1");
      });
      // a troca não vazou para o resto da requisição
      expect(escolaDoContexto()).toBe("e1");
    });
  });

  it("requisições concorrentes não se enxergam", async () => {
    const vistos: string[] = [];
    await Promise.all(
      ["a", "b", "c"].map((id) =>
        abrirContexto({ requestId: id }, async () => {
          await new Promise((r) => setTimeout(r, Math.random() * 5));
          vistos.push(contextoAtual()?.requestId ?? "?");
        }),
      ),
    );
    expect(vistos.sort()).toEqual(["a", "b", "c"]);
  });
});
