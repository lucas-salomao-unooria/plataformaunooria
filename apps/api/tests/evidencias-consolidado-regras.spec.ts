import { somarPorSerie, type TurmaMedida } from "../src/evidencias/evidencias-consolidado.service";
import {
  DISTRIBUICAO_VAZIA,
  distribuir,
  habilidadesDaMissao,
  missaoDaTurma,
  niveisDaMissao,
  ordemDaSerie,
  somar,
  type LinhaDoConsolidado,
} from "../src/evidencias/regras-do-consolidado";

/**
 * As regras PURAS do painel de habilidades (F14.7) — sem banco.
 *
 * O que se prova: o nível da criança na MISSÃO é o melhor entre as atividades
 * (decisão de 2026-10-03), quem não tem evidência que conte é "não avaliado"
 * e nunca "não atingiu", e a soma da escola e da rede não perde nem duplica
 * criança.
 */

const linha = (
  estudanteId: string,
  habilidade: string,
  status: LinhaDoConsolidado["status"],
  situacao: LinhaDoConsolidado["situacao"] = "valida",
  expId = "exp05ef1b",
): LinhaDoConsolidado => ({ estudanteId, expId, habilidade, status, situacao });

describe("o nível da criança na missão", () => {
  test("é o MELHOR entre todas as atividades e rodadas", () => {
    // As linhas de duas atividades diferentes chegam juntas: a missão é a composição.
    const niveis = niveisDaMissao(
      [linha("ana", "EF05CO08", "nao_atingiu"), linha("ana", "EF05CO08", "atingiu"), linha("ana", "EF05CO03", "em_processo")],
      "exp05ef1b",
    );
    expect(niveis.get("ana")?.get("EF05CO08")).toBe("atingiu");
    expect(niveis.get("ana")?.get("EF05CO03")).toBe("em_processo");
  });

  test("a projeção a confirmar e o 'Não participou' não contam", () => {
    const niveis = niveisDaMissao(
      [linha("bia", "EF05CO08", "atingiu", "a_revisar"), linha("caio", "EF05CO08", "nao_participou")],
      "exp05ef1b",
    );
    expect(niveis.get("bia")?.get("EF05CO08")).toBeUndefined();
    expect(niveis.get("caio")?.get("EF05CO08")).toBeUndefined();
  });

  test("cada missão é lida separada", () => {
    const niveis = niveisDaMissao(
      [linha("ana", "EF15CO02", "atingiu", "valida", "exp04ef1b"), linha("ana", "EF15CO02", "nao_atingiu")],
      "exp05ef1b",
    );
    expect(niveis.get("ana")?.get("EF15CO02")).toBe("nao_atingiu");
  });
});

describe("a distribuição da turma", () => {
  const niveis = niveisDaMissao(
    [
      linha("ana", "EF05CO08", "atingiu"),
      linha("bia", "EF05CO08", "em_processo"),
      linha("caio", "EF05CO08", "nao_atingiu"),
      linha("duda", "EF05CO08", "atingiu", "a_revisar"),
      // Saiu da turma: a linha fica no banco, mas não conta aqui.
      linha("ex-aluno", "EF05CO08", "atingiu"),
    ],
    "exp05ef1b",
  );

  test("cada criança DA TURMA cai em uma caixa, e quem não tem nível é 'não avaliado'", () => {
    expect(distribuir(["ana", "bia", "caio", "duda", "eli"], niveis, "EF05CO08")).toEqual({
      atingiu: 1,
      emProcesso: 1,
      naoAtingiu: 1,
      naoAvaliado: 2,
      total: 5,
    });
  });

  test("habilidade sem nenhuma evidência: a turma inteira é 'não avaliado', nunca 'não atingiu'", () => {
    const d = distribuir(["ana", "bia"], niveis, "EF05CO04");
    expect(d.naoAtingiu).toBe(0);
    expect(d.naoAvaliado).toBe(2);
  });

  test("somar não perde criança", () => {
    const a = distribuir(["ana", "bia"], niveis, "EF05CO08");
    const b = distribuir(["caio", "eli"], niveis, "EF05CO08");
    expect(somar(somar(DISTRIBUICAO_VAZIA, a), b)).toEqual({
      atingiu: 1,
      emProcesso: 1,
      naoAtingiu: 1,
      naoAvaliado: 1,
      total: 4,
    });
  });
});

describe("o que entra no painel", () => {
  test("as habilidades da ficha primeiro, depois as que saíram da ficha mas têm evidência", () => {
    const codigos = habilidadesDaMissao(
      ["EF05CO08", "EF05CO03"],
      [linha("ana", "EF05CO99", "atingiu"), linha("ana", "EF05CO08", "atingiu")],
      "exp05ef1b",
    );
    expect(codigos).toEqual(["EF05CO08", "EF05CO03", "EF05CO99"]);
  });

  test("a missão vale para a série do manifesto, ou para a turma que já a fez", () => {
    const missao = { expId: "exp05ef1b", series: ["5EF"] };
    expect(missaoDaTurma(missao, "5EF", new Set())).toBe(true);
    expect(missaoDaTurma(missao, "6EF", new Set())).toBe(false);
    expect(missaoDaTurma(missao, "6EF", new Set(["exp05ef1b"]))).toBe(true);
  });

  test("as séries na ordem da trilha", () => {
    expect(["1EM", "9EF", "5EF", "XX"].sort((a, b) => ordemDaSerie(a) - ordemDaSerie(b))).toEqual([
      "5EF",
      "9EF",
      "1EM",
      "XX",
    ]);
  });
});

describe("a soma por série (o painel da rede)", () => {
  const d = (atingiu: number, naoAvaliado: number) => ({
    atingiu,
    emProcesso: 0,
    naoAtingiu: 0,
    naoAvaliado,
    total: atingiu + naoAvaliado,
  });
  const turmas: TurmaMedida[] = [
    {
      id: "t1",
      nome: "5A",
      serie: "5EF",
      estudantes: 3,
      missoes: [{ expId: "exp05ef1b", aplicada: true, habilidades: [{ codigo: "EF05CO08", distribuicao: d(2, 1) }] }],
    },
    {
      id: "t2",
      nome: "5B",
      serie: "5EF",
      estudantes: 2,
      // Não aplicou: as crianças entram como "não avaliado".
      missoes: [{ expId: "exp05ef1b", aplicada: false, habilidades: [{ codigo: "EF05CO08", distribuicao: d(0, 2) }] }],
    },
    {
      id: "t3",
      nome: "4A",
      serie: "4EF",
      estudantes: 4,
      missoes: [{ expId: "exp04ef1b", aplicada: true, habilidades: [{ codigo: "EF15CO02", distribuicao: d(4, 0) }] }],
    },
  ];

  test("soma as turmas da série, conta quantas aplicaram, e ordena as séries pela trilha", () => {
    const series = somarPorSerie(turmas);
    expect(series.map((s) => s.serie)).toEqual(["4EF", "5EF"]);
    const quinto = series[1]!;
    expect(quinto).toMatchObject({ turmas: 2, estudantes: 5 });
    expect(quinto.missoes).toEqual([
      { expId: "exp05ef1b", turmasAplicadas: 1, habilidades: [{ codigo: "EF05CO08", distribuicao: d(2, 3) }] },
    ]);
  });
});
