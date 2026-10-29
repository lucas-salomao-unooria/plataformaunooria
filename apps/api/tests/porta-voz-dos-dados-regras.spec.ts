import { readFileSync } from "node:fs";
import { join } from "node:path";
import { componentesDoAno } from "../src/curriculo/componentes";
import { FICHA_EXP03EM1B } from "../src/evidencias/fichas/exp03em1b";
import { FICHAS } from "../src/evidencias/fichas";
import type { Nivel } from "../src/evidencias/regras";
import {
  DISCIPLINAS,
  ETAPAS_DO_GATE,
  LAUDO,
  MOTIVOS_DA_PERICIA,
  ROTULO_DA_DISCIPLINA,
  SERIE_HISTORICA,
  TEXTOS_DO_CHAT,
  TIPOS_DE_PUBLICACAO,
  conteudoDoPadrao,
  type ConteudoDoPacote,
  type Escala,
} from "../src/porta-voz-dos-dados/conteudo";
import { ConteudoDoPacoteSchema, ParecerSchema, RequisicaoGerarRecorteSchema, problemasDoRecorte } from "../src/porta-voz-dos-dados/contrato-de-rotas";
import { roteiroDoPodcast } from "../src/porta-voz-dos-dados/podcast";
import { validarSaidaDoItem } from "../src/porta-voz-dos-dados/prompts";
import {
  MARCADOR_CO12,
  MARCADOR_CO13,
  MARCADOR_CO14,
  MARCADOR_CO21,
  MARCADOR_CO22,
  MARCADOR_CO26,
  nivelCO12,
  nivelCO13,
  nivelCO14,
  nivelCO21,
  nivelCO22,
  nivelCO26,
} from "../src/porta-voz-dos-dados/regras/evidencia";
import { problemasDoConteudo } from "../src/porta-voz-dos-dados/regras/pacote";
import { avancarEtapa, normalizarEtapa, passoEfetivo, pausada, type MarcosDaSessao } from "../src/porta-voz-dos-dados/regras/passos";
import { problemasDoParecer } from "../src/porta-voz-dos-dados/regras/pericia";
import { adequada, camadasAtivas, corrigiu, regrediu, type Publicacao } from "../src/porta-voz-dos-dados/regras/publicacao";
import { trechosAlemDoTeto } from "../src/podcast/roteiro";

/**
 * O Porta-Voz dos Dados (exp03em1b, ADR-198) SEM banco: as seis réguas em
 * tabela (todas as combinações, com o ramo residual), o passo e o gate, o
 * parecer, a régua do pacote, o banco padrão com as correções do PO, o
 * podcast e o espelho dos CHECKs da migração.
 */

const ESCALAS: Escala[] = [0, 80];
const BOOL = [false, true];

/** Toda publicação possível: 2 escalas × 2³ camadas = 16. */
const TODAS: Publicacao[] = ESCALAS.flatMap((escala) =>
  BOOL.flatMap((explicacao) => BOOL.flatMap((fonte) => BOOL.map((contexto) => ({ escala, explicacao, fonte, contexto })))),
);
const pub = (escala: Escala, camadas: Partial<Omit<Publicacao, "escala">> = {}): Publicacao => ({
  escala,
  explicacao: false,
  fonte: false,
  contexto: false,
  ...camadas,
});
const NIVEIS: Nivel[] = ["atingiu", "em_processo", "nao_atingiu"];

describe("EM13CO12 — o conjunto da publicação FINAL", () => {
  test.each([
    [pub(0, { fonte: true }), "atingiu"],
    [pub(0), "em_processo"],
    [pub(80, { fonte: true }), "em_processo"],
    [pub(80, { explicacao: true, contexto: true }), "nao_atingiu"],
  ])("%j → %s", (p, nivel) => {
    expect(nivelCO12(p, null)).toBe(nivel);
  });

  test("vale a errata, quando houve — em todas as 256 combinações", () => {
    for (const i of TODAS) {
      for (const e of TODAS) expect(nivelCO12(i, e)).toBe(nivelCO12(e, null));
      expect(NIVEIS).toContain(nivelCO12(i, null));
    }
  });
});

