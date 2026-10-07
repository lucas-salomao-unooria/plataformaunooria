import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  AREAS,
  CARACTERES,
  DISCIPLINAS,
  ETAPAS,
  HASHTAG_RE,
  IDS_DE_PROJETO,
  MAX_PALAVRAS_DA_LEGENDA,
  MAX_PALAVRAS_DO_BASTIDOR,
  ORIGENS_DO_PACOTE,
  PARAMETROS,
  PARAMETROS_VAZIOS,
  PASSOS,
  PERFIL_RE,
  PROJETOS_POR_AREA,
  ROTULO_DA_DISCIPLINA,
  ROTULO_DO_PASSO,
  TERMOS_PROIBIDOS,
  AVISO_DO_PODCAST_ANTES_DA_GALERIA,
  AVISO_DO_PODCAST_NA_GALERIA,
  aulaEmAndamento,
  areaDoProjeto,
  avisoDoPodcast,
  caminhoDaTurma,
  continuarGerando,
  corpoDosParametros,
  distribuirErros,
  erroDaResposta,
  estadoDaImagem,
  estandesPorArea,
  falhaDaIa,
  falhasAcumuladas,
  mudouAEvidencia,
  normalizarProjeto,
  ordenarLinhas,
  percentual,
  problemasDosParametros,
  problemasPorCampo,
  rotuloDaDisciplina,
  rotuloDoBotao,
  semExclamacao,
  termosProibidosEm,
  textoDaInvisibilidade,
  textoDaRevisao,
  textoDoDesvio,
  textoDoProgressoDaMidia,
  textoDoQueFalta,
  textoDosVotos,
  votosEmPercentual,
  type ConteudoDoPacote,
  type LinhaDoPainel,
  type ProjetoDoPacote,
  type VotosDaArea,
} from "./juri-estadual-tipos";

// ─────────────────────────────────────────────────────────────── o espelho

/**
 * O ESPELHO da api, conferido contra o texto dela. O hub não importa a api, e
 * por isso a segunda lista existe — este teste é o que impede que ela seja a
 * que ninguém atualiza junto. Lê os arquivos como TEXTO, como o teste do
 * Jornal: o que importa é o valor, não executar o módulo.
 */
const API = join(__dirname, "../../api/src/juri-estadual");
const ler = (arquivo: string) => readFileSync(join(API, arquivo), "utf8");

