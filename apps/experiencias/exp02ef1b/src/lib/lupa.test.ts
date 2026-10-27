import { describe, expect, it } from "vitest";
import {
  achados,
  achadosNaFoto,
  alvoQueFalta,
  alvoSob,
  AMOSTRA_MAXIMA_MS,
  juntarRelatos,
  LUPA_VAZIA,
  pisoLocal,
  registrarAmostra,
  relatoMudou,
} from "./lupa";
import type { Alvo, RelatoDaLupa } from "./tipos";

/* Duas ÁREAS desenhadas pelo professor: um relógio quadrado e uma estante alta e estreita. */
const ALVOS: Alvo[] = [
  { id: "inv-1", x: 36, y: 20, w: 10, h: 18 },
  { id: "inv-2", x: 55, y: 15, w: 6, h: 45 },
];
const t = (a: number, b: number, c: number, d: number): RelatoDaLupa => ({ "inv-1:foto-1": a, "inv-1:foto-2": b, "inv-2:foto-1": c, "inv-2:foto-2": d });

describe("o cronômetro da lupa: 3 s sobre CADA objeto, EM CADA foto (ADR-188)", () => {
  it("o tempo vai para o objeto NA FOTO sob o centro da lente, e para nenhum fora dele", () => {
    let l = registrarAmostra(LUPA_VAZIA, "inv-1:foto-1", 200);
    l = registrarAmostra(l, "inv-2:foto-2", 100);
    l = registrarAmostra(l, null, 400);
    expect(l).toEqual(t(200, 0, 0, 100));
  });

  it("achar o objeto na foto 1 NÃO acha o da foto 2", () => {
    const l = t(3000, 0, 3000, 0);
    expect(achados(l, 3000)).toEqual(["inv-1:foto-1", "inv-2:foto-1"]);
    expect(achadosNaFoto(l, 3000, "foto-1")).toBe(2);
    expect(achadosNaFoto(l, 3000, "foto-2")).toBe(0);
    expect(pisoLocal(l, 3000)).toBe(false);
  });

  it("a aba que dormiu não ganha minutos de uma vez", () => {
    expect(registrarAmostra(LUPA_VAZIA, "inv-1:foto-1", 60_000)["inv-1:foto-1"]).toBe(AMOSTRA_MAXIMA_MS);
    expect(registrarAmostra(LUPA_VAZIA, "inv-1:foto-1", -50)["inv-1:foto-1"]).toBe(0);
  });

  it("o piso é os dois objetos nas duas fotos, cada um com 3 s", () => {
    expect(pisoLocal(t(3000, 3000, 3000, 2999), 3000)).toBe(false);
    expect(pisoLocal(t(3000, 3000, 3000, 3000), 3000)).toBe(true);
  });

  it("a mãozinha aponta o primeiro par objeto × foto que falta", () => {
    expect(alvoQueFalta(LUPA_VAZIA, 3000)).toBe("inv-1:foto-1");
    expect(alvoQueFalta(t(3000, 0, 3000, 3000), 3000)).toBe("inv-1:foto-2");
    expect(alvoQueFalta(t(3000, 3000, 3000, 3000), 3000)).toBeNull();
  });

  it("o relato junta pelo máximo e só vai quando mudou", () => {
    expect(juntarRelatos(t(500, 0, 0, 0), t(100, 900, 0, 0))).toEqual(t(500, 900, 0, 0));
    expect(relatoMudou(t(1000, 0, 0, 0), t(1100, 0, 0, 0))).toBe(false);
    expect(relatoMudou(t(1000, 0, 0, 0), t(1000, 0, 0, 300))).toBe(true);
  });
});

describe("alvoSob: a ÁREA inteira do objeto, com a folga do servidor", () => {
  it("o objeto alto é achado no topo e na base, não só no meio (o círculo da 2.1.0 errava)", () => {
    expect(alvoSob(ALVOS, { x: 58, y: 16 }, 1.5)?.id).toBe("inv-2");
    expect(alvoSob(ALVOS, { x: 58, y: 59 }, 1.5)?.id).toBe("inv-2");
    expect(alvoSob(ALVOS, { x: 41, y: 29 }, 1.5)?.id).toBe("inv-1");
  });

  it("a folga: 1,5 da largura dos lados, × 16/9 em cima e embaixo; longe, nada", () => {
    expect(alvoSob(ALVOS, { x: 47.5, y: 29 }, 1.5)?.id).toBe("inv-1");
    expect(alvoSob(ALVOS, { x: 47.6, y: 29 }, 1.5)).toBeNull();
    expect(alvoSob(ALVOS, { x: 41, y: 40.6 }, 1.5)?.id).toBe("inv-1");
    expect(alvoSob(ALVOS, { x: 41, y: 40.8 }, 1.5)).toBeNull();
    expect(alvoSob(ALVOS, { x: 10, y: 80 }, 1.5)).toBeNull();
  });
});
