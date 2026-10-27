import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  APOSTAS,
  BLOCOS,
  CARTOES,
  COLUNA_DO_CARTAO,
  DISCIPLINAS,
  FASES,
  FUNCOES,
  ITENS_DO_PACOTE,
  OPCAO_CERTA_DO_BLOCO,
  OPCOES_DE_CRITERIO,
  OPCOES_DO_BLOCO,
  ORIGENS,
  PACOTE_PADRAO,
  ROTEIRO,
  type Bloco,
  type Criterios,
  type Fase,
  type PassoDoAlgoritmo,
} from "../src/assistente-invisivel/conteudo";
import { EstadoSchema, MaterialFixoSchema, SessaoSchema } from "../src/assistente-invisivel/contrato-de-rotas";
import { roteiroDoPodcast } from "../src/assistente-invisivel/podcast";
import { validarItemRegenerado, validarSaidaDoPreparo } from "../src/assistente-invisivel/prompts";
import {
  corrigirCartoes,
  corrigirComunicado,
  efeitoDoReteste,
  equidadeDoReteste,
  marcouOsDispensaveis,
  type Alinhamento,
  type Comunicado,
  type Equidade,
} from "../src/assistente-invisivel/regras/bancada";
import { EM_BRANCO, textoDoComunicado } from "../src/assistente-invisivel/regras/comunicado";
import { nivelCO01, nivelCO03, nivelCO18, nivelCO20, type FatosDaRegua } from "../src/assistente-invisivel/regras/evidencia";
import { medidorDaTurma, todosApostaram } from "../src/assistente-invisivel/regras/medidor";
import { comItem, lerItem, problemasDoPacote, termoProibido } from "../src/assistente-invisivel/regras/pacote";
import {
  PASSOS,
  aguardandoProfessor,
  passoEfetivo,
  transicaoValida,
  type MarcosDaSessao,
  type Passo,
} from "../src/assistente-invisivel/regras/passos";
import { FICHA_EXP01EM1B } from "../src/evidencias/fichas/exp01em1b";

/**
 * O Assistente Invisível (exp01em1b, ADR-185) SEM banco: o passo e a espera
 * por fase, as transições, a bancada, as quatro réguas em tabela-verdade, o
 * medidor e o 100%, a régua do pacote, o gabarito fora do shape do estudante,
 * o podcast e o espelho dos CHECKs da migration.
 */

const NADA: MarcosDaSessao = {
  iniciou: false,
  navegou: false,
  apostou: false,
  simulacaoConcluida: false,
  fichasAbertas: false,
  inspecaoConcluida: false,
  classificou: false,
  algoritmoResolvido: false,
  retestou: false,
  revisando: false,
  avancouParaPublicacao: false,
  publicou: false,
};

/** Os marcos de quem chegou ATÉ o passo `p` (inclusive o que o leva a ele). */
function ate(p: Passo): MarcosDaSessao {
  const ordem: (keyof MarcosDaSessao)[] = [
    "iniciou",
    "navegou",
    "apostou",
    "simulacaoConcluida",
    "fichasAbertas",
    "inspecaoConcluida",
    "classificou",
    "algoritmoResolvido",
    "retestou",
    "avancouParaPublicacao",
    "publicou",
  ];
  const n = PASSOS.indexOf(p);
  const m = { ...NADA };
  for (const k of ordem.slice(0, n)) m[k] = true;
  return m;
}

describe("o passo é derivado dos marcos", () => {
  test("cada marco leva ao passo seguinte, na ordem do Figma", () => {
    expect(passoEfetivo(null)).toBe("boas-vindas");
    for (const p of PASSOS) expect(passoEfetivo(ate(p))).toBe(p);
  });

  test('"Revisar Critérios" volta ao banco; publicar conclui', () => {
    expect(passoEfetivo({ ...ate("reteste"), revisando: true })).toBe("criterios");
    expect(passoEfetivo({ ...NADA, iniciou: true, publicou: true })).toBe("concluida");
  });
});

