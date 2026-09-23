import { describe, expect, it, vi } from "vitest";
import { instalarVitais } from "./vitals";

describe("instalarVitais", () => {
  it("fora da amostra não instala nem baixa o pacote", async () => {
    const enviar = vi.fn(async () => undefined);
    await expect(instalarVitais({ rota: "exp08ef1b", superficie: "exp", enviar, amostra: 0.1, sorteio: () => 0.5 })).resolves.toBe(false);
    expect(enviar).not.toHaveBeenCalled();
  });

  it("dentro da amostra instala os quatro observadores", async () => {
    const enviar = vi.fn(async () => undefined);
    await expect(instalarVitais({ rota: "exp08ef1b", superficie: "exp", enviar, amostra: 0.1, sorteio: () => 0.01 })).resolves.toBe(true);
  });
});
