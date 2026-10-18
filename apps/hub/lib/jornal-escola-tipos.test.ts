import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  BLOCOS_ISCA,
  CARACTERES,
  COMPOSICAO,
  ETAPAS,
  IDS_DE_BLOCO,
  IDS_DE_NOTICIA,
  IDS_DE_SIMULACAO,
  LADOS_DA_CONDICAO,
  MEIOS,
  MEIOS_DA_SIMULACAO,
  MEIOS_COM_IMAGEM_OBRIGATORIA,
  MEIOS_DIGITAIS,
  MEIOS_TRADICIONAIS,
  MOTIVOS,
  ORIGENS_DO_PACOTE,
  PARAMETROS,
  PASSOS,
  REGUAS_DE_PALAVRAS,
  ROTULO_DA_ISCA,
  ROTULO_DO_MOTIVO,
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
  iscasMaisEscolhidas,
  mudouAEvidencia,
  normalizarMateria,
  normalizarNoticia,
  ordenarLinhas,
  percentual,
  problemasDaComposicao,
  problemasDaMateria,
  problemasDoParDaSimulacao,
  problemasDosParametros,
  problemasPorCampo,
  rotuloDoBotao,
  termosProibidosEm,
  textoDasIscas,
  textoDasRodadas,
  textoDoDestaque,
  textoDoEnvio,
  textoDoHistograma,
  imagensProntasParaAula,
  textoDoProgressoDaMidia,
  textoDoTermometro,
  type LinhaDoPainel,
  type MateriaDaSimulacao,
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
    expect([...BLOCOS_ISCA]).toEqual(listaDaApi(vocabulario, "BLOCOS_ISCA"));
  });

  test("o vocabulário da 3.0.0: as matérias da simulação e os lados dos cartões", () => {
    expect([...IDS_DE_SIMULACAO]).toEqual(listaDaApi(vocabulario, "IDS_DE_SIMULACAO"));
    expect([...LADOS_DA_CONDICAO]).toEqual(listaDaApi(vocabulario, "LADOS_DA_CONDICAO"));
    expect([...MEIOS_DA_SIMULACAO]).toEqual(listaDaApi(ler("invariantes.ts"), "MEIOS_DA_SIMULACAO"));
  });

  test("o nome de cada armadilha é o da bandeja da Chave", () => {
    const catalogo = ler("catalogo.ts");
    for (const isca of BLOCOS_ISCA) {
      const rotulo = new RegExp(`\\b${isca}: \\{ rotulo: "([^"]+)"`).exec(catalogo)?.[1];
      expect(rotulo, `o rótulo de ${isca} não foi encontrado no catálogo`).toBe(ROTULO_DA_ISCA[isca]);
    }
  });

  test("os passos e as etapas, na ordem — com a simulação entre o comparativo e a mensagem nova", () => {
    expect([...PASSOS]).toEqual(listaDaApi(passos, "PASSOS"));
    expect([...ETAPAS]).toEqual(listaDaApi(passos, "ETAPAS"));
    expect(PASSOS.indexOf("simulacao")).toBe(PASSOS.indexOf("comparativo") + 1);
    expect(PASSOS.indexOf("transferencia")).toBe(PASSOS.indexOf("simulacao") + 1);
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

  test("os tetos de caractere da matéria da simulação são os mesmos da notícia", () => {
    const materia = /export const MateriaDaSimulacaoSchema = z\.object\(([\s\S]*?)\n\}\);/.exec(contrato)?.[1] ?? "";
    const tetos = Object.fromEntries(
      [...materia.matchAll(/(\w+): Texto\((\d+), (\d+)\)/g)].map((m) => [m[1]!, { min: Number(m[2]), max: Number(m[3]) }]),
    );
    expect(tetos).toEqual({
      veiculo: CARACTERES.veiculo,
      falante: CARACTERES.falante,
      manchete: CARACTERES.manchete,
      resumo: CARACTERES.resumo,
      fonte: CARACTERES.pista,
      data: CARACTERES.pista,
      autoria: CARACTERES.pista,
      explicacao: CARACTERES.explicacao,
    });
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
  simulou: false,
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

describe("o que faz o painel de habilidades se atualizar sozinho", () => {
  type Resumo = Parameters<typeof mudouAEvidencia>[0]["resumo"];
  type Contadores = Partial<
    Pick<Resumo, "publicaramAPrimeira" | "formaramAChave" | "publicaramASegunda" | "concluiram" | "chave" | "transferencia">
  >;
  const painel = (resumo: Contadores = {}, rodada = 1, id = "p1", linhas: LinhaDoPainel[] = [linha("Ana")]) => ({
    pacote: { id, disciplina: "portugues", tema: "t", origem: "padrao" as const, midia: { total: 8, prontas: 8, aprovadas: 8 } },
    rodada,
    linhas,
    resumo: {
      total: 5,
      iniciaram: 5,
      publicaramAPrimeira: 3,
      formaramAChave: 2,
      publicaramASegunda: 1,
      concluiram: 1,
      computadores: { publicaram: 3, total: 5 },
      porComputador: false,
      histograma: { edicao1: [0, 1, 1, 1], edicao2: [0, 0, 0, 1] },
      motivos: { visual: 0, checagem: 0 },
      chave: { montaram: 2, iscas: { foto: 1, urgencia: 0, compartilhada: 0 }, seguir: 0, soNaPrimeira: 0 },
      transferencia: { decidiram: 1, repassaramSemAbrir: 0, naoRepassaram: 1 },
      radar: [],
      ...resumo,
    },
  });

  test("relê nas cinco jogadas que a api marca, e quando a atividade ou a rodada trocam", () => {
    const antes = painel();
    expect(mudouAEvidencia(antes, painel())).toBe(false);
    expect(mudouAEvidencia(antes, painel({ publicaramAPrimeira: 4 }))).toBe(true);
    expect(mudouAEvidencia(antes, painel({ formaramAChave: 3 }))).toBe(true);
    expect(mudouAEvidencia(antes, painel({ publicaramASegunda: 2 }))).toBe(true);
    expect(mudouAEvidencia(antes, painel({ concluiram: 2 }))).toBe(true);
    expect(mudouAEvidencia(antes, painel({ transferencia: { decidiram: 2, repassaramSemAbrir: 1, naoRepassaram: 1 } }))).toBe(true);
    expect(mudouAEvidencia(antes, painel({ chave: { ...antes.resumo.chave, montaram: 3 } }))).toBe(true);
    /* A simulação não tem contador no resumo: conta pelas linhas. */
    expect(mudouAEvidencia(antes, painel({}, 1, "p1", [linha("Ana", { simulou: true })]))).toBe(true);
    expect(mudouAEvidencia(antes, painel({}, 2))).toBe(true);
    expect(mudouAEvidencia(antes, painel({}, 1, "p2"))).toBe(true);
  });

  test("o que não marca nada não relê a página: quem só abriu a missão, ou a etapa que o professor abriu", () => {
    const antes = painel();
    expect(mudouAEvidencia(antes, { ...antes, resumo: { ...antes.resumo, iniciaram: 6, total: 6 } })).toBe(false);
  });
});

describe("o roteiro agregado da Chave", () => {
  test("as armadilhas da mais escolhida para a menos, sem as que ninguém pôs", () => {
    expect(iscasMaisEscolhidas({ foto: 2, urgencia: 5, compartilhada: 0 })).toEqual([
      { isca: "urgencia", vezes: 5 },
      { isca: "foto", vezes: 2 },
    ]);
    expect(textoDasIscas({ foto: 1, urgencia: 1, compartilhada: 3 }, true)).toBe(
      "Compartilhada: 3 computadores · Foto: 1 computador · Urgência: 1 computador",
    );
    expect(textoDasIscas({ foto: 0, urgencia: 0, compartilhada: 0 }, false)).toBeNull();
  });

  test("o motivo da 1ª edição tem os rótulos da 3.0.0", () => {
    expect(ROTULO_DO_MOTIVO).toEqual({
      visual: "Escolhi porque chamou atenção",
      checagem: "Escolhi porque conferi as pistas",
    });
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

  test("os erros da api vão para a notícia ou a matéria que eles citam; o resto é do conjunto", () => {
    const { porNoticia, porMateria, geral } = distribuirErros([
      "Notícia n3, manchete: 12 palavras (a régua é de 3 a 10).",
      "Notícia n3: termo que não pode aparecer na tela (falsa).",
      'A matéria s2 da simulação: "resumo" com 12 palavras (de 25 a 35).',
      "A simulação tem uma matéria publicável e uma com furo.",
      "Duas notícias têm a mesma manchete.",
    ]);
    expect(porNoticia.n3).toHaveLength(2);
    expect(porMateria.s2).toHaveLength(1);
    expect(geral).toEqual(["A simulação tem uma matéria publicável e uma com furo.", "Duas notícias têm a mesma manchete."]);
  });
});

function materiaValida(id: MateriaDaSimulacao["id"], meio: Meio, extra: Partial<MateriaDaSimulacao> = {}): MateriaDaSimulacao {
  return {
    id,
    meio,
    veiculo: "Jornal do Bairro",
    falante: null,
    manchete: "Biblioteca do bairro ganha cantinho de leitura",
    resumo: TRINTA,
    pistas: { fonte: "Jornal impresso da região", data: "Publicado ontem", autoria: "Repórter Caio Mendes" },
    gabarito: { publicavel: true, pilarEmFalta: null, explicacao: "Jornal conhecido, data recente e assinatura." },
    ...extra,
  };
}

describe("as duas matérias da simulação", () => {
  const furo = { publicavel: false, pilarEmFalta: "autoria" as const, explicacao: "Ninguém assina o texto do blog." };

  test("uma matéria dentro das réguas não tem problema; a régua é a da mesa", () => {
    expect(problemasDaMateria(materiaValida("s1", "jornal"))).toEqual({});
    const p = problemasDaMateria(materiaValida("s1", "jornal", { manchete: "Curta", resumo: "poucas palavras aqui no resumo" }));
    expect(p.manchete).toBe("Tem 1 palavra; o mínimo é 3.");
    expect(p.resumo).toBe("Tem 5 palavras; o mínimo é 25.");
  });

  test("sem imagem nem locutor: o meio é jornal, blog, portal ou mural", () => {
    expect(problemasDaMateria(materiaValida("s1", "tv")).meio).toMatch(/jornal, blog, portal ou mural/);
    expect(problemasDaMateria(materiaValida("s1", "mural")).meio).toBeUndefined();
  });

  test("termo proibido acusa no que a criança lê, nunca na explicação", () => {
    const p = problemasDaMateria(
      materiaValida("s2", "blog", {
        pistas: { fonte: "Um blog que diz mentira", data: "Publicado hoje", autoria: "Sem assinatura" },
        gabarito: { ...furo, explicacao: "Não é falsa, mas ninguém assina." },
      }),
    );
    expect(p.fonte).toMatch(/mentira/);
    expect(p.explicacao).toBeUndefined();
  });

  test("o par: uma pode ir para a capa e a outra não, de meios diferentes", () => {
    expect(problemasDoParDaSimulacao([materiaValida("s1", "jornal"), materiaValida("s2", "blog", { gabarito: furo })])).toEqual([]);
    expect(problemasDoParDaSimulacao([materiaValida("s1", "jornal"), materiaValida("s2", "blog")])).toEqual([
      "Das duas matérias da simulação, uma precisa poder ir para a capa e a outra não.",
    ]);
    expect(problemasDoParDaSimulacao([materiaValida("s1", "blog"), materiaValida("s2", "blog", { gabarito: furo })])).toEqual([
      "As duas matérias da simulação precisam ser de meios diferentes.",
    ]);
    expect(problemasDoParDaSimulacao([])).toHaveLength(1);
  });

  test("a matéria viaja limpa: falante vazio vira null, e a publicável não leva pilar", () => {
    const m = normalizarMateria({
      ...materiaValida("s1", "portal", { falante: "  ", manchete: " Manchete com espaço nas pontas " }),
      gabarito: { publicavel: true, pilarEmFalta: "data", explicacao: " Pode ir para a capa. " },
    });
    expect(m.falante).toBeNull();
    expect(m.manchete).toBe("Manchete com espaço nas pontas");
    expect(m.gabarito).toEqual({ publicavel: true, pilarEmFalta: null, explicacao: "Pode ir para a capa." });
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
    expect(textoDoProgressoDaMidia({ total: 5, prontas: 3, aprovadas: 1 })).toBe("3 de 5 imagens prontas, 1 aprovada.");
    expect(textoDoProgressoDaMidia({ total: 5, prontas: 5, aprovadas: 0 })).toBe("As 5 imagens estão prontas, 0 aprovadas.");
    expect(textoDoProgressoDaMidia({ total: 5, prontas: 5, aprovadas: 5 })).toBe("As 5 imagens estão aprovadas.");
    expect(textoDoProgressoDaMidia({ total: 1, prontas: 0, aprovadas: 0 })).toBe("0 de 1 imagem pronta, 0 aprovadas.");
    expect(textoDoProgressoDaMidia({ total: 0, prontas: 0, aprovadas: 0 })).toBe("Nenhuma notícia deste pacote pede imagem.");
  });

  test("vai ao ar só com todas as imagens aprovadas (ADR-147) — o espelho do 409 da api", () => {
    expect(imagensProntasParaAula({ total: 5, prontas: 5, aprovadas: 4 })).toBe(false);
    expect(imagensProntasParaAula({ total: 5, prontas: 5, aprovadas: 5 })).toBe(true);
  });
});
