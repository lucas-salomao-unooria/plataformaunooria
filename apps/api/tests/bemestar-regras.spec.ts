import {
  CHECKINS_POR_CICLO,
  CORTES,
  ESCALA,
  ITENS,
  ITENS_POR_CHECKIN,
  SUBESCALAS,
  ABERTURAS_FIXAS,
  PERGUNTAS_FIXAS,
  ACOLHIMENTOS_FIXOS,
  MENSAGEM_DE_APOIO,
  type Resposta,
} from "../src/bemestar/catalogo";
import {
  diaDe,
  faixaDe,
  fixoPara,
  itensDoCheckin,
  montarOrdem,
  pontuar,
  respostasCasamComItens,
  resultadoDe,
  seedDe,
  sinalDeApoio,
  validarTextoDaIa,
} from "../src/bemestar/regras";
import { extrairJson } from "../src/bemestar/bemestar.service";

/** Regras puras do check-in de bem-estar (DASS-21) — sem banco. */

const todas = (valor: 0 | 1 | 2 | 3): Resposta[] => ITENS.map((i) => ({ item: i.numero, valor }));

describe("catálogo DASS-21", () => {
  test("21 itens únicos, 7 por subescala, mapeamento oficial dos itens", () => {
    expect(ITENS).toHaveLength(21);
    expect(new Set(ITENS.map((i) => i.numero)).size).toBe(21);
    const por = (s: string) => ITENS.filter((i) => i.subescala === s).map((i) => i.numero);
    expect(por("depressao")).toEqual([3, 5, 10, 13, 16, 17, 21]);
    expect(por("ansiedade")).toEqual([2, 4, 7, 9, 15, 19, 20]);
    expect(por("estresse")).toEqual([1, 6, 8, 11, 12, 14, 18]);
    expect(ESCALA.map((e) => e.valor)).toEqual([0, 1, 2, 3]);
    expect(ITENS_POR_CHECKIN * CHECKINS_POR_CICLO).toBe(21);
  });

  test("os textos fixos passam nos próprios guardrails da IA", () => {
    for (const t of ABERTURAS_FIXAS) expect(validarTextoDaIa("abertura", t)).toMatchObject({ ok: true });
    for (const t of PERGUNTAS_FIXAS) expect(validarTextoDaIa("pergunta", t)).toMatchObject({ ok: true });
    for (const t of ACOLHIMENTOS_FIXOS) expect(validarTextoDaIa("acolhimento", t)).toMatchObject({ ok: true });
    expect(MENSAGEM_DE_APOIO.recursos[0]!.detalhe).toContain("188");
  });
});

describe("ordem do ciclo", () => {
  test("permutação de 1..21 com um item de cada subescala por check-in", () => {
    for (const seed of [1, 42, seedDe("prof-a:2026-08-25"), 0xffffffff]) {
      const ordem = montarOrdem(seed);
      expect([...ordem].sort((a, b) => a - b)).toEqual(ITENS.map((i) => i.numero));
      for (let n = 1; n <= CHECKINS_POR_CICLO; n += 1) {
        const itens = itensDoCheckin(ordem, n);
        expect(itens).toHaveLength(3);
        expect(new Set(itens.map((i) => i.subescala))).toEqual(new Set(SUBESCALAS));
      }
    }
  });

  test("determinística pelo seed e diferente entre seeds", () => {
    expect(montarOrdem(7)).toEqual(montarOrdem(7));
    expect(montarOrdem(7)).not.toEqual(montarOrdem(8));
    expect(seedDe("a")).not.toBe(seedDe("b"));
  });

  test("check-in fora de 1..7 é erro de programação", () => {
    expect(() => itensDoCheckin(montarOrdem(1), 0)).toThrow();
    expect(() => itensDoCheckin(montarOrdem(1), 8)).toThrow();
  });

  test("respostas precisam cobrir exatamente os itens do dia", () => {
    expect(respostasCasamComItens([{ item: 1, valor: 0 }, { item: 2, valor: 1 }, { item: 3, valor: 2 }], [3, 1, 2])).toBe(true);
    expect(respostasCasamComItens([{ item: 1, valor: 0 }, { item: 1, valor: 1 }, { item: 3, valor: 2 }], [3, 1, 2])).toBe(false);
    expect(respostasCasamComItens([{ item: 1, valor: 0 }, { item: 2, valor: 1 }, { item: 4, valor: 2 }], [3, 1, 2])).toBe(false);
    expect(respostasCasamComItens([{ item: 1, valor: 0 }, { item: 2, valor: 1 }], [3, 1, 2])).toBe(false);
  });
});

