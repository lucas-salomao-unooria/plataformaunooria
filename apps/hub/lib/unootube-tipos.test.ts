import { describe, expect, test } from "vitest";
import { formatarQuando, ordenarAlunos, situacaoDoAluno, type LinhaAlunoUnootube } from "./unootube-tipos";

const linha = (nome: string, extra: Partial<LinhaAlunoUnootube> = {}): LinhaAlunoUnootube => ({
  alunoId: nome,
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

describe("situacaoDoAluno / ordenarAlunos", () => {
  test("concluídos primeiro, depois em andamento, depois quem não iniciou", () => {
    const alunos = [
      linha("Zeca"),
      linha("Ana", { iniciou: true }),
      linha("Bia", { iniciou: true, credibilidadeAdicionada: true }),
      linha("Álvaro", { iniciou: true, credibilidadeAdicionada: true }),
    ];
    expect(ordenarAlunos(alunos).map((a) => a.nome)).toEqual(["Álvaro", "Bia", "Ana", "Zeca"]);
    expect(situacaoDoAluno(alunos[0]!)).toBe("nao-iniciou");
    expect(situacaoDoAluno(alunos[1]!)).toBe("em-andamento");
    expect(situacaoDoAluno(alunos[2]!)).toBe("concluiu");
  });
});