/** Os literais de string de `export const NOME = [...]`. */
function listaDaApi(fonte: string, nome: string): string[] {
  const corpo = new RegExp(`export const ${nome}(?::[^=]+)? = \\[([\\s\\S]*?)\\]`).exec(fonte)?.[1];
  expect(corpo, `${nome} não foi encontrado na api`).toBeDefined();
  return [...(corpo ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
}

function numeroDaApi(fonte: string, nome: string): number {
  const valor = new RegExp(`export const ${nome} = ([\\d_]+);`).exec(fonte)?.[1];
  expect(valor, `${nome} não foi encontrado na api`).toBeDefined();
  return Number((valor ?? "").replace(/_/g, ""));
}

function regexDaApi(fonte: string, nome: string): string {
  const valor = new RegExp(`export const ${nome} = /(.+)/;`).exec(fonte)?.[1];
  expect(valor, `${nome} não foi encontrado na api`).toBeDefined();
  return valor ?? "";
}

/** `campo: z.string().trim().min(3).max(60)` dentro do bloco de um schema. */
function tetosDoBloco(bloco: string): Record<string, { min: number; max: number }> {
  return Object.fromEntries(
    [...bloco.matchAll(/(\w+): z\.string\(\)\.trim\(\)\.min\((\d+)\)\.max\((\d+)\)/g)].map((m) => [
      m[1]!,
      { min: Number(m[2]), max: Number(m[3]) },
    ]),
  );
}

describe("o espelho do vocabulário da api", () => {
  const vocabulario = ler("vocabulario.ts");
  const passos = ler("regras/passos.ts");

  test("áreas, disciplinas e origens", () => {
    expect([...AREAS]).toEqual(listaDaApi(vocabulario, "AREAS"));
    expect([...DISCIPLINAS]).toEqual(listaDaApi(vocabulario, "DISCIPLINAS"));
    expect([...ORIGENS_DO_PACOTE]).toEqual(listaDaApi(vocabulario, "ORIGENS_DO_PACOTE"));
    expect(PROJETOS_POR_AREA).toBe(numeroDaApi(vocabulario, "PROJETOS_POR_AREA"));
  });

  test("toda disciplina tem rótulo em português", () => {
    expect(Object.keys(ROTULO_DA_DISCIPLINA).sort()).toEqual([...DISCIPLINAS].sort());
    expect(rotuloDaDisciplina("ciencias")).toBe("Ciências");
    expect(rotuloDaDisciplina("desconhecida")).toBe("desconhecida");
  });

  test("os passos e as etapas, na ordem", () => {
    expect([...PASSOS]).toEqual(listaDaApi(passos, "PASSOS"));
    expect([...ETAPAS]).toEqual(listaDaApi(passos, "ETAPAS"));
    expect(Object.keys(ROTULO_DO_PASSO)).toEqual([...PASSOS]);
  });

  test("os ids dos dezesseis estandes, e a área que o id diz", () => {
    expect(IDS_DE_PROJETO).toHaveLength(16);
    expect(IDS_DE_PROJETO.slice(0, 5)).toEqual(["proj-a1", "proj-a2", "proj-a3", "proj-a4", "proj-b1"]);
    expect(areaDoProjeto("proj-c3")).toBe("area_c");
  });
});

describe("o espelho das invariantes e do contrato", () => {
  const invariantes = ler("invariantes.ts");
  const contrato = ler("contrato-de-rotas.ts");

  test("os tetos de palavras, as formas de hashtag e perfil, os termos proibidos", () => {
    expect(MAX_PALAVRAS_DA_LEGENDA).toBe(numeroDaApi(invariantes, "MAX_PALAVRAS_DA_LEGENDA"));
    expect(MAX_PALAVRAS_DO_BASTIDOR).toBe(numeroDaApi(invariantes, "MAX_PALAVRAS_DO_BASTIDOR"));
    expect(HASHTAG_RE.source).toBe(regexDaApi(invariantes, "HASHTAG_RE"));
    expect(PERFIL_RE.source).toBe(regexDaApi(invariantes, "PERFIL_RE"));
    expect([...TERMOS_PROIBIDOS]).toEqual(listaDaApi(invariantes, "TERMOS_PROIBIDOS"));
  });

  test("os tetos de caractere do estande", () => {
    const bloco = /export const ProjetoDoPacoteSchema = z\.object\(\{([\s\S]*?)\n\}\);/.exec(contrato)?.[1] ?? "";
    expect(bloco, "ProjetoDoPacoteSchema não foi encontrado na api").not.toBe("");
    expect(tetosDoBloco(bloco)).toEqual(CARACTERES);
  });

  test("os tetos dos parâmetros do preparo", () => {
    const bloco = /export const ParametrosDoPreparoSchema = z\.object\(\{([\s\S]*?)\n\}\);/.exec(contrato)?.[1] ?? "";
    expect(tetosDoBloco(bloco)).toEqual({ tema: PARAMETROS.tema, assuntos: PARAMETROS.assuntos });
    expect(Number(/contexto: z\.string\(\)\.trim\(\)\.max\((\d+)\)/.exec(bloco)?.[1])).toBe(PARAMETROS.contextoMax);
  });

  test("a linha do painel não tem voto, taxa nem nível", () => {
    const linha = /export const LinhaDoPainelSchema = z\.object\(\{([\s\S]*?)\n\}\);/.exec(contrato)?.[1] ?? "";
    const campos = [...linha.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]);
    expect(campos).toEqual(["estudanteId", "nome", "usuario", "equipe", "entrou", "passo", "votou", "abriuAGaleria", "buscou", "revisou", "desviou", "concluiu"]);
  });
});

// ─────────────────────────────────────────────────────────────── as regras

function projeto(parcial: Partial<ProjetoDoPacote> = {}): ProjetoDoPacote {
  return {
    id: "proj-a1",
    area: "area_a",
    titulo: "Horta que se rega sozinha",
    escola: "Escola Estadual Rio Claro",
    perfil: "@horta.rioclaro",
    legenda: "Montamos uma horta com sensor de umidade que liga a irrigação quando a terra seca.",
    bastidor: "Primeiro teste do sensor: a bomba ligou duas vezes antes da hora.",
    hashtags: ["#meioambiente", "#horta"],
    imagem: { descricao: "Canteiro de horta escolar com mangueira e sensor", alt: "Horta da escola com sensor" },
    ...parcial,
  };
}

describe("o preparo", () => {
  test("parâmetros: disciplina do vocabulário, tema 3–60, assuntos 10–600, contexto opcional até 120", () => {
    expect(Object.keys(problemasDosParametros(PARAMETROS_VAZIOS)).sort()).toEqual(["assuntos", "disciplina", "tema"]);
    const validos = { disciplina: "ciencias", tema: "Feira", assuntos: "água, energia e lixo", contexto: "" };
    expect(problemasDosParametros(validos)).toEqual({});
    expect(problemasDosParametros({ ...validos, disciplina: "Ciências" }).disciplina).toBeDefined();
    expect(problemasDosParametros({ ...validos, contexto: "x".repeat(121) }).contexto).toBeDefined();
  });

  test("o corpo do preparo deixa o contexto AUSENTE quando vazio", () => {
    expect(corpoDosParametros({ disciplina: "arte", tema: " Mostra ", assuntos: " cor e forma ", contexto: "  " })).toEqual({
      disciplina: "arte",
      tema: "Mostra",
      assuntos: "cor e forma",
    });
    expect(corpoDosParametros({ disciplina: "arte", tema: "M", assuntos: "a", contexto: " periferia " }).contexto).toBe("periferia");
  });

  test("o estande válido não tem problema; cada campo aponta o seu", () => {
    expect(problemasPorCampo(projeto(), "#meioambiente")).toEqual({});
    const ruim = problemasPorCampo(
      projeto({
        titulo: "",
        perfil: "horta",
        legenda: Array.from({ length: 61 }, () => "palavra").join(" "),
        bastidor: "Testamos com Arduino na sala",
        hashtags: ["#horta", "#meioambiente"],
      }),
      "#meioambiente",
    );
    expect(Object.keys(ruim).sort()).toEqual(["bastidor", "hashtags", "legenda", "perfil", "titulo"]);
    expect(ruim.bastidor).toContain("arduino");
    expect(ruim.hashtags).toContain("#meioambiente");
  });

  test("os termos proibidos são por palavra inteira, sem acento e sem caixa", () => {
    expect(termosProibidosEm("Usamos o YouTube e o Lego")).toEqual(["youtube", "lego"]);
    expect(termosProibidosEm("Legal, um legume")).toEqual([]);
  });

  test("a exclamação vira ponto, no que viaja", () => {
    expect(semExclamacao("Venha ver!! Nosso robô!")).toBe("Venha ver. Nosso robô.");
    expect(normalizarProjeto(projeto({ titulo: "  Robô! ", legenda: "Funciona!" })).titulo).toBe("Robô.");
  });

  test("os erros da api vão para o estande que eles citam", () => {
    expect(distribuirErros(["legenda longa demais em proj-b2", "proj-a1 está na área errada", "as hashtags das categorias se repetem"])).toEqual({
      porProjeto: { "proj-b2": ["legenda longa demais em proj-b2"], "proj-a1": ["proj-a1 está na área errada"] },
      geral: ["as hashtags das categorias se repetem"],
    });
  });

  test("a grade da curadoria: quatro áreas, os estandes de cada uma na ordem do id", () => {
    const conteudo: ConteudoDoPacote = {
      tema: "Feira",
      categorias: AREAS.map((area) => ({ area, nome: area, hashtag: `#${area}` })),
      projetos: [projeto({ id: "proj-b2", area: "area_b" }), projeto({ id: "proj-b1", area: "area_b" }), projeto()],
    };
    const grade = estandesPorArea(conteudo);
    expect(grade.map((g) => g.categoria.area)).toEqual([...AREAS]);
    expect(grade[1]?.projetos.map((p) => p.id)).toEqual(["proj-b1", "proj-b2"]);
  });

  test("sem saldo e indisponível pelo status ou pelo código; o resto não é falha de IA", () => {
    expect(falhaDaIa(429, null)).toBe("sem-saldo");
    expect(falhaDaIa(400, "sem-saldo-de-ia")).toBe("sem-saldo");
    expect(falhaDaIa(503, null)).toBe("indisponivel");
    expect(falhaDaIa(400, "pacote-invalido")).toBeNull();
    expect(erroDaResposta({ codigo: "pacote-invalido", erros: ["a", 1] }, "padrão")).toEqual({
      codigo: "pacote-invalido",
      mensagem: "padrão",
      erros: ["a"],
    });
  });

  test("o caminho da turma escapa o id", () => {
    expect(caminhoDaTurma("a b")).toBe("/juri-estadual/turmas/a%20b");
  });
});

describe("o painel da aula", () => {
  const votos = (a: number, b: number, c: number, d: number): VotosDaArea[] =>
    [a, b, c, d].map((v, i) => ({ area: AREAS[i]!, nome: `Área ${i}`, hashtag: `#a${i}`, votos: v }));

  test("um botão só, e ele diz a etapa de destino", () => {
    expect(rotuloDoBotao("galeria")).toBe("Liberar a Galeria Oculta");
    expect(rotuloDoBotao("desvio")).toBe("Liberar a rodada de desvio");
    expect(rotuloDoBotao(null)).toBeNull();
  });

  test("o aviso do podcast recomenda o momento: depois da Galeria Oculta, na aula em andamento", () => {
    expect(avisoDoPodcast(true, "galeria")).toBe(AVISO_DO_PODCAST_NA_GALERIA);
    expect(avisoDoPodcast(true, "desvio")).toBe(AVISO_DO_PODCAST_NA_GALERIA);
    /* O podcast é opcional e do professor: o aviso recomenda, não proíbe. */
    expect(AVISO_DO_PODCAST_ANTES_DA_GALERIA).toMatch(/escolha sua/);
    expect(avisoDoPodcast(true, "exploracao")).toBe(AVISO_DO_PODCAST_ANTES_DA_GALERIA);
    expect(avisoDoPodcast(true, null)).toBe(AVISO_DO_PODCAST_ANTES_DA_GALERIA);
    /* Fora do ar, a etapa gravada é de outra rodada: o aviso é o de antes. */
    expect(avisoDoPodcast(false, "galeria")).toBe(AVISO_DO_PODCAST_ANTES_DA_GALERIA);
    expect(AVISO_DO_PODCAST_ANTES_DA_GALERIA).toMatch(/Galeria Oculta/);
  });

  test("os votos em percentual do total, na ordem das áreas", () => {
    expect(votosEmPercentual(votos(1, 1, 2, 0))).toEqual([25, 25, 50, 0]);
    expect(votosEmPercentual([])).toEqual([0, 0, 0, 0]);
    expect(percentual(1, 0)).toBe(0);
  });

  test("os textos têm o sujeito certo: jurado ou computador", () => {
    expect(textoDosVotos({ votaram: 24, total: 26 }, false)).toBe("24 de 26 jurados votaram.");
    expect(textoDosVotos({ votaram: 3, total: 8 }, true)).toBe("3 de 8 computadores votaram.");
    expect(textoDoQueFalta({ votaram: 24, total: 26 }, false)).toBe("Aguardando 2 jurados para fechar o lacre coletivo.");
    expect(textoDoQueFalta({ votaram: 26, total: 26 }, false)).toBeNull();
    expect(textoDaRevisao({ mantiveram: 20, trocaram: 1, complementaram: 2 }, false)).toBe(
      "1 jurado trocou o voto, 2 complementaram e 20 mantiveram.",
    );
    expect(textoDaRevisao({ mantiveram: 0, trocaram: 0, complementaram: 0 }, false)).toBeNull();
    expect(textoDoDesvio(5, 26, false)).toBe("5 de 26 jurados terminaram a rodada de desvio.");
    expect(textoDoDesvio(1, 3, true)).toBe("1 de 3 computadores terminaram a rodada de desvio.");
  });

  test("a invisibilidade é o número da api, nunca um número cravado", () => {
    expect(textoDaInvisibilidade(null)).not.toMatch(/\d/);
    expect(textoDaInvisibilidade(47)).toContain("47%");
  });

  test("a aula para de consultar quando todos concluíram com o desvio aberto", () => {
    const resumo = { total: 2, concluiram: 2 } as Parameters<typeof aulaEmAndamento>[0]["resumo"];
    expect(aulaEmAndamento({ etapa: "desvio", resumo })).toBe(false);
    expect(aulaEmAndamento({ etapa: "galeria", resumo })).toBe(true);
    expect(aulaEmAndamento({ etapa: "exploracao", resumo })).toBe(true);
  });

  test("a folha é alfabética pelo que a primeira célula mostra", () => {
    const linha = (nome: string, equipe: string | null): LinhaDoPainel => ({
      estudanteId: nome,
      nome,
      usuario: nome,
      equipe: equipe ? { id: equipe, nome: equipe } : null,
      entrou: true,
      passo: "feed",
      votou: false,
      abriuAGaleria: false,
      buscou: false,
      revisou: false,
      desviou: false,
      concluiu: false,
    });
    expect(ordenarLinhas([linha("Zé", "Equipe 10"), linha("Ana", "Equipe 2"), linha("Bia", null)]).map((l) => l.equipe?.nome ?? l.nome)).toEqual([
      "Bia",
      "Equipe 2",
      "Equipe 10",
    ]);
  });
});

describe("o que faz o painel de habilidades se atualizar sozinho", () => {
  type Passo = LinhaDoPainel["passo"];
  const linha = (passo: Passo, i: number): LinhaDoPainel => ({
    estudanteId: `e${i}`,
    nome: `E${i}`,
    usuario: `e${i}`,
    equipe: null,
    entrou: true,
    passo,
    votou: true,
    abriuAGaleria: false,
    buscou: false,
    revisou: false,
    desviou: false,
    concluiu: false,
  });
  const painel = (
    passos: Passo[] = ["galeria", "cadeia", "cadeia", "enquetes"],
    resumo: Partial<{ revisaram: number; concluiram: number }> = {},
    rodada = 1,
    id = "p1",
  ) => ({
    pacote: { id, disciplina: "ciencias", tema: "t", origem: "ia" as const, midia: { total: 16, prontas: 16 } },
    rodada,
    linhas: passos.map(linha),
    resumo: {
      total: passos.length,
      entraram: passos.length,
      votaram: passos.length,
      revisaram: 3,
      desviaram: 0,
      concluiram: 0,
      computadores: { votaram: passos.length, total: passos.length },
      porComputador: false,
      votosPorArea: [],
      invisibilidadeMedia: null,
      revisao: { mantiveram: 3, trocaram: 0, complementaram: 0 },
      votosRevisadosPorArea: [],
      ...resumo,
    },
  });

  test("relê na revisão do voto, na cadeia montada, no concluir depois das enquetes, e quando a atividade ou a rodada trocam", () => {
    const antes = painel();
    expect(mudouAEvidencia(antes, painel())).toBe(false);
    // A revisão do voto marca a EF06CO10 e a EF06CO01.
    expect(mudouAEvidencia(antes, painel(undefined, { revisaram: 4 }))).toBe(true);
    // A cadeia montada: a linha sai de `cadeia` (EF06CO03), sem contador no resumo.
    expect(mudouAEvidencia(antes, painel(["galeria", "cadeia", "mariana", "enquetes"]))).toBe(true);
    expect(mudouAEvidencia(antes, painel(undefined, { concluiram: 1 }))).toBe(true);
    expect(mudouAEvidencia(antes, painel(undefined, {}, 2))).toBe(true);
    expect(mudouAEvidencia(antes, painel(undefined, {}, 1, "p2"))).toBe(true);
  });

  test("passo que não marca nada não relê a página: o voto lacrado, a galeria aberta e o caso Mariana", () => {
    expect(mudouAEvidencia(painel(["feed"]), painel(["lacrada"]))).toBe(false);
    expect(mudouAEvidencia(painel(["lacrada"]), painel(["galeria"]))).toBe(false);
    expect(mudouAEvidencia(painel(["mariana"]), painel(["enquetes"]))).toBe(false);
  });
});

describe("as imagens", () => {
  test("o laço para no completo e quando uma volta não gera nada", () => {
    expect(continuarGerando({ completo: false, geradas: ["proj-a1"] })).toBe(true);
    expect(continuarGerando({ completo: true, geradas: ["proj-a1"] })).toBe(false);
    expect(continuarGerando({ completo: false, geradas: [] })).toBe(false);
  });

  test("a falha que saiu depois deixa de ser falha", () => {
    expect(falhasAcumuladas(["proj-a1", "proj-b1"], { falharam: ["proj-c1"], imagens: { "proj-a1": "u" } })).toEqual(["proj-b1", "proj-c1"]);
  });

  test("o progresso em palavras", () => {
    expect(textoDoProgressoDaMidia({ total: 16, prontas: 3 })).toBe("3 de 16 imagens prontas.");
    expect(textoDoProgressoDaMidia({ total: 16, prontas: 16 })).toBe("As 16 imagens estão prontas.");
  });
});

describe("a imagem de cada estande na aprovação", () => {
  test("gerando > sem imagem > aguardando o OK > aprovada", () => {
    expect(estadoDaImagem({ temImagem: true, gerando: true, aprovadas: false })).toBe("gerando");
    expect(estadoDaImagem({ temImagem: false, gerando: false, aprovadas: false })).toBe("sem-imagem");
    expect(estadoDaImagem({ temImagem: true, gerando: false, aprovadas: false })).toBe("aguardando");
    expect(estadoDaImagem({ temImagem: true, gerando: false, aprovadas: true })).toBe("aprovada");
    /* Aprovado sem imagem: o estande segue com a arte desenhada, e a grade diz isso. */
    expect(estadoDaImagem({ temImagem: false, gerando: false, aprovadas: true })).toBe("sem-imagem");
  });
});