describe("EM13CO13 — o anexo antes do compositor e do nudge", () => {
  const t = (s: number) => new Date(Date.UTC(2026, 9, 28, 10, 0, s));
  test.each([
    ["antes do nudge e do compositor", { anexoAbertoEm: t(10), nudgeE2Em: t(90), compositorAbertoEm: t(120) }, "atingiu"],
    ["sem nudge, antes do compositor", { anexoAbertoEm: t(10), nudgeE2Em: null, compositorAbertoEm: t(30) }, "atingiu"],
    ["nudge depois do compositor", { anexoAbertoEm: t(10), nudgeE2Em: t(200), compositorAbertoEm: t(30) }, "atingiu"],
    ["depois do nudge, antes do compositor", { anexoAbertoEm: t(100), nudgeE2Em: t(90), compositorAbertoEm: t(120) }, "em_processo"],
    ["no mesmo instante do nudge", { anexoAbertoEm: t(90), nudgeE2Em: t(90), compositorAbertoEm: t(120) }, "em_processo"],
    ["depois do compositor", { anexoAbertoEm: t(130), nudgeE2Em: null, compositorAbertoEm: t(120) }, "nao_atingiu"],
    ["nunca", { anexoAbertoEm: null, nudgeE2Em: t(90), compositorAbertoEm: t(120) }, "nao_atingiu"],
  ])("%s → %s", (_, fatos, nivel) => {
    expect(nivelCO13(fatos)).toBe(nivel);
  });
});

describe("EM13CO14 — a perícia (diretriz do PO)", () => {
  const p = (sinalizouA: boolean, motivoA: "escala" | "fonte" | "titulo" | null, sinalizouB: boolean, motivoB: "escala" | "fonte" | "titulo" | null) => ({
    sinalizouA,
    motivoA,
    sinalizouB,
    motivoB,
  });
  test.each([
    ["só B, escala", p(false, null, true, "escala"), "atingiu"],
    ["só B, fonte", p(false, null, true, "fonte"), "em_processo"],
    ["só B, título", p(false, null, true, "titulo"), "em_processo"],
    ["A e B, escala nos dois", p(true, "escala", true, "escala"), "em_processo"],
    ["A e B, B com fonte", p(true, "titulo", true, "fonte"), "em_processo"],
    ["só A", p(true, "escala", false, null), "nao_atingiu"],
    ["nenhum", p(false, null, false, null), "nao_atingiu"],
  ])("%s → %s", (_, parecer, nivel) => {
    expect(nivelCO14(parecer)).toBe(nivel);
  });
  test("pulou a perícia → não atingiu", () => {
    expect(nivelCO14(null)).toBe("nao_atingiu");
  });
});

describe("EM13CO21 — a explicação da escala", () => {
  test.each([
    ["ligada na 1ª, sem errata", pub(80, { explicacao: true }), null, "atingiu"],
    ["ligada na 1ª e mantida na errata", pub(80, { explicacao: true }), pub(0, { explicacao: true }), "atingiu"],
    ["ligada na 1ª e DESLIGADA na errata (decisão 4)", pub(0, { explicacao: true }), pub(0, { fonte: true }), "em_processo"],
    ["só na errata", pub(80), pub(0, { explicacao: true }), "em_processo"],
    ["nunca, com errata", pub(80), pub(0, { fonte: true }), "nao_atingiu"],
    ["nunca, sem errata", pub(0, { fonte: true }), null, "nao_atingiu"],
  ])("%s → %s", (_, inicial, errata, nivel) => {
    expect(nivelCO21(inicial, errata)).toBe(nivel);
  });
});

describe("EM13CO22 — as camadas da publicação FINAL", () => {
  test("a contagem decide: ≥ 2, 1, 0 — nas 16 publicações", () => {
    for (const p of TODAS) {
      const n = camadasAtivas(p);
      expect(nivelCO22(p, null)).toBe(n >= 2 ? "atingiu" : n === 1 ? "em_processo" : "nao_atingiu");
    }
  });
  test("com errata, vale a errata", () => {
    expect(nivelCO22(pub(0, { fonte: true, contexto: true }), pub(0))).toBe("nao_atingiu");
    expect(nivelCO22(pub(80), pub(80, { fonte: true }))).toBe("em_processo");
  });
});

