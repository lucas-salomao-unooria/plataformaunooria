import { costurarAulas, type HorarioDeAula } from "./costura";
import type { Aula } from "./contrato-de-rotas";

/**
 * A costura é a última barreira antes de o plano chegar ao professor, e o que
 * ela barra não aparece em nenhum outro teste: uma resposta de modelo malformada
 * passa pelo Zod do schema e ainda assim produz um plano errado — com aula em
 * dia que não existe, ou citando habilidade inventada.
 */

const TRES_AULAS: HorarioDeAula[] = [
  { numero: 1, data: "2026-02-03", diaDaSemana: 2, horario: "07:00" },
  { numero: 2, data: "2026-02-03", diaDaSemana: 2, horario: "07:50" },
  { numero: 3, data: "2026-02-05", diaDaSemana: 4, horario: "09:40" },
];

/** Habilidades REAIS do 7º ano de Matemática (existem no catálogo extraído). */
const PERMITIDAS = new Set(["EF07MA01", "EF07MA13"]);

const aulaDoModelo = (n: number, extra: Partial<Aula> = {}): Partial<Aula> => ({
  numero: n,
  tema: `Tema ${n}`,
  objetivo: "Resolver problemas com números inteiros.",
  habilidades: ["EF07MA01"],
  conteudo: "Números inteiros.",
  momentos: {
    retomada: { o_que: "Retoma a aula anterior.", minutos: 5 },
    desenvolvimento: { o_que: "Resolve em duplas.", minutos: 30 },
    sistematizacao: { o_que: "Registro no caderno.", minutos: 10 },
    fechamento: { o_que: "Síntese oral.", minutos: 5 },
  },
  recursos: ["quadro", "caderno"],
  avaliacao: "Observa se resolve sem apoio.",
  tarefaDeCasa: "Exercícios 1 a 5.",
  adaptacoes: "",
  ...extra,
});

describe("o esqueleto é do calendário, não do modelo", () => {
  it("preserva número, data, dia e horário reais", () => {
    const aulas = costurarAulas([aulaDoModelo(1), aulaDoModelo(2), aulaDoModelo(3)], TRES_AULAS, PERMITIDAS);
    expect(aulas).toHaveLength(3);
    expect(aulas.map((a) => [a.numero, a.data, a.horario])).toEqual([
      [1, "2026-02-03", "07:00"],
      [2, "2026-02-03", "07:50"],
      [3, "2026-02-05", "09:40"],
    ]);
  });

  it("descarta a sobra quando o modelo inventa aulas a mais", () => {
    // O erro mais comum: o modelo devolve dez aulas porque dez é redondo.
    const dez = Array.from({ length: 10 }, (_, i) => aulaDoModelo(i + 1));
    const aulas = costurarAulas(dez, TRES_AULAS, PERMITIDAS);
    expect(aulas).toHaveLength(3);
  });

  it("completa em branco quando o modelo devolve aulas a menos", () => {
    // Degrada para "planejar à mão", não para uma semana incompleta em silêncio.
    const aulas = costurarAulas([aulaDoModelo(1)], TRES_AULAS, PERMITIDAS);
    expect(aulas).toHaveLength(3);
    expect(aulas[0]!.tema).toBe("Tema 1");
    expect(aulas[1]!.tema).toBe("");
    expect(aulas[2]!.momentos.desenvolvimento).toEqual({ o_que: "", minutos: 0 });
  });

  it("casa pela ORDEM quando o modelo ignora a numeração", () => {
    const semNumero = [
      { ...aulaDoModelo(1), numero: undefined },
      { ...aulaDoModelo(2), numero: undefined },
      { ...aulaDoModelo(3), numero: undefined },
    ];
    const aulas = costurarAulas(semNumero, TRES_AULAS, PERMITIDAS);
    expect(aulas.map((a) => a.tema)).toEqual(["Tema 1", "Tema 2", "Tema 3"]);
    expect(aulas.map((a) => a.numero)).toEqual([1, 2, 3]);
  });

  it("não deixa o modelo renumerar nem redatar a aula", () => {
    const mentiroso = [aulaDoModelo(1, { numero: 99, data: "2026-12-25", horario: "23:00" } as never)];
    const aulas = costurarAulas(mentiroso, [TRES_AULAS[0]!], PERMITIDAS);
    expect(aulas[0]!.numero).toBe(1);
    expect(aulas[0]!.data).toBe("2026-02-03");
    expect(aulas[0]!.horario).toBe("07:00");
  });

  it("sobrevive a uma resposta vazia ou lixo", () => {
    expect(costurarAulas([], TRES_AULAS, PERMITIDAS)).toHaveLength(3);
    expect(costurarAulas([{}, {}, {}], TRES_AULAS, PERMITIDAS)).toHaveLength(3);
  });
});

