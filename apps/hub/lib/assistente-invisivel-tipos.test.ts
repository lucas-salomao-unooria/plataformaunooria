import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  ACOES_DA_FASE,
  APOSTAS,
  BLOCOS,
  CARTOES,
  CONTEXTO_MAX,
  CRITERIOS_INICIAIS,
  DISCIPLINAS,
  FASES,
  FUNCOES,
  ITENS_DO_PACOTE,
  LIMITES,
  OPCOES_DE_CRITERIO,
  ORIGENS,
  PASSOS,
  PERFIS,
  ROTAS_DA_CURADORIA,
  ROTULO_DA_DISCIPLINA,
  TEMA,
  TOPICOS,
  ETIQUETA_DO_MOMENTO,
  PAUSA_FEITA,
  acoesDoMomento,
  avisoDiscreto,
  codigoDosCriterios,
  momentoDoPainel,
  idDaAtividade,
  mudouAEvidencia,
  problemasDoRecorte,
  rascunhoDaResposta,
  textoDoItem,
  topicosDoTexto,
  type ConteudoDoPacote,
  type PainelDaTurma,
} from "./assistente-invisivel-tipos";

/**
 * O espelho do hub contra a api (lida como TEXTO: o hub não importa a api).
 * Uma lista de valores a mais é a que ninguém atualiza junto.
 */
const API = join(__dirname, "../../api/src/assistente-invisivel");
const conteudo = readFileSync(join(API, "conteudo.ts"), "utf8");
const passos = readFileSync(join(API, "regras/passos.ts"), "utf8");
const controllerDaTurma = readFileSync(join(API, "assistente-invisivel-turmas.controller.ts"), "utf8");

const lista = (fonte: string, nome: string) => {
  const m = new RegExp(`export const ${nome} = \\[([^\\]]+)\\] as const`).exec(fonte);
  return m ? [...(m[1] as string).matchAll(/"([^"]+)"/g)].map((x) => x[1]) : null;
};