describe("EM13CO26 — a tabela de decisão (decisão 4)", () => {
  test.each([
    ["1ª adequada, pulou a errata", pub(0, { fonte: true }), null, "atingiu"],
    ["1ª adequada, errata que mantém", pub(0, { fonte: true }), pub(0, { fonte: true, contexto: true }), "atingiu"],
    ["1ª adequada, errata 0 → 80 (regressão)", pub(0, { fonte: true }), pub(80, { fonte: true }), "nao_atingiu"],
    ["1ª inadequada (80), pulou", pub(80, { fonte: true }), null, "nao_atingiu"],
    ["1ª inadequada (0 sem fonte), pulou", pub(0, { contexto: true }), null, "nao_atingiu"],
    ["errata 80 → 0", pub(80, { fonte: true }), pub(0, { fonte: true }), "atingiu"],
    ["errata 80 → 0 TIRANDO a fonte (o eixo é o centro)", pub(80, { fonte: true }), pub(0), "atingiu"],
    ["errata que acrescenta a fonte (80 mantido)", pub(80), pub(80, { fonte: true }), "atingiu"],
    ["errata que acrescenta o contexto", pub(0), pub(0, { contexto: true }), "atingiu"],
    ["errata sem correção real (só a explicação)", pub(80, { fonte: true }), pub(80, { fonte: true, explicacao: true }), "em_processo"],
    ["errata idêntica", pub(80), pub(80), "em_processo"],
    ["errata 0 → 80 numa 1ª inadequada", pub(0), pub(80, { fonte: true }), "nao_atingiu"],
  ])("%s → %s", (_, inicial, errata, nivel) => {
    expect(nivelCO26(inicial, errata)).toBe(nivel);
  });

  test("todas as 16 × 17 combinações caem num dos três níveis, e a regressão nunca atinge", () => {
    for (const i of TODAS) {
      for (const e of [null, ...TODAS]) {
        const n = nivelCO26(i, e);
        expect(NIVEIS).toContain(n);
        if (e && regrediu(i, e)) expect(n).toBe("nao_atingiu");
        if (!e) expect(n).toBe(adequada(i) ? "atingiu" : "nao_atingiu");
        if (e && !regrediu(i, e) && !adequada(i)) expect(n).toBe(corrigiu(i, e) ? "atingiu" : "em_processo");
      }
    }
  });
});

describe("a ficha", () => {
  test("seis habilidades, um marcador cada, os mesmos ids da régua, sem perguntas, registrada em FICHAS", () => {
    expect(FICHA_EXP03EM1B.habilidades.map((h) => h.codigo)).toEqual(["EM13CO12", "EM13CO13", "EM13CO14", "EM13CO21", "EM13CO22", "EM13CO26"]);
    expect(FICHA_EXP03EM1B.habilidades.map((h) => h.marcadores[0]?.id)).toEqual([MARCADOR_CO12, MARCADOR_CO13, MARCADOR_CO14, MARCADOR_CO21, MARCADOR_CO22, MARCADOR_CO26]);
    expect(FICHA_EXP03EM1B.habilidades.every((h) => h.marcadores.length === 1 && h.marcadores[0]?.tipo === "acao")).toBe(true);
    expect(FICHA_EXP03EM1B.perguntas).toEqual([]);
    expect(FICHAS).toContain(FICHA_EXP03EM1B);
  });
});

