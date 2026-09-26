import {
  colapsarEmUnidades,
  EXPERIENCIAS_COM_EQUIPE,
  MODOS,
  NOME_MAX,
  nomePadrao,
  permiteEquipes,
  propostaManual,
  rotulosSemRepeticao,
  sortear,
  tamanhos,
  validarMontagem,
  type EquipeDoMapa,
  type Lado,
  type Presente,
  type ResultadoDoSorteio,
} from "../src/equipes/regras";

/**
 * As regras PURAS das equipes na missão (E13, ADR-111) — sem banco.
 *
 * O que se prova aqui é o que decide quem senta com quem: o tamanho rígido, o
 * sorteio que não junta os dois lados do Instanooria na mesma tela (e conta
 * quando não consegue), a validação do que o professor montou e o colapso do
 * painel em uma unidade por computador.
 */

/** Gerador com semente (mulberry32): o sorteio fica determinístico no teste. */
function semente(s: number): () => number {
  let a = s >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pessoas = (prefixo: string, n: number, grupo: Lado | null = null): Presente[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefixo}${i + 1}`, grupo }));

const tamanhosDe = (r: ResultadoDoSorteio) => r.equipes.map((e) => e.membros.length);

/** Todo presente aparece exatamente uma vez — o sorteio nunca perde nem duplica criança. */
function todosUmaVez(r: ResultadoDoSorteio, presentes: readonly Presente[]) {
  const ids = r.equipes.flatMap((e) => e.membros);
  expect([...ids].sort()).toEqual(presentes.map((p) => p.id).sort());
}

describe("as missões que aceitam equipe", () => {
  test("só as quatro conferidas", () => {
    expect([...EXPERIENCIAS_COM_EQUIPE]).toEqual(["exp08ef1b", "exp02em1b", "exp04ef1b", "exp07ef1b"]);
    expect(permiteEquipes("exp04ef1b")).toBe(true);
    expect(permiteEquipes("exp07ef1b")).toBe(true);
    expect(permiteEquipes("exp08ef4b")).toBe(false);
    expect(permiteEquipes("app-70-vila-do-lume")).toBe(false);
  });

  test("os dois modos e o nome padrão", () => {
    expect([...MODOS]).toEqual(["sorteio", "manual"]);
    expect(nomePadrao(0)).toBe("Equipe 1");
    expect(nomePadrao(9)).toBe("Equipe 10");
  });

});

/**
 * O QUE A CRIANÇA LÊ DOS COLEGAS: o primeiro nome, e o desempate só quando ele
 * repete. Os casos são os MESMOS de `apps/hub/lib/equipes.test.ts`
 * (`rotulosCurtos`), com as mesmas respostas — as duas escadas são cópias, e é
 * este par de testes que segura a divergência (ver `rotulosSemRepeticao`).
 */
describe("os rótulos sem repetição", () => {
  /** Os rótulos, na ordem dos nomes. */
  const rotulosDe = (...nomes: string[]) => {
    const rotulos = rotulosSemRepeticao(nomes.map((nome, i) => ({ id: `p${i}`, nome })));
    return nomes.map((_, i) => rotulos.get(`p${i}`));
  };
  /** Nenhum rótulo repete — sem caixa e sem acento, como a criança lê. */
  const semRepetir = (rotulos: (string | undefined)[]) => {
    const chaves = rotulos.map((r) => r?.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase());
    expect(new Set(chaves).size).toBe(rotulos.length);
  };

  test("sem empate, só o primeiro nome — sem espaço sobrando", () => {
    expect(rotulosDe("  Ana Clara Souza ", "Bia", "Caio Reis")).toEqual(["Ana", "Bia", "Caio"]);
    expect(rotulosDe("")).toEqual([""]);
  });

  test("o primeiro nome que repete ganha a inicial do último sobrenome, e só ele", () => {
    const rotulos = rotulosSemRepeticao([
      { id: "a", nome: "Ana Souza" },
      { id: "m1", nome: "Maria Clara Santos" },
      { id: "m2", nome: "maria Oliveira" },
    ]);
    expect(rotulos.get("a")).toBe("Ana");
    expect(rotulos.get("m1")).toBe("Maria S.");
    expect(rotulos.get("m2")).toBe("maria O.");
  });

  test("mesma inicial do sobrenome: sobe para o último sobrenome inteiro (as Gabrielas da 4B do seed)", () => {
    const rotulos = rotulosDe(
      "Gabriela Almeida Cardoso",
      "Gabriela Ribeiro Correia",
      "Beatriz Almeida Souza",
      "Beatriz Santana Correia",
    );
    expect(rotulos).toEqual(["Gabriela Cardoso", "Gabriela Correia", "Beatriz S.", "Beatriz C."]);
    semRepetir(rotulos);
  });

  test("três com o mesmo primeiro nome: só quem continua empatado sobe", () => {
    const rotulos = rotulosDe("Gabriela Almeida Cardoso", "Gabriela Ribeiro Correia", "Gabriela Souza", "Ana Souza");
    expect(rotulos).toEqual(["Gabriela Cardoso", "Gabriela Correia", "Gabriela S.", "Ana"]);
    semRepetir(rotulos);
  });

  test("empate a três no último sobrenome: entram as iniciais do meio, e o nome inteiro só em último caso", () => {
    const rotulos = rotulosDe("Maria Clara Santos", "Maria Cecília Santos", "Maria Luiza Santos", "Maria Souza");
    expect(rotulos).toEqual(["Maria Clara Santos", "Maria Cecília Santos", "Maria L. Santos", "Maria Souza"]);
    semRepetir(rotulos);
  });

  test("partícula do sobrenome não vira inicial", () => {
    expect(rotulosDe("Ana Maria de Souza", "Ana Paula de Souza")).toEqual(["Ana M. Souza", "Ana P. Souza"]);
  });

  test("acento não desempata: Lívia e Livia, Álvares e Alves", () => {
    const livias = rotulosDe("Lívia Carvalho Lopes", "Livia Costa Lima");
    expect(livias).toEqual(["Lívia Lopes", "Livia Lima"]);
    semRepetir(livias);
    const anas = rotulosDe("Ana Álvares", "Ana Alves");
    expect(anas).toEqual(["Ana Álvares", "Ana Alves"]);
    semRepetir(anas);
  });

  test("nome sem sobrenome fica como está, e o outro sobe", () => {
    expect(rotulosDe("Gabriela", "Gabriela Cardoso")).toEqual(["Gabriela", "Gabriela C."]);
  });

  test("homônimo perfeito não sobe à toa — só quando há um nome diferente no empate", () => {
    expect(rotulosDe("Ana Souza", "Ana Souza", "Bruno Lima")).toEqual(["Ana", "Ana", "Bruno"]);
    expect(rotulosDe("Ana Souza", "Ana Souza", "Ana Silva")).toEqual(["Ana Souza", "Ana Souza", "Ana Silva"]);
  });

  test("a mesma pessoa duas vezes na lista conta uma vez só", () => {
    const rotulos = rotulosSemRepeticao([
      { id: "a", nome: "Ana Souza" },
      { id: "a", nome: "Ana Souza" },
      { id: "a2", nome: "Ana Lima" },
    ]);
    expect(rotulos.get("a")).toBe("Ana S.");
    expect(rotulos.get("a2")).toBe("Ana L.");
  });
});

describe("tamanhos", () => {
  test("25 em 10 computadores: cinco de 3 e cinco de 2, os maiores primeiro", () => {
    expect(tamanhos(25, 10)).toEqual([3, 3, 3, 3, 3, 2, 2, 2, 2, 2]);
  });

  test("os tamanhos nunca diferem em mais de 1, e somam n", () => {
    for (let n = 1; n <= 40; n++) {
      for (let k = 1; k <= 45; k++) {
        const t = tamanhos(n, k);
        expect(t.reduce((s, x) => s + x, 0)).toBe(n);
        expect(Math.max(...t) - Math.min(...t)).toBeLessThanOrEqual(1);
        expect(t.length).toBe(Math.min(n, k));
      }
    }
  });

  test("computador sobrando não vira equipe vazia; zero computador vira um", () => {
    expect(tamanhos(3, 10)).toEqual([1, 1, 1]);
    expect(tamanhos(5, 0)).toEqual([5]);
    expect(tamanhos(0, 5)).toEqual([]);
  });
});

describe("o sorteio sem lados", () => {
  test("25 presentes em 10 computadores: os tamanhos são os de `tamanhos`", () => {
    const presentes = pessoas("e", 25);
    const r = sortear(presentes, 10, semente(1));
    expect(tamanhosDe(r)).toEqual([3, 3, 3, 3, 3, 2, 2, 2, 2, 2]);
    expect(r.equipes.map((e) => e.nome)).toEqual(
      Array.from({ length: 10 }, (_, i) => `Equipe ${i + 1}`),
    );
    todosUmaVez(r, presentes);
    expect(r.equipesMistas).toBe(0);
    expect(r.equipes.every((e) => e.grupo === null && !e.mista)).toBe(true);
  });

  test("quem faltou não entra: o chamador tira os ausentes antes de sortear", () => {
    const turma = pessoas("e", 25);
    const ausentes = new Set(["e3", "e7", "e20"]);
    const r = sortear(
      turma.filter((p) => !ausentes.has(p.id)),
      10,
      semente(2),
    );
    const sorteados = new Set(r.equipes.flatMap((e) => e.membros));
    expect(sorteados.size).toBe(22);
    for (const id of ausentes) expect(sorteados.has(id)).toBe(false);
    expect(tamanhosDe(r)).toEqual(tamanhos(22, 10));
  });

  test("computadores = presentes: cada um no seu computador", () => {
    const r = sortear(pessoas("e", 6), 6, semente(3));
    expect(tamanhosDe(r)).toEqual([1, 1, 1, 1, 1, 1]);
  });

  test("mais computadores que presentes: limita, sem equipe vazia", () => {
    const r = sortear(pessoas("e", 4), 30, semente(4));
    expect(r.equipes).toHaveLength(4);
    expect(tamanhosDe(r)).toEqual([1, 1, 1, 1]);
  });

  test("ninguém presente: nenhuma equipe", () => {
    expect(sortear([], 5, semente(5))).toEqual({ equipes: [], equipesMistas: 0 });
  });

  test("com a mesma semente, o mesmo sorteio; com outra, outro", () => {
    const presentes = pessoas("e", 25);
    expect(sortear(presentes, 10, semente(42))).toEqual(sortear(presentes, 10, semente(42)));
    expect(sortear(presentes, 10, semente(42))).not.toEqual(sortear(presentes, 10, semente(43)));
  });
});

describe("o sorteio com os lados do Instanooria", () => {
  /** Todo membro COM lado tem o lado da equipe — é o que "não mista" quer dizer. */
  const ladoCoerente = (r: ResultadoDoSorteio, presentes: readonly Presente[]) => {
    const lado = new Map(presentes.map((p) => [p.id, p.grupo ?? null]));
    for (const e of r.equipes) {
      const lados = e.membros.map((id) => lado.get(id)).filter((g): g is Lado => g != null);
      if (lados.length === 0) expect(e.grupo).toBeNull();
      else expect(lados.every((g) => g === e.grupo)).toBe(true);
    }
  };

  test("12 A + 8 B + 5 neutros em 10 computadores: nenhuma equipe mista, em qualquer semente", () => {
    const presentes = [...pessoas("a", 12, "A"), ...pessoas("b", 8, "B"), ...pessoas("n", 5)];
    for (let s = 1; s <= 30; s++) {
      const r = sortear(presentes, 10, semente(s));
      expect(r.equipesMistas).toBe(0);
      expect(r.equipes.some((e) => e.mista)).toBe(false);
      expect([...tamanhosDe(r)].sort().reverse()).toEqual(tamanhos(25, 10));
      todosUmaVez(r, presentes);
      ladoCoerente(r, presentes);
    }
  });

  test("os de um lado se espalham: com 12 A em 6 equipes, duas crianças de A em cada", () => {
    const presentes = [...pessoas("a", 12, "A"), ...pessoas("b", 8, "B"), ...pessoas("n", 5)];
    const r = sortear(presentes, 10, semente(7));
    const ladoA = r.equipes.filter((e) => e.grupo === "A");
    expect(ladoA).toHaveLength(6);
    for (const e of ladoA) {
      expect(e.membros.filter((id) => id.startsWith("a"))).toHaveLength(2);
    }
  });

  test("13 A + 15 B em 7 computadores de 4: a aritmética não fecha, e é UMA mista, contada", () => {
    const presentes = [...pessoas("a", 13, "A"), ...pessoas("b", 15, "B")];
    for (let s = 1; s <= 30; s++) {
      const r = sortear(presentes, 7, semente(s));
      expect(tamanhosDe(r)).toEqual([4, 4, 4, 4, 4, 4, 4]);
      expect(r.equipesMistas).toBe(1);
      expect(r.equipes.filter((e) => e.mista)).toHaveLength(1);
      todosUmaVez(r, presentes);
      /* A mista tem 3 de B e 1 de A: o lado dela é o da maioria. */
      const mista = r.equipes.find((e) => e.mista);
      expect(mista?.grupo).toBe("B");
    }
  });

  test("um lado só: nenhuma mista, e toda equipe com gente de lado é daquele lado", () => {
    const presentes = [...pessoas("a", 10, "A"), ...pessoas("n", 5)];
    const r = sortear(presentes, 5, semente(8));
    expect(r.equipesMistas).toBe(0);
    expect(r.equipes.every((e) => e.grupo === "A")).toBe(true);
    ladoCoerente(r, presentes);
  });

  test("o lado da equipe não é o nome: as de A não são sempre as primeiras", () => {
    const presentes = [...pessoas("a", 10, "A"), ...pessoas("b", 10, "B")];
    const primeiras = new Set<string>();
    for (let s = 1; s <= 10; s++) {
      const r = sortear(presentes, 4, semente(s));
      primeiras.add(r.equipes.map((e) => e.grupo).join(""));
    }
    expect(primeiras.size).toBeGreaterThan(1);
  });

  test("determinístico com semente, também com lados", () => {
    const presentes = [...pessoas("a", 13, "A"), ...pessoas("b", 15, "B"), ...pessoas("n", 3)];
    expect(sortear(presentes, 8, semente(99))).toEqual(sortear(presentes, 8, semente(99)));
  });
});

describe("o modo manual", () => {
  const presentes = [
    { id: "e1", nome: "Ana" },
    { id: "e2", nome: "Bia" },
    { id: "e3", nome: "Caio" },
    { id: "e4", nome: "Duda" },
    { id: "e5", nome: "Enzo" },
  ];

  test("N equipes vazias, e todo mundo esperando para ser arrastado", () => {
    const p = propostaManual(presentes, 3);
    expect(p.equipes).toEqual([
      { nome: "Equipe 1", membros: [] },
      { nome: "Equipe 2", membros: [] },
      { nome: "Equipe 3", membros: [] },
    ]);
    expect(p.semEquipe).toEqual(presentes);
  });

  test("limita a [1, n]", () => {
    expect(propostaManual(presentes, 50).equipes).toHaveLength(5);
    expect(propostaManual(presentes, 0).equipes).toHaveLength(1);
  });

  test("sem presentes, nenhuma equipe", () => {
    expect(propostaManual([], 4)).toEqual({ equipes: [], semEquipe: [] });
  });
});

describe("validar a montagem", () => {
  const turma = new Set(["e1", "e2", "e3", "e4"]);
  const ok = {
    ausentes: ["e4"],
    equipes: [
      { nome: "Equipe 1", membros: ["e1", "e2"] },
      { nome: "Equipe 2", membros: ["e3"] },
    ],
  };

  test("a montagem certa não tem erro", () => {
    expect(validarMontagem(ok, turma)).toEqual([]);
  });

  test("nenhuma equipe", () => {
    expect(validarMontagem({ ausentes: [], equipes: [] }, turma)).toEqual([
      "Monte pelo menos uma equipe.",
    ]);
  });

  test("membro de fora da turma", () => {
    const erros = validarMontagem(
      { ausentes: [], equipes: [{ nome: "Equipe 1", membros: ["e1", "intruso"] }] },
      turma,
    );
    expect(erros).toEqual(['A equipe "Equipe 1" tem alguém que não é desta turma.']);
  });

  test("ausente de fora da turma", () => {
    const erros = validarMontagem({ ...ok, ausentes: ["intruso"] }, turma);
    expect(erros).toEqual(["A lista de ausentes tem alguém que não é desta turma."]);
  });

  test("estudante em duas equipes, e repetido na mesma", () => {
    expect(
      validarMontagem(
        {
          ausentes: [],
          equipes: [
            { nome: "Equipe 1", membros: ["e1"] },
            { nome: "Equipe 2", membros: ["e1"] },
          ],
        },
        turma,
      ),
    ).toEqual(['Há um estudante em duas equipes ("Equipe 1" e "Equipe 2").']);
    expect(
      validarMontagem({ ausentes: [], equipes: [{ nome: "Equipe 1", membros: ["e1", "e1"] }] }, turma),
    ).toEqual(['Há um estudante repetido na equipe "Equipe 1".']);
  });

  test("ausente dentro de uma equipe", () => {
    const erros = validarMontagem({ ...ok, ausentes: ["e3"] }, turma);
    expect(erros).toEqual(['Há um estudante marcado como ausente dentro da equipe "Equipe 2".']);
  });

  test("nome vazio (depois do trim), longo demais e repetido sem distinguir maiúsculas", () => {
    expect(
      validarMontagem({ ausentes: [], equipes: [{ nome: "   ", membros: ["e1"] }] }, turma),
    ).toEqual(["A equipe na posição 1 está sem nome."]);

    const longo = "x".repeat(NOME_MAX + 1);
    expect(
      validarMontagem({ ausentes: [], equipes: [{ nome: longo, membros: ["e1"] }] }, turma),
    ).toEqual([`O nome "${longo}" passa de ${NOME_MAX} caracteres.`]);
    expect(
      validarMontagem(
        { ausentes: [], equipes: [{ nome: "x".repeat(NOME_MAX), membros: ["e1"] }] },
        turma,
      ),
    ).toEqual([]);

    expect(
      validarMontagem(
        {
          ausentes: [],
          equipes: [
            { nome: "Azul", membros: ["e1"] },
            { nome: " azul ", membros: ["e2"] },
          ],
        },
        turma,
      ),
    ).toEqual(['Há mais de uma equipe chamada "azul".']);

    /* Duas equipes com o MESMO nome continuam sendo duas: a criança nas duas
       está em duas equipes, e não "repetida na mesma". */
    expect(
      validarMontagem(
        {
          ausentes: [],
          equipes: [
            { nome: "Azul", membros: ["e1"] },
            { nome: "Azul", membros: ["e1"] },
          ],
        },
        turma,
      ),
    ).toEqual([
      'Há mais de uma equipe chamada "Azul".',
      'Há um estudante em duas equipes ("Azul" e "Azul").',
    ]);
  });

  test("equipe sem ninguém", () => {
    expect(
      validarMontagem(
        {
          ausentes: [],
          equipes: [
            { nome: "Equipe 1", membros: ["e1"] },
            { nome: "Equipe 2", membros: [] },
          ],
        },
        turma,
      ),
    ).toEqual(['A equipe "Equipe 2" está sem ninguém.']);
  });

  test("todos os problemas de uma vez, e não o primeiro", () => {
    const erros = validarMontagem(
      {
        ausentes: ["e2"],
        equipes: [
          { nome: "", membros: [] },
          { nome: "Equipe 2", membros: ["e2", "fora"] },
        ],
      },
      turma,
    );
    expect(erros).toEqual([
      "A equipe na posição 1 está sem nome.",
      "A equipe na posição 1 está sem ninguém.",
      'A equipe "Equipe 2" tem alguém que não é desta turma.',
      'Há um estudante marcado como ausente dentro da equipe "Equipe 2".',
    ]);
  });
});

describe("o painel contado por computador", () => {
  type Linha = { id: string; iniciou: boolean; quando: number };
  const linha = (id: string, iniciou = false, quando = 0): Linha => ({ id, iniciou, quando });

  const verde: EquipeDoMapa = {
    id: "eq-verde",
    nome: "Verde",
    membros: [
      { id: "ana", nome: "Ana" },
      { id: "bia", nome: "Bia" },
      { id: "caio", nome: "Caio" },
    ],
  };
  const mapa = new Map(verde.membros.map((m) => [m.id, verde]));

  const colapsar = (linhas: Linha[], comRecencia = true) =>
    colapsarEmUnidades(
      linhas,
      (l) => l.id,
      mapa,
      (l) => l.iniciou,
      comRecencia ? (l) => l.quando : undefined,
    );

  test("a equipe vira UMA unidade, representada por quem iniciou", () => {
    const [unidade, ...resto] = colapsar([linha("ana"), linha("bia", true, 10), linha("caio")]);
    expect(resto).toHaveLength(0);
    expect(unidade?.chave).toBe("equipe:eq-verde");
    expect(unidade?.equipe).toBe(verde);
    expect(unidade?.linha.id).toBe("bia");
    expect(unidade?.linhas.map((l) => l.id)).toEqual(["ana", "bia", "caio"]);
  });

  test("dois iniciaram: vale o mais recente — o computador que trocou de login", () => {
    const [unidade] = colapsar([linha("ana", true, 5), linha("bia", true, 20), linha("caio", true, 10)]);
    expect(unidade?.linha.id).toBe("bia");
  });

  test("sem recência, vale o primeiro que iniciou", () => {
    const [unidade] = colapsar([linha("ana"), linha("bia", true, 5), linha("caio", true, 20)], false);
    expect(unidade?.linha.id).toBe("bia");
  });

  test("ninguém iniciou: a primeira linha da equipe", () => {
    const [unidade] = colapsar([linha("caio"), linha("ana")]);
    expect(unidade?.linha.id).toBe("caio");
  });

  test("quem não tem equipe fica sozinho, e a ordem é a da primeira aparição", () => {
    const unidades = colapsar([
      linha("duda", true, 1),
      linha("ana"),
      linha("enzo"),
      linha("caio", true, 3),
    ]);
    expect(unidades.map((u) => u.chave)).toEqual([
      "estudante:duda",
      "equipe:eq-verde",
      "estudante:enzo",
    ]);
    expect(unidades[0]?.equipe).toBeNull();
    expect(unidades[1]?.linha.id).toBe("caio");
    expect(unidades[2]?.linha.id).toBe("enzo");
  });

  test("sem equipe nenhuma, o painel é o de antes: uma unidade por criança", () => {
    const unidades = colapsarEmUnidades(
      [linha("ana"), linha("bia")],
      (l) => l.id,
      new Map(),
      (l) => l.iniciou,
    );
    expect(unidades.map((u) => u.chave)).toEqual(["estudante:ana", "estudante:bia"]);
  });
});
