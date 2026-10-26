import { describe, expect, test } from "vitest";
import { AMOSTRA_MAXIMA_MS, fotoQueFalta, juntarRelatos, LUPA_VAZIA, pisoLocal, registrarAmostra, relatoMudou } from "./lupa";

const PISO = 3000;

describe("o cronômetro da lupa (E2)", () => {
  test("o tempo vai para a foto sob o centro da lente; fora das fotos, não conta", () => {
    let l = registrarAmostra(LUPA_VAZIA, "foto-1", false, 200);
    l = registrarAmostra(l, null, false, 200);
    l = registrarAmostra(l, "foto-2", false, 200);
    expect(l).toEqual({ foto1Ms: 200, foto2Ms: 200, fundo1: false, fundo2: false });
  });

  test("o fundo de cada foto, uma vez visto, fica visto", () => {
    let l = registrarAmostra(LUPA_VAZIA, "foto-1", true, 200);
    l = registrarAmostra(l, "foto-1", false, 200);
    expect(l.fundo1).toBe(true);
    expect(l.fundo2).toBe(false);
  });

  test("a aba que dormiu não ganha minutos de uma vez", () => {
    expect(registrarAmostra(LUPA_VAZIA, "foto-1", false, 60_000).foto1Ms).toBe(AMOSTRA_MAXIMA_MS);
    expect(registrarAmostra(LUPA_VAZIA, "foto-1", false, -50).foto1Ms).toBe(0);
  });

  test("o piso: 3 s em CADA foto E o fundo das DUAS (one-pager §4)", () => {
    expect(pisoLocal({ foto1Ms: 3000, foto2Ms: 3000, fundo1: true, fundo2: true }, PISO)).toBe(true);
    expect(pisoLocal({ foto1Ms: 9000, foto2Ms: 2999, fundo1: true, fundo2: true }, PISO)).toBe(false);
    expect(pisoLocal({ foto1Ms: 3000, foto2Ms: 3000, fundo1: true, fundo2: false }, PISO)).toBe(false);
  });

  test("a mãozinha aponta a primeira foto que ainda falta", () => {
    expect(fotoQueFalta(LUPA_VAZIA, PISO)).toBe("foto-1");
    expect(fotoQueFalta({ foto1Ms: 3000, foto2Ms: 0, fundo1: true, fundo2: false }, PISO)).toBe("foto-2");
    expect(fotoQueFalta({ foto1Ms: 3000, foto2Ms: 3000, fundo1: false, fundo2: true }, PISO)).toBe("foto-1");
  });

  test("o relato só vai quando há novidade, e nunca volta atrás", () => {
    const enviado = { foto1Ms: 1000, foto2Ms: 0, fundo1: false, fundo2: false };
    expect(relatoMudou(enviado, { ...enviado, foto1Ms: 1100 })).toBe(false);
    expect(relatoMudou(enviado, { ...enviado, foto1Ms: 1300 })).toBe(true);
    expect(relatoMudou(enviado, { ...enviado, fundo2: true })).toBe(true);
    expect(juntarRelatos(enviado, { foto1Ms: 500, foto2Ms: 700, fundo1: true, fundo2: false })).toEqual({
      foto1Ms: 1000,
      foto2Ms: 700,
      fundo1: true,
      fundo2: false,
    });
  });
});