describe("o passo e o gate", () => {
  const m = (parcial: Partial<MarcosDaSessao>): MarcosDaSessao => ({
    chatAberto: false,
    compositorAberto: false,
    publicou: false,
    errataDecidida: false,
    periciaAberta: false,
    concluiu: false,
    ...parcial,
  });
  test.each([
    [null, "exploracao", "abertura"],
    [m({}), "exploracao", "abertura"],
    [m({ chatAberto: true }), "exploracao", "dados"],
    [m({ chatAberto: true, compositorAberto: true }), "exploracao", "compositor"],
    [m({ chatAberto: true, compositorAberto: true, publicou: true }), "exploracao", "feed"],
    [m({ chatAberto: true, compositorAberto: true, publicou: true }), "pausa", "feed"],
    /* Decisão 7: publicou com a retomada já liberada → direto à errata. */
    [m({ chatAberto: true, compositorAberto: true, publicou: true }), "liberada", "errata"],
    [m({ publicou: true, errataDecidida: true }), "liberada", "laudo"],
    [m({ publicou: true, errataDecidida: true, periciaAberta: true }), "liberada", "pericia"],
    [m({ publicou: true, errataDecidida: true, periciaAberta: true, concluiu: true }), "liberada", "concluida"],
  ] as const)("%j em %s → %s", (marcos, etapa, passo) => {
    expect(passoEfetivo(marcos, etapa)).toBe(passo);
  });

  test("a pausa é camada sobre tudo menos a conclusão", () => {
    expect(pausada("dados", "pausa")).toBe(true);
    expect(pausada("feed", "pausa")).toBe(true);
    expect(pausada("concluida", "pausa")).toBe(false);
    expect(pausada("feed", "liberada")).toBe(false);
  });

  test("o gate só anda para a frente", () => {
    expect(avancarEtapa("exploracao", "pausa")).toBe("pausa");
    expect(avancarEtapa("pausa", "liberada")).toBe("liberada");
    expect(avancarEtapa("exploracao", "liberada")).toBe("liberada");
    expect(avancarEtapa("liberada", "pausa")).toBe("liberada");
    expect(avancarEtapa("pausa", "pausa")).toBe("pausa");
    expect(normalizarEtapa("lixo")).toBe("exploracao");
    expect(normalizarEtapa(undefined)).toBe("exploracao");
  });
});

describe("o parecer", () => {
  test("sinalizou ⇒ motivo; não sinalizou ⇒ sem motivo", () => {
    expect(problemasDoParecer({ sinalizouA: false, motivoA: null, sinalizouB: true, motivoB: "escala" })).toEqual([]);
    expect(problemasDoParecer({ sinalizouA: true, motivoA: null, sinalizouB: false, motivoB: null })).toHaveLength(1);
    expect(problemasDoParecer({ sinalizouA: false, motivoA: "fonte", sinalizouB: false, motivoB: null })).toHaveLength(1);
  });
  test("o Zod aplica a mesma regra e completa o motivo ausente com null", () => {
    expect(ParecerSchema.safeParse({ sinalizouA: false, sinalizouB: true, motivoB: "escala" })).toMatchObject({
      success: true,
      data: { sinalizouA: false, motivoA: null, sinalizouB: true, motivoB: "escala" },
    });
    expect(ParecerSchema.safeParse({ sinalizouA: false, sinalizouB: true }).success).toBe(false);
    expect(ParecerSchema.safeParse({ sinalizouA: false, sinalizouB: false, motivoB: "titulo" }).success).toBe(false);
    expect(ParecerSchema.safeParse({ sinalizouA: false, sinalizouB: true, motivoB: "gabarito" }).success).toBe(false);
  });
});

