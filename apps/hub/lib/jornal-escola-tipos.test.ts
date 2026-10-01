import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  CARACTERES,
  COMPOSICAO,
  ETAPAS,
  IDS_DE_BLOCO,
  IDS_DE_NOTICIA,
  MEIOS,
  MEIOS_COM_IMAGEM_OBRIGATORIA,
  MEIOS_DIGITAIS,
  MEIOS_TRADICIONAIS,
  MOTIVOS,
  ORIGENS_DO_PACOTE,
  PARAMETROS,
  PASSOS,
  REGUAS_DE_PALAVRAS,
  TERMOS_PROIBIDOS_NA_TELA,
  TIPOS_DE_PISTA,
  aulaEmAndamento,
  composicaoDoPacote,
  continuarGerando,
  corpoDosParametros,
  destaqueDoRadar,
  distribuirErros,
  erroDaResposta,
  escolhaDoGabarito,
  falhasAcumuladas,
  gabaritoDaEscolha,
  histogramaEmPercentual,
  normalizarNoticia,
  ordenarLinhas,
  percentual,
  problemasDaComposicao,
  problemasDosParametros,
  problemasPorCampo,
  rotuloDoBotao,
  termosProibidosEm,
  textoDasRodadas,
  textoDoDestaque,
  textoDoEnvio,
  textoDoHistograma,
  textoDoProgressoDaMidia,
  textoDoTermometro,
  type LinhaDoPainel,
  type Meio,
  type NoticiaDoPacote,
  type NoticiaNoRadar,
} from "./jornal-escola-tipos";

// ─────────────────────────────────────────────────────────────── o espelho

/**
 * O ESPELHO da api, conferido contra o texto dela. O hub não importa a api (o
 * bundle do hub não carrega código de servidor), e por isso a segunda lista
 * existe — este teste é o que impede que ela seja a que ninguém atualiza junto.
 * Lê os arquivos como TEXTO, como o `despachante-da-ficha.test.ts` lê o
 * `page.tsx`: o que importa é o valor, não executar o módulo.
 */
const API = join(__dirname, "../../api/src/jornal-escola");
const ler = (arquivo: string) => readFileSync(join(API, arquivo), "utf8");

