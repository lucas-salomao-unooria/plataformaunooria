import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { PERMANENCIA_MS, TELA_DO_PASSO, frasesDaLegenda, passoEfetivo } from "./regras";
import {
  ACOES_DA_REVISAO,
  AREAS,
  CONVICCOES,
  ENQUETES,
  ETAPAS,
  MAX_FRASES_DA_LEGENDA,
  MOTIVOS_DA_REVISAO,
  MOTIVOS_DO_VOTO,
  PASSOS,
  PASSOS_PEDIDOS,
  POSTS_NO_DESVIO,
  POSTS_NO_FEED,
  TIPOS_DE_BUSCA,
  TIPOS_DE_POST,
  TOTAL_DE_BLOCOS,
  TOTAL_DE_PROJETOS,
  type Desvio,
  type Feed,
  type Galeria,
  type PostPublico,
  type ProjetoDaGaleria,
  type Sessao,
} from "./tipos";

/**
 * O ESPELHO do contrato contra a api. A experiência não importa a api (o
 * bundle é público, a api é outro pacote), então `lib/tipos.ts` tem uma cópia
 * DECLARADA das listas e dos campos — e este teste LÊ os arquivos da api como
 * texto e reprova a divergência. Sem ele, um passo novo no servidor cairia
 * numa tela que não existe, e um campo renomeado chegaria `undefined` na tela;
 * o typecheck não veria nenhum dos dois. Molde: `exp04ef1b/src/lib/espelho.test.ts`.
 */
const MODULO = "../../api/src/juri-estadual";
const VOCABULARIO = `${MODULO}/vocabulario.ts`;
const PASSOS_DA_API = `${MODULO}/regras/passos.ts`;
const CONTEUDO = `${MODULO}/conteudo.ts`;
const CONTRATO = `${MODULO}/contrato-de-rotas.ts`;
const FICHA = "../../api/src/evidencias/fichas/exp06ef1b.ts";
const JUSTIFICATIVA = `${MODULO}/regras/justificativa.ts`;

const ler = (caminho: string) => readFileSync(caminho, "utf8");

function listaDoArquivo(caminho: string, nome: string): string[] {
  const bloco = new RegExp(`export const ${nome}(?:: [^=]+)? = \\[([\\s\\S]*?)\\] as const`).exec(ler(caminho));
  if (!bloco?.[1]) throw new Error(`${nome} não encontrado em ${caminho}`);
  return [...bloco[1].matchAll(/"([^"]+)"/g)].map((m) => m[1] ?? "");
}

function numeroDoArquivo(caminho: string, nome: string): number {
  const casou = new RegExp(`export const ${nome} = ([\\d_]+);`).exec(ler(caminho));
  if (!casou?.[1]) throw new Error(`${nome} não encontrado em ${caminho}`);
  return Number(casou[1].replace(/_/g, ""));
}

/** As chaves de PRIMEIRO nível de um `z.object({...})` do contrato. */
function chavesDoSchema(nome: string): string[] {
  const fonte = ler(CONTRATO);
  const inicio = fonte.indexOf(`export const ${nome} = z`);
  if (inicio < 0) throw new Error(`${nome} não encontrado em ${CONTRATO}`);
  const abre = fonte.indexOf("({", inicio) + 2;
  let nivel = 1;
  let i = abre;
  for (; i < fonte.length && nivel > 0; i += 1) {
    const c = fonte[i];
    if (c === "{" || c === "(" || c === "[") nivel += 1;
    if (c === "}" || c === ")" || c === "]") nivel -= 1;
  }
  const corpo = fonte.slice(abre, i - 1);
  // Só o 1º nível: apaga o conteúdo de cada (...)/{...}/[...] aninhado.
  let raso = "";
  let fundo = 0;
  for (const c of corpo) {
    if (c === "{" || c === "(" || c === "[") fundo += 1;
    if (fundo === 0) raso += c;
    if (c === "}" || c === ")" || c === "]") fundo -= 1;
  }
  return [...raso.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(?:^|,|\n)\s*(\w+):/g)].map((m) => m[1] ?? "").sort();
}

/** As chaves de cada interface do espelho — o `satisfies` cobra que a lista está completa. */
const CHAVES = {
  sessao: {
    pacoteId: 1, rodada: 1, passo: 1, passoDoEstudante: 1, etapa: 1, aguardandoOProfessor: 1, tema: 1,
    categorias: 1, feed: 1, motivos: 1, voto: 1, revisao: 1, desvio: 1, cadeia: 1, mariana: 1, concluida: 1,
  } satisfies Record<keyof Sessao, 1>,
  feed: { posts: 1, curtidos: 1, salvos: 1, completo: 1 } satisfies Record<keyof Feed, 1>,
  desvio: {
    posts: 1, curtidos: 1, salvos: 1, completo: 1, comInteracao: 1, concluido: 1, comparacao: 1,
  } satisfies Record<keyof Desvio, 1>,
  post: {
    id: 1, projetoId: 1, tipo: 1, area: 1, titulo: 1, escola: 1, perfil: 1, texto: 1, legenda: 1, hashtags: 1, imagem: 1,
  } satisfies Record<keyof PostPublico, 1>,
  galeria: { invisibilidade: 1, projetos: 1 } satisfies Record<keyof Galeria, 1>,
  projeto: {
    id: 1, area: 1, titulo: 1, escola: 1, perfil: 1, legenda: 1, hashtags: 1, imagem: 1, exibidoNoSeuFeed: 1,
  } satisfies Record<keyof ProjetoDaGaleria, 1>,
};

