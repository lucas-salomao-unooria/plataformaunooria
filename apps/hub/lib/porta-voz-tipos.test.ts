import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  ASSUNTOS,
  DISCIPLINAS,
  ETAPAS_DO_GATE,
  ITENS_DO_PACOTE,
  MORADORES,
  MOTIVOS_DA_PERICIA,
  NOME_DO_GRUPO,
  ORIGENS,
  PASSOS,
  ROTAS_DA_TURMA,
  ROTULO_DA_DISCIPLINA,
  ROTULO_DO_ITEM,
  ROTULO_DO_PASSO,
  TEMA,
  VALORES_DA_SERIE,
  assinaturaDaEvidencia,
  assuntosDoTexto,
  comItemRegenerado,
  mudouAEvidencia,
  percentual,
  problemasDoRecorte,
  tempoParado,
  type ConteudoDoPacote,
  type PainelDaTurma,
} from "./porta-voz-tipos";

/**
 * O espelho do hub contra a api (lida como TEXTO: o hub não importa a api).
 * Uma lista de valores a mais é a que ninguém atualiza junto.
 */
const API = join(__dirname, "../../api/src/porta-voz-dos-dados");
const conteudo = readFileSync(join(API, "conteudo.ts"), "utf8");
const passos = readFileSync(join(API, "regras/passos.ts"), "utf8");
const contrato = readFileSync(join(API, "contrato-de-rotas.ts"), "utf8");
const controller = readFileSync(join(API, "porta-voz-dos-dados-turmas.controller.ts"), "utf8");
const material = readFileSync(join(API, "porta-voz-dos-dados-professor.controller.ts"), "utf8");

const lista = (fonte: string, nome: string) => {
  const m = new RegExp(`export const ${nome} = \\[([^\\]]+)\\]`).exec(fonte);
  return m ? [...(m[1] as string).matchAll(/"([^"]+)"/g)].map((x) => x[1]) : null;
};

describe("o espelho dos vocabulários", () => {
  test.each([
    ["DISCIPLINAS", DISCIPLINAS, conteudo],
    ["ORIGENS", ORIGENS, conteudo],
    ["ETAPAS_DO_GATE", ETAPAS_DO_GATE, conteudo],
    ["MOTIVOS_DA_PERICIA", MOTIVOS_DA_PERICIA, conteudo],
    ["ITENS_DO_PACOTE", ITENS_DO_PACOTE, conteudo],
    ["PASSOS", PASSOS, passos],
  ])("%s", (nome, valores, fonte) => {
    expect(lista(fonte, nome)).toEqual([...valores]);
  });

  test("o rótulo de cada componente é o da api", () => {
    for (const slug of DISCIPLINAS) {
      expect(conteudo, slug).toContain(`: "${ROTULO_DA_DISCIPLINA[slug]}",`);
    }
  });

  test("todo passo e todo item da curadoria têm rótulo", () => {
    expect(Object.keys(ROTULO_DO_PASSO)).toEqual([...PASSOS]);
    expect(Object.keys(ROTULO_DO_ITEM)).toEqual([...ITENS_DO_PACOTE]);
  });

  test("os tetos do recorte e do pacote", () => {
    expect(conteudo).toContain(`export const TEMA = { min: ${TEMA.min}, max: ${TEMA.max} } as const;`);
    expect(conteudo).toContain(
      `export const ASSUNTOS = { min: ${ASSUNTOS.min}, max: ${ASSUNTOS.max}, caracteres: ${ASSUNTOS.caracteres}, total: ${ASSUNTOS.total} } as const;`,
    );
    expect(conteudo).toContain(`export const MORADORES = ${MORADORES};`);
    expect(conteudo).toContain(`export const NOME_DO_GRUPO = "${NOME_DO_GRUPO}";`);
    const serie = /export const SERIE_HISTORICA = \[([\s\S]*?)\];/.exec(conteudo)?.[1] ?? "";
    expect([...serie.matchAll(/valor: (\d+)/g)].map((m) => Number(m[1]))).toEqual([...VALORES_DA_SERIE]);
    expect(contrato).toContain("contexto: z.string().trim().max(120).optional().nullable()");
  });
});

describe("o contrato que as telas do professor usam", () => {
  test("as rotas da turma que o hub chama existem no controller", () => {
    const rotas = [
      ROTAS_DA_TURMA.pacotes,
      ROTAS_DA_TURMA.pacote(":pacoteId"),
      ROTAS_DA_TURMA.gerar,
      ROTAS_DA_TURMA.padrao,
      ROTAS_DA_TURMA.regenerar(":pacoteId"),
      ROTAS_DA_TURMA.homologar(":pacoteId"),
      ROTAS_DA_TURMA.emAndamento,
      ROTAS_DA_TURMA.gate,
      ROTAS_DA_TURMA.zerar,
      ROTAS_DA_TURMA.painel,
    ].map((r) => `":turmaId${decodeURIComponent(r)}"`);
    for (const rota of rotas) expect(controller, rota).toContain(rota);
    expect(controller).toContain('@Controller("porta-voz-dos-dados/turmas")');
    expect(material).toContain('@Controller("porta-voz-dos-dados/professor")');
    expect(material).toContain('@Get("material")');
  });

  test("o gate recebe `etapa` (pausa | liberada), e o em andamento recebe o pacote no corpo", () => {
    expect(contrato).toContain('RequisicaoGateSchema = z.object({ etapa: z.enum(["pausa", "liberada"]) })');
    expect(contrato).toContain("RequisicaoEmAndamentoSchema = z.object({ pacoteId:");
    expect(contrato).toContain("RequisicaoRegenerarItemSchema = z.object({ item: z.enum(ITENS_DO_PACOTE) })");
    expect(contrato).toContain("RequisicaoHomologarSchema = z.object({ conteudo: ConteudoBaseSchema.optional() })");
    expect(contrato).toContain("RequisicaoZerarSchema = z.object({ rodada:");
  });

  test("o painel traz as contagens que a lousa desenha — e nenhuma escala por estudante", () => {
    const m = /export const RespostaPainelSchema = z\.object\(([\s\S]*?)\n\}\);/.exec(contrato);
    expect(m).not.toBeNull();
    for (const campo of ["porPasso", "pausados", "primeiraPublicacao", "escala0", "escala80", "abriramAnexo", "errata", "publicaram", "pularam", "pericia", "emitiram", "segundosInativo", "perguntas"]) {
      expect(m?.[1], campo).toContain(campo);
    }
    const linhas = /linhas: z\.array\(z\.object\(\{([^}]*)\}\)\)/.exec(m?.[1] ?? "");
    expect(linhas?.[1]).not.toContain("escala");
  });
});

