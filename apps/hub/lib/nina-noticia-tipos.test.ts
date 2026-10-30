import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { GATILHOS_DO_GUIA, ROTEIRO_DO_GUIA } from "./entre-redes/guias/exp03ef1b";

import {
  ACOES_DO_GATE,
  CAMPOS,
  CAMINHO_DAS_IMAGENS_DO_BANCO,
  CHAVES_DAS_CENAS_FIXAS,
  CHAVES_DAS_IMAGENS,
  CHAVES_DO_BANCO,
  COPY_DO_PAINEL,
  COPY_DO_PREPARO,
  DIAS,
  DICAS_DA_ESPERA,
  DISCIPLINAS,
  ETAPAS,
  FALHA_DA_GERACAO,
  GATILHOS_DE_CONDUCAO,
  LUGARES,
  MANCHETE,
  MAX_PALAVRAS_DA_MANCHETE,
  ORIGENS_DO_PACOTE,
  PARAMETROS,
  PARAMETROS_VAZIOS,
  PASSOS,
  PESSOAS,
  POLLING_DO_PAINEL_MS,
  ROTEIRO_DE_MEDIACAO,
  ROTULO_DA_DISCIPLINA,
  ROTULO_DA_ETAPA,
  ROTULO_DO_PASSO,
  ROTULO_DO_SUPORTE,
  ROTULO_DO_VALOR,
  SUPORTES,
  SUPORTE_OMITIDO,
  alertasDaSala,
  caminhoDaTurma,
  caminhoDoBancoPadrao,
  continuarGerando,
  corpoDosParametros,
  erroDaResposta,
  falhaDaIa,
  falhasAcumuladas,
  gatilhosDaEtapa,
  manchetesRepetidas,
  mudouAEvidencia,
  ordenarLinhas,
  problemaDaManchete,
  problemasDosParametros,
  rotuloDaDisciplina,
  rotuloDaImagemDoBanco,
  rotuloDoBotao,
  textoDaFicha,
  textoDoProgressoDoBanco,
  textosDasEscolhas,
  progressoDaAula,
  todosConcluiram,
  type ConteudoDoPacote,
  type LinhaDoPainel,
  type PainelDaTurma,
} from "./nina-noticia-tipos";

/**
 * O ESPELHO da api, conferido contra o texto dela. O hub não importa a api, e
 * por isso a segunda lista existe — este teste é o que impede que ela seja a
 * que ninguém atualiza junto.
 */
const API = join(__dirname, "../../api/src/nina-noticia");
const ler = (arquivo: string) => readFileSync(join(API, arquivo), "utf8");
const vocabulario = ler("vocabulario.ts");
const contrato = ler("contrato-de-rotas.ts");
const conteudo = ler("conteudo.ts");
const invariantes = ler("invariantes.ts");

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

/** As entradas `chave: "valor"` de um `Record` da api. */
function registroDaApi(fonte: string, nome: string): Record<string, string> {
  const corpo = new RegExp(`export const ${nome}[^=]*= \\{([\\s\\S]*?)\\};`).exec(fonte)?.[1];
  expect(corpo, `${nome} não foi encontrado na api`).toBeDefined();
  return Object.fromEntries(
    [...(corpo ?? "").matchAll(/"?([\w-]+)"?: "([^"]+)"/g)].map((m) => [m[1]!, m[2]!]),
  );
}

