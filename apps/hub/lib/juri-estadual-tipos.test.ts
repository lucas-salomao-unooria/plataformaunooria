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
  IDS_DE_PROJETO_LEGADOS,
  ID_DE_PROJETO_RE,
  MAX_PALAVRAS_DA_LEGENDA,
  MAX_PALAVRAS_DO_BASTIDOR,
  ORIGENS_DO_PACOTE,
  PARAMETROS,
  PARAMETROS_VAZIOS,
  PASSOS,
  PERFIL_RE,
  PROJETOS_POR_AREA,
  PROJETOS_POR_AREA_LEGADO,
  TOTAL_DE_PROJETOS,
  ROTULO_DA_DISCIPLINA,
  ROTULO_DO_PASSO,
  TERMOS_PROIBIDOS,
  AVISO_DO_PODCAST_ANTES_DA_GALERIA,
  AVISO_DO_PODCAST_NA_GALERIA,
  aulaEmAndamento,
  areaDoProjeto,
  avisoDoPodcast,
  caminhoDaTurma,
  compararIdsDeProjeto,
  idsDoBancoPorArea,
  numeroDoProjeto,
  rotuloDaAbaDaArea,
  textoDoProgressoDoBanco,
  continuarGerando,
  corpoDosParametros,
  distribuirErros,
  erroDaResposta,
  estadoDaImagem,
  LAMINAS,
  ROTULO_DA_LAMINA,
  chaveDaMidia,
  laminasSemImagem,
  projetoDaChave,
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
  textoDaConcentracao,
  textoDaRevisao,
  textoDaTaxaDeRevisao,
  avisoDoRascunho,
  AVISO_DO_BANCO_PADRAO,
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
    expect(PROJETOS_POR_AREA_LEGADO).toBe(numeroDaApi(vocabulario, "PROJETOS_POR_AREA_LEGADO"));
    expect(ID_DE_PROJETO_RE.source).toBe(regexDaApi(vocabulario, "ID_DE_PROJETO_RE"));
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

  test("os ids dos quarenta estandes (e dos dezesseis legados), e a área que o id diz", () => {
    expect(TOTAL_DE_PROJETOS).toBe(40);
    expect(IDS_DE_PROJETO).toHaveLength(40);
    expect(IDS_DE_PROJETO.slice(8, 11)).toEqual(["proj-a9", "proj-a10", "proj-b1"]);
    expect(IDS_DE_PROJETO_LEGADOS).toHaveLength(16);
    expect(IDS_DE_PROJETO_LEGADOS.every((id) => IDS_DE_PROJETO.includes(id))).toBe(true);
    expect(IDS_DE_PROJETO.every((id) => ID_DE_PROJETO_RE.test(id))).toBe(true);
    expect(["proj-a0", "proj-a11", "proj-e1"].some((id) => ID_DE_PROJETO_RE.test(id))).toBe(false);
    expect(areaDoProjeto("proj-c3")).toBe("area_c");
    expect(areaDoProjeto("proj-d10")).toBe("area_d");
    expect(numeroDoProjeto("proj-b10")).toBe(10);
  });

  test("a ordem é numérica dentro da área, nunca a de texto", () => {
    expect(["proj-b1", "proj-a10", "proj-a2", "proj-a9"].sort(compararIdsDeProjeto)).toEqual(["proj-a2", "proj-a9", "proj-a10", "proj-b1"]);
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

  test("os tetos de caractere do estande que se ESCREVE (sem os formatos da 0.4.x)", () => {
    const bloco = /export const ProjetoDoPacoteSchema = z\.object\(\{([\s\S]*?)\n\}\);/.exec(contrato)?.[1] ?? "";
    expect(bloco, "ProjetoDoPacoteSchema não foi encontrado na api").not.toBe("");
    /* O esquema de escrita é o de leitura menos o que ele omite. */
    const omitidos = /ProjetoDoPacoteEscritaSchema = ProjetoDoPacoteSchema\.omit\(\{([^}]*)\}\)/.exec(contrato)?.[1] ?? "";
    expect(omitidos, "ProjetoDoPacoteEscritaSchema não foi encontrado na api").not.toBe("");
    const fora = [...omitidos.matchAll(/(\w+): true/g)].map((m) => m[1]!);
    expect(fora.sort()).toEqual(["depoimento", "prototipo"]);
    const tetos = tetosDoBloco(bloco);
    for (const campo of fora) delete tetos[campo];
    expect(tetos).toEqual(CARACTERES);
  });

  test("a concentração está no resumo do painel, e não na linha", () => {
    const painel = /export const PainelSchema = z\.object\(\{([\s\S]*?)\n\}\);/.exec(contrato)?.[1] ?? "";
    expect(painel).toMatch(/concentracao: z\.object\(\{\s*curtiram:[^\n]*\n\s*naoCurtiram:/);
    expect(painel).not.toContain("invisibilidadeMedia");
  });

  test("o rascunho traz as imagens que já existem", () => {
    const rascunho = /export const RascunhoSchema = z\.object\(\{([\s\S]*?)\n\}\);/.exec(contrato)?.[1] ?? "";
    expect(rascunho).toMatch(/imagens: z\.record\(z\.string\(\)\)/);
  });

  test("as imagens do banco padrão: a forma do progresso e da geração", () => {
    const progresso = /export const ImagensDoBancoPadraoSchema = z\.object\(\{([\s\S]*?)\n\}\);/.exec(contrato)?.[1] ?? "";
    expect([...progresso.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1])).toEqual(["total", "prontas", "faltam", "completo", "imagens"]);
    expect(progresso).toMatch(/faltam: z\.array\(ChaveDaMidiaSchema\)/);
    const geracao = /export const GeracaoDoBancoPadraoSchema = ImagensDoBancoPadraoSchema\.extend\(\{([\s\S]*?)\n\}\);/.exec(contrato)?.[1] ?? "";
    expect([...geracao.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1])).toEqual(["geradas", "falharam"]);
    const controller = ler("juri-estadual-banco-padrao.controller.ts");
    expect(controller).toContain('@Controller("juri-estadual/banco-padrao")');
    expect(controller).toContain('@Get("imagens")');
    expect(controller).toContain('@Post("imagens")');
  });

  test("as lâminas do carrossel são as da api, na mesma ordem, e a chave da capa é o id (ADR-178)", () => {
    const fonte = ler("regras/laminas.ts");
    const declaradas = /export const LAMINAS = \[([^\]]*)\]/.exec(fonte)?.[1] ?? "";
    expect([...declaradas.matchAll(/"([a-z]+)"/g)].map((m) => m[1])).toEqual([...LAMINAS]);
    expect(fonte).toContain('return lamina === "capa" ? projetoId : `${projetoId}:${lamina}`;');
    expect(contrato).toMatch(/lamina: LaminaSchema\.default\("capa"\)/);
  });

  test("os tetos dos parâmetros do preparo", () => {
    const bloco = /export const ParametrosDoPreparoSchema = z\.object\(\{([\s\S]*?)\n\}\);/.exec(contrato)?.[1] ?? "";
    expect(tetosDoBloco(bloco)).toEqual({ tema: PARAMETROS.tema, assuntos: PARAMETROS.assuntos });
    expect(Number(/contexto: z\.string\(\)\.trim\(\)\.max\((\d+)\)/.exec(bloco)?.[1])).toBe(PARAMETROS.contextoMax);
  });

  test("a linha do painel não tem voto, taxa nem nível", () => {
    const linha = /export const LinhaDoPainelSchema = z\.object\(\{([\s\S]*?)\n\}\);/.exec(contrato)?.[1] ?? "";
    const campos = [...linha.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]);
    expect(campos).toEqual(["estudanteId", "nome", "usuario", "equipe", "entrou", "passo", "votou", "ocioso", "separou", "abriuAGaleria", "buscou", "revisou", "concluiu"]);
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

  test("os erros de proj-b10 vão para o proj-b10, não para o proj-b1", () => {
    expect(distribuirErros(["legenda longa demais em proj-b10"]).porProjeto).toEqual({ "proj-b10": ["legenda longa demais em proj-b10"] });
  });

  test("a grade da curadoria: quatro áreas, os estandes de cada uma na ordem NUMÉRICA do id", () => {
    const conteudo: ConteudoDoPacote = {
      tema: "Feira",
      categorias: AREAS.map((area) => ({ area, nome: area, hashtag: `#${area}` })),
      projetos: [
        projeto({ id: "proj-b10", area: "area_b" }),
        projeto({ id: "proj-b2", area: "area_b" }),
        projeto({ id: "proj-b1", area: "area_b" }),
        projeto(),
      ],
    };
    const grade = estandesPorArea(conteudo);
    expect(grade.map((g) => g.categoria.area)).toEqual([...AREAS]);
    expect(grade[1]?.projetos.map((p) => p.id)).toEqual(["proj-b1", "proj-b2", "proj-b10"]);
  });

  test("o rótulo da aba: o nome e a contagem, ou a pendência quando há", () => {
    expect(rotuloDaAbaDaArea("Saúde", 10)).toBe("Saúde · 10");
    expect(rotuloDaAbaDaArea("Saúde", 10, { quantos: 0, texto: "com ajuste" })).toBe("Saúde · 10");
    expect(rotuloDaAbaDaArea("Saúde", 10, { quantos: 2, texto: "com ajuste" })).toBe("Saúde · 2 com ajuste");
  });

  test("o estande que viaja não leva os formatos da 0.4.x", () => {
    const antigo = { ...projeto(), prototipo: "Um protótipo antigo", depoimento: "Um depoimento antigo" };
    expect(Object.keys(normalizarProjeto(antigo))).not.toContain("prototipo");
    expect(Object.keys(normalizarProjeto(antigo))).not.toContain("depoimento");
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

  test("o rascunho que caiu no banco padrão diz por quê; o da IA não avisa nada", () => {
    expect(avisoDoRascunho({ usouIa: true, motivo: null })).toBeNull();
    expect(avisoDoRascunho({ usouIa: false, motivo: "sem-saldo-de-ia" })).toBe(AVISO_DO_BANCO_PADRAO["sem-saldo-de-ia"]);
    expect(avisoDoRascunho({ usouIa: false, motivo: "ia-indisponivel" })).toMatch(/demoraram a responder/);
  });

  test("o caminho da turma escapa o id", () => {
    expect(caminhoDaTurma("a b")).toBe("/juri-estadual/turmas/a%20b");
  });
});

describe("o painel da aula", () => {
  const votos = (a: number, b: number, c: number, d: number): VotosDaArea[] =>
    [a, b, c, d].map((v, i) => ({ area: AREAS[i]!, nome: `Área ${i}`, hashtag: `#a${i}`, votos: v }));

  test("um botão só, e ele diz a etapa de destino", () => {
    expect(rotuloDoBotao("galeria")).toBe("Liberar Auditoria");
    expect(rotuloDoBotao("exploracao")).toBeNull();
    expect(rotuloDoBotao(null)).toBeNull();
  });

  test("o aviso do podcast: o literal do one-pager antes da auditoria, a hora certa depois dela", () => {
    expect(avisoDoPodcast(true, "galeria")).toBe(AVISO_DO_PODCAST_NA_GALERIA);
    expect(AVISO_DO_PODCAST_ANTES_DA_GALERIA).toMatch(/estritamente após a conclusão da Etapa 4/);
    expect(avisoDoPodcast(true, "exploracao")).toBe(AVISO_DO_PODCAST_ANTES_DA_GALERIA);
    expect(avisoDoPodcast(true, null)).toBe(AVISO_DO_PODCAST_ANTES_DA_GALERIA);
    /* Fora do ar, a etapa gravada é de outra rodada: o aviso é o de antes. */
    expect(avisoDoPodcast(false, "galeria")).toBe(AVISO_DO_PODCAST_ANTES_DA_GALERIA);
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
    expect(textoDaRevisao({ mantiveram: 20, trocaram: 1 }, false)).toBe("1 jurado trocou o voto e 20 mantiveram.");
    expect(textoDaRevisao({ mantiveram: 0, trocaram: 0 }, false)).toBeNull();
    expect(textoDaTaxaDeRevisao(3, 26, false)).toBe("3 de 26 jurados revisaram o voto após a busca ativa na Galeria Oculta.");
  });

  test("a concentração é o número da api, nunca um número cravado", () => {
    expect(textoDaConcentracao({ curtiram: null, naoCurtiram: null })).not.toMatch(/\d/);
    expect(textoDaConcentracao({ curtiram: 70, naoCurtiram: 30 })).toBe(
      "Quem curtiu: em média 70% do feed numa área só. Quem não curtiu: 30%.",
    );
    expect(textoDaConcentracao({ curtiram: 72, naoCurtiram: null })).toMatch(/^Quem curtiu: em média 72%.*Todos que votaram curtiram/);
    expect(textoDaConcentracao({ curtiram: null, naoCurtiram: 31 })).toMatch(/^Quem não curtiu: em média 31%/);
  });

  test("a aula para de consultar quando todos concluíram com a auditoria liberada", () => {
    const resumo = { total: 2, concluiram: 2 } as Parameters<typeof aulaEmAndamento>[0]["resumo"];
    expect(aulaEmAndamento({ etapa: "galeria", resumo })).toBe(false);
    expect(aulaEmAndamento({ etapa: "galeria", resumo: { ...resumo, concluiram: 1 } })).toBe(true);
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
      ocioso: false,
      separou: false,
      abriuAGaleria: false,
      buscou: false,
      revisou: false,
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
    ocioso: false,
    separou: true,
    abriuAGaleria: false,
    buscou: false,
    revisou: false,
    concluiu: false,
  });
  const painel = (
    passos: Passo[] = ["galeria", "cadeia", "cadeia", "fim"],
    resumo: Partial<{ separaram: number; revisaram: number; concluiram: number }> = {},
    rodada = 1,
    id = "p1",
  ) => ({
    pacote: { id, disciplina: "ciencias", tema: "t", origem: "ia" as const, midia: { total: 40, prontas: 40 } },
    rodada,
    linhas: passos.map(linha),
    resumo: {
      total: passos.length,
      entraram: passos.length,
      votaram: passos.length,
      separaram: passos.length,
      revisaram: 3,
      concluiram: 0,
      ociosos: 0,
      computadores: { votaram: passos.length, total: passos.length },
      porComputador: false,
      votosPorArea: [],
      concentracao: { curtiram: null, naoCurtiram: null },
      revisao: { mantiveram: 3, trocaram: 0 },
      votosRevisadosPorArea: [],
      ...resumo,
    },
  });

  test("relê na separação, na regra enviada, e quando a atividade ou a rodada trocam (ficha 6, ADR-176)", () => {
    const antes = painel();
    expect(mudouAEvidencia(antes, painel())).toBe(false);
    // A separação das pastas, corrigida no voto, marca a EF06CO01.
    expect(mudouAEvidencia(antes, painel(undefined, { separaram: 5 }))).toBe(true);
    // A regra enviada: a linha sai de `cadeia` para `fim` (EF06CO03), sem contador no resumo.
    expect(mudouAEvidencia(antes, painel(["galeria", "cadeia", "fim", "fim"]))).toBe(true);
    expect(mudouAEvidencia(antes, painel(undefined, {}, 2))).toBe(true);
    expect(mudouAEvidencia(antes, painel(undefined, {}, 1, "p2"))).toBe(true);
  });

  test("o que não marca nada não relê a página: a espera, a galeria, a revisão do voto e a sessão antiga que conclui", () => {
    expect(mudouAEvidencia(painel(["feed"]), painel(["classificacao"]))).toBe(false);
    expect(mudouAEvidencia(painel(["lacrada"]), painel(["galeria"]))).toBe(false);
    expect(mudouAEvidencia(painel(), painel(undefined, { revisaram: 4 }))).toBe(false);
    expect(mudouAEvidencia(painel(["mariana"]), painel(["fim"]))).toBe(false);
    expect(mudouAEvidencia(painel(), painel(undefined, { concluiram: 1 }))).toBe(false);
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

  test("o progresso em palavras, com o total do pacote (40, ou 16 no legado)", () => {
    expect(textoDoProgressoDaMidia({ total: 40, prontas: 3 })).toBe("3 de 40 imagens prontas.");
    expect(textoDoProgressoDaMidia({ total: 16, prontas: 16 })).toBe("As 16 imagens estão prontas.");
  });

  test("o banco padrão: os ids por área em ordem numérica, com e sem imagem, e o progresso", () => {
    const porArea = idsDoBancoPorArea({ imagens: { "proj-a10": "u", "proj-a1": "u" }, faltam: ["proj-a2", "proj-b1", "nada"] });
    expect(porArea.map((a) => a.area)).toEqual([...AREAS]);
    expect(porArea[0]?.ids).toEqual(["proj-a1", "proj-a2", "proj-a10"]);
    expect(porArea[1]?.ids).toEqual(["proj-b1"]);
    expect(textoDoProgressoDoBanco({ total: 40, prontas: 12 })).toBe("12 de 40 imagens do banco prontas.");
    expect(textoDoProgressoDoBanco({ total: 40, prontas: 40 })).toBe("As 40 imagens do banco estão prontas.");
  });

  test("as chaves das lâminas (ADR-178): a capa é o id; o banco agrupa as quatro no projeto", () => {
    expect(chaveDaMidia("proj-a1", "capa")).toBe("proj-a1");
    expect(chaveDaMidia("proj-a1", "bastidor")).toBe("proj-a1:bastidor");
    expect(projetoDaChave("proj-a1:equipe")).toBe("proj-a1");
    expect(laminasSemImagem("proj-a1", { "proj-a1": "u", "proj-a1:detalhe": "u" })).toBe(2);
    const porArea = idsDoBancoPorArea({ imagens: { "proj-a1:detalhe": "u" }, faltam: ["proj-a1", "proj-a2:bastidor", "proj-a2:selfie:x"] });
    expect(porArea[0]?.ids).toEqual(["proj-a1", "proj-a2"]);
    expect(LAMINAS.map((l) => ROTULO_DA_LAMINA[l])).toHaveLength(4);
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
