import { FICHA_EXP08EF1B } from "../src/evidencias/fichas/exp08ef1b";
import { problemaDosTiposDeTese } from "../src/geracao/prompts/personas";
import {
  criteriosDoEnvio,
  medeConfiabilidade,
  montarEnvio,
  nivelDoEnvio,
  type PostDoEnvio,
} from "../src/motor/canal-a/envio";
import { comporRaioX, gabaritoDoPost, nivelDoRaioX, type PostDoAcervo } from "../src/motor/canal-a/raio-x";
import { marcadasSemRepeticao, nivelDosTermos } from "../src/motor/canal-a/termos";
import {
  CLAUSULAS,
  MENSAGENS,
  TERMOS_DA_ENTRADA,
  termosDaEntrada,
  type ClausulaId,
  type OpcaoDoRaioX,
} from "../src/motor/canal-a/vocabulario";

/**
 * As regras PURAS do Canal A da exp08ef1b (ADR-167) — sem banco.
 *
 * O que se prova: a composição do Raio-x (só posts vistos, a regra dos 3, os
 * casos de falta, o post em que mais parou sempre dentro, `null` quando não
 * fecha), as três réguas EXAUSTIVAMENTE (toda combinação cai em um nível), as
 * réguas do PO validadas em 2026-10-21 (ADR-179), a montagem dos 9 posts do
 * envio sem lado, os termos da entrada com as 5 cláusulas, e a ficha v3.
 */

// ── 6a Raio-x ────────────────────────────────────────────────────────────

let n = 0;
const post = (lado: string, extra: Partial<PostDoAcervo> = {}): PostDoAcervo => ({
  id: `p${++n}`,
  lado,
  intensidade: 2,
  categoria: lado === "neutro" ? "tema" : "x",
  aprovado: true,
  ...extra,
});

function acervo(qtd: { A: number; B: number; neutro: number; foraDoTema?: number }) {
  const posts = [
    ...Array.from({ length: qtd.A }, () => post("A")),
    ...Array.from({ length: qtd.B }, () => post("B")),
    ...Array.from({ length: qtd.neutro }, () => post("neutro")),
    ...Array.from({ length: qtd.foraDoTema ?? 0 }, () => post("neutro", { categoria: "lanche" })),
  ];
  return posts;
}

const todosVistos = (posts: PostDoAcervo[]) => Object.fromEntries(posts.map((p) => [p.id, 1]));

function contar(ids: string[], posts: PostDoAcervo[]) {
  const porId = new Map(posts.map((p) => [p.id, p]));
  const c = { A: 0, B: 0, neutro: 0 };
  for (const id of ids) c[gabaritoDoPost(porId.get(id)!.lado)] += 1;
  return c;
}