describe("o espelho do vocabulário da api", () => {
  test.each([
    ["PASSOS", PASSOS],
    ["ETAPAS", ETAPAS],
    ["ACOES_DO_GATE", ACOES_DO_GATE],
    ["SUPORTES", SUPORTES],
    ["CAMPOS", CAMPOS],
    ["LUGARES", LUGARES],
    ["PESSOAS", PESSOAS],
    ["DIAS", DIAS],
    ["ORIGENS_DO_PACOTE", ORIGENS_DO_PACOTE],
    ["DISCIPLINAS", DISCIPLINAS],
    ["CHAVES_DAS_IMAGENS", CHAVES_DAS_IMAGENS],
    ["CHAVES_DAS_CENAS_FIXAS", CHAVES_DAS_CENAS_FIXAS],
  ])("%s", (nome, valores) => {
    expect([...valores]).toEqual(listaDaApi(vocabulario, nome));
  });

  test("os rótulos de suporte, valor e disciplina são os da api", () => {
    expect(ROTULO_DO_SUPORTE).toEqual(registroDaApi(vocabulario, "ROTULO_DO_SUPORTE"));
    expect(ROTULO_DO_VALOR).toEqual(registroDaApi(vocabulario, "ROTULO_DO_VALOR"));
    expect(ROTULO_DA_DISCIPLINA).toEqual(registroDaApi(vocabulario, "ROTULO_DA_DISCIPLINA"));
    expect(vocabulario).toContain(`SUPORTE_OMITIDO: Suporte = "${SUPORTE_OMITIDO}"`);
    expect(rotuloDaDisciplina("ciencias")).toBe("Ciências");
    expect(rotuloDaDisciplina("desconhecida")).toBe("desconhecida");
  });

  test("os números: o polling do painel e a manchete", () => {
    expect(POLLING_DO_PAINEL_MS).toBe(numeroDaApi(vocabulario, "POLLING_DO_PAINEL_MS"));
    expect(MAX_PALAVRAS_DA_MANCHETE).toBe(numeroDaApi(invariantes, "MAX_PALAVRAS_DA_MANCHETE"));
  });

  test("os tetos dos parâmetros e da manchete são os do contrato", () => {
    const parametros = /export const ParametrosDoPreparoSchema = z\.object\(\{([\s\S]*?)\n\}\);/.exec(contrato)?.[1] ?? "";
    expect(parametros).toContain(`tema: z.string().trim().min(${PARAMETROS.tema.min}).max(${PARAMETROS.tema.max})`);
    expect(parametros).toContain(`assuntos: z.string().trim().min(${PARAMETROS.assuntos.min}).max(${PARAMETROS.assuntos.max})`);
    expect(contrato).toContain(`manchete: z.string().trim().min(${MANCHETE.min}).max(${MANCHETE.max})`);
  });

  test("toda rota da professora que o hub chama existe no índice do contrato", () => {
    for (const caminho of [
      "turmas/:turmaId/painel",
      "turmas/:turmaId/gate",
      "turmas/:turmaId/zerar",
      "turmas/:turmaId/banco-padrao",
      "turmas/:turmaId/gerar-conteudo",
      "turmas/:turmaId/regenerar-reportagem",
      "turmas/:turmaId/homologar",
      "turmas/:turmaId/pacotes",
      "turmas/:turmaId/pacotes/:pacoteId",
      "turmas/:turmaId/pacotes/:pacoteId/gerar-midia",
      "turmas/:turmaId/pacotes/:pacoteId/imagens/:chave/refazer",
      "turmas/:turmaId/pacotes/:pacoteId/aprovar-imagens",
      "turmas/:turmaId/pacotes/:pacoteId/em-andamento",
    ]) {
      expect(contrato, caminho).toContain(`caminho: "${caminho}"`);
    }
  });

  test("a rota das imagens do banco (a tela do admin) existe no índice, com papel admin", () => {
    const relativo = CAMINHO_DAS_IMAGENS_DO_BANCO.replace(/^\/nina-noticia\//, "");
    expect(contrato).toMatch(new RegExp(`caminho: "${relativo}",\\s*papel: "admin"`));
  });
});

describe("as imagens do banco padrão (a tela do admin)", () => {
  test("as oito, na ordem da api: as do pacote e as cenas fixas, cada uma com rótulo", () => {
    expect([...CHAVES_DO_BANCO]).toEqual([...CHAVES_DAS_IMAGENS, ...CHAVES_DAS_CENAS_FIXAS]);
    const servico = readFileSync(join(API, "banco-padrao-imagens.service.ts"), "utf8");
    expect(servico).toContain("[...itensDoPacote(conteudoDoBancoPadrao()), ...itensDasCenasFixas()]");
    for (const chave of CHAVES_DO_BANCO) expect(rotuloDaImagemDoBanco(chave).length).toBeGreaterThan(3);
    expect(new Set(CHAVES_DO_BANCO.map(rotuloDaImagemDoBanco)).size).toBe(CHAVES_DO_BANCO.length);
  });

  test("o progresso em frase, e as falhas que ainda não saíram", () => {
    expect(textoDoProgressoDoBanco({ total: 8, prontas: 3 })).toBe("3 de 8 imagens do banco prontas.");
    expect(textoDoProgressoDoBanco({ total: 8, prontas: 8 })).toBe("As 8 imagens do banco estão prontas.");
    expect(falhasAcumuladas(["telao"], { falharam: ["caso-b", "mural"], imagens: { telao: "u" } })).toEqual(["mural", "caso-b"]);
  });
});

describe("a mediação é a da api, frase por frase", () => {
  test("o roteiro e os gatilhos", () => {
    for (const { pergunta, cuidado } of ROTEIRO_DE_MEDIACAO) {
      expect(conteudo).toContain(`"${pergunta}"`);
      expect(conteudo).toContain(`"${cuidado}"`);
    }
    for (const gatilho of GATILHOS_DE_CONDUCAO) expect(conteudo).toContain(`"${gatilho}"`);
  });

  test("a cópia do guia da aula é o espelho, frase por frase", () => {
    expect(ROTEIRO_DO_GUIA).toEqual(ROTEIRO_DE_MEDIACAO);
    expect(GATILHOS_DO_GUIA).toEqual(GATILHOS_DE_CONDUCAO);
  });

  test("cada momento da turma tem o seu gatilho", () => {
    expect(gatilhosDaEtapa("aposta")).toEqual([GATILHOS_DE_CONDUCAO[0]]);
    expect(gatilhosDaEtapa("filtro")).toHaveLength(2);
    expect(gatilhosDaEtapa("inspecao")).toEqual([]);
  });
});

describe("na tela é ESCOLHA, nunca aposta (spec §7.1)", () => {
  test("nenhum texto do espelho diz aposta", () => {
    const textos = [
      ...Object.values(ROTULO_DO_PASSO),
      ...Object.values(ROTULO_DA_ETAPA),
      ...Object.values(COPY_DO_PREPARO),
      ...Object.values(COPY_DO_PAINEL),
      ...DICAS_DA_ESPERA,
      ...GATILHOS_DE_CONDUCAO,
      ...Object.values(FALHA_DA_GERACAO).flatMap((f) => [f.titulo, f.texto]),
    ];
    for (const texto of textos) expect(texto, texto).not.toMatch(/aposta/i);
  });

  test("nem as telas do professor desta missão", () => {
    const telas = [
      "../app/(plataforma)/professor/entre-redes/[ano]/[unidade]/missao-nina-noticia.tsx",
      "../app/(plataforma)/professor/entre-redes/[ano]/[unidade]/atividades/nova/criar-nina-noticia.tsx",
      "../app/(plataforma)/professor/entre-redes/[ano]/[unidade]/resultados/painel-da-aula-nina-noticia.tsx",
      "../app/(plataforma)/professor/entre-redes/[ano]/[unidade]/resultados/resultados-nina-noticia.tsx",
      "../app/(plataforma)/professor/entre-redes/[ano]/[unidade]/resultados/imagens-da-nina.tsx",
      "../app/(plataforma)/professor/entre-redes/[ano]/[unidade]/resultados/zerar-turma-nina-noticia.tsx",
      "./entre-redes/guias/exp03ef1b.ts",
    ];
    for (const tela of telas) {
      /* Fora dos comentários: o nome interno da etapa pode aparecer na explicação. */
      const fonte = readFileSync(join(__dirname, tela), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "")
        .replace(/"aposta"/g, "");
      expect(fonte, tela).not.toMatch(/aposta/i);
    }
  });
});

// ──────────────────────────────────────────────────────────────── o preparo

const PACOTE: ConteudoDoPacote = {
  tema: "Feira de Troca de Livros",
  cartaz: { texto: "Feira de Troca de Livros", imagem: { descricao: "Cartaz da feira com livros.", alt: "Cartaz." } },
  reportagens: [
    {
      suporte: "mural",
      manchete: "Feira de Livros",
      legenda: "Estudantes trocam gibis no pátio.",
      lugar: "patio",
      ficha: { quem: "estudantes", onde: "patio", quando: "sexta" },
      imagem: { descricao: "Mural com crianças no pátio.", alt: "Mural." },
    },
    {
      suporte: "portal",
      manchete: "Livros no Pátio",
      legenda: "Mesas com livros no pátio.",
      lugar: "patio",
      ficha: { quem: "estudantes", onde: "patio", quando: "sexta" },
      imagem: { descricao: "Portal com mesas no pátio.", alt: "Portal." },
    },
    {
      suporte: "telao",
      manchete: "Troca de Leituras",
      legenda: "Crianças leem no pátio.",
      lugar: "patio",
      ficha: { quem: "estudantes", onde: null, quando: "sexta" },
      imagem: { descricao: "Telão com crianças lendo no pátio.", alt: "Telão." },
    },
  ],
};

describe("o preparo", () => {
  test("os parâmetros: o que falta e o corpo", () => {
    expect(Object.keys(problemasDosParametros(PARAMETROS_VAZIOS)).sort()).toEqual(["assuntos", "disciplina", "tema"]);
    const ok = { disciplina: "ciencias", tema: "  Horta da escola ", assuntos: "plantas, água, solo" };
    expect(problemasDosParametros(ok)).toEqual({});
    expect(corpoDosParametros(ok)).toEqual({ disciplina: "ciencias", tema: "Horta da escola", assuntos: "plantas, água, solo" });
    expect(problemasDosParametros({ ...ok, tema: "x".repeat(61) }).tema).toBeDefined();
  });

  test("a manchete: até quatro palavras e quarenta caracteres", () => {
    expect(problemaDaManchete("Feira de Livros")).toBeNull();
    expect(problemaDaManchete(" ")).not.toBeNull();
    expect(problemaDaManchete("Uma feira de livros enorme")).not.toBeNull();
    expect(problemaDaManchete("x".repeat(41))).not.toBeNull();
  });

  test("manchetes repetidas, sem acento e sem caixa", () => {
    expect(manchetesRepetidas(PACOTE)).toBe(false);
    const repetida = structuredClone(PACOTE);
    repetida.reportagens[1]!.manchete = "FEIRA DE LIVROS";
    expect(manchetesRepetidas(repetida)).toBe(true);
  });

  test("a ficha do telão mostra o Onde vazio", () => {
    expect(textoDaFicha(PACOTE.reportagens[0]!.ficha)).toBe("Quem (estudantes) · Onde (Pátio) · Quando (sexta)");
    expect(textoDaFicha(PACOTE.reportagens[2]!.ficha)).toBe("Quem (estudantes) · Onde (vazio) · Quando (sexta)");
  });

  test("a falha da IA pelo status ou pelo código", () => {
    expect(falhaDaIa(429, null)).toBe("sem-saldo-de-ia");
    expect(falhaDaIa(200, "ia-indisponivel")).toBe("ia-indisponivel");
    expect(falhaDaIa(400, "pacote-invalido")).toBeNull();
    expect(FALHA_DA_GERACAO["sem-saldo-de-ia"].titulo).toBe("Limite de geração atingido temporariamente.");
    expect(FALHA_DA_GERACAO["ia-indisponivel"].titulo).toBe("Instabilidade no gerador de conteúdo.");
  });

  test("o erro da api, com a frase de reserva", () => {
    expect(erroDaResposta({ codigo: "pacote-invalido", mensagem: "Pacote inválido.", erros: ["a", 1] }, "x")).toEqual({
      codigo: "pacote-invalido",
      mensagem: "Pacote inválido.",
      erros: ["a"],
    });
    expect(erroDaResposta(null, "reserva").mensagem).toBe("reserva");
  });

  test("o laço das imagens para quando completa ou quando não anda", () => {
    expect(continuarGerando({ completo: false, geradas: ["mural"] })).toBe(true);
    expect(continuarGerando({ completo: true, geradas: ["mural"] })).toBe(false);
    expect(continuarGerando({ completo: false, geradas: [] })).toBe(false);
  });

  test("os caminhos", () => {
    expect(caminhoDaTurma("a b")).toBe("/nina-noticia/turmas/a%20b");
    expect(caminhoDoBancoPadrao("t")).toBe("/nina-noticia/turmas/t/banco-padrao");
  });

  test("o rótulo do assunto é o do ajuste do PO", () => {
    expect(COPY_DO_PREPARO.rotuloDosAssuntos).toBe("Assunto da matéria");
  });
});

// ──────────────────────────────────────────────────────────────── o painel

function linha(nome: string, passo: LinhaDoPainel["passo"], equipe?: string): LinhaDoPainel {
  return {
    estudanteId: `id-${nome}`,
    nome,
    usuario: nome.toLowerCase(),
    equipe: equipe ? { id: `eq-${equipe}`, nome: equipe } : null,
    entrou: true,
    passo,
    etapaVisivel: 1,
    aguardando: false,
    concluiu: passo === "fim",
    alertas: { semParada: false, uniformes: false },
  };
}

function painel(linhas: LinhaDoPainel[], extra: Partial<PainelDaTurma> = {}): PainelDaTurma {
  return {
    turma: { id: "t", nome: "3º A", serie: "3EF" },
    pacote: { id: "p", disciplina: "lingua-portuguesa", tema: "Feira", origem: "padrao", midia: { total: 4, prontas: 4 } },
    rodada: 1,
    etapa: "aposta",
    pausada: false,
    proximaEtapa: "filtro",
    linhas,
    resumo: {
      total: linhas.length,
      entraram: linhas.length,
      concluiram: linhas.filter((l) => l.concluiu).length,
      porComputador: true,
      porEtapa: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 },
      escolhas: { travadas: 0, uma: 0, duas: 0, tres: 0, deFora: {} },
      alertas: { semParada: 0, uniformes: 0 },
    },
    ...extra,
  };
}