/** Os literais de string de `export const NOME = [...]`. */
function listaDaApi(fonte: string, nome: string): string[] {
  const corpo = new RegExp(`export const ${nome}(?::[^=]+)? = \\[([\\s\\S]*?)\\]`).exec(fonte)?.[1];
  expect(corpo, `${nome} não foi encontrado na api`).toBeDefined();
  return [...(corpo ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
}

/** `chave: { min: 3, max: 10 }` de um objeto `export const NOME = {...}`. */
function reguasDaApi(fonte: string, nome: string): Record<string, { min: number; max: number }> {
  const corpo = new RegExp(`export const ${nome} = \\{([\\s\\S]*?)\\} as const`).exec(fonte)?.[1];
  expect(corpo, `${nome} não foi encontrado na api`).toBeDefined();
  return Object.fromEntries(
    [...(corpo ?? "").matchAll(/(\w+): \{ min: (\d+), max: (\d+) \}/g)].map((m) => [m[1]!, { min: Number(m[2]), max: Number(m[3]) }]),
  );
}

describe("o espelho do vocabulário da api", () => {
  const vocabulario = ler("vocabulario.ts");
  const passos = ler("regras/passos.ts");

  test("ids, meios, pistas, motivos, origens e blocos", () => {
    expect([...IDS_DE_NOTICIA]).toEqual(listaDaApi(vocabulario, "IDS_DE_NOTICIA"));
    expect([...MEIOS]).toEqual(listaDaApi(vocabulario, "MEIOS"));
    expect([...MEIOS_TRADICIONAIS]).toEqual(listaDaApi(vocabulario, "MEIOS_TRADICIONAIS"));
    expect([...MEIOS_DIGITAIS]).toEqual(listaDaApi(vocabulario, "MEIOS_DIGITAIS"));
    expect([...TIPOS_DE_PISTA]).toEqual(listaDaApi(vocabulario, "TIPOS_DE_PISTA"));
    expect([...MOTIVOS]).toEqual(listaDaApi(vocabulario, "MOTIVOS"));
    expect([...ORIGENS_DO_PACOTE]).toEqual(listaDaApi(vocabulario, "ORIGENS_DO_PACOTE"));
    /* `IDS_DE_BLOCO` na api é `[...BLOCOS_VALIDOS, ...BLOCOS_ISCA]`, e `BLOCOS_VALIDOS` é `TIPOS_DE_PISTA`. */
    expect([...IDS_DE_BLOCO]).toEqual([...listaDaApi(vocabulario, "TIPOS_DE_PISTA"), ...listaDaApi(vocabulario, "BLOCOS_ISCA")]);
  });

  test("os passos e as etapas, na ordem", () => {
    expect([...PASSOS]).toEqual(listaDaApi(passos, "PASSOS"));
    expect([...ETAPAS]).toEqual(listaDaApi(passos, "ETAPAS"));
  });
});

describe("o espelho das invariantes e do contrato", () => {
  const invariantes = ler("invariantes.ts");
  const contrato = ler("contrato-de-rotas.ts");

  test("as réguas de palavras e a composição do pacote", () => {
    expect(reguasDaApi(invariantes, "REGUAS_DE_PALAVRAS")).toEqual(REGUAS_DE_PALAVRAS);
    const composicao = new RegExp("export const COMPOSICAO = \\{([\\s\\S]*?)\\} as const").exec(invariantes)?.[1] ?? "";
    expect(Number(/publicaveisMin: (\d+)/.exec(composicao)?.[1])).toBe(COMPOSICAO.publicaveisMin);
    expect(Number(/comImagemMin: (\d+)/.exec(composicao)?.[1])).toBe(COMPOSICAO.comImagemMin);
    expect(reguasDaApi(`export const X = {${composicao}} as const`, "X")).toEqual({
      antigas: COMPOSICAO.antigas,
      semConfirmacao: COMPOSICAO.semConfirmacao,
    });
    expect([...MEIOS_COM_IMAGEM_OBRIGATORIA]).toEqual(listaDaApi(invariantes, "MEIOS_COM_IMAGEM_OBRIGATORIA"));
  });

  test("os termos que a criança não pode ler", () => {
    expect([...TERMOS_PROIBIDOS_NA_TELA]).toEqual(listaDaApi(invariantes, "TERMOS_PROIBIDOS_NA_TELA"));
  });

  test("os tetos de caractere da notícia e dos parâmetros do preparo", () => {
    const noticia = /export const NoticiaDoPacoteSchema = z\.object\(([\s\S]*?)\n\}\);/.exec(contrato)?.[1] ?? "";
    const tetos = Object.fromEntries(
      [...noticia.matchAll(/(\w+): Texto\((\d+), (\d+)\)/g)].map((m) => [m[1]!, { min: Number(m[2]), max: Number(m[3]) }]),
    );
    expect(tetos).toEqual({
      veiculo: CARACTERES.veiculo,
      falante: CARACTERES.falante,
      manchete: CARACTERES.manchete,
      resumo: CARACTERES.resumo,
      corpo: CARACTERES.corpo,
      legenda: CARACTERES.legenda,
      descricaoImagem: CARACTERES.descricaoImagem,
      fonte: CARACTERES.pista,
      data: CARACTERES.pista,
      autoria: CARACTERES.pista,
      explicacao: CARACTERES.explicacao,
      leitor: CARACTERES.leitor,
      fala: CARACTERES.fala,
    });

    const parametros = /export const ParametrosDoPreparoSchema = z\.object\(\{([\s\S]*?)\}\);/.exec(contrato)?.[1] ?? "";
    expect(/disciplina: z\.string\(\)\.trim\(\)\.min\((\d+)\)\.max\((\d+)\)/.exec(parametros)?.slice(1).map(Number)).toEqual([
      PARAMETROS.disciplina.min,
      PARAMETROS.disciplina.max,
    ]);
    expect(/tema: z\.string\(\)\.trim\(\)\.min\((\d+)\)\.max\((\d+)\)/.exec(parametros)?.slice(1).map(Number)).toEqual([
      PARAMETROS.tema.min,
      PARAMETROS.tema.max,
    ]);
    expect(Number(/topicos: z\.string\(\)\.trim\(\)\.max\((\d+)\)/.exec(parametros)?.[1])).toBe(PARAMETROS.topicosMax);
  });
});

// ─────────────────────────────────────────────────────────────── o painel

const linha = (nome: string, extra: Partial<LinhaDoPainel> = {}): LinhaDoPainel => ({
  estudanteId: nome,
  nome,
  usuario: nome.toLowerCase(),
  equipe: null,
  entrou: false,
  iniciou: false,
  passo: "desafio",
  pistasAbertas: 0,
  publicouAPrimeira: false,
  chaveFormada: false,
  publicouASegunda: false,
  concluiu: false,
  ...extra,
});

describe("o botão único", () => {
  /* A suíte e2e casa por texto exato: estes dois rótulos não mudam sem mudar lá. */
  test("mostra a PRÓXIMA etapa", () => {
    expect(rotuloDoBotao("resultado")).toBe("Liberar resultado");
    expect(rotuloDoBotao("revisao")).toBe("Liberar revisão");
  });

  test("depois da revisão não há botão — e a exploração nunca é destino", () => {
    expect(rotuloDoBotao(null)).toBeNull();
    expect(rotuloDoBotao("exploracao")).toBeNull();
  });
});

describe("quantos publicaram", () => {
  test("o sujeito é o computador quando a turma tem equipes", () => {
    expect(textoDoEnvio({ publicaram: 4, total: 6 }, true)).toBe("4 de 6 computadores publicaram a 1ª edição.");
    expect(textoDoEnvio({ publicaram: 20, total: 31 }, false)).toBe("20 de 31 estudantes publicaram a 1ª edição.");
    expect(textoDoEnvio({ publicaram: 1, total: 1 }, true)).toBe("1 de 1 computador publicou a 1ª edição.");
  });

  test("o termômetro da copy, sem 'duplas' e sem NaN na turma vazia", () => {
    expect(textoDoTermometro({ publicaram: 4, total: 6 }, true)).toBe("Jornais publicados pela turma: 4/6 computadores (67%)");
    expect(textoDoTermometro({ publicaram: 0, total: 0 }, false)).toBe("Jornais publicados pela turma: 0/0 estudantes (0%)");
    expect(percentual(1, 3)).toBe(33);
    expect(percentual(0, 0)).toBe(0);
  });

  test("a aula só para de ser acompanhada quando todos concluíram com a revisão aberta", () => {
    const resumo = (concluiram: number, total: number) =>
      ({ total, concluiram }) as unknown as Parameters<typeof aulaEmAndamento>[0]["resumo"];
    expect(aulaEmAndamento({ etapa: "revisao", resumo: resumo(5, 5) })).toBe(false);
    expect(aulaEmAndamento({ etapa: "revisao", resumo: resumo(4, 5) })).toBe(true);
    expect(aulaEmAndamento({ etapa: "resultado", resumo: resumo(5, 5) })).toBe(true);
    // Turma sem ninguém: continua esperando — pode ser só cedo.
    expect(aulaEmAndamento({ etapa: "revisao", resumo: resumo(0, 0) })).toBe(true);
  });
});

describe("o histograma anônimo", () => {
  test("em percentual de quem publicou aquela edição, e sem NaN antes da primeira", () => {
    expect(histogramaEmPercentual([1, 2, 1, 0])).toEqual([25, 50, 25, 0]);
    expect(histogramaEmPercentual([0, 0, 0, 0])).toEqual([0, 0, 0, 0]);
  });

  test("as contagens exatas, sem nome; cala enquanto ninguém publicou", () => {
    expect(textoDoHistograma([2, 1, 0, 1], true)).toBe(
      "0 de 3: 2 computadores · 1 de 3: 1 computador · 2 de 3: 0 computadores · 3 de 3: 1 computador",
    );
    expect(textoDoHistograma([0, 0, 0, 0], false)).toBeNull();
  });
});

describe("o radar calculado", () => {
  const noticia = (id: NoticiaNoRadar["noticiaId"], extra: Partial<NoticiaNoRadar>): NoticiaNoRadar => ({
    noticiaId: id,
    manchete: `Manchete ${id}`,
    meio: "jornal",
    publicavel: true,
    pilarEmFalta: null,
    naEdicao1: 0,
    naEdicao2: 0,
    ...extra,
  });

  test("destaca a que NÃO podia ir para a capa e mais foi — nunca uma publicável", () => {
    const radar = [
      noticia("n1", { naEdicao1: 6 }),
      noticia("n2", { publicavel: false, pilarEmFalta: "data", naEdicao1: 3, manchete: "Gincana no sábado" }),
      noticia("n3", { publicavel: false, pilarEmFalta: "fonte", naEdicao1: 2 }),
    ];
    const d = destaqueDoRadar(radar, 4);
    expect(d?.noticiaId).toBe("n2");
    expect(d?.percentual).toBe(75);
    expect(textoDoDestaque(d!, true)).toBe(
      "75% dos computadores que publicaram puseram na capa “Gincana no sábado” — fato antigo apresentado como de hoje.",
    );
  });

  test("empate fica com a primeira da mesa; ninguém publicou ou nenhuma chegou à capa: nada", () => {
    const radar = [
      noticia("n4", { publicavel: false, pilarEmFalta: "autoria", naEdicao1: 2 }),
      noticia("n5", { publicavel: false, pilarEmFalta: "data", naEdicao1: 2 }),
    ];
    expect(destaqueDoRadar(radar, 3)?.noticiaId).toBe("n4");
    expect(destaqueDoRadar(radar, 0)).toBeNull();
    expect(destaqueDoRadar([noticia("n4", { publicavel: false, pilarEmFalta: "data" })], 3)).toBeNull();
  });
});

describe("a lista por computador", () => {
  test("alfabética pelo que a célula mostra, com número como número — nunca por progresso", () => {
    const ordem = ordenarLinhas([
      linha("Zé", { publicouAPrimeira: true, pistasAbertas: 9 }),
      linha("Bia", { equipe: { id: "e10", nome: "Equipe 10" } }),
      linha("Ana"),
      linha("Caio", { equipe: { id: "e2", nome: "Equipe 2" } }),
    ]).map((l) => l.equipe?.nome ?? l.nome);
    expect(ordem).toEqual(["Ana", "Equipe 2", "Equipe 10", "Zé"]);
  });

  test("as rodadas do histórico", () => {
    expect(textoDasRodadas(0)).toBe("nunca rodou");
    expect(textoDasRodadas(1)).toBe("1 rodada");
    expect(textoDasRodadas(3)).toBe("3 rodadas");
  });
});

// ─────────────────────────────────────────────────────────────── o preparo

const TRINTA = "palavra ".repeat(30).trim();

function noticiaValida(id: NoticiaDoPacote["id"], meio: Meio, extra: Partial<NoticiaDoPacote> = {}): NoticiaDoPacote {
  return {
    id,
    meio,
    veiculo: meio === "rede_social" ? "@turma_da_vila" : "Gazeta do Bairro",
    falante: meio === "radio" ? "Locutora Ana" : null,
    manchete: `Feira de ciências ${id} abre as portas hoje`,
    resumo: TRINTA,
    corpo: "palavra ".repeat(20).trim(),
    legenda: null,
    descricaoImagem: null,
    pistas: { fonte: "Portal da escola", data: "Publicado hoje de manhã", autoria: "Professora Carla Mendes" },
    gabarito: { publicavel: true, pilarEmFalta: null, explicacao: "Tem fonte, data de hoje e assinatura." },
    consequencia: { leitor: "Família do Téo", fala: "Chegamos na hora certa e deu tudo certo." },
    ...extra,
  };
}

describe("o gabarito na tela", () => {
  test("a escolha e o par (publicável, pilar) nunca ficam incoerentes", () => {
    expect(gabaritoDaEscolha("publicavel")).toEqual({ publicavel: true, pilarEmFalta: null });
    expect(gabaritoDaEscolha("data")).toEqual({ publicavel: false, pilarEmFalta: "data" });
    expect(escolhaDoGabarito({ publicavel: false, pilarEmFalta: "autoria", explicacao: "x" })).toBe("autoria");
    expect(escolhaDoGabarito({ publicavel: true, pilarEmFalta: null, explicacao: "x" })).toBe("publicavel");
  });
});

describe("os problemas de uma notícia, campo a campo", () => {
  test("uma notícia dentro das réguas não tem problema nenhum", () => {
    expect(problemasPorCampo(noticiaValida("n1", "jornal"))).toEqual({});
  });

  test("as réguas de palavras, com a frase do campo", () => {
    const p = problemasPorCampo(noticiaValida("n1", "jornal", { manchete: "Curta", resumo: "poucas palavras aqui" }));
    expect(p.manchete).toBe("Tem 1 palavra; o mínimo é 3.");
    expect(p.resumo).toBe("Tem 3 palavras; o mínimo é 25.");
  });

  test("o que cada meio exige: locutor no rádio, @ e imagem no post, imagem no telejornal", () => {
    expect(problemasPorCampo(noticiaValida("n2", "radio", { falante: null })).falante).toMatch(/locutor/);
    const post = problemasPorCampo(noticiaValida("n6", "rede_social", { veiculo: "Turma da Vila" }));
    expect(post.veiculo).toMatch(/@/);
    expect(post.descricaoImagem).toBe("O post precisa de imagem.");
    expect(problemasPorCampo(noticiaValida("n3", "tv")).descricaoImagem).toBe("O quadro de telejornal precisa de imagem.");
  });

  test("termo proibido acusa no campo que a criança lê — nunca na explicação do professor", () => {
    const n = noticiaValida("n1", "jornal", {
      consequencia: { leitor: "Vizinha", fala: "Essa notícia era falsa e ninguém avisou a gente." },
      gabarito: { publicavel: false, pilarEmFalta: "fonte", explicacao: "Não é falsa, mas ninguém confirmou o aviso." },
    });
    const p = problemasPorCampo(n);
    expect(p.fala).toMatch(/falsa/);
    expect(p.explicacao).toBeUndefined();
    expect(termosProibidosEm("Falsificação de assinatura")).toEqual([]);
    expect(termosProibidosEm("Isso é MENTIRA")).toEqual(["mentira"]);
  });
});

describe("o conjunto das oito", () => {
  /* Uma composição que passa: 4 publicáveis, 2 antigas, 2 sem confirmação,
     tradicionais e digitais dos dois lados, 4 com imagem. */
  const pacote: NoticiaDoPacote[] = [
    noticiaValida("n1", "jornal", { descricaoImagem: "Crianças montando estandes na quadra." }),
    noticiaValida("n2", "radio"),
    noticiaValida("n3", "tv", {
      descricaoImagem: "Apresentadora no estúdio do telejornal.",
      gabarito: { publicavel: false, pilarEmFalta: "data", explicacao: "O fato é de 2018, contado como de hoje." },
    }),
    noticiaValida("n4", "blog", { gabarito: { publicavel: false, pilarEmFalta: "data", explicacao: "Fato antigo apresentado como atual." } }),
    noticiaValida("n5", "portal"),
    noticiaValida("n6", "rede_social", {
      descricaoImagem: "Foto colorida de uma festa.",
      gabarito: { publicavel: false, pilarEmFalta: "autoria", explicacao: "Ninguém assina o post da página." },
    }),
    noticiaValida("n7", "mensagem", { gabarito: { publicavel: false, pilarEmFalta: "fonte", explicacao: "Aviso sem confirmação de ninguém." } }),
    noticiaValida("n8", "mural", { descricaoImagem: "Cartaz no mural do corredor." }),
  ];

  test("passa inteiro, e a composição é contada como a api conta", () => {
    expect(problemasDaComposicao(pacote)).toEqual([]);
    expect(composicaoDoPacote(pacote)).toEqual({ publicaveis: 4, antigas: 2, semConfirmacao: 2, comImagem: 4 });
  });

  test("mexer no gabarito de uma notícia pode quebrar o conjunto, e a tela diz", () => {
    /* Duas publicáveis viram "fato antigo": sobram 2 publicáveis e ficam 4 antigas. */
    const mexido = pacote.map((n) =>
      n.id === "n2" || n.id === "n5"
        ? { ...n, gabarito: { publicavel: false, pilarEmFalta: "data" as const, explicacao: n.gabarito.explicacao } }
        : n,
    );
    const problemas = problemasDaComposicao(mexido);
    expect(problemas).toContain("O pacote precisa de pelo menos 3 notícias que possam ir para a capa (tem 2).");
    expect(problemas).toContain("O pacote precisa de 2 a 3 fatos antigos apresentados como de hoje (tem 4).");
    const semVariedade = pacote.map((n) => (n.meio === "mural" ? { ...n, meio: "jornal" as const } : n));
    expect(problemasDaComposicao(semVariedade)[0]).toMatch(/meio diferente/);
  });

  test("os erros da api vão para a notícia que eles citam; o resto é do conjunto", () => {
    const { porNoticia, geral } = distribuirErros([
      "Notícia n3, manchete: 12 palavras (a régua é de 3 a 10).",
      "Notícia n3: termo que não pode aparecer na tela (falsa).",
      "Duas notícias têm a mesma manchete.",
    ]);
    expect(porNoticia.n3).toHaveLength(2);
    expect(geral).toEqual(["Duas notícias têm a mesma manchete."]);
  });
});

describe("a notícia como ela viaja", () => {
  test("a notícia viaja limpa: vazio anulável vira null, e a publicável não leva pilar", () => {
    const n = normalizarNoticia({
      ...noticiaValida("n1", "jornal"),
      falante: "  ",
      legenda: " Legenda da foto ",
      gabarito: { publicavel: true, pilarEmFalta: "data", explicacao: " Explicação qualquer aqui. " },
    });
    expect(n.falante).toBeNull();
    expect(n.legenda).toBe("Legenda da foto");
    expect(n.gabarito).toEqual({ publicavel: true, pilarEmFalta: null, explicacao: "Explicação qualquer aqui." });
  });
});

describe("os parâmetros do preparo", () => {
  test("a régua do contrato, campo a campo", () => {
    expect(problemasDosParametros({ disciplina: "Ciências", tema: "Feira de ciências", topicos: "" })).toEqual({});
    const p = problemasDosParametros({ disciplina: "C", tema: "Feir", topicos: "x".repeat(601) });
    expect(Object.keys(p).sort()).toEqual(["disciplina", "tema", "topicos"]);
  });

  test("`topicos` vazio NÃO vai no corpo: o Zod da api aceita ausente, não null", () => {
    expect(corpoDosParametros({ disciplina: " Ciências ", tema: "Feira de ciências", topicos: "  " })).toEqual({
      disciplina: "Ciências",
      tema: "Feira de ciências",
    });
    expect(corpoDosParametros({ disciplina: "Ciências", tema: "Feira de ciências", topicos: " horta " }).topicos).toBe("horta");
  });

  test("o erro da api com a frase de reserva", () => {
    expect(erroDaResposta({ codigo: "sem-saldo-de-ia", mensagem: "Sem saldo." }, "x")).toEqual({
      codigo: "sem-saldo-de-ia",
      mensagem: "Sem saldo.",
      erros: [],
    });
    expect(erroDaResposta(null, "Reserva.")).toEqual({ codigo: null, mensagem: "Reserva.", erros: [] });
  });
});

describe("o laço das imagens", () => {
  test("repete enquanto falta e a última chamada andou", () => {
    expect(continuarGerando({ completo: false, geradas: ["n1", "n2"] })).toBe(true);
    expect(continuarGerando({ completo: true, geradas: ["n1"] })).toBe(false);
  });

  /* O caso que custa dinheiro: tudo o que sobrou falhou. */
  test("para quando uma chamada não gera nada", () => {
    expect(continuarGerando({ completo: false, geradas: [] })).toBe(false);
  });

  test("a falha que saiu numa volta seguinte deixa de ser falha", () => {
    const primeira = falhasAcumuladas([], { falharam: ["n2"], imagens: { n1: "u1" } });
    expect(primeira).toEqual(["n2"]);
    expect(falhasAcumuladas(primeira, { falharam: ["n6"], imagens: { n1: "u1", n2: "u2" } })).toEqual(["n6"]);
  });

  test("o texto do progresso", () => {
    expect(textoDoProgressoDaMidia({ total: 5, prontas: 3 })).toBe("3 de 5 imagens prontas.");
    expect(textoDoProgressoDaMidia({ total: 5, prontas: 5 })).toBe("As 5 imagens estão prontas.");
    expect(textoDoProgressoDaMidia({ total: 1, prontas: 0 })).toBe("0 de 1 imagem pronta.");
    expect(textoDoProgressoDaMidia({ total: 0, prontas: 0 })).toBe("Nenhuma notícia deste pacote pede imagem.");
  });
});
