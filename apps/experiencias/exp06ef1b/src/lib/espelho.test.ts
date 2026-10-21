import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { PERMANENCIA_MS, TELA_DO_PASSO, passoEfetivo } from "./regras";
import {
  ACOES_DA_REVISAO,
  AREAS,
  CONVICCOES,
  ETAPAS,
  MINUTOS_NO_FEED,
  PASSOS,
  PASSOS_PEDIDOS,
  PECAS_POR_LADO,
  POSTS_NO_FEED,
  TIPOS_DE_BUSCA,
  TIPOS_DE_POST,
  TIPOS_DE_POST_LEGADOS,
  TIPOS_DE_POST_LIDOS,
  TOTAL_DE_PROJETOS,
  type AreaSemCurtidas,
  type Feed,
  type Galeria,
  type PecaDaRegra,
  type PostPublico,
  type ProjetoDaGaleria,
  type RevelacaoDaRegra,
  type Sessao,
  type VistosPorArea,
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
    categorias: 1, feed: 1, voto: 1, revisao: 1, cadeia: 1, concluida: 1,
  } satisfies Record<keyof Sessao, 1>,
  feed: {
    posts: 1, curtidos: 1, salvos: 1, pastas: 1, semPasta: 1, completo: 1, tempoEsgotado: 1, encerraEm: 1,
    cedulaLiberada: 1,
  } satisfies Record<keyof Feed, 1>,
  peca: { id: 1, texto: 1 } satisfies Record<keyof PecaDaRegra, 1>,
  revelacao: { escolha: 1, certa: 1, motivo: 1, area: 1 } satisfies Record<keyof RevelacaoDaRegra, 1>,
  post: {
    id: 1, projetoId: 1, tipo: 1, area: 1, titulo: 1, escola: 1, perfil: 1, texto: 1, legenda: 1, bastidor: 1,
    hashtags: 1, imagem: 1, laminas: 1,
  } satisfies Record<keyof PostPublico, 1>,
  galeria: {
    invisibilidade: 1, porArea: 1, semCurtidas: 1, projetos: 1, ocultosAbertos: 1, podeManter: 1,
  } satisfies Record<keyof Galeria, 1>,
  invisibilidade: { ocultos: 1, total: 1 } satisfies Record<keyof Galeria["invisibilidade"], 1>,
  porArea: { area: 1, vistos: 1, total: 1 } satisfies Record<keyof VistosPorArea, 1>,
  semCurtidas: { area: 1, posts: 1 } satisfies Record<keyof AreaSemCurtidas, 1>,
  projeto: {
    id: 1, area: 1, titulo: 1, escola: 1, perfil: 1, legenda: 1, resumo: 1, hashtags: 1, imagem: 1, laminas: 1, exibidoNoSeuFeed: 1,
  } satisfies Record<keyof ProjetoDaGaleria, 1>,
};

