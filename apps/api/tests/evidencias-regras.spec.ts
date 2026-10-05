import type { FichaPedagogica } from "../src/evidencias/fichas";
import {
  NIVEL,
  STATUS,
  STATUS_DE_MARCA,
  copiasDesejadas,
  decidirCopia,
  diferencaDasCopias,
  ehProjecao,
  embaralhar,
  marcadorDaFicha,
  marcadoresDaPergunta,
  melhor,
  melhorRodadaPorHabilidade,
  statusProprio,
  validarFicha,
  type CopiaExistente,
  type Nivel,
} from "../src/evidencias/regras";

/**
 * As regras PURAS da evidência pedagógica (E14) — sem banco.
 *
 * O que se prova aqui é o que decide o nível que o professor lê: a escala, a
 * melhor de duas marcas, a melhor rodada por habilidade, a precedência
 * (professor > própria > equipe), o `nao_participou` que barra a cópia e some
 * do perfil, a projeção que espera revisão — e o recálculo quando as equipes
 * mudam.
 */

describe("a escala", () => {
  test("atingiu > em_processo > nao_atingiu, e nao_participou fica FORA da escala", () => {
    expect(NIVEL.atingiu).toBeGreaterThan(NIVEL.em_processo);
    expect(NIVEL.em_processo).toBeGreaterThan(NIVEL.nao_atingiu);
    expect([...STATUS_DE_MARCA]).toEqual(["atingiu", "em_processo", "nao_atingiu"]);
    expect([...STATUS]).toEqual(["atingiu", "em_processo", "nao_atingiu", "nao_participou"]);
    expect(Object.keys(NIVEL)).not.toContain("nao_participou");
  });

  test("`melhor` é comutativo, e N/A (null) perde para qualquer nível", () => {
    const niveis: (Nivel | null)[] = [null, "nao_atingiu", "em_processo", "atingiu"];
    for (const a of niveis) for (const b of niveis) expect(melhor(a, b)).toBe(melhor(b, a));
    expect(melhor(null, "nao_atingiu")).toBe("nao_atingiu");
    expect(melhor("em_processo", "atingiu")).toBe("atingiu");
    expect(melhor("em_processo", "nao_atingiu")).toBe("em_processo");
    expect(melhor(null, null)).toBeNull();
  });

  test("dois marcadores da mesma habilidade na mesma rodada: vale o MELHOR", () => {
    /* A ação saiu em processo; a pergunta, atingiu. */
    expect(statusProprio([{ status: "em_processo" }, { status: "atingiu" }])).toBe("atingiu");
    expect(statusProprio([{ status: "nao_atingiu" }, { status: "em_processo" }])).toBe("em_processo");
    expect(statusProprio([])).toBeNull();
  });
});

describe("o resultado da atividade: a melhor rodada POR HABILIDADE", () => {
  test("X melhor na rodada 1, Y melhor na rodada 2 → as duas ficam com o melhor", () => {
    const r = melhorRodadaPorHabilidade([
      { habilidade: "X", status: "atingiu", situacao: "valida" },
      { habilidade: "Y", status: "nao_atingiu", situacao: "valida" },
      { habilidade: "X", status: "em_processo", situacao: "valida" },
      { habilidade: "Y", status: "atingiu", situacao: "valida" },
    ]);
    expect(Object.fromEntries(r)).toEqual({ X: "atingiu", Y: "atingiu" });
  });

  test("a projeção `a_revisar` NÃO conta; confirmada, conta", () => {
    expect(melhorRodadaPorHabilidade([{ habilidade: "X", status: "atingiu", situacao: "a_revisar" }]).size).toBe(0);
    expect(
      Object.fromEntries(melhorRodadaPorHabilidade([{ habilidade: "X", status: "atingiu", situacao: "valida" }])),
    ).toEqual({ X: "atingiu" });
  });

  test("`nao_participou` é N/A no perfil: sozinho, a habilidade some; com um nível em outra rodada, fica o nível", () => {
    expect(
      melhorRodadaPorHabilidade([{ habilidade: "X", status: "nao_participou", situacao: "valida" }]).size,
    ).toBe(0);
    expect(
      Object.fromEntries(
        melhorRodadaPorHabilidade([
          { habilidade: "X", status: "nao_participou", situacao: "valida" },
          { habilidade: "X", status: "nao_atingiu", situacao: "valida" },
        ]),
      ),
    ).toEqual({ X: "nao_atingiu" });
  });
});