describe("o Raio-x: quais posts entram", () => {
  test("o caso comum: 2 do lado dele (com o que mais parou), 2 do outro, 2 neutros sobre o tema", () => {
    const posts = acervo({ A: 6, B: 4, neutro: 3, foraDoTema: 3 });
    const maisParou = posts[3]!.id;
    const c = comporRaioX({
      posts,
      vistosPorPost: todosVistos(posts),
      dwellPorPost: { [maisParou]: 9000 },
      ladoDele: "A",
      semente: "run-1",
    })!;
    expect(c.postIds).toHaveLength(6);
    expect(c.maisParou).toBe(maisParou);
    expect(c.postIds).toContain(maisParou);
    expect(contar(c.postIds, posts)).toEqual({ A: 2, B: 2, neutro: 2 });
    /* Fora do tema nunca entra. */
    const foraDoTema = posts.filter((p) => p.categoria === "lanche").map((p) => p.id);
    expect(c.postIds.some((id) => foraDoTema.includes(id))).toBe(false);
  });

  test("do OUTRO lado, só entra post que ele VIU — o que nunca ficou na tela fica de fora", () => {
    const posts = acervo({ A: 3, B: 3, neutro: 3 });
    const vistos = todosVistos(posts);
    const naoVisto = posts.find((p) => p.lado === "B")!.id;
    delete vistos[naoVisto];
    const c = comporRaioX({ posts, vistosPorPost: vistos, dwellPorPost: {}, ladoDele: "A", semente: "s" })!;
    expect(c.postIds).not.toContain(naoVisto);
  });

  test("do outro lado, os mais sutis (menor intensidade) entre os vistos", () => {
    const posts = [
      ...acervo({ A: 3, B: 0, neutro: 2 }),
      post("B", { intensidade: 3 }),
      post("B", { intensidade: 1 }),
      post("B", { intensidade: 1 }),
    ];
    const c = comporRaioX({ posts, vistosPorPost: todosVistos(posts), dwellPorPost: {}, ladoDele: "A", semente: "s" })!;
    const sutis = posts.filter((p) => p.lado === "B" && p.intensidade === 1).map((p) => p.id);
    expect(c.postIds.filter((id) => sutis.includes(id))).toHaveLength(2);
  });

  test("atividade sem neutro sobre o tema: 3 de cada lado", () => {
    const posts = acervo({ A: 4, B: 4, neutro: 0, foraDoTema: 4 });
    const c = comporRaioX({ posts, vistosPorPost: todosVistos(posts), dwellPorPost: {}, ladoDele: "B", semente: "s" })!;
    expect(contar(c.postIds, posts)).toEqual({ A: 3, B: 3, neutro: 0 });
  });

  test("viu menos de 2 neutros: completa com o outro lado até 3, e depois com o lado dele até 3", () => {
    const posts = acervo({ A: 5, B: 3, neutro: 1 });
    const c = comporRaioX({ posts, vistosPorPost: todosVistos(posts), dwellPorPost: {}, ladoDele: "A", semente: "s" })!;
    expect(contar(c.postIds, posts)).toEqual({ A: 2, B: 3, neutro: 1 });
    const semOutro = acervo({ A: 5, B: 2, neutro: 1 });
    const d = comporRaioX({ posts: semOutro, vistosPorPost: todosVistos(semOutro), dwellPorPost: {}, ladoDele: "A", semente: "s" })!;
    expect(contar(d.postIds, semOutro)).toEqual({ A: 3, B: 2, neutro: 1 });
  });

  test("viu menos de 2 do outro lado: completa com neutros até 3, e depois com o lado dele até 3", () => {
    const posts = acervo({ A: 5, B: 1, neutro: 3 });
    const c = comporRaioX({ posts, vistosPorPost: todosVistos(posts), dwellPorPost: {}, ladoDele: "A", semente: "s" })!;
    expect(contar(c.postIds, posts)).toEqual({ A: 2, B: 1, neutro: 3 });
    const poucos = acervo({ A: 5, B: 1, neutro: 2 });
    const d = comporRaioX({ posts: poucos, vistosPorPost: todosVistos(poucos), dwellPorPost: {}, ladoDele: "A", semente: "s" })!;
    expect(contar(d.postIds, poucos)).toEqual({ A: 3, B: 1, neutro: 2 });
  });

  test("a regra dos 3 vale em toda composição: nenhuma resposta certa mais de 3 vezes", () => {
    for (let a = 0; a <= 6; a++)
      for (let b = 0; b <= 6; b++)
        for (let ne = 0; ne <= 6; ne++) {
          const posts = acervo({ A: a, B: b, neutro: ne });
          const c = comporRaioX({ posts, vistosPorPost: todosVistos(posts), dwellPorPost: {}, ladoDele: "A", semente: `${a}${b}${ne}` });
          if (!c) continue;
          const conta = contar(c.postIds, posts);
          expect(c.postIds).toHaveLength(6);
          expect(new Set(c.postIds).size).toBe(6);
          expect(Math.max(conta.A, conta.B, conta.neutro)).toBeLessThanOrEqual(3);
          expect(c.postIds).toContain(c.maisParou);
          expect(posts.find((p) => p.id === c.maisParou)!.lado).toBe("A");
        }
  });

  test("viu pouco: completa com posts NÃO vistos do lado dele e neutros, nunca do outro lado (ADR-179)", () => {
    const posts = acervo({ A: 6, B: 6, neutro: 6 });
    /* Rolou quase nada: viu 1 do lado dele e 1 do outro. */
    const dele = posts.find((p) => p.lado === "A")!.id;
    const outro = posts.find((p) => p.lado === "B")!.id;
    const c = comporRaioX({ posts, vistosPorPost: { [dele]: 1, [outro]: 1 }, dwellPorPost: { [dele]: 4000 }, ladoDele: "A", semente: "s" })!;
    expect(c.postIds).toHaveLength(6);
    expect(c.maisParou).toBe(dele);
    const doOutroLado = c.postIds.filter((id) => posts.find((p) => p.id === id)!.lado === "B");
    expect(doOutroLado).toEqual([outro]);
    expect(Math.max(...Object.values(contar(c.postIds, posts)))).toBeLessThanOrEqual(3);
  });

  test("não viu NADA do lado dele: ainda compõe, com o lado dele tirado do acervo", () => {
    const posts = acervo({ A: 4, B: 4, neutro: 4 });
    const c = comporRaioX({ posts, vistosPorPost: {}, dwellPorPost: {}, ladoDele: "A", semente: "s" })!;
    expect(c.postIds).toHaveLength(6);
    expect(contar(c.postIds, posts)).toEqual({ A: 3, B: 0, neutro: 3 });
  });

  test("com vistos suficientes, nenhum post não visto entra", () => {
    const posts = acervo({ A: 6, B: 6, neutro: 6 });
    const vistos = Object.fromEntries(
      [...posts.filter((p) => p.lado === "A").slice(0, 2), ...posts.filter((p) => p.lado === "B").slice(0, 2), ...posts.filter((p) => p.lado === "neutro").slice(0, 2)].map((p) => [p.id, 1]),
    );
    const c = comporRaioX({ posts, vistosPorPost: vistos, dwellPorPost: {}, ladoDele: "A", semente: "s" })!;
    expect(c.postIds.every((id) => vistos[id])).toBe(true);
  });

  test("não fecha 6 nem completando, sem lado, ou sem post nenhum do lado dele: o Raio-x não aparece", () => {
    const pouco = acervo({ A: 3, B: 1, neutro: 1 });
    expect(comporRaioX({ posts: pouco, vistosPorPost: todosVistos(pouco), dwellPorPost: {}, ladoDele: "A", semente: "s" })).toBeNull();
    const ok = acervo({ A: 3, B: 3, neutro: 3 });
    expect(comporRaioX({ posts: ok, vistosPorPost: todosVistos(ok), dwellPorPost: {}, ladoDele: null, semente: "s" })).toBeNull();
    const semDele = acervo({ A: 0, B: 3, neutro: 3 });
    expect(comporRaioX({ posts: semDele, vistosPorPost: todosVistos(semDele), dwellPorPost: {}, ladoDele: "A", semente: "s" })).toBeNull();
  });

  test("a mesma sessão dá a mesma composição; outra sessão, outra ordem", () => {
    const posts = acervo({ A: 6, B: 6, neutro: 6 });
    const entrada = { posts, vistosPorPost: todosVistos(posts), dwellPorPost: {}, ladoDele: "A" as const };
    expect(comporRaioX({ ...entrada, semente: "x" })).toEqual(comporRaioX({ ...entrada, semente: "x" }));
    const ordens = new Set(["a", "b", "c", "d", "e"].map((s) => comporRaioX({ ...entrada, semente: s })!.postIds.join()));
    expect(ordens.size).toBeGreaterThan(1);
  });
});

