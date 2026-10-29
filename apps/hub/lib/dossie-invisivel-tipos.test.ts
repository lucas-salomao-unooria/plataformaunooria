import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  ASSUNTOS,
  BLOCOS,
  BOTOES_DO_GATE,
  CAMINHOS,
  DISCIPLINAS,
  DOCUMENTOS_INDEXADOS,
  ETAPAS_DO_GATE,
  ITENS_DO_PACOTE,
  LIMITES_DO_PROJETO,
  ORIGENS,
  PASSOS,
  PROJETOS,
  ROTAS_DA_TURMA,
  ROTULO_DA_DISCIPLINA,
  ROTULO_DO_ITEM,
  ROTULO_DO_PASSO,
  TEMA,
  TRAVAS,
  VERBA,
  assinaturaDaEvidencia,
  assuntosDoTexto,
  comItemRegenerado,
  itensModificados,
  mudouAEvidencia,
  percentual,
  problemasDoRecorte,
  proximaTrava,
  tempoParado,
  travaFeita,
  type ConteudoDoPacote,
  type PainelDaTurma,
} from "./dossie-invisivel-tipos";

/**
 * O espelho do hub contra a api (lida como TEXTO: o hub não importa a api).
 * Uma lista de valores a mais é a que ninguém atualiza junto.
 */
const API = join(__dirname, "../../api/src/dossie-invisivel");
const conteudo = readFileSync(join(API, "conteudo.ts"), "utf8");
const passos = readFileSync(join(API, "regras/passos.ts"), "utf8");
const contrato = readFileSync(join(API, "contrato-de-rotas.ts"), "utf8");
const controller = readFileSync(join(API, "dossie-invisivel.controller.ts"), "utf8");
const componentes = readFileSync(join(__dirname, "../../api/src/curriculo/componentes.ts"), "utf8");

const lista = (fonte: string, nome: string) => {
  const m = new RegExp(`export const ${nome} = \\[([^\\]]+)\\]`).exec(fonte);
  return m ? [...(m[1] as string).matchAll(/"([^"]+)"/g)].map((x) => x[1]) : null;
};

describe("o espelho dos vocabulários", () => {
  test.each([
    ["DISCIPLINAS", DISCIPLINAS, conteudo],
    ["ORIGENS", ORIGENS, conteudo],
    ["ETAPAS_DO_GATE", ETAPAS_DO_GATE, conteudo],
    ["PROJETOS", PROJETOS, conteudo],
    ["CAMINHOS", CAMINHOS, conteudo],
    ["BLOCOS", BLOCOS, conteudo],
    ["ITENS_DO_PACOTE", ITENS_DO_PACOTE, conteudo],
    ["PASSOS", PASSOS, passos],
  ])("%s", (nome, valores, fonte) => {
    expect(lista(fonte, nome)).toEqual([...valores]);
  });

  test("o rótulo de cada componente é o do catálogo curricular da api (o projeto interdisciplinar é da missão)", () => {
    for (const slug of DISCIPLINAS) {
      if (slug === "interdisciplinar") {
        expect(conteudo).toContain(`"${ROTULO_DA_DISCIPLINA[slug]}"`);
        continue;
      }
      expect(componentes, slug).toMatch(new RegExp(`slug: "${slug}",\\s*rotulo: "${ROTULO_DA_DISCIPLINA[slug]}"`));
    }
  });

  test("todo passo e todo item da curadoria têm rótulo", () => {
    expect(Object.keys(ROTULO_DO_PASSO)).toEqual([...PASSOS]);
    expect(Object.keys(ROTULO_DO_ITEM)).toEqual([...ITENS_DO_PACOTE]);
  });

  test("os botões das três travas são os da api, na ordem do gate", () => {
    expect(TRAVAS).toEqual(ETAPAS_DO_GATE.slice(1));
    for (const trava of TRAVAS) expect(conteudo, trava).toContain(`${trava}: "${BOTOES_DO_GATE[trava]}",`);
  });

  test("os tetos do recorte, a verba e o volume documental", () => {
    expect(conteudo).toContain(`export const TEMA = { min: ${TEMA.min}, max: ${TEMA.max} } as const;`);
    expect(conteudo).toContain(
      `export const ASSUNTOS = { min: ${ASSUNTOS.min}, max: ${ASSUNTOS.max}, caracteres: ${ASSUNTOS.caracteres}, total: ${ASSUNTOS.total} } as const;`,
    );
    expect(conteudo).toContain(`export const VERBA = ${VERBA.toLocaleString("en-US").replace(",", "_")};`);
    expect(conteudo).toContain(
      `DOCUMENTOS_INDEXADOS: Readonly<Record<ProjetoId, number>> = { papel: ${DOCUMENTOS_INDEXADOS.papel}, parcial: ${DOCUMENTOS_INDEXADOS.parcial}, nuvem: ${DOCUMENTOS_INDEXADOS.nuvem} };`,
    );
    expect(contrato).toContain("contexto: z.string().trim().max(120).optional().nullable()");
    expect(contrato).toContain(`nome: texto(${LIMITES_DO_PROJETO.nome}, 3)`);
    expect(contrato).toContain(`card: texto(${LIMITES_DO_PROJETO.card}, 10)`);
    expect(contrato).toContain(`impacto: texto(${LIMITES_DO_PROJETO.impacto}, 5)`);
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
    expect(controller).toContain('@Controller("dossie-invisivel/turmas")');
    expect(controller).toContain('@Controller("dossie-invisivel/professor")');
    expect(controller).toContain('@Get("material")');
  });

  test("o gate recebe as três travas, e o em andamento recebe o pacote no corpo", () => {
    expect(contrato).toContain('RequisicaoGateSchema = z.object({ etapa: z.enum(["revelacao", "revoto", "explicar"]) })');
    expect(contrato).toContain("RequisicaoEmAndamentoSchema = z.object({ pacoteId:");
    expect(contrato).toContain("RequisicaoRegenerarItemSchema = z.object({ item: z.enum(ITENS_DO_PACOTE) })");
    expect(contrato).toContain("RequisicaoHomologarSchema = z.object({ conteudo: ConteudoBaseSchema.optional() })");
    expect(contrato).toContain("RequisicaoZerarSchema = z.object({ rodada:");
  });

  test("o painel traz as contagens que a lousa desenha — e nenhum voto nem caminho por estudante", () => {
    const m = /export const RespostaPainelSchema = z\.object\(([\s\S]*?)\n\}\);/.exec(contrato);
    expect(m).not.toBeNull();
    for (const campo of ["porPasso", "caminhos", "escolhaInicial", "escolhaFinal", "migracao", "mantiveram", "trocaram", "protocolosEnviados", "segundosInativo", "perguntas", "botoes", "projetos"]) {
      expect(m?.[1], campo).toContain(campo);
    }
    const linhas = /linhas: z\.array\(z\.object\(\{([^}]*)\}\)\)/.exec(m?.[1] ?? "");
    expect(linhas?.[1]).not.toMatch(/projeto|caminho|ranking/);
  });
});

