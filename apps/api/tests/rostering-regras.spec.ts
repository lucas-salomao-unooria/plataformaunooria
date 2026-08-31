import {
  gerarUsuario,
  normalizarPapel,
  normalizarSerie,
  normalizarTurno,
  periodoVigente,
  serieParaGrade,
} from "../src/rostering/regras";
import { lerPlanilha, modeloEmBranco } from "../src/rostering/planilha";
import { COLUNAS_MODELO } from "../src/rostering/catalogo";

describe("papéis", () => {
  test("coordenação, direção e os termos do OneRoster viram gestor", () => {
    for (const bruto of ["coordenacao", "Coordenação", "coordenador", "Diretora", "principal", "siteAdministrator"]) {
      expect(normalizarPapel(bruto)).toBe("gestor");
    }
  });

  test("docente/teacher viram professor; estudante/student/estudante viram estudante", () => {
    expect(normalizarPapel("Docente")).toBe("professor");
    expect(normalizarPapel("teacher")).toBe("professor");
    expect(normalizarPapel("estudante")).toBe("estudante");
    expect(normalizarPapel("student")).toBe("estudante");
    expect(normalizarPapel("estudante")).toBe("estudante");
  });

  test("papel desconhecido devolve null — quem chama transforma em linha de relatório", () => {
    expect(normalizarPapel("responsavel")).toBeNull();
    expect(normalizarPapel("guardian")).toBeNull();
    expect(normalizarPapel("")).toBeNull();
  });
});

describe("séries", () => {
  test("aceita a forma da casa, a extensão do padrão e o vocabulário CEDS", () => {
    expect(normalizarSerie("8EF")).toBe("8EF");
    expect(normalizarSerie("8ef")).toBe("8EF");
    expect(normalizarSerie("ext:8EF")).toBe("8EF");
    expect(normalizarSerie("08")).toBe("8EF");
    expect(normalizarSerie("8")).toBe("8EF");
  });

  test("10, 11 e 12 são as três séries do ensino médio", () => {
    expect(normalizarSerie("10")).toBe("1EM");
    expect(normalizarSerie("12")).toBe("3EM");
    expect(serieParaGrade("3EM")).toBe("12");
    expect(serieParaGrade("1EF")).toBe("01");
  });

  test("série que não existe não vira palpite", () => {
    expect(normalizarSerie("13")).toBeNull();
    expect(normalizarSerie("pré")).toBeNull();
  });
});

describe("turnos", () => {
  test("matutino/vespertino/noturno são aceitos", () => {
    expect(normalizarTurno("matutino")).toBe("manha");
    expect(normalizarTurno("Vespertino")).toBe("tarde");
    expect(normalizarTurno("noturno")).toBe("noite");
    expect(normalizarTurno("integral")).toBe("integral");
    expect(normalizarTurno("qualquer")).toBeNull();
  });
});

describe("geração de login", () => {
  test("primeiro nome + último sobrenome, sem acento", () => {
    expect(gerarUsuario("Ana Paula Ribeiro", new Set())).toBe("ana.ribeiro");
    expect(gerarUsuario("João Gonçalves", new Set())).toBe("joao.goncalves");
  });

  test("colisão ganha sufixo numérico em vez de sobrescrever alguém", () => {
    const usados = new Set(["ana.ribeiro", "ana.ribeiro2"]);
    expect(gerarUsuario("Ana Ribeiro", usados)).toBe("ana.ribeiro3");
  });

  test("nome curto ainda produz login válido (mínimo de 3 caracteres)", () => {
    expect(gerarUsuario("Ana", new Set()).length).toBeGreaterThanOrEqual(3);
  });
});

describe("período vigente", () => {
  const p = (titulo: string, ano: number) => ({
    titulo,
    inicio: new Date(Date.UTC(ano, 0, 1)),
    fim: new Date(Date.UTC(ano, 11, 31)),
  });

  test("o ano que contém a data de hoje", () => {
    const escolhido = periodoVigente([p("2025", 2025), p("2026", 2026)], new Date("2026-08-28"));
    expect(escolhido?.titulo).toBe("2026");
  });

  test("nenhum vigente cai no mais recente, em vez de devolver nada", () => {
    const escolhido = periodoVigente([p("2025", 2025), p("2026", 2026)], new Date("2027-03-01"));
    expect(escolhido?.titulo).toBe("2026");
  });
});

describe("leitura da planilha", () => {
  test("o modelo para download tem exatamente as colunas que o leitor conhece", () => {
    expect(modeloEmBranco().trim()).toBe(COLUNAS_MODELO.join(","));
    const leitura = lerPlanilha(`${modeloEmBranco()}`);
    expect(leitura.erros.map((e) => e.campo)).toEqual(["arquivo"]); // sem linhas de dados
  });

  test("cabeçalho é lido por nome: ordem trocada continua funcionando", () => {
    const leitura = lerPlanilha(["papel,nome,turma,serie", "estudante,Ana Lima,8A,8EF"].join("\n"));
    expect(leitura.erros).toEqual([]);
    expect(leitura.pessoas[0]).toMatchObject({ nome: "Ana Lima", papel: "estudante", turma: "8A" });
  });

  test("coluna desconhecida é erro de cabeçalho — não coluna ignorada em silêncio", () => {
    const leitura = lerPlanilha(["nome,papel,telefone", "Ana,estudante,11999999999"].join("\n"));
    expect(leitura.pessoas).toEqual([]);
    expect(leitura.erros[0]).toMatchObject({ campo: "header" });
  });

  test("cpf É coluna conhecida, e o dígito verificador é conferido na leitura", () => {
    const boa = lerPlanilha(["cpf,nome,papel", "529.982.247-25,Ana Lima,professor"].join("\n"));
    expect(boa.erros).toEqual([]);
    expect(boa.pessoas[0]?.cpf).toBe("52998224725"); // só os dígitos

    const ruim = lerPlanilha(["cpf,nome,papel", "529.982.247-26,Ana Lima,professor"].join("\n"));
    expect(ruim.erros[0]).toMatchObject({ campo: "cpf" });
  });

  test("estudante sem turma ou sem série volta com o campo que faltou", () => {
    const leitura = lerPlanilha(["nome,papel,turma,serie", "Ana Lima,estudante,,"].join("\n"));
    expect(leitura.erros.map((e) => e.campo).sort()).toEqual(["serie", "turma"]);
  });

  test("coordenação com turma vira AVISO, não erro — e a turma não é aplicada", () => {
    const leitura = lerPlanilha(["nome,papel,turma,serie", "Carlos Dias,coordenacao,8A,8EF"].join("\n"));
    expect(leitura.erros).toEqual([]);
    expect(leitura.avisos[0]).toMatchObject({ campo: "turma" });
    expect(leitura.pessoas[0]?.turma).toBe("");
  });

  test("o formato antigo continua sendo aceito", () => {
    const leitura = lerPlanilha(
      ["nome,usuario,senha,papel,turma,serie", "Ana Lima,ana.lima,senha1234,estudante,8A,8EF"].join("\n"),
    );
    expect(leitura.formato).toBe("legado");
    expect(leitura.pessoas[0]).toMatchObject({ usuario: "ana.lima", senha: "senha1234" });
  });

  test("linha em branco no fim da planilha não é erro", () => {
    const leitura = lerPlanilha(["nome,papel", "Ana Lima,professor", ",", ""].join("\n"));
    expect(leitura.erros).toEqual([]);
    expect(leitura.pessoas).toHaveLength(1);
  });
});