describe("o vocabulário é o da api, na mesma ordem", () => {
  test.each([
    ["PASSOS", PASSOS, PASSOS_DA_API],
    ["ETAPAS", ETAPAS, PASSOS_DA_API],
    ["PASSOS_PEDIDOS", PASSOS_PEDIDOS, PASSOS_DA_API],
    ["AREAS", AREAS, VOCABULARIO],
    ["TIPOS_DE_POST", TIPOS_DE_POST, VOCABULARIO],
    ["TIPOS_DE_POST_LEGADOS", TIPOS_DE_POST_LEGADOS, VOCABULARIO],
    ["CONVICCOES", CONVICCOES, VOCABULARIO],
    ["ACOES_DA_REVISAO", ACOES_DA_REVISAO, VOCABULARIO],
    ["TIPOS_DE_BUSCA", TIPOS_DE_BUSCA, VOCABULARIO],
  ] as const)("%s", (nome, lista, arquivo) => {
    expect([...lista]).toEqual(listaDoArquivo(arquivo, nome));
  });

  test("a leitura aceita o formato servido e os legados, nesta ordem (como `TIPOS_DE_POST_LIDOS` da api)", () => {
    expect(ler(VOCABULARIO)).toContain(
      "export const TIPOS_DE_POST_LIDOS = [...TIPOS_DE_POST, ...TIPOS_DE_POST_LEGADOS] as const;",
    );
    expect([...TIPOS_DE_POST_LIDOS]).toEqual([...TIPOS_DE_POST, ...TIPOS_DE_POST_LEGADOS]);
    expect([...TIPOS_DE_POST]).toEqual(["apresentacao"]);
  });

  test("os números do feed e da mostra", () => {
    expect(POSTS_NO_FEED).toBe(numeroDoArquivo(VOCABULARIO, "POSTS_NO_FEED"));
    expect(PERMANENCIA_MS).toBe(numeroDoArquivo(VOCABULARIO, "PERMANENCIA_MS"));
    expect(MINUTOS_NO_FEED).toBe(numeroDoArquivo(VOCABULARIO, "MINUTOS_NO_FEED"));
    expect(TOTAL_DE_PROJETOS).toBe(AREAS.length * numeroDoArquivo(VOCABULARIO, "PROJETOS_POR_AREA"));
  });

  test("o ciclo do voto da 0.3.0 saiu: sem justificativa, sem complementar, sem rodada de desvio", () => {
    const contrato = ler(CONTRATO);
    expect(contrato).not.toMatch(/export const (DesvioSchema|JustificativaSchema)/);
    expect([...ACOES_DA_REVISAO]).toEqual(["manter", "trocar"]);
    expect(PASSOS).not.toContain("desvio" as never);
    expect(ETAPAS).not.toContain("desvio" as never);
  });

  test("três peças de cada lado da regra, como o esqueleto da api — e a cadeia e os pacotes não existem mais", () => {
    const conteudo = ler(CONTEUDO);
    for (const nome of ["PECAS_DO_SE", "PECAS_DO_ENTAO"]) {
      const pecas = new RegExp(`export const ${nome} = \\[([\\s\\S]*?)\\] as const`).exec(conteudo)?.[1] ?? "";
      expect([...pecas.matchAll(/certa: (true|false)/g)]).toHaveLength(PECAS_POR_LADO);
    }
    expect(conteudo).not.toContain("BLOCOS_DA_CADEIA");
    expect(conteudo).not.toContain("PACOTES_DA_CURTIDA");
    /* O caso Mariana e os cartões saíram (ADR-176): a regra conclui. */
    expect(conteudo).not.toContain("CASO_MARIANA");
    expect(ler(CONTRATO)).not.toMatch(/export const (CartoesSchema|ClassificacaoSchema)/);
    expect(PASSOS).not.toContain("pacotes" as never);
  });

  test("a ficha 6 (ADR-176): EF06CO01 e EF06CO03 por ação, sem pergunta — a EF06CO10 e a EF06CO07 saíram", () => {
    const ficha = ler(FICHA);
    expect(ficha).toContain("versao: 6,");
    const codigos = [...ficha.matchAll(/codigo: "(EF\d{2}CO\d{2})"/g)].map((m) => m[1]);
    expect(codigos).toEqual(["EF06CO01", "EF06CO03"]);
    expect(ficha).toContain("perguntas: [],");
    expect(ficha).not.toContain('codigo: "EF06CO10"');
    expect(ficha).not.toContain('codigo: "EF06CO07"');
  });
});

describe("os campos do espelho são os do contrato", () => {
  test.each([
    ["SessaoSchema", CHAVES.sessao],
    ["FeedSchema", CHAVES.feed],
    ["PecaPublicaSchema", CHAVES.peca],
    ["RevelacaoDaRegraSchema", CHAVES.revelacao],
    ["PostPublicoSchema", CHAVES.post],
    ["GaleriaSchema", CHAVES.galeria],
    ["InvisibilidadeSchema", CHAVES.invisibilidade],
    ["VistosPorAreaSchema", CHAVES.porArea],
    ["AreaSemCurtidasSchema", CHAVES.semCurtidas],
    ["ProjetoDaGaleriaSchema", CHAVES.projeto],
  ] as const)("%s", (nome, chaves) => {
    expect(chavesDoSchema(nome)).toEqual(Object.keys(chaves).sort());
  });
});

describe("passoEfetivo — a mesma resposta da api num F5", () => {
  test("todo passo tem tela", () => {
    expect(Object.keys(TELA_DO_PASSO)).toEqual([...PASSOS]);
  });

  test("antes do voto, a etapa não toca a criança — nem na separação antiga da 0.6.0", () => {
    for (const etapa of ETAPAS) {
      expect(passoEfetivo("credencial", etapa)).toBe("credencial");
      expect(passoEfetivo("feed", etapa)).toBe("feed");
      expect(passoEfetivo("classificacao", etapa)).toBe("classificacao");
    }
  });

  test("lacrada espera na exploração e vira galeria quando o professor libera", () => {
    expect(passoEfetivo("lacrada", "exploracao")).toBe("lacrada");
    expect(passoEfetivo("lacrada", "galeria")).toBe("galeria");
  });

  test("da revisão em diante, o passo é da criança", () => {
    for (const passo of ["revisada", "cadeia", "mariana", "enquetes", "fim"] as const) {
      for (const etapa of ETAPAS) expect(passoEfetivo(passo, etapa)).toBe(passo);
    }
  });
});