describe("o vocabulário é o da api, na mesma ordem", () => {
  test.each([
    ["PASSOS", PASSOS, PASSOS_DA_API],
    ["ETAPAS", ETAPAS, PASSOS_DA_API],
    ["PASSOS_PEDIDOS", PASSOS_PEDIDOS, PASSOS_DA_API],
    ["AREAS", AREAS, VOCABULARIO],
    ["TIPOS_DE_POST", TIPOS_DE_POST, VOCABULARIO],
    ["CONVICCOES", CONVICCOES, VOCABULARIO],
    ["ACOES_DA_REVISAO", ACOES_DA_REVISAO, VOCABULARIO],
    ["MOTIVOS_DO_VOTO", MOTIVOS_DO_VOTO, VOCABULARIO],
    ["MOTIVOS_DA_REVISAO", MOTIVOS_DA_REVISAO, VOCABULARIO],
    ["TIPOS_DE_BUSCA", TIPOS_DE_BUSCA, VOCABULARIO],
  ] as const)("%s", (nome, lista, arquivo) => {
    expect([...lista]).toEqual(listaDoArquivo(arquivo, nome));
  });

  test("os números do feed e da mostra", () => {
    expect(POSTS_NO_FEED).toBe(numeroDoArquivo(VOCABULARIO, "POSTS_NO_FEED"));
    expect(PERMANENCIA_MS).toBe(numeroDoArquivo(VOCABULARIO, "PERMANENCIA_MS"));
    expect(POSTS_NO_DESVIO).toBe(numeroDoArquivo(VOCABULARIO, "POSTS_NO_DESVIO"));
    expect(MAX_FRASES_DA_LEGENDA).toBe(numeroDoArquivo(VOCABULARIO, "MAX_FRASES_DA_LEGENDA"));
  });

  test("as frases da legenda (o trecho grifado) se cortam como na api", () => {
    /* A mesma expressão nas duas pontas: a tela oferece a frase i, e a api confere a frase i. */
    const daApi = /\.split\((\/[^\n]*?\/u)\)/.exec(ler(JUSTIFICATIVA))?.[1];
    expect(daApi).toBeDefined();
    expect(frasesDaLegenda.toString()).toContain(daApi ?? "nada");
    expect(frasesDaLegenda("Uma frase. Outra! Mais uma? Fim")).toHaveLength(4);
    expect(TOTAL_DE_PROJETOS).toBe(AREAS.length * numeroDoArquivo(VOCABULARIO, "PROJETOS_POR_AREA"));
  });

  test("quatro blocos, como o esqueleto da api — e os pacotes da curtida não existem mais", () => {
    const conteudo = ler(CONTEUDO);
    const blocos = /export const BLOCOS_DA_CADEIA = \[([\s\S]*?)\] as const/.exec(conteudo)?.[1] ?? "";
    expect([...blocos.matchAll(/posicao: \d/g)]).toHaveLength(TOTAL_DE_BLOCOS);
    /* A EF06CO07 saiu da missão (o pedido do PO): nem o esqueleto nem o passo. */
    expect(conteudo).not.toContain("PACOTES_DA_CURTIDA");
    expect(PASSOS).not.toContain("pacotes");
  });

  test("as três enquetes são as perguntas da ficha, na ordem", () => {
    const perguntas = /perguntas: \[([\s\S]*)\],\s*\};?\s*$/.exec(ler(FICHA))?.[1] ?? "";
    const ids = [...perguntas.matchAll(/^\s{6}id: "(p\d)"/gm)].map((m) => m[1]);
    expect(ids).toEqual([...ENQUETES]);
  });

  test("as habilidades da ficha: EF06CO10 (com a p1), EF06CO01 e EF06CO03 — sem a EF06CO07", () => {
    const ficha = ler(FICHA);
    const codigos = [...ficha.matchAll(/codigo: "(EF\d{2}CO\d{2})"/g)].map((m) => m[1]);
    expect(codigos).toEqual(["EF06CO10", "EF06CO01", "EF06CO03"]);
    expect(ficha).not.toContain('codigo: "EF06CO07"');
  });
});

describe("os campos do espelho são os do contrato", () => {
  test.each([
    ["SessaoSchema", CHAVES.sessao],
    ["FeedSchema", CHAVES.feed],
    ["DesvioSchema", CHAVES.desvio],
    ["PostPublicoSchema", CHAVES.post],
    ["GaleriaSchema", CHAVES.galeria],
    ["ProjetoDaGaleriaSchema", CHAVES.projeto],
  ] as const)("%s", (nome, chaves) => {
    expect(chavesDoSchema(nome)).toEqual(Object.keys(chaves).sort());
  });
});

describe("passoEfetivo — a mesma resposta da api num F5", () => {
  test("todo passo tem tela", () => {
    expect(Object.keys(TELA_DO_PASSO)).toEqual([...PASSOS]);
  });

  test("antes do voto, a etapa não toca a criança", () => {
    for (const etapa of ETAPAS) {
      expect(passoEfetivo("credencial", etapa)).toBe("credencial");
      expect(passoEfetivo("feed", etapa)).toBe("feed");
    }
  });

  test("lacrada espera na exploração e vira galeria quando o professor libera", () => {
    expect(passoEfetivo("lacrada", "exploracao")).toBe("lacrada");
    expect(passoEfetivo("lacrada", "galeria")).toBe("galeria");
    expect(passoEfetivo("lacrada", "desvio")).toBe("galeria");
  });

  test("revisada espera o desvio, e vira desvio quando o professor libera", () => {
    expect(passoEfetivo("revisada", "galeria")).toBe("revisada");
    expect(passoEfetivo("revisada", "desvio")).toBe("desvio");
  });

  test("da revisão em diante, o passo é da criança", () => {
    for (const passo of ["cadeia", "mariana", "enquetes", "fim"] as const) {
      for (const etapa of ETAPAS) expect(passoEfetivo(passo, etapa)).toBe(passo);
    }
  });
});