describe("a camada de espera, por fase", () => {
  /** O que o PO e o Vinicius decidiram, escrito à parte do código (`regras/passos.ts`). */
  function esperado(p: Passo, f: Fase): boolean {
    const i = FASES.indexOf(f);
    const alcancou = (alvo: Fase) => i >= FASES.indexOf(alvo);
    if (["boas-vindas", "funcoes", "aposta"].includes(p)) return !alcancou("testes");
    if (p === "simulacao") return !alcancou("simulacao") || f === "debate-1";
    if (p === "confronto" || p === "fichas") return f === "debate-1";
    if (p === "classificacao") return !alcancou("explicar") || f === "debate-1";
    if (["algoritmo", "criterios", "reteste"].includes(p)) return f === "debate-2";
    if (p === "publicacao") return !alcancou("publicar");
    return false;
  }
  test.each(PASSOS.flatMap((p) => FASES.map((f) => [p, f] as const)))("%s com a turma em %s", (p, f) => {
    expect(aguardandoProfessor(p, f)).toBe(esperado(p, f));
  });

  test("a Trava 1 é DEPOIS das fichas, e a Trava 2 depois do avanço", () => {
    expect(aguardandoProfessor("fichas", "simulacao")).toBe(false);
    expect(aguardandoProfessor("classificacao", "simulacao")).toBe(true);
    expect(aguardandoProfessor("publicacao", "debate-2")).toBe(true);
    expect(aguardandoProfessor("concluida", "aguardando-inicio")).toBe(false);
  });
});

describe("as transições do professor: só para a frente, pausas opcionais", () => {
  const validas = new Set([
    "aguardando-inicio>testes",
    "testes>simulacao",
    "simulacao>debate-1",
    "simulacao>explicar",
    "debate-1>explicar",
    "explicar>debate-2",
    "explicar>publicar",
    "debate-2>publicar",
  ]);
  test.each(FASES.flatMap((a) => FASES.map((b) => [a, b] as const)))("%s → %s", (a, b) => {
    expect(transicaoValida(a, b)).toBe(validas.has(`${a}>${b}`));
  });
});

describe("a bancada (E5)", () => {
  test("os cartões: acertos, completa e a cadeia causal", () => {
    const certa = Object.fromEntries(CARTOES.map((c) => [c, COLUNA_DO_CARTAO[c]]));
    expect(corrigirCartoes(certa)).toEqual({ completa: true, acertos: 6, cadeiaCausal: true });
    expect(corrigirCartoes({ horario: "observados" })).toEqual({ completa: false, acertos: 1, cadeiaCausal: false });
    expect(corrigirCartoes({ horario: "observados", "sinal-de-rede": "observados", "trilha-avancada": "observados" })).toMatchObject({
      acertos: 2,
      cadeiaCausal: true,
    });
  });

  test("o algoritmo: só exatamente {2, 3, 4}", () => {
    expect(marcouOsDispensaveis([2, 3, 4])).toBe(true);
    expect(marcouOsDispensaveis([4, 3, 2])).toBe(true);
    for (const outro of [[], [2, 3], [1, 2, 3, 4], [2, 3, 5], [1, 5]] as PassoDoAlgoritmo[][]) expect(marcouOsDispensaveis(outro)).toBe(false);
  });

  test.each(OPCOES_DE_CRITERIO.flatMap((e) => OPCOES_DE_CRITERIO.flatMap((d) => OPCOES_DE_CRITERIO.map((s) => [e, d, s] as const))))(
    "o reteste com %s-%s-%s (a F3 não pesa)",
    (exercicios, duvidas, sugestoes) => {
      const c: Criterios = { exercicios, duvidas, sugestoes };
      const ex = exercicios !== "b";
      const du = duvidas !== "b";
      expect(equidadeDoReteste(c)).toBe(ex && du ? "total" : ex || du ? "parcial" : "nenhuma");
      expect(efeitoDoReteste(c)).toEqual({ beatrizAvancada: ex, thiagoLivre: du });
    },
  );

  test("o comunicado: pleno, incompleto (branco ou só o bloco 1) e descaracterizado (2, 3 ou 4)", () => {
    const certo = { ...OPCAO_CERTA_DO_BLOCO };
    expect(corrigirComunicado(certo)).toEqual({ alinhamento: "pleno", corretos: 4, incompleto: false });
    expect(corrigirComunicado({ ...certo, problema: "lentidao" }).alinhamento).toBe("incompleto");
    const { salvaguarda: _s, ...semSalvaguarda } = certo;
    expect(corrigirComunicado(semSalvaguarda)).toEqual({ alinhamento: "incompleto", corretos: 3, incompleto: true });
    for (const b of ["inferencia", "regra", "salvaguarda"] as const) {
      const errada = OPCOES_DO_BLOCO[b].find((o) => o !== OPCAO_CERTA_DO_BLOCO[b])!;
      expect(corrigirComunicado({ ...certo, [b]: errada }).alinhamento).toBe("descaracterizado");
    }
  });

  test("o comunicado em texto corrido mostra a lacuna", () => {
    const t = textoDoComunicado({ ...OPCAO_CERTA_DO_BLOCO, regra: undefined } as Comunicado);
    expect(t).toBe(
      `Identificamos que o assistente estava restringindo acessos automaticamente, ao deduzir perfil de estudo a partir de metadados de horário e oscilação de rede. Para garantir equidade, estabelecemos que o acesso agora é definido por ${EM_BRANCO}. Qualquer estudante tem direito a solicitar explicação e revisão humana de decisões automatizadas.`,
    );
  });
});

