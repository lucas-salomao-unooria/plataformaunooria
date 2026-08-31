import { describe, expect, test } from "vitest";
import {
  formatarQuando,
  ordenarEstudantes,
  situacaoDoEstudante,
  type LinhaEstudanteUnootube,
} from "./unootube-tipos";

const linha = (nome: string, extra: Partial<LinhaEstudanteUnootube> = {}): LinhaEstudanteUnootube => ({
  estudanteId: nome,
  nome,
  usuario: nome.toLowerCase(),
  iniciou: false,
  salvos: 0,
  fontesConfiaveis: 0,
  inscritos: 0,
  rankingDesbloqueado: false,
  credibilidadeAdicionada: false,
  concluidoEm: null,
  ...extra,
});

describe("formatarQuando", () => {
  test("nulo/inválido vira travessão", () => {
    expect(formatarQuando(null)).toBe("—");
    expect(formatarQuando("não é data")).toBe("—");
  });
  test("mesmo ano omite o ano; ano diferente mostra", () => {
    const agora = new Date("2026-08-24T12:00:00");
    const d = new Date("2026-03-05T09:07:00");
    expect(formatarQuando(d.toISOString(), agora)).toBe("05/03 09:07");
    const antiga = new Date("2025-03-05T09:07:00");
    expect(formatarQuando(antiga.toISOString(), agora)).toBe("05/03/2025 09:07");
  });
});

describe("situacaoDoEstudante / ordenarEstudantes", () => {
  test("concluídos primeiro, depois em andamento, depois quem não iniciou", () => {
    const estudantes = [
      linha("Zeca"),
      linha("Ana", { iniciou: true }),
      linha("Bia", { iniciou: true, credibilidadeAdicionada: true }),
      linha("Álvaro", { iniciou: true, credibilidadeAdicionada: true }),
    ];
    expect(ordenarEstudantes(estudantes).map((a) => a.nome)).toEqual(["Álvaro", "Bia", "Ana", "Zeca"]);
    expect(situacaoDoEstudante(estudantes[0]!)).toBe("nao-iniciou");
    expect(situacaoDoEstudante(estudantes[1]!)).toBe("em-andamento");
    expect(situacaoDoEstudante(estudantes[2]!)).toBe("concluiu");
    expect(situacaoDoEstudante(estudantes[0]!)).toBe("nao-iniciou");
  });
});
