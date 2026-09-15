import {
  periodosDoAnoLetivo,
  semanasDoAnoLetivo,
  aulasDaSemana,
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

describe("semanas de planejamento", () => {
  const periodos = periodosDoAnoLetivo("2026-02-02", "bimestral");

  it("gera 40 semanas no ano letivo", () => {
    const s = semanasDoAnoLetivo(periodos);
    expect(s).toHaveLength(40);
    expect(s[0]!).toMatchObject({ ordem: 1, inicio: "2026-02-02", periodoDeAvaliacao: 1 });
    expect(s[39]!.periodoDeAvaliacao).toBe(4);
  });

  it("chama a semana de semana, com a ordem que o professor lê na lista", () => {
    // O rótulo vai para o cabeçalho do .doc que a coordenação recebe, e ele já
    // divergiu: a lista dizia "3ª Semana" e o documento, "3ª janela".
    const s = semanasDoAnoLetivo(periodos);
    expect(s[0]!.rotulo).toBe("1ª Semana");
    expect(s[2]!.rotulo).toBe("3ª Semana");
  });

  it("nenhuma semana atravessa a virada do período de avaliação", () => {
    // Os períodos são divididos em semanas fechadas, então cada semana pertence
    // a um período só — e é isso que faz a `ordem` da semana ser estável.
    for (const divisao of ["bimestral", "trimestral", "semestral"] as const) {
      const p = periodosDoAnoLetivo("2026-02-02", divisao);
      for (const s of semanasDoAnoLetivo(p)) {
        const dono = p.find((x) => s.inicio >= x.inicio && s.inicio <= x.fim);
        expect(s.fim <= dono!.fim).toBe(true);
        expect(s.periodoDeAvaliacao).toBe(dono!.ordem);
      }
    }
  });

  it("não deixa buraco entre semanas consecutivas", () => {
    const s = semanasDoAnoLetivo(periodos);
    for (let i = 1; i < s.length; i++) {
      expect(s[i]!.inicio).toBe(somarDias(s[i - 1]!.fim, 1));
    }
  });

  it("não passa do fim do ano letivo", () => {
    const s = semanasDoAnoLetivo(periodos);
    expect(s[s.length - 1]!.fim).toBe(periodos[periodos.length - 1]!.fim);
  });
});

describe("aulas datadas a partir da grade", () => {
  const grade: FaixaDeHorario[] = [
    { diaDaSemana: 2, horarios: ["07:00", "07:50"] },
    { diaDaSemana: 4, horarios: ["09:40"] },
  ];
  const [semana1] = semanasDoAnoLetivo(periodosDoAnoLetivo("2026-02-02", "bimestral"));

  it("data cada aula no dia certo, na ordem cronológica", () => {
    const aulas = aulasDaSemana(semana1!, grade);
    expect(aulas).toHaveLength(3);
    expect(aulas[0]!).toMatchObject({ numero: 1, data: "2026-02-03", diaDaSemana: 2, horario: "07:00" });
    expect(aulas[1]!).toMatchObject({ numero: 2, data: "2026-02-03", horario: "07:50" });
    expect(aulas[2]!).toMatchObject({ numero: 3, data: "2026-02-05", diaDaSemana: 4 });
  });

  it("nunca põe aula em sábado ou domingo", () => {
    const comFimDeSemana = [...grade, { diaDaSemana: 6 as never, horarios: ["08:00"] }];
    const aulas = aulasDaSemana(semana1!, comFimDeSemana);
    expect(aulas.every((a) => a.diaDaSemana >= 1 && a.diaDaSemana <= 5)).toBe(true);
  });

  it("remove o feriado em vez de empurrar a aula para outro dia", () => {
    // Empurrar deslocaria o plano inteiro e desalinharia todas as semanas
    // seguintes. Repor é decisão do professor, não conta do sistema.
    const aulas = aulasDaSemana(semana1!, grade, ["2026-02-03"]);
    expect(aulas).toHaveLength(1);
    expect(aulas[0]!.data).toBe("2026-02-05");
    expect(aulas[0]!.numero).toBe(1);
  });

  it("devolve vazio quando a grade está em dias que a semana não cobre", () => {
    expect(aulasDaSemana(semana1!, [{ diaDaSemana: 1, horarios: [] }])).toEqual([]);
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