describe("a régua das quatro habilidades (tabela-verdade, §12a)", () => {
  type N = "atingiu" | "em_processo" | "nao_atingiu";
  const combos: FatosDaRegua[] = [];
  for (const publicou of [true, false])
    for (const paginaAtiva of [true, false])
      for (const comunicado of [null, "pleno", "incompleto", "descaracterizado"] as (Alinhamento | null)[])
        for (const equidade of [null, "total", "parcial", "nenhuma"] as (Equidade | null)[])
          for (const abriu of [true, false])
            for (const marcouAlgum of [true, false])
              for (const dispensaveis of [true, false]) {
                if (!publicou && (paginaAtiva || comunicado !== null)) continue;
                if (publicou && comunicado === null) continue;
                if (!marcouAlgum && dispensaveis) continue;
                if (!abriu && marcouAlgum) continue;
                combos.push({
                  publicou,
                  paginaAtiva,
                  comunicado,
                  equidade,
                  abriuPainelDoAlgoritmo: abriu,
                  marcouAlgumPasso: marcouAlgum,
                  marcouOsDispensaveis: dispensaveis,
                });
              }

  /** O plano §3, escrito de novo à mão. */
  function co20(f: FatosDaRegua): N {
    if (!f.publicou || f.comunicado === "descaracterizado") return "nao_atingiu";
    if (f.paginaAtiva && f.comunicado === "pleno") return "atingiu";
    if (f.paginaAtiva && f.comunicado === "incompleto") return "em_processo";
    if (!f.paginaAtiva && f.comunicado === "pleno") return "em_processo";
    return "em_processo";
  }
  const co01 = (f: FatosDaRegua): N => (f.equidade === "total" ? "atingiu" : f.equidade === "parcial" ? "em_processo" : "nao_atingiu");
  function co18(f: FatosDaRegua): N {
    const a = f.equidade === "total";
    const b = f.publicou && f.paginaAtiva && f.comunicado === "pleno";
    return a && b ? "atingiu" : a || b ? "em_processo" : "nao_atingiu";
  }
  const co03 = (f: FatosDaRegua): N =>
    !f.abriuPainelDoAlgoritmo || !f.marcouAlgumPasso ? "nao_atingiu" : f.marcouOsDispensaveis ? "atingiu" : "em_processo";

  test(`as ${combos.length} combinações possíveis`, () => {
    expect(combos.length).toBeGreaterThan(100);
    for (const f of combos) {
      expect([nivelCO20(f), nivelCO01(f), nivelCO18(f), nivelCO03(f)]).toEqual([co20(f), co01(f), co18(f), co03(f)]);
    }
  });

  test("o encerrar (publicou: false) nunca dá atingiu na CO20 nem na CO18", () => {
    for (const f of combos.filter((x) => !x.publicou)) {
      expect(nivelCO20(f)).toBe("nao_atingiu");
      expect(nivelCO18(f)).not.toBe("atingiu");
    }
  });

  test("a ficha tem as quatro habilidades, com os ids de marcador do conteúdo", () => {
    expect(FICHA_EXP01EM1B.habilidades.map((h) => [h.codigo, h.marcadores.map((m) => m.id)])).toEqual([
      ["EM13CO20", ["comunicado-de-transparencia"]],
      ["EM13CO01", ["criterios-reutilizados"]],
      ["EM13CO18", ["ciclo-da-auditoria"]],
      ["EM13CO03", ["etapas-do-algoritmo"]],
    ]);
    expect(FICHA_EXP01EM1B.perguntas).toEqual([]);
  });
});