describe("o espelho dos vocabulários", () => {
  test.each([
    ["DISCIPLINAS", DISCIPLINAS, conteudo],
    ["ORIGENS", ORIGENS, conteudo],
    ["FASES", FASES, conteudo],
    ["APOSTAS", APOSTAS, conteudo],
    ["FUNCOES", FUNCOES, conteudo],
    ["OPCOES_DE_CRITERIO", OPCOES_DE_CRITERIO, conteudo],
    ["CARTOES", CARTOES, conteudo],
    ["BLOCOS", BLOCOS, conteudo],
    ["PERFIS", PERFIS, conteudo],
    ["ITENS_DO_PACOTE", ITENS_DO_PACOTE, conteudo],
    ["PASSOS", PASSOS, passos],
  ])("%s", (nome, valores, fonte) => {
    expect(lista(fonte, nome)).toEqual([...valores]);
  });

  test("o rótulo de cada disciplina é o da api", () => {
    for (const [slug, rotulo] of Object.entries(ROTULO_DA_DISCIPLINA)) {
      expect(conteudo).toMatch(new RegExp(`"?${slug}"?: "${rotulo}"`));
    }
  });

  test("os tetos do recorte e do pacote são os da api", () => {
    expect(conteudo).toContain(`TEMA = { min: ${TEMA.min}, max: ${TEMA.max} }`);
    expect(conteudo).toContain(`TOPICOS = { min: ${TOPICOS.min}, max: ${TOPICOS.max}, maxCaracteres: ${TOPICOS.maxCaracteres} }`);
    expect(conteudo).toContain(`CONTEXTO_MAX = ${CONTEXTO_MAX};`);
    expect(conteudo).toContain(
      `LIMITES = { titulo: ${LIMITES.titulo}, enunciado: ${LIMITES.enunciado}, duvida: ${LIMITES.duvida}, resposta: ${LIMITES.resposta}, resumo: ${LIMITES.resumo} }`,
    );
  });

  test("a configuração inicial é B-B-A, a da api", () => {
    expect(codigoDosCriterios(CRITERIOS_INICIAIS)).toBe("B-B-A");
    expect(conteudo).toContain(
      `CRITERIOS_INICIAIS: Criterios = { exercicios: "${CRITERIOS_INICIAIS.exercicios}", duvidas: "${CRITERIOS_INICIAIS.duvidas}", sugestoes: "${CRITERIOS_INICIAIS.sugestoes}" }`,
    );
  });

  /* Os caminhos da curadoria e da lista divergem das missões irmãs (`/pacotes` é o preparo aqui):
     cada um tem de existir no controller da api, ou a tela dá 404 sem erro de compilação. */
  test("toda rota da turma que o hub chama existe na api", () => {
    for (const rota of Object.values(ROTAS_DA_CURADORIA)) {
      expect(controllerDaTurma, rota).toContain(`":turmaId${rota}"`);
    }
    for (const rota of ["/painel", "/gate", "/zerar", "/pacotes/:pacoteId/em-andamento"]) {
      expect(controllerDaTurma, rota).toContain(`":turmaId${rota}"`);
    }
  });

  /* Um botão que pede uma transição que a api não aceita dá 409 na frente da sala. */
  test("todo botão da aula pede uma transição que a api aceita", () => {
    const bloco = /PROXIMAS_FASES[^=]*= \{([\s\S]+?)\n\};/.exec(passos)?.[1] ?? "";
    const proximas = new Map(
      [...bloco.matchAll(/^\s*"?([a-z0-9-]+)"?: \[([^\]]*)\],/gm)].map((m) => [m[1], [...(m[2] as string).matchAll(/"([^"]+)"/g)].map((x) => x[1])]),
    );
    expect([...proximas.keys()]).toEqual([...FASES]);
    for (const fase of FASES) {
      expect(ACOES_DA_FASE[fase].map((a) => a.para).sort(), fase).toEqual([...(proximas.get(fase) ?? [])].sort());
    }
  });
});

const CONTEUDO: ConteudoDoPacote = {
  versao: 1,
  trilhaAvancada: { titulo: "Trilha", enunciado: "Enunciado avançado" },
  reforcoBasico: { titulo: "Reforço", enunciado: "Enunciado básico" },
  duvidas: { lucas: "dl", beatriz: "db", thiago1: "dt1", thiago2: "dt2", thiago3: "dt3" },
  respostas: { lucas: "rl", beatriz: "rb", thiago1: "rt1", thiago2: "rt2", thiago3: "rt3" },
  leitura: { titulo: "Leitura", resumo: "Resumo" },
};

describe("a curadoria", () => {
  test("cada item tem o seu texto, e só três têm título", () => {
    expect(textoDoItem(CONTEUDO, "trilhaAvancada")).toEqual({ titulo: "Trilha", texto: "Enunciado avançado" });
    expect(textoDoItem(CONTEUDO, "leitura")).toEqual({ titulo: "Leitura", texto: "Resumo" });
    expect(textoDoItem(CONTEUDO, "duvidas.thiago2")).toEqual({ titulo: null, texto: "dt2" });
    expect(textoDoItem(CONTEUDO, "respostas.lucas")).toEqual({ titulo: null, texto: "rl" });
  });

  test("o recorte segue o Zod da api", () => {
    expect(topicosDoTexto("Leis de Mendel, Cruzamentos Complexos\n Probabilidade ,")).toEqual(["Leis de Mendel", "Cruzamentos Complexos", "Probabilidade"]);
    expect(problemasDoRecorte({ disciplina: "biologia", tema: "Genética", topicos: ["aa", "bb", "cc"], contexto: "" })).toEqual([]);
    expect(problemasDoRecorte({ disciplina: "", tema: "x", topicos: ["a"], contexto: "z".repeat(121) })).toHaveLength(5);
    expect(problemasDoRecorte({ disciplina: "biologia", tema: "Genética", topicos: ["a1", "b1", "c1", "d1", "e1", "f1"], contexto: "" })).toHaveLength(1);
  });

  test("a resposta da curadoria aceita as duas formas", () => {
    const pacote = { id: "p", conteudo: CONTEUDO };
    expect(rascunhoDaResposta({ rascunho: pacote })).toBe(pacote);
    expect(rascunhoDaResposta(pacote)).toBe(pacote);
    expect(rascunhoDaResposta({ atividade: { pacoteId: "p" } })).toBeNull();
    expect(idDaAtividade({ id: "p" })).toBe("p");
    expect(idDaAtividade({ atividade: { pacoteId: "q" }, fase: "aguardando-inicio" })).toBe("q");
    expect(idDaAtividade(null)).toBeNull();
  });
});

describe("a condução", () => {
  const resumo = (retestes: number, publicaram: number) => ({ criterioExercicios: { a: retestes, b: 0, c: 0 }, publicaram });

  test("cada fase desenha o quadro do Figma do seu momento", () => {
    expect(momentoDoPainel("simulacao", resumo(0, 0))).toBe("simulacao");
    expect(momentoDoPainel("debate-1", resumo(0, 0))).toBe("telas-travadas");
    /* E4-PROF-01 "liberado": a bancada acabou de abrir — sem projeção e sem os botões da E5. */
    expect(momentoDoPainel("explicar", resumo(0, 0))).toBe("bancada-liberada");
    expect(acoesDoMomento("explicar", "bancada-liberada")).toEqual([]);
    /* Com reteste na sala, o E5-PROF-01: a projeção e os botões. */
    expect(momentoDoPainel("explicar", resumo(2, 0))).toBe("projecao");
    expect(acoesDoMomento("explicar", "projecao").map((a) => a.para)).toEqual(["debate-2", "publicar"]);
    expect(momentoDoPainel("debate-2", resumo(2, 0))).toBe("projecao-pausada");
    /* E5-PROF-01 "liberado" até a primeira publicação; o relatório final depois. */
    expect(momentoDoPainel("publicar", resumo(2, 0))).toBe("publicacao-liberada");
    expect(momentoDoPainel("publicar", resumo(2, 1))).toBe("relatorio");
  });

  test("na pausa, o botão dela fica à vista e não pede transição nenhuma", () => {
    expect(PAUSA_FEITA["debate-1"]?.rotulo).toBe("Travar Telas da Turma");
    expect(PAUSA_FEITA["debate-2"]?.rotulo).toBe("Pausar para Comparação");
    /* O botão ativo da pausa continua sendo só o de seguir — {para} sempre à frente. */
    expect(ACOES_DA_FASE["debate-1"].map((a) => a.para)).toEqual(["explicar"]);
    expect(ACOES_DA_FASE["debate-2"].map((a) => a.para)).toEqual(["publicar"]);
  });

  test("a etiqueta não tem o jargão 'Handoff' do Figma (ADR-91)", () => {
    for (const t of Object.values(ETIQUETA_DO_MOMENTO)) expect(t).not.toMatch(/handoff/i);
    expect(ETIQUETA_DO_MOMENTO["telas-travadas"]).toBe("Mediação 1: 8 minutos");
    expect(ETIQUETA_DO_MOMENTO["bancada-liberada"]).toBe("Etapa 5 Destravada");
  });

  test("o aviso discreto diz qual critério restritivo ficou", () => {
    expect(avisoDiscreto({ avancouComVies: false, criterios: { exercicios: "b", duvidas: "b", sugestoes: "a" } })).toBeNull();
    expect(avisoDiscreto({ avancouComVies: true, criterios: { exercicios: "b", duvidas: "a", sugestoes: "a" } })).toBe(
      "manteve o critério 1B (horário de acesso)",
    );
    expect(avisoDiscreto({ avancouComVies: true, criterios: { exercicios: "c", duvidas: "b", sugestoes: "c" } })).toBe(
      "manteve o critério 2B (estabilidade da conexão)",
    );
  });

  test("a evidência muda na publicação, não no resto do caminho", () => {
    const linha = {
      unidadeId: "e1",
      nome: "Ana",
      equipe: null,
      passo: "criterios",
      aguardandoProfessor: false,
      aposta: "a",
      simulacaoConcluida: true,
      cartoes: null,
      algoritmo: { aberto: false, marcados: [], correto: false },
      criterios: null,
      retestes: 0,
      equidade: null,
      avancouComVies: false,
      publicacao: null,
      niveis: null,
    } as const;
    const base = { linhas: [linha] } as unknown as PainelDaTurma;
    const andou = { linhas: [{ ...linha, passo: "reteste", retestes: 1 }] } as unknown as PainelDaTurma;
    const publicou = {
      linhas: [{ ...linha, passo: "concluida", niveis: { co20: "atingiu", co01: "atingiu", co18: "atingiu", co03: "nao_atingiu" } }],
    } as unknown as PainelDaTurma;
    expect(mudouAEvidencia(base, andou)).toBe(false);
    expect(mudouAEvidencia(base, publicou)).toBe(true);
  });
});