describe("o Raio-x: a régua do PO (ADR-179, ajustada na ADR-180)", () => {
  const ids = ["p1", "p2", "p3", "p4", "p5", "p6"];
  const gabarito: Record<string, OpcaoDoRaioX> = { p1: "A", p2: "A", p3: "B", p4: "B", p5: "neutro", p6: "neutro" };
  const errar = (o: OpcaoDoRaioX): OpcaoDoRaioX => (o === "A" ? "B" : o === "B" ? "neutro" : "A");

  test("toda combinação de acertos cai em exatamente um nível: 5–6, 4, 0–3", () => {
    for (let mascara = 0; mascara < 64; mascara++) {
      const respostas = Object.fromEntries(
        ids.map((id, i) => [id, mascara & (1 << i) ? gabarito[id]! : errar(gabarito[id]!)]),
      ) as Record<string, OpcaoDoRaioX>;
      const { nivel, acertos } = nivelDoRaioX({ respostas, gabarito });
      expect(nivel).toBe(acertos >= 5 ? "atingiu" : acertos === 4 ? "em_processo" : "nao_atingiu");
    }
  });

  test("marcar sempre a mesma opção dá 2 acertos (nesta composição): não atingiu", () => {
    for (const o of ["A", "B", "neutro"] as const) {
      const respostas = Object.fromEntries(ids.map((id) => [id, o]));
      expect(nivelDoRaioX({ respostas, gabarito })).toEqual({ nivel: "nao_atingiu", acertos: 2 });
    }
  });

  test("quem chuta: a mesma opção nos 6 acerta até 3 (a regra dos 3) e não atingiu", () => {
    const tresDeA: Record<string, OpcaoDoRaioX> = { p1: "A", p2: "A", p3: "A", p4: "B", p5: "neutro", p6: "neutro" };
    const respostas = Object.fromEntries(ids.map((id) => [id, "A" as const]));
    expect(nivelDoRaioX({ respostas, gabarito: tresDeA })).toEqual({ nivel: "nao_atingiu", acertos: 3 });
  });
});