describe("a cópia para o colega de equipe (`decidirCopia`)", () => {
  const equipe = { status: "em_processo" as const, projecao: false };

  test("sem nada: grava como `equipe`, já valendo", () => {
    expect(decidirCopia({ temMarcaPropria: false, atual: null }, equipe)).toEqual({
      gravar: true,
      status: "em_processo",
      origem: "equipe",
      situacao: "valida",
    });
  });

  test("colega com marca PRÓPRIA não é sobrescrito", () => {
    expect(decidirCopia({ temMarcaPropria: true, atual: null }, equipe)).toEqual({ gravar: false });
  });

  test("PRECEDÊNCIA: o ajuste do professor e a linha própria nunca são sobrescritos — nem por uma cópia melhor", () => {
    for (const origem of ["professor", "propria"] as const) {
      expect(
        decidirCopia(
          { temMarcaPropria: false, atual: { status: "nao_atingiu", origem, situacao: "valida" } },
          { status: "atingiu", projecao: false },
        ),
      ).toEqual({ gravar: false });
    }
  });

  test("`nao_participou` BARRA a cópia (é ajuste do professor)", () => {
    expect(
      decidirCopia(
        { temMarcaPropria: false, atual: { status: "nao_participou", origem: "professor", situacao: "valida" } },
        { status: "atingiu", projecao: false },
      ),
    ).toEqual({ gravar: false });
  });

  test("entre duas fontes da mesma equipe fica a MELHOR — igual ou pior não reescreve", () => {
    const atual = { status: "em_processo" as const, origem: "equipe" as const, situacao: "valida" as const };
    expect(decidirCopia({ temMarcaPropria: false, atual }, { status: "nao_atingiu", projecao: false })).toEqual({
      gravar: false,
    });
    expect(decidirCopia({ temMarcaPropria: false, atual }, { status: "em_processo", projecao: false })).toEqual({
      gravar: false,
    });
    expect(decidirCopia({ temMarcaPropria: false, atual }, { status: "atingiu", projecao: false })).toMatchObject({
      gravar: true,
      status: "atingiu",
    });
  });

  test("na PROJEÇÃO a cópia nasce `projecao`/`a_revisar`", () => {
    expect(decidirCopia({ temMarcaPropria: false, atual: null }, { status: "atingiu", projecao: true })).toEqual({
      gravar: true,
      status: "atingiu",
      origem: "projecao",
      situacao: "a_revisar",
    });
  });
});

describe("a projeção", () => {
  const turma = ["a", "b", "c", "d"];

  test("um computador só é projeção, com qualquer equipe", () => {
    expect(ehProjecao({ computadores: 1, membros: ["a", "b"], estudantesDaTurma: turma })).toBe(true);
  });

  test("a equipe com a turma INTEIRA é projeção, com qualquer número de computadores", () => {
    expect(ehProjecao({ computadores: 3, membros: ["d", "c", "b", "a"], estudantesDaTurma: turma })).toBe(true);
  });

  test("equipe menor que a turma, com mais de um computador, não é", () => {
    expect(ehProjecao({ computadores: 2, membros: ["a", "b"], estudantesDaTurma: turma })).toBe(false);
    expect(ehProjecao({ computadores: null, membros: ["a", "b", "c"], estudantesDaTurma: turma })).toBe(false);
  });
});

