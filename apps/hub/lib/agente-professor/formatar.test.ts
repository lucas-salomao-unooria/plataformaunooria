import { describe, expect, it } from "vitest";

import { quandoNaLista } from "./formatar";

/**
 * A data da linha do histórico, no fuso da plataforma (padrão
 * `America/Sao_Paulo`, ADR-99). Os horários escolhidos são os que a ADR-98
 * mostrou quebrarem: depois das 21h de Brasília já é o dia seguinte em UTC.
 */
describe("quandoNaLista", () => {
  // 30/09/2026, 23:30 em Brasília = 01/10/2026, 02:30 UTC.
  const agora = new Date("2026-10-01T02:30:00Z");

  it("hoje (no fuso da rede, não no UTC) mostra só a hora", () => {
    expect(quandoNaLista("2026-10-01T01:10:00Z", agora)).toBe("Hoje, 22:10");
  });

  it("ontem", () => {
    expect(quandoNaLista("2026-09-29T15:00:00Z", agora)).toBe("Ontem, 12:00");
  });

  it("antes disso, data e hora", () => {
    expect(quandoNaLista("2026-09-20T12:05:00Z", agora)).toBe("20/09/2026, 09:05");
  });

  it("data inválida não quebra a lista", () => {
    expect(quandoNaLista("não é data", agora)).toBe("—");
  });
});