// ── 6b Os termos ─────────────────────────────────────────────────────────

describe("os termos: a régua do PO por erros (ADR-179)", () => {
  const explicam = CLAUSULAS.filter((c) => c.explica).map((c) => c.id);

  test("as que explicam são a 1, a 3 e a 5", () => {
    expect(explicam).toEqual(["c1", "c3", "c5"]);
  });

  test("toda combinação de marcadas cai em exatamente um nível: 0 erros, 1–2, 3+", () => {
    for (let mascara = 0; mascara < 32; mascara++) {
      const marcadas = CLAUSULAS.filter((_, i) => mascara & (1 << i)).map((c) => c.id) as ClausulaId[];
      const { nivel, erros } = nivelDosTermos({ marcadas });
      const esperados = CLAUSULAS.filter((c) => marcadas.includes(c.id) !== c.explica).length;
      expect(erros).toBe(esperados);
      expect(nivel).toBe(erros === 0 ? "atingiu" : erros <= 2 ? "em_processo" : "nao_atingiu");
    }
  });

  test("as 3 certas: atingiu; marcar todas: 2 erros, em processo; nenhuma: 3 erros, não atingiu", () => {
    expect(nivelDosTermos({ marcadas: ["c1", "c3", "c5"] })).toEqual({ nivel: "atingiu", erros: 0 });
    expect(nivelDosTermos({ marcadas: ["c1", "c2", "c3", "c4", "c5"] })).toEqual({ nivel: "em_processo", erros: 2 });
    expect(nivelDosTermos({ marcadas: [] })).toEqual({ nivel: "nao_atingiu", erros: 3 });
  });

  test("a mesma regra marcada duas vezes é recusada", () => {
    expect(marcadasSemRepeticao({ marcadas: ["c1", "c3"] })).toBe(true);
    expect(marcadasSemRepeticao({ marcadas: ["c1", "c1"] })).toBe(false);
  });

  test("os termos da entrada trazem as 5 cláusulas, com as mesmas palavras, enterradas no texto", () => {
    const texto = termosDaEntrada().join("\n");
    for (const c of CLAUSULAS) expect(texto).toContain(c.texto);
    expect(texto).not.toMatch(/\{c\d\}/);
    expect(TERMOS_DA_ENTRADA.length).toBeGreaterThanOrEqual(6);
    /* Nenhuma cláusula abre o texto: elas ficam no meio de parágrafos de praxe. */
    expect(CLAUSULAS.some((c) => termosDaEntrada()[0]!.includes(c.texto))).toBe(false);
  });
});

// ── 6c Mandar pra quem não viu ───────────────────────────────────────────

let m = 0;
const doEnvio = (lado: string, tipoDoAutor = "pagina_tema", categoria = lado === "neutro" ? "tema" : "x"): PostDoEnvio => ({
  id: `e${++m}`,
  lado,
  categoria,
  aprovado: true,
  tipoDoAutor,
});

function acervoDoEnvio() {
  return [
    ...[1, 2, 3, 4, 5].map(() => doEnvio("A")),
    doEnvio("A", "fofoca_tema"),
    doEnvio("A", "humor"),
    ...[1, 2, 3, 4, 5].map(() => doEnvio("B")),
    doEnvio("B", "humor"),
    ...[1, 2, 3, 4].map(() => doEnvio("neutro", "checagem")),
    doEnvio("neutro", "vida_escolar", "lanche"),
  ];
}