describe("o recálculo quando as equipes mudam", () => {
  const proprios = new Map<string, Map<string, Nivel>>([
    ["ana", new Map<string, Nivel>([["X", "atingiu"], ["Y", "nao_atingiu"]])],
    ["bia", new Map<string, Nivel>([["Y", "em_processo"]])],
  ]);

  test("cada equipe copia a MELHOR fonte de cada habilidade, para quem não tem marca própria", () => {
    const copias = copiasDesejadas({
      equipes: [{ id: "e1", membros: ["ana", "bia", "caio"] }],
      proprios,
      bloqueados: new Set(),
      projecao: () => false,
    });
    const resumo = copias.map((c) => [c.estudanteId, c.habilidade, c.status, c.fonteEstudanteId]);
    expect(resumo).toEqual([
      ["bia", "X", "atingiu", "ana"],
      ["caio", "X", "atingiu", "ana"],
      ["caio", "Y", "em_processo", "bia"],
    ]);
  });

  test("quem está bloqueado (ajuste, `nao_participou`) não recebe; equipe sem fonte não copia", () => {
    const copias = copiasDesejadas({
      equipes: [
        { id: "e1", membros: ["ana", "caio"] },
        { id: "e2", membros: ["duda", "enzo"] },
      ],
      proprios,
      bloqueados: new Set(["caio|X"]),
      projecao: () => false,
    });
    expect(copias.map((c) => [c.estudanteId, c.habilidade])).toEqual([["caio", "Y"]]);
  });

  test("na projeção, as cópias nascem a revisar", () => {
    const copias = copiasDesejadas({
      equipes: [{ id: "e1", membros: ["ana", "caio"] }],
      proprios,
      bloqueados: new Set(),
      projecao: () => true,
    });
    expect(copias.every((c) => c.origem === "projecao" && c.situacao === "a_revisar")).toBe(true);
  });

  const existente = (e: Partial<CopiaExistente>): CopiaExistente => ({
    id: "id-1",
    estudanteId: "caio",
    habilidade: "X",
    status: "atingiu",
    origem: "projecao",
    situacao: "valida",
    fonteEstudanteId: "ana",
    equipeId: "e-velha",
    ...e,
  });

  test("a cópia que não mudou de nível nem de origem FICA com a confirmação que tinha, e sem evento", () => {
    const d = diferencaDasCopias(
      [existente({})],
      [
        {
          estudanteId: "caio",
          habilidade: "X",
          status: "atingiu",
          origem: "projecao",
          situacao: "a_revisar",
          fonteEstudanteId: "ana",
          equipeId: "e-nova",
        },
      ],
    );
    expect(d.apagar).toEqual(["id-1"]);
    expect(d.gravar).toEqual([expect.objectContaining({ situacao: "valida", equipeId: "e-nova" })]);
    expect(d.mudancas).toEqual([]);
  });

  test("sai quem saiu da equipe, entra quem entrou, muda o que mudou — com de/para", () => {
    const d = diferencaDasCopias(
      [existente({ id: "sai", estudanteId: "duda" }), existente({ id: "muda", origem: "equipe", status: "em_processo" })],
      [
        {
          estudanteId: "caio",
          habilidade: "X",
          status: "atingiu",
          origem: "equipe",
          situacao: "valida",
          fonteEstudanteId: "ana",
          equipeId: "e2",
        },
        {
          estudanteId: "enzo",
          habilidade: "X",
          status: "atingiu",
          origem: "equipe",
          situacao: "valida",
          fonteEstudanteId: "ana",
          equipeId: "e2",
        },
      ],
    );
    expect(d.apagar.sort()).toEqual(["muda", "sai"]);
    expect(d.gravar.map((g) => g.estudanteId).sort()).toEqual(["caio", "enzo"]);
    expect(d.mudancas).toEqual([
      {
        estudanteId: "caio",
        habilidade: "X",
        de: { status: "em_processo", origem: "equipe", situacao: "valida" },
        para: { status: "atingiu", origem: "equipe", situacao: "valida" },
      },
      { estudanteId: "enzo", habilidade: "X", de: null, para: { status: "atingiu", origem: "equipe", situacao: "valida" } },
      { estudanteId: "duda", habilidade: "X", de: { status: "atingiu", origem: "projecao", situacao: "valida" }, para: null },
    ]);
  });
});

/** Um código da BNCC de verdade para os fixtures — o validador recebe o conjunto. */
const BNCC = new Set(["EF08CO01", "EF08CO02"]);

const fichaBoa = (): FichaPedagogica => ({
  expId: "exp08ef1b",
  versao: 1,
  habilidades: [
    {
      codigo: "EF08CO01",
      marcadores: [
        { id: "acao-1", tipo: "acao" },
        { id: "pergunta-1", tipo: "multipla_escolha", perguntaId: "p1" },
      ],
      criterios: { atingiu: "a", em_processo: "b", nao_atingiu: "c" },
    },
    {
      codigo: "EF08CO02",
      marcadores: [{ id: "pergunta-1b", tipo: "multipla_escolha", perguntaId: "p1" }],
      criterios: { atingiu: "a", em_processo: "b", nao_atingiu: "c" },
    },
  ],
  perguntas: [
    {
      id: "p1",
      enunciado: "Qual é a melhor atitude?",
      alternativas: [
        { id: "a", texto: "Checar a fonte", status: "atingiu" },
        { id: "b", texto: "Compartilhar", status: "nao_atingiu" },
      ],
    },
  ],
});

