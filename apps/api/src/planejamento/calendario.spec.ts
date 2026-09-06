import {
  periodosDoAnoLetivo,
  janelasDePlanejamento,
  aulasDaJanela,
  conferirGrade,
  segundaDaSemana,
  diaDaSemanaDe,
  somarDias,
  type FaixaDeHorario,
} from "./calendario";

describe("data civil, sem escorregar de fuso", () => {
  it("lê o dia da semana igual em qualquer fuso do Brasil", () => {
    // 2026-02-02 é uma segunda-feira. Se a implementação usasse hora local ou
    // meia-noite UTC, em UTC-3 isto viraria domingo — e a primeira aula do ano
    // letivo cairia no fim de semana.
    expect(diaDaSemanaDe("2026-02-02")).toBe(1);
    expect(diaDaSemanaDe("2026-02-08")).toBe(0);
  });

  it("atravessa a virada de mês e de ano", () => {
    expect(somarDias("2026-02-27", 2)).toBe("2026-03-01");
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
    // 2028 é bissexto: 28/02 + 1 = 29/02, não 01/03.
    expect(somarDias("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("põe o domingo na semana que acabou, não na que começa", () => {
    expect(segundaDaSemana("2026-02-04")).toBe("2026-02-02");
    expect(segundaDaSemana("2026-02-08")).toBe("2026-02-02");
    expect(segundaDaSemana("2026-02-09")).toBe("2026-02-09");
  });
});

describe("períodos de avaliação", () => {
  it("divide o ano em 4 bimestres de 10 semanas", () => {
    const p = periodosDoAnoLetivo("2026-02-02", "bimestral");
    expect(p).toHaveLength(4);
    expect(p[0]!).toMatchObject({ ordem: 1, rotulo: "1º Bimestre", inicio: "2026-02-02" });
    // 10 semanas = 70 dias; o bimestre fecha no domingo da 10ª semana.
    expect(p[0]!.fim).toBe("2026-04-12");
    expect(p[1]!.inicio).toBe("2026-04-13");
  });

  it("empurra a sobra da divisão para o último período", () => {
    // 40 semanas em 3 trimestres: 13 + 13 + 14. A sobra vai para o fim porque
    // é o período que absorve a recuperação final.
    const p = periodosDoAnoLetivo("2026-02-02", "trimestral");
    expect(p).toHaveLength(3);
    const semanas = p.map(
      (x) => (Date.parse(x.fim) - Date.parse(x.inicio)) / (7 * 86400000) + 1 / 7,
    );
    expect(semanas.map(Math.round)).toEqual([13, 13, 14]);
  });

  it("começa sempre numa segunda, mesmo se o ano letivo abre numa quarta", () => {
    const p = periodosDoAnoLetivo("2026-02-04", "bimestral");
    expect(diaDaSemanaDe(p[0]!.inicio)).toBe(1);
    // Nenhum período termina no meio de uma semana: todos fecham no domingo.
    for (const x of p) expect(diaDaSemanaDe(x.fim)).toBe(0);
  });

  it("não deixa buraco nem sobreposição entre períodos", () => {
    const p = periodosDoAnoLetivo("2026-02-02", "bimestral");
    for (let i = 1; i < p.length; i++) {
      expect(p[i]!.inicio).toBe(somarDias(p[i - 1]!.fim, 1));
    }
  });
});

describe("janelas de planejamento", () => {
  const periodos = periodosDoAnoLetivo("2026-02-02", "bimestral");

  it("gera 40 semanas no ano letivo", () => {
    const j = janelasDePlanejamento(periodos, "semanal");
    expect(j).toHaveLength(40);
    expect(j[0]!).toMatchObject({ ordem: 1, inicio: "2026-02-02", periodoDeAvaliacao: 1 });
    expect(j[39]!.periodoDeAvaliacao).toBe(4);
  });

  it("gera 20 quinzenas, e a que atravessa o bimestre fica no que ela começou", () => {
    const j = janelasDePlanejamento(periodos, "quinzenal");
    expect(j).toHaveLength(20);
    // 10 semanas por bimestre = 5 quinzenas exatas, então a 6ª abre o 2º
    // bimestre. Com trimestre de 13 semanas a conta não fecha, e é aí que a
    // regra "pertence ao período em que começou" importa.
    expect(j[4]!.periodoDeAvaliacao).toBe(1);
    expect(j[5]!.periodoDeAvaliacao).toBe(2);
  });

  it("classifica a quinzena que cruza a virada do trimestre pelo início", () => {
    const tri = periodosDoAnoLetivo("2026-02-02", "trimestral");
    const j = janelasDePlanejamento(tri, "quinzenal");
    // 13 semanas = 6 quinzenas e meia: a 7ª quinzena começa no 1º trimestre e
    // termina no 2º. Ela é do primeiro.
    const cruzando = j.find((x) => x.inicio <= tri[0]!.fim && x.fim > tri[0]!.fim);
    expect(cruzando?.periodoDeAvaliacao).toBe(1);
  });

  it("não passa do fim do ano letivo", () => {
    const j = janelasDePlanejamento(periodos, "quinzenal");
    expect(j[j.length - 1]!.fim).toBe(periodos[periodos.length - 1]!.fim);
  });
});

describe("aulas datadas a partir da grade", () => {
  const grade: FaixaDeHorario[] = [
    { diaDaSemana: 2, horarios: ["07:00", "07:50"] },
    { diaDaSemana: 4, horarios: ["09:40"] },
  ];
  const [semana1] = janelasDePlanejamento(periodosDoAnoLetivo("2026-02-02", "bimestral"), "semanal");

  it("data cada aula no dia certo, na ordem cronológica", () => {
    const aulas = aulasDaJanela(semana1!, grade);
    expect(aulas).toHaveLength(3);
    expect(aulas[0]!).toMatchObject({ numero: 1, data: "2026-02-03", diaDaSemana: 2, horario: "07:00" });
    expect(aulas[1]!).toMatchObject({ numero: 2, data: "2026-02-03", horario: "07:50" });
    expect(aulas[2]!).toMatchObject({ numero: 3, data: "2026-02-05", diaDaSemana: 4 });
  });

  it("dá o dobro de aulas na quinzena", () => {
    const [q1] = janelasDePlanejamento(periodosDoAnoLetivo("2026-02-02", "bimestral"), "quinzenal");
    expect(aulasDaJanela(q1!, grade)).toHaveLength(6);
  });

  it("nunca põe aula em sábado ou domingo", () => {
    const comFimDeSemana = [...grade, { diaDaSemana: 6 as never, horarios: ["08:00"] }];
    const aulas = aulasDaJanela(semana1!, comFimDeSemana);
    expect(aulas.every((a) => a.diaDaSemana >= 1 && a.diaDaSemana <= 5)).toBe(true);
  });

  it("remove o feriado em vez de empurrar a aula para outro dia", () => {
    // Empurrar deslocaria o plano inteiro e desalinharia todas as janelas
    // seguintes. Repor é decisão do professor, não conta do sistema.
    const aulas = aulasDaJanela(semana1!, grade, ["2026-02-03"]);
    expect(aulas).toHaveLength(1);
    expect(aulas[0]!.data).toBe("2026-02-05");
    expect(aulas[0]!.numero).toBe(1);
  });

  it("devolve vazio quando a grade está em dias que a janela não cobre", () => {
    expect(aulasDaJanela(semana1!, [{ diaDaSemana: 1, horarios: [] }])).toEqual([]);
  });
});

describe("coerência entre grade e carga declarada", () => {
  it("acusa a grade que não bate com as aulas semanais", () => {
    const grade: FaixaDeHorario[] = [
      { diaDaSemana: 2, horarios: ["07:00"] },
      { diaDaSemana: 4, horarios: ["07:00"] },
    ];
    // O erro clássico: declara 5 aulas, marca 2. Sem aviso, o plano anual
    // dimensiona 200 aulas e o de período entrega 2 por semana.
    expect(conferirGrade(grade, 5)).toEqual({ total: 2, coerente: false });
    expect(conferirGrade(grade, 2)).toEqual({ total: 2, coerente: true });
  });
});