const PAINEL: Pick<PainelDaTurma, "atividade" | "resumo"> = {
  atividade: { pacoteId: "p1", rodada: 1, tema: "Água", grupo: "Água" },
  resumo: {
    estudantes: 30,
    entraram: 10,
    porPasso: { abertura: 0, dados: 0, compositor: 0, feed: 10, errata: 0, laudo: 0, pericia: 0, concluida: 0 },
    pausados: 0,
    primeiraPublicacao: { escala0: 4, escala80: 6 },
    abriramAnexo: 3,
    errata: { publicaram: 0, pularam: 0 },
    pericia: { emitiram: 0, pularam: 0 },
  },
};

test("a evidência muda nos três gestos que a ficha marca, e não com a pausa nem com o anexo", () => {
  expect(mudouAEvidencia(PAINEL, { ...PAINEL, resumo: { ...PAINEL.resumo, pausados: 9, abriramAnexo: 9 } })).toBe(false);
  expect(mudouAEvidencia(PAINEL, { ...PAINEL, resumo: { ...PAINEL.resumo, primeiraPublicacao: { escala0: 5, escala80: 6 } } })).toBe(true);
  expect(mudouAEvidencia(PAINEL, { ...PAINEL, resumo: { ...PAINEL.resumo, errata: { publicaram: 0, pularam: 1 } } })).toBe(true);
  expect(mudouAEvidencia(PAINEL, { ...PAINEL, resumo: { ...PAINEL.resumo, pericia: { emitiram: 1, pularam: 0 } } })).toBe(true);
  expect(assinaturaDaEvidencia({ ...PAINEL, atividade: null })).not.toBe(assinaturaDaEvidencia(PAINEL));
});

test("o Regenerar Item troca só o item, e guarda o que o professor editou nos outros", () => {
  const local = { grupo: "editado na tela", camadas: { fonte: "local" } } as unknown as ConteudoDoPacote;
  const servidor = { grupo: "do servidor", camadas: { fonte: "nova da IA" } } as unknown as ConteudoDoPacote;
  const novo = comItemRegenerado(local, servidor, "camadas");
  expect(novo.grupo).toBe("editado na tela");
  expect(novo.camadas.fonte).toBe("nova da IA");
  expect(local.camadas.fonte).toBe("local");
});

test("o tempo parado da folha", () => {
  expect(tempoParado(null)).toBe("—");
  expect(tempoParado(45)).toBe("45 s");
  expect(tempoParado(185)).toBe("3 min");
  expect(tempoParado(3900)).toBe("1 h 05 min");
});

test("percentual inteiro, e zero sem total", () => {
  expect(percentual(1, 3)).toBe(33);
  expect(percentual(0, 0)).toBe(0);
});

test("o recorte segue o Zod da api", () => {
  expect(assuntosDoTexto("Turbidez\n\n Rede  de distribuição \nComunicação")).toEqual(["Turbidez", "Rede de distribuição", "Comunicação"]);
  expect(problemasDoRecorte({ disciplina: "biologia", tema: "Água tratada", assuntos: ["aa", "bb", "cc"], contexto: "" })).toEqual([]);
  expect(problemasDoRecorte({ disciplina: "", tema: "x", assuntos: ["aa"], contexto: "" })).toHaveLength(3);
  expect(problemasDoRecorte({ disciplina: "biologia", tema: "Água", assuntos: ["a".repeat(120), "b".repeat(120), "c".repeat(120), "d".repeat(120), "e".repeat(120), "f".repeat(2)], contexto: "x".repeat(121) })).toEqual([
    "Os assuntos somados passam de 600 caracteres.",
    "O bairro ou território passa de 120 caracteres.",
  ]);
});

test("as perguntas do roteiro da api aparecem no guia, literais", async () => {
  const { GUIA_EXP03EM1B } = await import("./entre-redes/guias/exp03em1b");
  const m = /export const ROTEIRO_DO_DEBATE = \[([\s\S]*?)\] as const/.exec(conteudo);
  const roteiro = m ? [...(m[1] as string).matchAll(/"([^"]+)"/g)].map((x) => x[1]) : null;
  expect(roteiro).toHaveLength(3);
  const doGuia = GUIA_EXP03EM1B.debate.perguntas.map((p) => p.pergunta);
  for (const pergunta of roteiro ?? []) expect(doGuia).toContain(pergunta);
});