describe("o medidor e o 100% (E3/E4)", () => {
  test("some abaixo de 3 apostas; fecha 100 com o maior resto", () => {
    expect(medidorDaTurma({ a: 1, b: 1 })).toBeNull();
    expect(medidorDaTurma({})).toBeNull();
    expect(medidorDaTurma({ a: 1, b: 1, c: 1 })).toEqual({ a: 34, b: 33, c: 33, total: 3 });
    expect(medidorDaTurma({ a: 20, b: 5, c: 2 })).toEqual({ a: 74, b: 19, c: 7, total: 27 });
    for (let a = 0; a < 7; a += 1)
      for (let b = 0; b < 7; b += 1)
        for (let c = 0; c < 7; c += 1) {
          const m = medidorDaTurma({ a, b, c });
          if (a + b + c < 3) expect(m).toBeNull();
          else expect(m!.a + m!.b + m!.c).toBe(100);
        }
  });

  test("100% das sessões ABERTAS; sem sessão, nunca", () => {
    expect(todosApostaram(0, 0)).toBe(false);
    expect(todosApostaram(3, 2)).toBe(false);
    expect(todosApostaram(3, 3)).toBe(true);
  });
});

describe("a régua do pacote", () => {
  test("o banco padrão passa", () => {
    expect(problemasDoPacote(PACOTE_PADRAO.conteudo)).toEqual([]);
  });

  test.each(["horário", "Horários", "MADRUGADA", "noite", "noturno", "conexão", "conexões", "sinal", "internet", "rede", "redes"])(
    'recusa "%s" em qualquer item',
    (termo) => {
      expect(termoProibido(`Uma frase com ${termo} no meio.`)).not.toBeNull();
      const ruim = comItem(PACOTE_PADRAO.conteudo, "respostas.thiago2", { texto: `Explique o poema e a ${termo} dele.` });
      expect(problemasDoPacote(ruim).join(" ")).toMatch(/2ª resposta ao Thiago cita/);
    },
  );

  test("não confunde palavra parecida", () => {
    for (const ok of ["redação", "sinalizar", "horta", "noiteiro?", "Internacional"]) expect(termoProibido(ok)).toBeNull();
  });

  test("dúvidas iguais, títulos iguais e texto além do teto", () => {
    const c = PACOTE_PADRAO.conteudo;
    expect(problemasDoPacote(comItem(c, "duvidas.thiago2", { texto: c.duvidas.thiago1 })).join(" ")).toMatch(/cinco dúvidas/);
    expect(problemasDoPacote(comItem(c, "reforcoBasico", { titulo: c.trilhaAvancada.titulo, texto: "x" })).join(" ")).toMatch(/títulos diferentes/);
    expect(problemasDoPacote(comItem(c, "duvidas.lucas", { texto: "a".repeat(201) })).join(" ")).toMatch(/duvidas\.lucas/);
    expect(problemasDoPacote({ versao: 1 }).length).toBeGreaterThan(0);
  });

  test("a saída da IA: o pacote sem `versao` é aceito e aparado; com a pista da inferência, recusado", () => {
    const { versao: _v, ...semVersao } = structuredClone(PACOTE_PADRAO.conteudo);
    const bruto = { ...semVersao, leitura: { titulo: "  Leitura   Recomendada: X  ", resumo: "Um guia curto." }, extra: "ignorado" };
    const c = validarSaidaDoPreparo(bruto);
    expect(c.versao).toBe(1);
    expect(c.leitura.titulo).toBe("Leitura Recomendada: X");
    expect(Object.keys(c)).not.toContain("extra");
    expect(() => validarSaidaDoPreparo({ ...semVersao, duvidas: { ...semVersao.duvidas, beatriz: "Estudo de madrugada, isso conta?" } })).toThrow(/madrugada/);
  });

  test("o item regenerado: troca só ele, passa pela régua e precisa ser outro", () => {
    const c = PACOTE_PADRAO.conteudo;
    const novo = validarItemRegenerado({ titulo: "Trilha Avançada: Ironia em Drummond", texto: "Analise a ironia em dois versos." }, c, "trilhaAvancada");
    expect(lerItem(novo, "trilhaAvancada")).toEqual({ titulo: "Trilha Avançada: Ironia em Drummond", texto: "Analise a ironia em dois versos." });
    expect(novo.duvidas).toEqual(c.duvidas);
    expect(() => validarItemRegenerado({ texto: c.duvidas.lucas }, c, "duvidas.lucas")).toThrow(/igual/);
    expect(() => validarItemRegenerado({ texto: "Funciona sem internet?" }, c, "duvidas.lucas")).toThrow(/internet/);
  });

  test("os itens do pacote são lidos e trocados um a um", () => {
    for (const item of ITENS_DO_PACOTE) {
      const v = lerItem(PACOTE_PADRAO.conteudo, item);
      expect(lerItem(comItem(PACOTE_PADRAO.conteudo, item, { ...v, texto: "Novo texto." }), item).texto).toBe("Novo texto.");
    }
  });
});