const PAINEL: Pick<PainelDaTurma, "atividade" | "resumo"> = {
  atividade: { pacoteId: "p1", rodada: 1, tema: "Verba", projetos: { papel: "Mesa Aberta", parcial: "Ponto de Apoio", nuvem: "Conexão para Continuar" } },
  resumo: {
    estudantes: 30,
    entraram: 10,
    porPasso: { abertura: 0, conversa: 10, espera1: 0, revelacao: 0, espera2: 0, explicar: 0, concluida: 0 },
    caminhos: { A1: 0, A2: 0, B: 0 },
    escolhaInicial: { papel: 1, parcial: 2, nuvem: 3 },
    escolhaFinal: { papel: 0, parcial: 0, nuvem: 0 },
    migracao: { mantiveram: 0, trocaram: 0, para: { papel: 0, parcial: 0, nuvem: 0 } },
    protocolosEnviados: 0,
  },
};

test("a evidência muda nos três gestos que a ficha marca, e não com o passo nem com o caminho", () => {
  expect(mudouAEvidencia(PAINEL, { ...PAINEL, resumo: { ...PAINEL.resumo, entraram: 12, caminhos: { A1: 2, A2: 1, B: 3 } } })).toBe(false);
  expect(mudouAEvidencia(PAINEL, { ...PAINEL, resumo: { ...PAINEL.resumo, escolhaInicial: { papel: 2, parcial: 2, nuvem: 3 } } })).toBe(true);
  expect(mudouAEvidencia(PAINEL, { ...PAINEL, resumo: { ...PAINEL.resumo, escolhaFinal: { papel: 1, parcial: 0, nuvem: 0 } } })).toBe(true);
  expect(mudouAEvidencia(PAINEL, { ...PAINEL, resumo: { ...PAINEL.resumo, protocolosEnviados: 1 } })).toBe(true);
  expect(assinaturaDaEvidencia({ ...PAINEL, atividade: null })).not.toBe(assinaturaDaEvidencia(PAINEL));
});

test("as travas andam só para a frente, uma de cada vez", () => {
  expect(proximaTrava(null)).toBe("revelacao");
  expect(proximaTrava("exploracao")).toBe("revelacao");
  expect(proximaTrava("revelacao")).toBe("revoto");
  expect(proximaTrava("revoto")).toBe("explicar");
  expect(proximaTrava("explicar")).toBeNull();
  expect(travaFeita("revoto", "revelacao")).toBe(true);
  expect(travaFeita("revoto", "explicar")).toBe(false);
  expect(travaFeita(null, "revelacao")).toBe(false);
});

