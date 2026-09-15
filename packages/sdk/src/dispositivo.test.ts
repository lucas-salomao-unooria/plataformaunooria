import { describe, expect, it } from "vitest";
import { lerDispositivo } from "./dispositivo";

/**
 * O coletor não pode ser a causa de um erro — ele roda DENTRO do caminho que
 * reporta erro. Os testes cobram isso antes de cobrar os números.
 */
function janela(nav: Record<string, unknown>, medidas?: Partial<Window>): Window {
  return { innerWidth: 1366, innerHeight: 768, devicePixelRatio: 2, navigator: nav, ...medidas } as unknown as Window;
}

describe("lerDispositivo", () => {
  it("lê o que o Chromium oferece", () => {
    const d = lerDispositivo(janela({ connection: { effectiveType: "4g" }, deviceMemory: 4, hardwareConcurrency: 8 }));
    expect(d).toEqual({ largura: 1366, altura: 768, dpr: 2, conexao: "4g", memoriaGb: 4, nucleos: 8 });
  });

  it("no Safari e no Firefox devolve só o que existe, sem inventar zero", () => {
    const d = lerDispositivo(janela({ hardwareConcurrency: 4 }));
    expect(d).toEqual({ largura: 1366, altura: 768, dpr: 2, conexao: undefined, memoriaGb: undefined, nucleos: 4 });
  });

  it("ignora `effectiveType` fora do vocabulário em vez de repassá-lo", () => {
    expect(lerDispositivo(janela({ connection: { effectiveType: "5g" } }))?.conexao).toBeUndefined();
    expect(lerDispositivo(janela({ connection: "nao-e-objeto" }))?.conexao).toBeUndefined();
  });

  it("arredonda a medida: viewport fracionário vira inteiro, que é o que o schema aceita", () => {
    const d = lerDispositivo(janela({}, { innerWidth: 411.42857, innerHeight: 823.1 } as Partial<Window>));
    expect(d?.largura).toBe(411);
    expect(d?.altura).toBe(823);
  });

  it("navegador que LANÇA no acesso devolve undefined — coletar contexto nunca derruba quem reporta", () => {
    const hostil = {
      get innerWidth(): number {
        throw new Error("bloqueado por extensão de privacidade");
      },
      navigator: {},
    } as unknown as Window;
    expect(() => lerDispositivo(hostil)).not.toThrow();
    expect(lerDispositivo(hostil)).toBeUndefined();
  });
});