describe("o pacote e o banco padrão", () => {
  test("o banco padrão (01e) passa na forma e na régua", () => {
    expect(problemasDoConteudo(conteudoDoPadrao())).toEqual([]);
    expect(ConteudoDoPacoteSchema.safeParse(conteudoDoPadrao()).success).toBe(true);
  });

  test("os textos-chave do 01e (TC-11..17) e o Coordenador Silva", () => {
    const c = conteudoDoPadrao();
    expect(c.reacoes.zero.map((r) => r.texto)).toEqual(["Ah, tudo tranquilo, oscilação normal de rotina", "Não precisamos aprovar verba emergencial nenhuma para a escola", "Deixa como está"]);
    expect(c.reacoes.oitenta.map((r) => r.texto)).toEqual([
      "Meu Deus, a água da cidade está contaminada!",
      "Exijo fechamento imediato das escolas e interdição do reservatório!",
      "Que absurdo essa prefeitura!",
    ]);
    expect(c.posAha.conflito.texto).toBe("Ué, afinal de contas, a situação está normal ou em colapso? Qual escola está mentindo?");
    expect(c.posAha.coordenador.autor).toBe("Coordenador Silva");
  });

  test("os números são do servidor: 95, 94, 92, 88", () => {
    expect(SERIE_HISTORICA.map((s) => s.valor)).toEqual([95, 94, 92, 88]);
    expect(SERIE_HISTORICA.every((s) => s.conformes + s.inconformes === s.coletadas)).toBe(true);
  });

  test("as correções do PO: Fator ≈ 6,3 (nunca 6,37) e ~46,7%", () => {
    expect(LAUDO.fator).toBe("≈ 6,3");
    expect(LAUDO.fatorDeMentira).toContain("≈ 6,3");
    expect(LAUDO.fatorDeMentira).toContain("~46,7%");
    expect(JSON.stringify(LAUDO)).not.toContain("6,37");
  });

  const mexido = (f: (c: ConteudoDoPacote) => void) => {
    const c = conteudoDoPadrao();
    f(c);
    return problemasDoConteudo(c);
  };
  test("a régua recusa: explicação trocada, moradores diferentes, nota sem 98%, número fora da série", () => {
    expect(mexido((c) => (c.camadas.explicacao.zero = "Eixo vertical recortado a partir de 80%."))).not.toEqual([]);
    expect(mexido((c) => (c.camadas.explicacao.oitenta = "Eixo vertical do começo ao fim."))).not.toEqual([]);
    expect(mexido((c) => (c.reacoes.oitenta[0]!.autor = "Outra Pessoa"))).not.toEqual([]);
    expect(mexido((c) => (c.notaTecnica.resumo = "A queda se concentrou em duas ruas centrais durante obras na tubulação antiga."))).not.toEqual([]);
    expect(mexido((c) => (c.camadas.contexto = "Nota: o índice caiu de 96% para 85% no período."))).not.toEqual([]);
    expect(mexido((c) => (c.reacoes.zero[1]!.texto = "x".repeat(181)))).not.toEqual([]);
  });

  test("a régua recusa períodos em unidades misturadas, e aceita qualquer unidade única", () => {
    expect(mexido((c) => (c.servico.periodos = ["Semana 1", "Semana 2", "Mês 3", "Mês 4"]))).toContain(
      "Os quatro períodos precisam estar na mesma unidade de tempo (ex.: Mês 1 a Mês 4).",
    );
    expect(mexido((c) => (c.servico.periodos = ["Semana 1", "Semana 2", "Semana 3", "Semana 4"]))).toEqual([]);
    expect(mexido((c) => (c.servico.periodos = ["1º Quadrimestre", "2º Quadrimestre", "Quadrimestre 3", "4º quadrimestre"]))).toEqual([]);
  });

  test("os textos fixos do chat: sem inglês e sem cravar a unidade do período", () => {
    const chat = JSON.stringify(TEXTOS_DO_CHAT);
    expect(chat).not.toMatch(/\b(preview|slot|post)s?\b/i);
    expect(TEXTOS_DO_CHAT.introDaTabela).not.toMatch(/mes(es)?\b|semana|quadrimestre/i);
    /* O lembrete antes das prévias não manda tocar "na escala acima": ela ainda não existe. */
    expect(TEXTOS_DO_CHAT.nudgeE2SemPrevias).not.toContain("acima");
  });

  test("o Regenerar Item junta o item novo e passa a régua inteira", () => {
    const c = conteudoDoPadrao();
    const novo = validarSaidaDoItem("grupo", { grupo: "Qualidade do Transporte Escolar" }, c);
    expect(novo.grupo).toBe("Qualidade do Transporte Escolar");
    expect(novo.reacoes).toEqual(c.reacoes);
    expect(() => validarSaidaDoItem("camadas", { camadas: { ...c.camadas, explicacao: { zero: "eixo em 80%", oitenta: "eixo em 80%" } } }, c)).toThrow();
    expect(() => validarSaidaDoItem("grupo", {}, c)).toThrow();
  });

  test("o recorte: 3 a 6 assuntos, até 600 caracteres somados", () => {
    const ok = { disciplina: "biologia", tema: "Água", assuntos: ["Coleta", "Amostras", "Tubulação"] };
    expect(RequisicaoGerarRecorteSchema.safeParse(ok).success).toBe(true);
    expect(RequisicaoGerarRecorteSchema.safeParse({ ...ok, assuntos: ["a1", "b2"] }).success).toBe(false);
    expect(problemasDoRecorte({ ...ok, disciplina: "biologia", assuntos: Array(6).fill("x".repeat(110)) })).toHaveLength(1);
  });
});