const projeto = (nome: string) => ({ nome, coordenador: "X", idade: 14, vagas: 20, custoPorVaga: 500, card: "c", area: "a", impacto: "i", documentos: [] });
const CONTEUDO: ConteudoDoPacote = {
  projetos: { papel: projeto("A"), parcial: projeto("B"), nuvem: projeto("C") },
  cadernos: { arquivo: "c.dat", amostras: ["a"], resumo: "r" },
};

test("o Regenerar item pontual troca só o item, e guarda o que o professor editou nos outros", () => {
  const local: ConteudoDoPacote = { ...CONTEUDO, projetos: { ...CONTEUDO.projetos, papel: projeto("editado na tela") } };
  const servidor: ConteudoDoPacote = { projetos: { papel: projeto("do servidor"), parcial: projeto("B"), nuvem: projeto("nova da IA") }, cadernos: { ...CONTEUDO.cadernos, resumo: "novo" } };
  const novo = comItemRegenerado(local, servidor, "nuvem");
  expect(novo.projetos.papel.nome).toBe("editado na tela");
  expect(novo.projetos.nuvem.nome).toBe("nova da IA");
  expect(novo.cadernos.resumo).toBe("r");
  expect(comItemRegenerado(local, servidor, "cadernos").cadernos.resumo).toBe("novo");
  expect(local.projetos.nuvem.nome).toBe("C");
});

test("a etiqueta Modificado pelo docente marca só o item mexido", () => {
  expect(itensModificados(CONTEUDO, CONTEUDO)).toEqual([]);
  expect(itensModificados(CONTEUDO, { ...CONTEUDO, projetos: { ...CONTEUDO.projetos, parcial: { ...CONTEUDO.projetos.parcial, vagas: 18 } } })).toEqual(["parcial"]);
  expect(itensModificados(CONTEUDO, { ...CONTEUDO, cadernos: { ...CONTEUDO.cadernos, amostras: ["b"] } })).toEqual(["cadernos"]);
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
  expect(assuntosDoTexto("Bibliotecas comunitárias, inclusão digital\n\n fake news ;mediação")).toEqual(["Bibliotecas comunitárias", "inclusão digital", "fake news", "mediação"]);
  expect(problemasDoRecorte({ disciplina: "ciencias", tema: "Água tratada", assuntos: ["aa", "bb", "cc"], contexto: "" })).toEqual([]);
  expect(problemasDoRecorte({ disciplina: "", tema: "x", assuntos: ["aa"], contexto: "" })).toHaveLength(3);
  expect(problemasDoRecorte({ disciplina: "ciencias", tema: "Água", assuntos: ["a".repeat(120), "b".repeat(120), "c".repeat(120), "d".repeat(120), "e".repeat(120), "f".repeat(2)], contexto: "x".repeat(121) })).toEqual([
    "Os assuntos somados passam de 600 caracteres.",
    "O contexto comunitário passa de 120 caracteres.",
  ]);
});

test("as perguntas do roteiro da api aparecem no guia, literais", async () => {
  const { GUIA_EXP09EF1B } = await import("./entre-redes/guias/exp09ef1b");
  const m = /export const ROTEIRO_DO_DEBATE: readonly string\[\] = \[([\s\S]*?)\];/.exec(conteudo);
  const roteiro = m ? [...(m[1] as string).matchAll(/"([^"]+)"/g)].map((x) => x[1]) : null;
  expect(roteiro).toHaveLength(3);
  const doGuia = GUIA_EXP09EF1B.debate.perguntas.map((p) => p.pergunta);
  for (const pergunta of roteiro ?? []) expect(doGuia).toContain(pergunta);
});

test("nada da Etapa 6 nas telas do professor", () => {
  const telas = [
    "missao-dossie-invisivel.tsx",
    "atividades/nova/criar-dossie-invisivel.tsx",
    "resultados/resultados-dossie-invisivel.tsx",
    "resultados/painel-da-aula-dossie-invisivel.tsx",
    "resultados/zerar-turma-dossie-invisivel.tsx",
    "guia/material-do-dossie-invisivel.tsx",
  ].map((f) => readFileSync(join(__dirname, "../app/(plataforma)/professor/entre-redes/[ano]/[unidade]", f), "utf8"));
  telas.push(readFileSync(join(__dirname, "entre-redes/guias/exp09ef1b.ts"), "utf8"));
  for (const tela of telas) expect(tela).not.toMatch(/Lia e Davi|módulo bônus|Ativar Caso/);
});