describe("o envio: os 9 posts", () => {
  test("3 de cada lado e 3 neutros sobre o tema; em cada lado, exatamente 1 de fofoca ou humor", () => {
    const acervo = acervoDoEnvio();
    const ids = montarEnvio(acervo, "run-1")!;
    expect(ids).toHaveLength(9);
    const sel = acervo.filter((p) => ids.includes(p.id));
    for (const lado of ["A", "B"]) {
      const doLado = sel.filter((p) => p.lado === lado);
      expect(doLado).toHaveLength(3);
      expect(doLado.filter((p) => ["fofoca_tema", "humor"].includes(p.tipoDoAutor))).toHaveLength(1);
    }
    expect(sel.filter((p) => p.lado === "neutro" && p.categoria === "tema")).toHaveLength(3);
    expect(montarEnvio(acervo, "run-1")).toEqual(ids);
  });

  test("sem neutro sobre o tema: 4 ou 5 de cada lado", () => {
    const acervo = acervoDoEnvio().filter((p) => p.lado !== "neutro");
    const ids = montarEnvio(acervo, "run-2")!;
    const sel = acervo.filter((p) => ids.includes(p.id));
    expect(sel).toHaveLength(9);
    expect([4, 5]).toContain(sel.filter((p) => p.lado === "A").length);
  });

  test("a atividade só mede a confiabilidade com fofoca ou humor nos DOIS lados", () => {
    expect(medeConfiabilidade(acervoDoEnvio())).toBe(true);
    expect(medeConfiabilidade(acervoDoEnvio().filter((p) => !(p.lado === "B" && p.tipoDoAutor === "humor")))).toBe(false);
  });
});

describe("o envio: os 3 critérios do PO (ADR-179) e a mensagem que ridiculariza (ADR-180)", () => {
  const A = doEnvio("A");
  const Af = doEnvio("A", "fofoca_tema");
  const B = doEnvio("B");
  const N = doEnvio("neutro", "checagem");
  const mensagens = ["aviso", "neutra", "encerra", "ridiculariza"] as const;
  const selecoes = [[A, B], [Af, B], [A, N], [Af], [N], [A]];

  test("o nível é a contagem dos critérios (3 atingiu, 1–2 em processo, 0 não atingiu), e ridicularizar dá não atingiu", () => {
    for (const selecao of selecoes)
      for (const mensagem of mensagens) {
        const c = criteriosDoEnvio(selecao, mensagem);
        const n = [c.doisLados, c.semFofoca, c.aviso].filter(Boolean).length;
        const r = nivelDoEnvio({ selecao, mensagem, medeConfiabilidade: true });
        expect(r).toEqual({
          nivel: mensagem === "ridiculariza" ? "nao_atingiu" : n === 3 ? "atingiu" : n > 0 ? "em_processo" : "nao_atingiu",
          marcador: "envio",
          criterios: n,
        });
      }
  });

  test("os casos do desenho", () => {
    expect(nivelDoEnvio({ selecao: [A, B], mensagem: "aviso", medeConfiabilidade: true }).nivel).toBe("atingiu");
    expect(nivelDoEnvio({ selecao: [Af, B], mensagem: "aviso", medeConfiabilidade: true }).nivel).toBe("em_processo");
    expect(nivelDoEnvio({ selecao: [Af], mensagem: "encerra", medeConfiabilidade: true }).nivel).toBe("nao_atingiu");
    // Dois lados e sem fofoca (2 de 3), mas ridicularizando: não atingiu.
    expect(nivelDoEnvio({ selecao: [A, B], mensagem: "ridiculariza", medeConfiabilidade: true })).toEqual({
      nivel: "nao_atingiu",
      marcador: "envio",
      criterios: 2,
    });
  });

  test("sem a confiabilidade, só o envio que fecha os 3 muda — vai a em processo e grava o marcador limitado", () => {
    let mudaram = 0;
    for (const selecao of selecoes)
      for (const mensagem of mensagens) {
        const comum = nivelDoEnvio({ selecao, mensagem, medeConfiabilidade: true });
        const limitado = nivelDoEnvio({ selecao, mensagem, medeConfiabilidade: false });
        expect(limitado.nivel).not.toBe("atingiu");
        if (comum.nivel !== limitado.nivel || comum.marcador !== limitado.marcador) {
          mudaram++;
          expect(comum.criterios).toBe(3);
          expect(limitado).toMatchObject({ nivel: "em_processo", marcador: "envio-sem-confiabilidade" });
        }
      }
    expect(mudaram).toBe(1);
  });

  test("as 4 mensagens continuam as mesmas, uma de cada tipo", () => {
    expect(MENSAGENS.map((m) => m.tipo)).toEqual(["aviso", "neutra", "encerra", "ridiculariza"]);
  });
});

