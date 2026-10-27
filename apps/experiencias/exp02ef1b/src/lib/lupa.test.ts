import { describe, expect, it } from "vitest";
import { achados, alvoQueFalta, alvoSob, AMOSTRA_MAXIMA_MS, juntarRelatos, LUPA_VAZIA, pisoLocal, registrarAmostra, relatoMudou } from "./lupa";
import type { Alvo } from "./tipos";

const ALVOS: Alvo[] = [
  { id: "inv-1", x: 41, y: 33, r: 8 },
  { id: "inv-2", x: 60, y: 33, r: 7 },
];

describe("o cronômetro da lupa: 3 s sobre CADA objeto do fundo", () => {
  it("o tempo vai para o objeto sob o centro da lente, e para nenhum fora dele", () => {
    let l = registrarAmostra(LUPA_VAZIA, "inv-1", 200);
    l = registrarAmostra(l, "inv-2", 100);
    l = registrarAmostra(l, null, 400);
    expect(l).toEqual({ alvo1Ms: 200, alvo2Ms: 100 });
  });

  it("a aba que dormiu não ganha minutos de uma vez", () => {
    expect(registrarAmostra(LUPA_VAZIA, "inv-1", 60_000).alvo1Ms).toBe(AMOSTRA_MAXIMA_MS);
    expect(registrarAmostra(LUPA_VAZIA, "inv-1", -50).alvo1Ms).toBe(0);
  });

  it("o piso é os dois objetos, cada um com 3 s", () => {
    expect(pisoLocal({ alvo1Ms: 3000, alvo2Ms: 2999 }, 3000)).toBe(false);
    expect(pisoLocal({ alvo1Ms: 3000, alvo2Ms: 3000 }, 3000)).toBe(true);
    expect(achados({ alvo1Ms: 3100, alvo2Ms: 10 }, 3000)).toEqual(["inv-1"]);
  });

  it("a mãozinha aponta o primeiro objeto que falta", () => {
    expect(alvoQueFalta(LUPA_VAZIA, 3000)).toBe("inv-1");
    expect(alvoQueFalta({ alvo1Ms: 3000, alvo2Ms: 0 }, 3000)).toBe("inv-2");
    expect(alvoQueFalta({ alvo1Ms: 3000, alvo2Ms: 3000 }, 3000)).toBeNull();
  });

  it("o relato junta pelo máximo e só vai quando mudou", () => {
    expect(juntarRelatos({ alvo1Ms: 500, alvo2Ms: 0 }, { alvo1Ms: 100, alvo2Ms: 900 })).toEqual({ alvo1Ms: 500, alvo2Ms: 900 });
    expect(relatoMudou({ alvo1Ms: 1000, alvo2Ms: 0 }, { alvo1Ms: 1100, alvo2Ms: 0 })).toBe(false);
    expect(relatoMudou({ alvo1Ms: 1000, alvo2Ms: 0 }, { alvo1Ms: 1300, alvo2Ms: 0 })).toBe(true);
  });
});

describe("alvoSob: o objeto sob a lente, redondo na TELA", () => {
  it("acha o objeto com folga além do raio e nenhum longe dele", () => {
    expect(alvoSob(ALVOS, { x: 41, y: 33 })?.id).toBe("inv-1");
    expect(alvoSob(ALVOS, { x: 49, y: 33 })?.id).toBe("inv-1"); // 8 = o raio, dentro da folga
    expect(alvoSob(ALVOS, { x: 60, y: 45 })?.id).toBe("inv-2"); // 12 de altura = 6,75 na tela
    expect(alvoSob(ALVOS, { x: 10, y: 80 })).toBeNull();
  });

  it("entre dois, vence o mais perto", () => {
    expect(alvoSob(ALVOS, { x: 51, y: 33 })?.id).toBe("inv-1");
    expect(alvoSob(ALVOS, { x: 52, y: 33 })?.id).toBe("inv-2");
  });
});