describe("a saída do estudante não tem lugar para o gabarito", () => {
  /** Todas as chaves de um schema, em qualquer profundidade. */
  function chaves(s: z.ZodTypeAny, acc = new Set<string>()): Set<string> {
    if (s instanceof z.ZodObject) {
      for (const [k, v] of Object.entries(s.shape as Record<string, z.ZodTypeAny>)) {
        acc.add(k);
        chaves(v, acc);
      }
    } else if (s instanceof z.ZodNullable || s instanceof z.ZodOptional) chaves(s.unwrap() as z.ZodTypeAny, acc);
    else if (s instanceof z.ZodArray) chaves(s.element as z.ZodTypeAny, acc);
    else if (s instanceof z.ZodUnion) for (const o of s.options as z.ZodTypeAny[]) chaves(o, acc);
    return acc;
  }
  const PROIBIDAS = ["acertos", "correto", "certa", "certo", "colunaCerta", "gabarito", "alinhamento", "niveis", "equitativos", "dispensaveis", "corretos", "blocosCorretos"];

  test.each([
    ["SessaoSchema", SessaoSchema],
    ["EstadoSchema", EstadoSchema],
    ["MaterialFixoSchema", MaterialFixoSchema],
  ] as const)("%s", (_nome, schema) => {
    const todas = chaves(schema);
    expect(todas.size).toBeGreaterThan(10);
    for (const k of PROIBIDAS) expect(todas).not.toContain(k);
  });

  test("as opções dos blocos descem em ordem fixa, sem marca da certa", () => {
    const opcao = MaterialFixoSchema.shape.blocos.element.shape.opcoes.element;
    expect(Object.keys(opcao.shape).sort()).toEqual(["id", "texto"]);
  });
});

describe("o roteiro e o podcast", () => {
  test("as quatro perguntas do roteiro e o card de transferência", () => {
    expect(ROTEIRO.perguntas).toHaveLength(4);
    expect(ROTEIRO.perguntas[1]).toMatch(/^Estudar às 23h45/);
    expect(ROTEIRO.transferencia).toMatch(/^Um aplicativo de transporte urbano/);
  });

  test("só Alex e Sam falam, e o texto é o do §11", () => {
    const r = roteiroDoPodcast();
    expect(r.map((b) => b.bloco)).toEqual(["abertura", "recapitulacao", "revelacao", "provocacao", "encerramento"]);
    expect(new Set(r.flatMap((b) => b.falas.map((f) => f.falante)))).toEqual(new Set(["Alex", "Sam"]));
    const texto = JSON.stringify(r);
    expect(texto).toContain("bastidores do UnooriaAI na escola");
    expect(texto).toContain("Até mais, pessoal! Cuidem dos seus dados.");
  });
});

describe("os vocabulários do código são os dos CHECKs da migration", () => {
  const sql = readFileSync(join(__dirname, "../prisma/migrations/20261026180000_exp01em1b_assistente_invisivel/migration.sql"), "utf8");
  const lista = (xs: readonly string[]) => `(${xs.map((x) => `'${x}'`).join(", ")})`;
  const array = (xs: readonly (string | number)[]) => `ARRAY[${xs.map((x) => (typeof x === "number" ? `${x}` : `'${x}'`)).join(", ")}]`;
  test.each([
    ["disciplina", DISCIPLINAS],
    ["origem", ORIGENS],
    ["fase", FASES],
    ["fase do histórico (sem a inicial)", FASES.filter((f) => f !== "aguardando-inicio")],
    ["aposta", APOSTAS],
    ["equidade", ["total", "parcial", "nenhuma"]],
    ["alinhamento", ["pleno", "incompleto", "descaracterizado"]],
  ] as const)("%s", (_nome, valores) => {
    expect(sql).toContain(lista(valores));
  });
  test("as funções, os itens do pacote e os passos do algoritmo", () => {
    expect(sql).toContain(`${array(FUNCOES)}::TEXT[]`);
    expect(sql).toContain(`${array(ITENS_DO_PACOTE)}::TEXT[]`);
    expect(sql).toContain(`${array([1, 2, 3, 4, 5])}::SMALLINT[]`);
  });
  test("os quatro blocos e os seis cartões cabem nos tetos dos CHECKs", () => {
    expect(sql).toContain(`"blocos_corretos" BETWEEN 0 AND ${BLOCOS.length}`);
    expect(sql).toContain(`"cartoes_acertos" BETWEEN 0 AND ${CARTOES.length}`);
    expect(BLOCOS.every((b: Bloco) => OPCOES_DO_BLOCO[b].length === 2)).toBe(true);
  });
});