// ── a ficha v4 ───────────────────────────────────────────────────────────

describe("a ficha da exp08ef1b, versão 4", () => {
  test("toda habilidade por ação, sem pergunta, com o rótulo de cada ação", () => {
    expect(FICHA_EXP08EF1B.versao).toBe(4);
    expect(FICHA_EXP08EF1B.perguntas).toEqual([]);
    const marcadores = FICHA_EXP08EF1B.habilidades.flatMap((h) => h.marcadores);
    expect(marcadores.every((mk) => mk.tipo === "acao" && Boolean(mk.rotulo))).toBe(true);
    expect(Object.fromEntries(FICHA_EXP08EF1B.habilidades.map((h) => [h.codigo, h.marcadores.map((mk) => mk.id)]))).toEqual({
      EF08CO11: ["raio-x"],
      EF08CO09: ["termos"],
      EF08CO07: ["envio", "envio-sem-confiabilidade"],
    });
    expect(marcadores.filter((mk) => mk.limitadoPelaAtividade).map((mk) => mk.id)).toEqual(["envio-sem-confiabilidade"]);
  });

  test("o critério da EF08CO11 diz o que se mede e o que não se mede", () => {
    const co11 = FICHA_EXP08EF1B.habilidades.find((h) => h.codigo === "EF08CO11")!;
    expect(co11.criterios.observacao).toContain("Precisão e relevância das fontes não são medidas");
    expect(co11.criterios.observacao).toContain("só pelo Raio-x");
    expect(co11.criterios.observacao).not.toContain("sugestão da IA");
  });

  test("nenhum texto da ficha fala nas perguntas do fim (o Canal B saiu)", () => {
    expect(JSON.stringify(FICHA_EXP08EF1B)).not.toMatch(/na \d.? pergunta|perguntas do fim|medida na pergunta/i);
  });
});

// ── a geração dos perfis ─────────────────────────────────────────────────

describe("a geração: fofoca e humor nos dois lados (o envio mede a confiabilidade)", () => {
  const persona = (lado: "A" | "B" | "neutro", tipo: string) =>
    ({ handle: `@p.${++n}`, display_name: "P", tipo, lado, perfil_afim: "abertura", bio: "b", voz: "v" }) as never;
  const lado = (l: "A" | "B", tipos: string[]) => tipos.map((t) => persona(l, t));

  test("cada lado com pelo menos um de fofoca e um de humor, e sem checagem: passa", () => {
    const ok = [...lado("A", ["pagina_tema", "fofoca_tema", "humor"]), ...lado("B", ["humor", "fofoca_tema", "pagina_tema"])];
    expect(problemaDosTiposDeTese(ok, 8)).toBeNull();
  });

  test("lado sem fofoca, sem humor ou com checagem: recusado com a frase", () => {
    expect(problemaDosTiposDeTese([...lado("A", ["pagina_tema", "humor"]), ...lado("B", ["fofoca_tema", "humor"])], 8)).toBe(
      "o lado A ficou sem perfil de fofoca",
    );
    expect(problemaDosTiposDeTese([...lado("A", ["fofoca_tema", "humor"]), ...lado("B", ["fofoca_tema"])], 8)).toBe(
      "o lado B ficou sem perfil de humor",
    );
    expect(
      problemaDosTiposDeTese([...lado("A", ["fofoca_tema", "humor", "checagem"]), ...lado("B", ["fofoca_tema", "humor"])], 8),
    ).toBe("o lado A tem perfil de checagem, que é dos neutros");
  });

  test("conta só o que fica depois do corte por lado", () => {
    const cortado = [...lado("A", ["pagina_tema", "pagina_tema", "fofoca_tema", "humor"]), ...lado("B", ["fofoca_tema", "humor"])];
    expect(problemaDosTiposDeTese(cortado, 2)).toBe("o lado A ficou sem perfil de fofoca");
  });
});