describe("o podcast (fixo, só do professor)", () => {
  const texto = roteiroDoPodcast()
    .flatMap((t) => t.falas.map((f) => f.texto))
    .join(" ");
  test("as correções do PO: TC-32 renomados, TC-33 que vocês montaram", () => {
    expect(texto).toContain("formulado por estatísticos renomados.");
    expect(texto).not.toContain("renovados");
    expect(texto).toContain("daquela ferramenta essencial que vocês montaram: a Nota de Intenção.");
    expect(texto).not.toContain("tiveram que redigir");
  });
  test("cinco blocos, só Alex e Sam, e cada trecho cabe no teto do áudio", () => {
    const r = roteiroDoPodcast();
    expect(r.map((t) => t.bloco)).toEqual(["abertura", "recapitulacao", "revelacao", "provocacao", "encerramento"]);
    expect(new Set(r.flatMap((t) => t.falas.map((f) => f.falante)))).toEqual(new Set(["Alex", "Sam"]));
    expect(trechosAlemDoTeto(r)).toEqual([]);
  });
});

describe("as disciplinas do recorte: a Formação Geral Básica da 3ª série e Computação", () => {
  const semSufixo = (slug: string) => slug.replace(/-em$/, "");
  test("a lista CONTÉM cada componente de componentesDoAno(\"3EM\") e computacao, na ordem do catálogo", () => {
    const esperados = [...componentesDoAno("3EM").map((c) => semSufixo(c.slug)), "computacao"];
    expect(DISCIPLINAS.slice(0, esperados.length)).toEqual(esperados);
  });
  test("o rótulo é o do catálogo", () => {
    for (const c of componentesDoAno("3EM")) {
      expect(ROTULO_DA_DISCIPLINA[semSufixo(c.slug) as (typeof DISCIPLINAS)[number]]).toBe(c.rotulo);
    }
  });
});

describe("o espelho dos CHECKs da migração", () => {
  const sql = readFileSync(join(__dirname, "../prisma/migrations/20261028190000_exp03em1b_porta_voz_dos_dados/migration.sql"), "utf8");
  const lista = (xs: readonly (string | number)[]) => `(${xs.map((x) => (typeof x === "number" ? String(x) : `'${x}'`)).join(", ")})`;
  test("disciplina", () => expect(sql).toContain(`CHECK ("disciplina" IN ${lista(DISCIPLINAS)})`));
  test("gate", () => expect(sql).toContain(`CHECK ("etapa" IN ${lista(ETAPAS_DO_GATE)})`));
  test("tipo de publicação", () => expect(sql).toContain(`CHECK ("tipo" IN ${lista(TIPOS_DE_PUBLICACAO)})`));
  test("escala", () => expect(sql).toContain(`CHECK ("escala" IN ${lista([0, 80])})`));
  test("motivo da perícia", () => expect(sql).toContain(`"motivo_a" IN ${lista(MOTIVOS_DA_PERICIA)}`));
  test("RLS forçada nas cinco tabelas", () => {
    expect(sql).toContain("ARRAY['exp03em1b_pacotes', 'exp03em1b_gates_turma', 'exp03em1b_gates_historico', 'exp03em1b_sessoes', 'exp03em1b_publicacoes']");
    expect(sql).toContain("FORCE ROW LEVEL SECURITY");
  });
});