describe("o painel", () => {
  test("o botão diz a etapa de destino e some depois da inspeção", () => {
    expect(rotuloDoBotao("filtro")).toBe("Liberar Filtro");
    expect(rotuloDoBotao("inspecao")).toBe("Liberar Inspeção");
    expect(rotuloDoBotao(null)).toBeNull();
  });

  test("toda etapa e todo passo têm rótulo", () => {
    expect(Object.keys(ROTULO_DA_ETAPA)).toEqual([...ETAPAS]);
    expect(Object.keys(ROTULO_DO_PASSO)).toEqual([...PASSOS]);
  });

  test("as escolhas da Etapa 2, só agregadas", () => {
    /* O valor é curto: a frase no corpo grande do MetricCard estourava o cartão. */
    expect(textosDasEscolhas({ travadas: 0, uma: 0, duas: 0, tres: 0, deFora: {} }, true).valor).toBe("—");
    const t = textosDasEscolhas({ travadas: 4, uma: 1, duas: 1, tres: 2, deFora: { telao: 2 } }, true);
    expect(t.valor).toBe("50%");
    expect(t.linhas[0]).toBe("escolheram as 3 notícias, de 4 escolhas travadas.");
    expect(t.linhas[1]).toBe("2 equipes escolheram 3 notícias; 1 equipe, 2 notícias; 1 equipe, 1 notícia.");
    expect(t.linhas[2]).toBe("Ficou de fora da caixa: Telão do Corredor (2).");
  });

  test("o progresso da aula: quatro números, na ordem dos portões", () => {
    const p = painel([linha("Ana", "galeria"), linha("Bia", "filtro"), linha("Caio", "omissao"), linha("Duda", "fim")], {});
    p.resumo.escolhas.travadas = 3;
    expect(progressoDaAula(p).map((c) => [c.titulo, c.valor])).toEqual([
      ["Entraram", "4/4"],
      ["Travaram a escolha", "3/4"],
      ["Viram a notícia sumir", "2/4"],
      ["Concluíram", "1/4"],
    ]);
  });

  test("os alertas da sala", () => {
    expect(alertasDaSala({ semParada: 0, uniformes: 0 })).toEqual([]);
    expect(alertasDaSala({ semParada: 2, uniformes: 1 })).toEqual([
      "Alerta: rotina em repetição sem parada. (2)",
      "Alerta: carimbos todos iguais. (1)",
    ]);
  });

  test("a evidência muda quando uma linha passa de um marco da ficha", () => {
    const antes = painel([linha("Ana", "ficha"), linha("Bia", "rotina")]);
    expect(mudouAEvidencia(antes, painel([linha("Ana", "ficha"), linha("Bia", "rotina")]))).toBe(false);
    expect(mudouAEvidencia(antes, painel([linha("Ana", "carimbos"), linha("Bia", "rotina")]))).toBe(true);
    expect(mudouAEvidencia(antes, painel([linha("Ana", "ficha"), linha("Bia", "caso")]))).toBe(true);
    expect(mudouAEvidencia(antes, painel(antes.linhas, { rodada: 2 }))).toBe(true);
    /* Andar entre passos sem marca (galeria → escolha) não relê a página. */
    const cedo = painel([linha("Ana", "galeria")]);
    expect(mudouAEvidencia(cedo, painel([linha("Ana", "aposta")]))).toBe(false);
  });

  test("alfabética pela equipe, com número como número — nunca por progresso", () => {
    const ordem = ordenarLinhas([linha("Caio", "fim", "Equipe 10"), linha("Ana", "galeria", "Equipe 2")]);
    expect(ordem.map((l) => l.equipe?.nome)).toEqual(["Equipe 2", "Equipe 10"]);
  });

  test("todos concluíram", () => {
    expect(todosConcluiram(painel([linha("Ana", "fim")]))).toBe(true);
    expect(todosConcluiram(painel([linha("Ana", "fim"), linha("Bia", "caso")]))).toBe(false);
    expect(todosConcluiram(painel([]))).toBe(false);
  });
});