describe("a ficha", () => {
  test("a ficha boa passa, e acha marcador e pergunta", () => {
    const ficha = fichaBoa();
    expect(validarFicha(ficha, BNCC)).toEqual([]);
    expect(marcadorDaFicha(ficha, "pergunta-1")).toMatchObject({ habilidade: "EF08CO01" });
    expect(marcadorDaFicha(ficha, "nao-existe")).toBeNull();
    /* Uma pergunta pode medir duas habilidades: os dois marcadores respondem. */
    expect(marcadoresDaPergunta(ficha, "p1")).toEqual(["pergunta-1", "pergunta-1b"]);
  });

  test("o validador RECUSA de verdade: cada defeito vira uma frase", () => {
    const ruim: FichaPedagogica = {
      ...fichaBoa(),
      expId: "exp-01-instanooria",
      versao: 0,
      habilidades: [
        { codigo: "EF99XX99", marcadores: [{ id: "m", tipo: "acao" }], criterios: { atingiu: "a", em_processo: "b", nao_atingiu: "c" } },
        { codigo: "ef08co01", marcadores: [], criterios: { atingiu: "a", em_processo: " ", nao_atingiu: "c" } },
        {
          codigo: "EF08CO02",
          marcadores: [
            { id: "m", tipo: "acao" },
            { id: "sem-pergunta", tipo: "multipla_escolha", perguntaId: "p-fantasma" },
            { id: "acao-com-pergunta", tipo: "acao", perguntaId: "p1" },
          ],
          criterios: { atingiu: "a", em_processo: "b", nao_atingiu: "c" },
        },
      ],
      perguntas: [
        {
          id: "p1",
          enunciado: "",
          alternativas: [
            { id: "a", texto: "x", status: "talvez" as unknown as Nivel },
            { id: "a", texto: "", status: "atingiu" },
          ],
        },
        { id: "p2", enunciado: "Sozinha", alternativas: [{ id: "a", texto: "x", status: "atingiu" }] },
      ],
    };
    const erros = validarFicha(ruim, BNCC);
    const esperados = [
      "expId fora do formato",
      "versão tem de ser inteira",
      "EF99XX99 não é um código da BNCC",
      "ef08co01 não é um código da BNCC",
      "ef08co01 não tem marcador",
      'ef08co01 está sem o critério de "em_processo"',
      'o marcador "m" aparece mais de uma vez',
      'o marcador "sem-pergunta" aponta para uma pergunta que não existe',
      'o marcador de ação "acao-com-pergunta" não pode ter pergunta',
      'a pergunta "p1" está sem enunciado',
      'a pergunta "p1" não é corrigida por nenhum marcador',
      'a alternativa "a" de "p1" aparece mais de uma vez',
      'a alternativa "a" de "p1" está sem texto',
      'a alternativa "a" de "p1" tem um nível que não existe',
      'a pergunta "p2" precisa de pelo menos duas alternativas',
      'a pergunta "p2" não é corrigida por nenhum marcador',
    ];
    for (const trecho of esperados) {
      expect({ trecho, achou: erros.some((e) => e.includes(trecho)) }).toEqual({ trecho, achou: true });
    }
  });

  test("habilidade repetida e ficha sem habilidade", () => {
    const repetida: FichaPedagogica = {
      ...fichaBoa(),
      habilidades: [...fichaBoa().habilidades, { codigo: "EF08CO01", marcadores: [{ id: "outro", tipo: "acao" }], criterios: { atingiu: "a", em_processo: "b", nao_atingiu: "c" } }],
    };
    expect(validarFicha(repetida, BNCC).some((e) => e.includes("EF08CO01 aparece mais de uma vez"))).toBe(true);
    expect(
      validarFicha({ ...fichaBoa(), habilidades: [], perguntas: [] }, BNCC).some((e) => e.includes("nenhuma habilidade")),
    ).toBe(true);
  });
});

describe("a ordem das alternativas (embaralhar)", () => {
  /** Um gerador determinístico (mulberry32): o sorteio vira reproduzível. */
  function prng(semente: number): () => number {
    let a = semente >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  test("é uma permutação: os mesmos itens, nenhum a mais nem a menos, e a lista original intacta", () => {
    const original = ["A1", "A2", "A3", "A4"] as const;
    const saida = embaralhar(original, prng(1));
    expect([...saida].sort()).toEqual([...original]);
    expect(original).toEqual(["A1", "A2", "A3", "A4"]);
  });

  test("as 6 ordens de 3 alternativas aparecem, com frequência parecida", () => {
    const aleatorio = prng(42);
    const contagem = new Map<string, number>();
    for (let i = 0; i < 6000; i++) {
      const ordem = embaralhar(["A1", "A2", "A3"], aleatorio).join(",");
      contagem.set(ordem, (contagem.get(ordem) ?? 0) + 1);
    }
    expect(contagem.size).toBe(6);
    /* 1.000 esperadas por ordem; o viés do Fisher–Yates errado (troca com
       qualquer posição) passaria de 1.250 numa delas. */
    for (const n of contagem.values()) expect(Math.abs(n - 1000)).toBeLessThan(150);
  });

  test("com o sorteio travado nas pontas, nunca sai do índice nem perde item", () => {
    expect(embaralhar(["A1", "A2", "A3"], () => 0).sort()).toEqual(["A1", "A2", "A3"]);
    expect(embaralhar(["A1", "A2", "A3"], () => 0.9999999).sort()).toEqual(["A1", "A2", "A3"]);
    expect(embaralhar(["A1", "A2", "A3"], () => 1).sort()).toEqual(["A1", "A2", "A3"]);
    expect(embaralhar([], Math.random)).toEqual([]);
  });
});