describe("pontuação e faixas", () => {
  test("soma por subescala ×2: tudo 0 → 0; tudo 3 → 42", () => {
    expect(pontuar(todas(0))).toEqual({ depressao: 0, ansiedade: 0, estresse: 0 });
    expect(pontuar(todas(3))).toEqual({ depressao: 42, ansiedade: 42, estresse: 42 });
  });

  test("ciclo incompleto não pontua", () => {
    expect(() => pontuar(todas(1).slice(0, 20))).toThrow(/incompleto/);
  });

  test("faixas de corte publicadas (limites inferiores)", () => {
    expect(faixaDe("depressao", 9)).toBe("normal");
    expect(faixaDe("depressao", 10)).toBe("leve");
    expect(faixaDe("depressao", 14)).toBe("moderado");
    expect(faixaDe("depressao", 21)).toBe("severo");
    expect(faixaDe("depressao", 28)).toBe("extremamente-severo");
    expect(faixaDe("ansiedade", 7)).toBe("normal");
    expect(faixaDe("ansiedade", 8)).toBe("leve");
    expect(faixaDe("ansiedade", 10)).toBe("moderado");
    expect(faixaDe("ansiedade", 15)).toBe("severo");
    expect(faixaDe("ansiedade", 20)).toBe("extremamente-severo");
    expect(faixaDe("estresse", 14)).toBe("normal");
    expect(faixaDe("estresse", 15)).toBe("leve");
    expect(faixaDe("estresse", 19)).toBe("moderado");
    expect(faixaDe("estresse", 26)).toBe("severo");
    expect(faixaDe("estresse", 34)).toBe("extremamente-severo");
    for (const s of SUBESCALAS) expect([...CORTES[s]]).toEqual([...CORTES[s]].sort((a, b) => a - b));
  });

  test("resultado de um ciclo misto", () => {
    // depressão 1 em cada item (7×2=14 → moderado), ansiedade 0, estresse 3 (42).
    const respostas: Resposta[] = ITENS.map((i) => ({
      item: i.numero,
      valor: i.subescala === "depressao" ? 1 : i.subescala === "estresse" ? 3 : 0,
    }));
    const r = resultadoDe(pontuar(respostas));
    expect(r).toMatchObject({ depressao: 14, ansiedade: 0, estresse: 42 });
    expect(r.faixas).toEqual({ depressao: "moderado", ansiedade: "normal", estresse: "extremamente-severo" });
  });
});

describe("sinal de apoio", () => {
  test("item sentinela (17 ou 21) ≥ 2 acende; < 2 não", () => {
    expect(sinalDeApoio([{ item: 21, valor: 2 }, { item: 1, valor: 0 }, { item: 2, valor: 0 }])).toBe(true);
    expect(sinalDeApoio([{ item: 17, valor: 3 }])).toBe(true);
    expect(sinalDeApoio([{ item: 21, valor: 1 }, { item: 17, valor: 1 }, { item: 13, valor: 3 }])).toBe(false);
  });

  test("termo de risco no texto livre acende (sem acento, maiúsculas)", () => {
    expect(sinalDeApoio([], "Semana corrida, mas ok.")).toBe(false);
    expect(sinalDeApoio([], "NÃO AGUENTO MAIS isso")).toBe(true);
    expect(sinalDeApoio([], "às vezes queria sumir")).toBe(true);
    expect(sinalDeApoio([], "pensei em me machucar")).toBe(true);
  });
});

describe("guardrails do texto da IA", () => {
  test("aceita texto dentro do escopo e normaliza espaços", () => {
    expect(validarTextoDaIa("abertura", "  Sexta-feira chegou.\n Um minuto para você antes da sala. ")).toEqual({
      ok: true,
      texto: "Sexta-feira chegou. Um minuto para você antes da sala.",
    });
    expect(validarTextoDaIa("pergunta", "Se quiser, o que mais pesou na sua semana?")).toMatchObject({ ok: true });
  });

  test("recusa vocabulário clínico, ordens, promessas, gestão, links e markup", () => {
    const casos: Array<[Parameters<typeof validarTextoDaIa>[0], string]> = [
      ["abertura", "Vamos medir sua ansiedade de hoje em três frases rápidas."],
      ["abertura", "Sinais de depressão aparecem em semanas assim, fique atento."],
      ["acolhimento", "Entendo. Você deve procurar um psicólogo o quanto antes, isso ajuda."],
      ["acolhimento", "Fica tranquilo, isso vai passar e tudo vai ficar bem em breve."],
      ["acolhimento", "Vou avisar a coordenação para que te ajudem com a carga horária."],
      ["acolhimento", "Sua pontuação de hoje ficou boa, continue assim nas próximas semanas."],
      ["acolhimento", "Leia mais em https://exemplo.com/ajuda para lidar com semanas difíceis."],
      ["abertura", "<b>Bom dia</b>, professor. Um minuto para você antes da aula."],
    ];
    for (const [tipo, texto] of casos) expect(validarTextoDaIa(tipo, texto)).toMatchObject({ ok: false });
  });

  test("tamanho e formato: pergunta termina com ?, abertura não pergunta duas vezes", () => {
    expect(validarTextoDaIa("pergunta", "Como foi o seu dia hoje, de verdade")).toMatchObject({ ok: false });
    expect(validarTextoDaIa("abertura", "Oi.")).toMatchObject({ ok: false });
    expect(validarTextoDaIa("abertura", "x".repeat(200))).toMatchObject({ ok: false });
    expect(validarTextoDaIa("abertura", "Como está? E a semana? Comece pelas três frases abaixo.")).toMatchObject({ ok: false });
    expect(validarTextoDaIa("abertura", 42)).toMatchObject({ ok: false });
  });
});

describe("utilitários", () => {
  test("dia no fuso do contrato (23h30 em SP ainda é o mesmo dia; 02h UTC é o dia anterior em SP)", () => {
    expect(diaDe(new Date("2026-08-25T23:30:00-03:00"))).toBe("2026-08-25");
    expect(diaDe(new Date("2026-08-26T02:00:00Z"))).toBe("2026-08-25");
    expect(diaDe(new Date("2026-08-26T03:00:00Z"))).toBe("2026-08-26");
  });

  test("fixoPara rotaciona pelo número do check-in", () => {
    expect(fixoPara(["a", "b", "c"], 1)).toBe("a");
    expect(fixoPara(["a", "b", "c"], 3)).toBe("c");
    expect(fixoPara(["a", "b", "c"], 4)).toBe("a");
    expect(fixoPara(["a", "b", "c"], 0)).toBe("a");
  });

  test("extrairJson tolera cerca de markdown e texto em volta", () => {
    expect(extrairJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(extrairJson('Claro! {"mensagem": "ok"} espero ter ajudado')).toEqual({ mensagem: "ok" });
    expect(() => extrairJson("[mock] resposta para: contexto")).toThrow();
  });
});