describe("a barreira contra habilidade inventada", () => {
  it("remove código que não existe na BNCC", () => {
    // `EF67LP42` não existe. Num plano anual entregue à coordenação, ele chega
    // como erro do professor — e é por isso que há três barreiras, não uma.
    const aulas = costurarAulas(
      [aulaDoModelo(1, { habilidades: ["EF07MA01", "EF67LP42"] })],
      [TRES_AULAS[0]!],
      new Set(["EF07MA01", "EF67LP42"]),
    );
    expect(aulas[0]!.habilidades).toEqual(["EF07MA01"]);
  });

  it("remove código real que está FORA do recorte do período", () => {
    // Existe na BNCC, mas é de outro componente: o professor não o distribuiu.
    const aulas = costurarAulas(
      [aulaDoModelo(1, { habilidades: ["EF07MA01", "EF67LP08"] })],
      [TRES_AULAS[0]!],
      PERMITIDAS,
    );
    expect(aulas[0]!.habilidades).toEqual(["EF07MA01"]);
  });

  it("normaliza caixa e espaço, e não repete o mesmo código", () => {
    const aulas = costurarAulas(
      [aulaDoModelo(1, { habilidades: [" ef07ma01 ", "EF07MA01", "EF07MA13"] })],
      [TRES_AULAS[0]!],
      PERMITIDAS,
    );
    expect(aulas[0]!.habilidades).toEqual(["EF07MA01", "EF07MA13"]);
  });

  it("aceita aula sem habilidade — retomada e avaliação são honestas assim", () => {
    const aulas = costurarAulas(
      [aulaDoModelo(1, { habilidades: [] })],
      [TRES_AULAS[0]!],
      PERMITIDAS,
    );
    expect(aulas[0]!.habilidades).toEqual([]);
  });
});

describe("saneamento dos campos", () => {
  it("troca ausente por string vazia, nunca undefined", () => {
    const aulas = costurarAulas([{ numero: 1 }], [TRES_AULAS[0]!], PERMITIDAS);
    const a = aulas[0]!;
    for (const campo of ["tema", "objetivo", "conteudo", "avaliacao", "tarefaDeCasa", "adaptacoes"] as const) {
      expect(a[campo]).toBe("");
    }
    expect(a.recursos).toEqual([]);
  });

  it("corta minutos absurdos em vez de aceitar erro de unidade", () => {
    // 3000 é a aula em segundos; -5 é um sinal trocado. Os dois quebrariam a
    // soma de tempo que a tela mostra ao professor.
    const aulas = costurarAulas(
      [
        aulaDoModelo(1, {
          momentos: {
            retomada: { o_que: "a", minutos: 3000 },
            desenvolvimento: { o_que: "b", minutos: -5 },
            sistematizacao: { o_que: "c", minutos: 10.6 },
            fechamento: { o_que: "d", minutos: Number.NaN },
          },
        }),
      ],
      [TRES_AULAS[0]!],
      PERMITIDAS,
    );
    const m = aulas[0]!.momentos;
    expect(m.retomada.minutos).toBe(120);
    expect(m.desenvolvimento.minutos).toBe(0);
    expect(m.sistematizacao.minutos).toBe(11);
    expect(m.fechamento.minutos).toBe(0);
  });

  it("nunca aceita `cumprida` ou o registro do professor vindos do modelo", () => {
    // São o registro do que aconteceu na aula. Se a IA pudesse preenchê-los, o
    // plano nasceria "dado" e o instrumento deixaria de medir qualquer coisa.
    const aulas = costurarAulas(
      [aulaDoModelo(1, { cumprida: true, observacaoDoProfessor: "correu bem" })],
      [TRES_AULAS[0]!],
      PERMITIDAS,
    );
    expect(aulas[0]!.cumprida).toBe(false);
    expect(aulas[0]!.observacaoDoProfessor).toBe("");
  });
});
